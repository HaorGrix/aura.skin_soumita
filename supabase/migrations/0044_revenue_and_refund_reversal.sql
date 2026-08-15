-- ===================================================================
-- skin.theory — dashboard revenue audit: 3 real bugs found and fixed
-- -------------------------------------------------------------------
-- Live audit against professional e-commerce standards (pending orders
-- must never count as revenue; refunds must reverse everything they
-- triggered). Confirmed via direct testing, not assumed:
--
-- BUG 1 — admin_stats() counted 'pending' AND 'refunded' orders as
--   revenue. Its only filter was `status <> 'cancelled'`. A brand-new,
--   unconfirmed order inflated "Revenue today" the instant it was
--   placed, and refunding a delivered order never reversed the figure.
--
-- BUG 2 — set_order_status() treated 'delivered' as fully terminal
--   (`v_from in ('delivered','refunded','cancelled')` blocked ANY further
--   transition), which made refunding a delivered order categorically
--   impossible through this system. Confirmed live: attempting
--   delivered -> refunded raised TERMINAL_STATUS:delivered every time.
--   This is a real, standard flow (a customer returns a delivered item)
--   that had no path to completion at all.
--
-- BUG 3 — place_order() awards loyalty points and records coupon usage
--   the moment an order is PLACED (status='pending'), not when it's
--   confirmed/delivered. Cancelling or refunding an order never reversed
--   either: a customer keeps points for an order they never actually
--   paid for, and a once-per-customer coupon stays permanently "used" by
--   an order that didn't go through. orders.points_earned didn't exist,
--   so there was no reliable way to know how many points to claw back
--   even if reversal code existed.
--
-- Note on order statuses: the real order_status enum, confirmed live
-- (not assumed) is: pending, processing, shipped, delivered, cancelled,
-- refunded. There is no 'confirmed' status in this system.
-- ===================================================================

-- -------------------------------------------------------------------
-- 0. Store exactly how many points an order granted, so a later
--    cancel/refund can claw back the EXACT amount — recomputing it at
--    reversal time would drift if points_per_taka changed in between.
-- -------------------------------------------------------------------
alter table public.orders add column if not exists points_earned int not null default 0;

-- -------------------------------------------------------------------
-- 1. place_order() — full redefinition (current source: 0037), with
--    ONLY the points_earned persistence added (the two lines marked NEW
--    below). No other line differs from 0037's version.
-- -------------------------------------------------------------------
create or replace function public.place_order(payload jsonb)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email            citext;
  v_item             jsonb;
  v_variant          public.product_variants%rowtype;
  v_product          public.products%rowtype;
  v_qty              int;
  v_subtotal         int := 0;
  v_discount         int := 0;
  v_shipping         int := 0;
  v_tax              int := 0;
  v_total            int;
  v_settings         public.store_settings%rowtype;
  v_coupon           public.coupons%rowtype;
  v_code             citext;
  v_customer_id      uuid;
  v_customer_points  int := 0;
  v_order            public.orders;
  v_free_shipping    boolean := false;
  v_image            text;
  v_prior_orders     int := 0;
  v_used_by_customer int := 0;
  v_points_earned    int := 0;
  v_phone_normalized text;
  v_phone_already_used boolean := false;
begin
  ------------------------------------------------------------------
  -- Validate the shape of the request
  ------------------------------------------------------------------
  v_email := lower(trim(payload ->> 'email'));
  if v_email is null or v_email = '' then raise exception 'EMAIL_REQUIRED'; end if;

  if payload -> 'items' is null
     or jsonb_typeof(payload -> 'items') <> 'array'
     or jsonb_array_length(payload -> 'items') = 0 then
    raise exception 'EMPTY_CART';
  end if;

  v_phone_normalized := public.normalize_bd_phone(payload -> 'shipping_address' ->> 'phone');

  select * into v_settings from public.store_settings where id = true;

  ------------------------------------------------------------------
  -- Resolve every line to a variant, then lock those variant rows in a
  -- deterministic order (by variant id) before any write.
  ------------------------------------------------------------------
  for v_item in
    select value from jsonb_array_elements(payload -> 'items') as t(value)
    order by coalesce(
      value ->> 'variant_id',
      (select pv.id::text from public.product_variants pv
        join public.products p on p.id = pv.product_id
       where (p.slug = value ->> 'slug' or p.legacy_id = value ->> 'slug')
         and pv.is_default
       limit 1)
    )
  loop
    v_qty := greatest(coalesce((v_item ->> 'quantity')::int, 1), 1);

    if v_item ? 'variant_id' then
      select * into v_variant from public.product_variants
       where id = (v_item ->> 'variant_id')::uuid
       for update;
    else
      select pv.* into v_variant
        from public.product_variants pv
        join public.products p on p.id = pv.product_id
       where (p.slug = v_item ->> 'slug' or p.legacy_id = v_item ->> 'slug')
         and pv.is_default
       for update;
    end if;

    if not found then
      raise exception 'VARIANT_NOT_FOUND:%', coalesce(v_item ->> 'slug', v_item ->> 'variant_id');
    end if;

    select * into v_product from public.products where id = v_variant.product_id;

    if v_product.status <> 'active' then
      raise exception 'PRODUCT_UNAVAILABLE:%', v_product.slug;
    end if;

    if v_qty > v_product.max_per_order then
      raise exception 'MAX_PER_ORDER:%:%', v_product.slug, v_product.max_per_order;
    end if;

    if v_variant.stock_quantity < v_qty and not v_product.backorder_ok then
      raise exception 'INSUFFICIENT_STOCK:%:%', v_product.slug, v_variant.stock_quantity;
    end if;

    v_subtotal := v_subtotal + (v_variant.price_minor * v_qty);
  end loop;

  ------------------------------------------------------------------
  -- Coupon
  ------------------------------------------------------------------
  v_code := upper(trim(coalesce(payload ->> 'coupon_code', '')));
  if v_code <> '' then
    select * into v_coupon from public.coupons where code = v_code;

    if not found then raise exception 'COUPON_INVALID:unknown'; end if;
    if not v_coupon.is_active then raise exception 'COUPON_INVALID:inactive'; end if;
    if v_coupon.starts_at is not null and now() < v_coupon.starts_at then
      raise exception 'COUPON_INVALID:not_started';
    end if;
    if v_coupon.ends_at is not null and now() > v_coupon.ends_at then
      raise exception 'COUPON_INVALID:expired';
    end if;
    if v_subtotal < coalesce(v_coupon.min_subtotal_minor, 0) then
      raise exception 'COUPON_INVALID:min_subtotal';
    end if;
    if v_coupon.usage_limit is not null and v_coupon.used_count >= v_coupon.usage_limit then
      raise exception 'COUPON_INVALID:exhausted';
    end if;

    if v_coupon.required_points is not null then
      select coalesce(max(points), 0) into v_customer_points
        from public.customers where email = v_email;
      if v_customer_points < v_coupon.required_points then
        raise exception 'COUPON_INVALID:not_unlocked';
      end if;
    end if;

    select count(*) into v_prior_orders from public.orders o
      where o.email = v_email and o.status <> 'cancelled';
    if v_coupon.first_order_only and v_prior_orders > 0 then
      raise exception 'COUPON_INVALID:first_order_only';
    end if;

    select count(*) into v_used_by_customer
      from public.coupon_redemptions r
      join public.orders o on o.id = r.order_id
     where r.coupon_id = v_coupon.id and o.email = v_email;

    if v_phone_normalized is not null then
      select exists(
        select 1 from public.coupon_phone_redemptions cpr
         where cpr.coupon_id = v_coupon.id
           and cpr.phone_normalized = v_phone_normalized
           and cpr.confirmed
      ) into v_phone_already_used;
    end if;

    if v_used_by_customer >= coalesce(v_coupon.usage_limit_per_customer, 1)
       or v_phone_already_used then
      raise exception 'COUPON_INVALID:already_used';
    end if;

    if v_coupon.kind = 'percent' then
      v_discount := floor(v_subtotal * coalesce(v_coupon.value_percent, 0) / 100.0);
      if v_coupon.max_discount_minor is not null then
        v_discount := least(v_discount, v_coupon.max_discount_minor);
      end if;
    elsif v_coupon.kind = 'fixed' then
      v_discount := least(coalesce(v_coupon.value_minor, 0), v_subtotal);
    end if;

    v_free_shipping := (v_coupon.kind = 'free_shipping') or coalesce(v_coupon.also_free_shipping, false);
  end if;

  ------------------------------------------------------------------
  -- Shipping + tax
  ------------------------------------------------------------------
  if v_free_shipping
     or (v_subtotal - v_discount) >= coalesce(v_settings.free_shipping_threshold_minor, 0) then
    v_shipping := 0;
  else
    v_shipping := coalesce(v_settings.standard_shipping_minor, 0);
  end if;

  v_tax   := floor((v_subtotal - v_discount) * coalesce(v_settings.tax_rate, 0));
  v_total := (v_subtotal - v_discount) + v_shipping + v_tax;

  ------------------------------------------------------------------
  -- Customer
  ------------------------------------------------------------------
  if auth.uid() is not null then
    select id into v_customer_id from public.customers where auth_user_id = auth.uid();
    if v_customer_id is null then
      insert into public.customers (auth_user_id, email, full_name, phone)
      values (auth.uid(), v_email,
              nullif(payload -> 'shipping_address' ->> 'name', ''),
              nullif(payload -> 'shipping_address' ->> 'phone', ''))
      returning id into v_customer_id;
    end if;
  else
    select id into v_customer_id
      from public.customers where email = v_email and auth_user_id is null limit 1;
    if v_customer_id is null then
      insert into public.customers (email, full_name, phone)
      values (v_email,
              nullif(payload -> 'shipping_address' ->> 'name', ''),
              nullif(payload -> 'shipping_address' ->> 'phone', ''))
      returning id into v_customer_id;
    end if;
  end if;

  ------------------------------------------------------------------
  -- The order
  ------------------------------------------------------------------
  insert into public.orders (
    number, customer_id, email, status, payment_method, payment_status,
    subtotal_minor, discount_minor, shipping_minor, tax_minor, total_minor,
    coupon_code, shipping_address
  ) values (
    'AUR-' || lpad(nextval('public.order_number_seq')::text, 6, '0'),
    v_customer_id, v_email, 'pending',
    coalesce(payload ->> 'payment_method', 'cod'),
    'unpaid',
    v_subtotal, v_discount, v_shipping, v_tax, v_total,
    nullif(v_code, ''), coalesce(payload -> 'shipping_address', '{}'::jsonb)
  ) returning * into v_order;

  ------------------------------------------------------------------
  -- Line items + stock movement
  ------------------------------------------------------------------
  for v_item in select value from jsonb_array_elements(payload -> 'items') as t(value)
  loop
    v_qty := greatest(coalesce((v_item ->> 'quantity')::int, 1), 1);

    if v_item ? 'variant_id' then
      select * into v_variant from public.product_variants where id = (v_item ->> 'variant_id')::uuid;
    else
      select pv.* into v_variant
        from public.product_variants pv
        join public.products p on p.id = pv.product_id
       where (p.slug = v_item ->> 'slug' or p.legacy_id = v_item ->> 'slug')
         and pv.is_default;
    end if;

    select * into v_product from public.products where id = v_variant.product_id;

    select storage_path into v_image
      from public.product_images
     where product_id = v_product.id
     order by position asc limit 1;

    insert into public.order_items (
      order_id, product_id, variant_id, product_name, product_slug, brand_name,
      size_label, image_path, unit_price_minor, quantity, line_total_minor
    ) values (
      v_order.id, v_product.id, v_variant.id, v_product.name, v_product.slug, v_product.brand,
      v_variant.size_label, v_image, v_variant.price_minor, v_qty, v_variant.price_minor * v_qty
    );

    update public.product_variants
       set stock_quantity = greatest(stock_quantity - v_qty, 0), updated_at = now()
     where id = v_variant.id;

    insert into public.inventory_movements (product_id, variant_id, delta, reason, order_id, note)
    values (v_product.id, v_variant.id, -v_qty, 'sale', v_order.id, 'order ' || v_order.number);
  end loop;

  ------------------------------------------------------------------
  -- Coupon redemption + opening status event
  ------------------------------------------------------------------
  if v_coupon.id is not null then
    insert into public.coupon_redemptions (coupon_id, order_id, customer_id, discount_minor)
    values (v_coupon.id, v_order.id, v_customer_id, v_discount);

    update public.coupons set used_count = used_count + 1 where id = v_coupon.id;

    if v_phone_normalized is not null then
      insert into public.coupon_phone_redemptions (coupon_id, phone_normalized, order_id, confirmed)
      values (v_coupon.id, v_phone_normalized, v_order.id, false);
    end if;
  end if;

  insert into public.order_events (order_id, from_status, to_status, note)
  values (v_order.id, null, 'pending', 'Order placed');

  v_points_earned := floor((v_total / 100.0) * coalesce(v_settings.points_per_taka, 0));
  if v_points_earned > 0 then
    update public.customers set points = points + v_points_earned where id = v_customer_id;
    -- NEW: persist exactly what was granted, so set_order_status() can
    -- claw back this EXACT amount on a later cancel/refund rather than
    -- recomputing against (possibly since-changed) settings.
    update public.orders set points_earned = v_points_earned where id = v_order.id;
    v_order.points_earned := v_points_earned;
  end if;

  return v_order;
end $$;

grant execute on function public.place_order(jsonb) to anon, authenticated;

-- -------------------------------------------------------------------
-- 2. set_order_status() — full redefinition (current source: 0026),
--    with three changes:
--      a) delivered can now move to refunded specifically (previously
--         blocked outright — see BUG 2 above). Still fully terminal for
--         every other transition, and cancelled/refunded remain
--         terminal with no exceptions.
--      b) on arrival at cancelled OR refunded: claws back the points
--         this order granted (GREATEST-clamped so a customer's balance
--         can never go negative from this), and undoes its coupon
--         usage — deletes the coupon_redemptions row (so
--         first-order/per-customer limits forget this attempt) and
--         decrements coupons.used_count, and deletes any
--         coupon_phone_redemptions row (whether it had been confirmed
--         by a prior delivery or not).
--      c) everything else (restock, the delivered->confirms-phone-flag
--         block) is unchanged.
-- -------------------------------------------------------------------
create or replace function public.set_order_status(
  p_order_id uuid, p_status text, p_note text default null
) returns public.orders language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders;
  v_from text;
  v_item record;
  v_variant_id uuid;
  v_coupon_id uuid;
begin
  if not public.is_staff('support') then raise exception 'FORBIDDEN'; end if;

  select status::text into v_from from public.orders where id = p_order_id for update;
  if v_from is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_from = p_status then raise exception 'NO_CHANGE'; end if;

  -- CHANGED: delivered's only legal next status is refunded (a return
  -- after delivery is a normal e-commerce flow) — every other
  -- transition out of delivered stays blocked, and cancelled/refunded
  -- are still fully terminal with no exceptions.
  if v_from in ('refunded', 'cancelled') or (v_from = 'delivered' and p_status <> 'refunded') then
    raise exception 'TERMINAL_STATUS:%', v_from;
  end if;

  update public.orders
     set status = p_status::order_status,
         cancelled_at = case when p_status in ('cancelled','refunded') then now() else cancelled_at end
   where id = p_order_id
  returning * into v_order;

  insert into public.order_events (order_id, from_status, to_status, note, actor_id)
  values (p_order_id, v_from::order_status, p_status::order_status, p_note, auth.uid());

  if p_status in ('cancelled','refunded') then
    -- Restock (unchanged from 0026)
    for v_item in select product_id, variant_id, quantity from public.order_items
                   where order_id = p_order_id and product_id is not null loop
      v_variant_id := coalesce(
        v_item.variant_id,
        (select id from public.product_variants where product_id = v_item.product_id and is_default)
      );

      if v_variant_id is not null then
        update public.product_variants
           set stock_quantity = stock_quantity + v_item.quantity, updated_at = now()
         where id = v_variant_id;
      end if;

      insert into public.inventory_movements (product_id, variant_id, delta, reason, order_id, actor_id, note)
      values (v_item.product_id, v_variant_id, v_item.quantity, 'cancel', p_order_id, auth.uid(), 'auto-restock on ' || p_status);
    end loop;

    -- NEW: claw back exactly the points this order granted at checkout.
    -- points_earned is 0 for orders placed before this migration (the
    -- column's default), so a pre-existing order simply reverses
    -- nothing extra — never a negative surprise.
    if v_order.points_earned > 0 and v_order.customer_id is not null then
      update public.customers
         set points = greatest(points - v_order.points_earned, 0)
       where id = v_order.customer_id;
    end if;

    -- NEW: undo the coupon usage this order recorded, so a
    -- first-order-only or per-customer-limit coupon doesn't stay
    -- permanently consumed by an order that never went through.
    if v_order.coupon_code is not null then
      delete from public.coupon_redemptions
       where order_id = p_order_id
      returning coupon_id into v_coupon_id;

      if v_coupon_id is not null then
        update public.coupons
           set used_count = greatest(used_count - 1, 0)
         where id = v_coupon_id;
      end if;

      delete from public.coupon_phone_redemptions where order_id = p_order_id;
    end if;
  end if;

  -- Confirm the phone-based discount flag, only on arrival at
  -- 'delivered' (unchanged from 0026).
  if p_status = 'delivered' then
    update public.coupon_phone_redemptions
       set confirmed = true, confirmed_at = now()
     where order_id = p_order_id and not confirmed;
  end if;

  return v_order;
end $$;

grant execute on function public.set_order_status(uuid,text,text) to authenticated;

-- -------------------------------------------------------------------
-- 3. admin_stats() — fix the revenue filter. Was `status <> 'cancelled'`
--    (counted pending AND refunded); now only counts orders that
--    represent an actual, uncancelled, unrefunded sale in progress or
--    completed. Because this is a live SUM computed fresh on every call
--    (not a stored/cached counter), a refund or cancellation reverses
--    the figure automatically on the very next dashboard load — nothing
--    to separately "subtract".
-- -------------------------------------------------------------------
create or replace function public.admin_stats()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not public.is_staff('support') then '{}'::jsonb else jsonb_build_object(
    'orders_today',    (select count(*) from orders where placed_at >= current_date),
    'revenue_today',   (select coalesce(sum(total_minor),0) from orders
                          where placed_at >= current_date
                            and status in ('processing','shipped','delivered')),
    'revenue_30d',     (select coalesce(sum(total_minor),0) from orders
                          where placed_at >= current_date - 30
                            and status in ('processing','shipped','delivered')),
    'pending_orders',  (select count(*) from orders where status in ('pending','processing')),
    'total_products',  (select count(*) from products where status = 'active'),
    'low_stock',       (select count(*) from products where status='active' and stock > 0 and stock <= low_stock_at),
    'out_of_stock',    (select count(*) from products where status='active' and stock = 0),
    'customers',       (select count(*) from customers),
    'active_coupons',  (select count(*) from coupons where is_active
                          and (ends_at is null or ends_at > now()))
  ) end;
$$;

-- -------------------------------------------------------------------
-- VERIFY
--   -- place an order (status starts 'pending') -> admin_stats()'s
--   -- revenue_today must NOT include it yet.
--   select revenue_today from ... -- (call admin_stats() as staff)
--
--   -- set_order_status(id, 'processing') -> revenue_today now includes it.
--   -- set_order_status(id, 'delivered')  -> still included, unchanged.
--   -- set_order_status(id, 'refunded')   -> revenue_today drops back out,
--   --   customers.points is reduced by exactly points_earned, and (if a
--   --   coupon was used) coupons.used_count decrements and the
--   --   coupon_redemptions/coupon_phone_redemptions rows for this order
--   --   are gone.
--
--   -- separately: place another order, set_order_status(id, 'cancelled')
--   --   directly from 'pending' -> must succeed (was always allowed),
--   --   revenue_today must never have included it, points/coupon
--   --   reversal still applies.
-- ===================================================================
