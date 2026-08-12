-- ===================================================================
-- skin.theory — server-side enforcement of coupons.required_points
-- -------------------------------------------------------------------
-- Loyalty coupons (SKN3/SKN5/SKN8FS-style, required_points set) have only
-- ever been gated CLIENT-side (CartContext.applyPromo comparing the
-- account's points to result.requiredPoints). Neither
-- validate_coupon_preview() nor place_order() has ever actually checked
-- it — a documented gap since 0007_seed_coupons.sql's own note ("roadmap
-- item 8"). A crafted request straight to either RPC/function could apply
-- a loyalty discount without having earned it.
--
-- Fixes all three functions that touch coupon eligibility, so nothing is
-- left checking it in only one place while the others stay bypassable:
--
--   place_order()            — MANDATORY. v_email is a required field by
--                               this point, so there's no "can't confirm
--                               yet" case; insufficient points now raises
--                               COUPON_INVALID:not_unlocked, same as every
--                               other coupon rejection reason.
--   validate_coupon_preview() — same rule, but only checked once p_email
--                               is provided — mirrors how first_order_only
--                               already works in this exact function: a
--                               guest browsing Cart before Checkout can't
--                               be confirmed either way yet, so the
--                               preview stays optimistic. place_order()
--                               is what actually closes the loop.
--   list_eligible_coupons()  — same "can't confirm without email, list it
--                               anyway" rule, consistent with how it
--                               already treats first_order_only.
--
-- Points are looked up directly from `customers.points` by email — NOT
-- passed in as a parameter — so a client can never claim a points total
-- for someone else. `place_order()` doesn't yet have a resolved
-- customer_id at the point the coupon block runs (customer resolution
-- happens later in the function), so this looks up by email directly,
-- same as the first_order_only/usage_limit_per_customer checks already
-- do in that same block.
--
-- HOW TO APPLY: Supabase Dashboard -> SQL Editor -> paste -> Run.
-- ===================================================================

-- -------------------------------------------------------------------
-- 1. place_order() — full redefinition (current source: 0026), with the
--    required_points check added into the existing coupon block. No
--    other line changes from 0026's version.
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
  v_customer_points  int := 0;             -- NEW
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

    -- NEW: required_points, enforced server-side for the first time.
    -- v_email is mandatory by this point in the function, so there's no
    -- "can't confirm yet" case the way the preview RPCs have to allow for.
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
  elsif coalesce(payload ->> 'shipping_method', 'standard') = 'express' then
    v_shipping := coalesce(v_settings.express_shipping_minor, 0);
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
  end if;

  return v_order;
end $$;

grant execute on function public.place_order(jsonb) to anon, authenticated;

-- -------------------------------------------------------------------
-- 2. validate_coupon_preview() — full redefinition (current source:
--    0030), required_points check added inside the existing "only once
--    we have an email" block, alongside first_order_only.
-- -------------------------------------------------------------------
create or replace function public.validate_coupon_preview(
  p_code text,
  p_subtotal_minor integer default 0,
  p_email text default null
)
returns table (
  valid               boolean,
  reason              text,
  code                text,
  kind                text,
  value_percent       numeric,
  value_minor         integer,
  max_discount_minor  integer,
  also_free_shipping  boolean,
  min_subtotal_minor  integer,
  first_order_only    boolean,
  required_points     integer
)
language plpgsql security definer set search_path = public as $$
declare
  v_code text := upper(trim(coalesce(p_code, '')));
  v_coupon public.coupons%rowtype;
  v_prior_orders int := 0;
  v_used_by_customer int := 0;
  v_customer_points int := 0;    -- NEW
begin
  if v_code = '' then
    return query select false, 'unknown', v_code, null::text, null::numeric, null::int, null::int, null::boolean, null::int, null::boolean, null::int;
    return;
  end if;

  select c.* into v_coupon from public.coupons c where c.code = v_code;
  if not found then
    return query select false, 'unknown', v_code, null::text, null::numeric, null::int, null::int, null::boolean, null::int, null::boolean, null::int;
    return;
  end if;

  if not v_coupon.is_active then
    reason := 'inactive';
  elsif v_coupon.starts_at is not null and now() < v_coupon.starts_at then
    reason := 'not_started';
  elsif v_coupon.ends_at is not null and now() > v_coupon.ends_at then
    reason := 'expired';
  elsif coalesce(p_subtotal_minor, 0) < coalesce(v_coupon.min_subtotal_minor, 0) then
    reason := 'min_subtotal';
  elsif v_coupon.usage_limit is not null and v_coupon.used_count >= v_coupon.usage_limit then
    reason := 'exhausted';
  end if;

  -- Per-customer checks (including, now, required_points) only run once we
  -- actually have an email — a guest browsing Cart before Checkout won't
  -- yet. place_order() re-checks all of these unconditionally regardless
  -- of what this preview said.
  if reason is null and p_email is not null and trim(p_email) <> '' then
    if v_coupon.required_points is not null then
      select coalesce(max(points), 0) into v_customer_points
        from public.customers where email = trim(p_email);
      if v_customer_points < v_coupon.required_points then
        reason := 'not_unlocked';
      end if;
    end if;

    if reason is null then
      select count(*) into v_prior_orders from public.orders o
        where o.email = trim(p_email) and o.status <> 'cancelled';
      if v_coupon.first_order_only and v_prior_orders > 0 then
        reason := 'first_order_only';
      else
        select count(*) into v_used_by_customer
          from public.coupon_redemptions r join public.orders o on o.id = r.order_id
         where r.coupon_id = v_coupon.id and o.email = trim(p_email);
        if v_used_by_customer >= coalesce(v_coupon.usage_limit_per_customer, 1) then
          reason := 'already_used';
        end if;
      end if;
    end if;
  end if;

  return query select
    (reason is null), reason, v_coupon.code::text, v_coupon.kind::text, v_coupon.value_percent,
    v_coupon.value_minor, v_coupon.max_discount_minor, v_coupon.also_free_shipping,
    v_coupon.min_subtotal_minor, v_coupon.first_order_only, v_coupon.required_points;
end $$;

grant execute on function public.validate_coupon_preview(text, integer, text) to anon, authenticated;

-- -------------------------------------------------------------------
-- 3. list_eligible_coupons() — full redefinition (current source: 0034),
--    required_points filter added, same "can't confirm without an email,
--    list it anyway" rule already applied to first_order_only there.
-- -------------------------------------------------------------------
create or replace function public.list_eligible_coupons(
  p_subtotal_minor integer default 0,
  p_email          text default null
)
returns table (
  code                text,
  kind                text,
  value_percent       numeric,
  value_minor         integer,
  max_discount_minor  integer,
  also_free_shipping  boolean,
  min_subtotal_minor  integer,
  first_order_only    boolean,
  required_points     integer
)
language plpgsql security definer set search_path = public as $$
declare
  v_email text := nullif(trim(coalesce(p_email, '')), '');
begin
  return query
  select
    c.code::text, c.kind::text, c.value_percent, c.value_minor, c.max_discount_minor,
    c.also_free_shipping, c.min_subtotal_minor, c.first_order_only, c.required_points
  from public.coupons c
  where c.is_active
    and (c.starts_at is null or now() >= c.starts_at)
    and (c.ends_at is null or now() <= c.ends_at)
    and coalesce(p_subtotal_minor, 0) >= coalesce(c.min_subtotal_minor, 0)
    and (c.usage_limit is null or c.used_count < c.usage_limit)
    and (
      c.required_points is null
      or v_email is null  -- can't confirm yet — list it, place_order() is the real gate
      or (select coalesce(max(cu.points), 0) from public.customers cu where cu.email = v_email) >= c.required_points
    )
    and (
      not c.first_order_only
      or v_email is null
      or not exists (
        select 1 from public.orders o
         where o.email = v_email and o.status <> 'cancelled'
      )
    )
    and (
      v_email is null
      or (
        select count(*) from public.coupon_redemptions r
          join public.orders o on o.id = r.order_id
         where r.coupon_id = c.id and o.email = v_email
      ) < coalesce(c.usage_limit_per_customer, 1)
    )
  order by coalesce(c.value_percent, 0) desc, coalesce(c.value_minor, 0) desc;
end $$;

grant execute on function public.list_eligible_coupons(integer, text) to anon, authenticated;

-- -------------------------------------------------------------------
-- VERIFY
--   -- pick a real loyalty coupon (required_points set) and a customer
--   -- email known to have FEWER points than it requires:
--   select * from validate_coupon_preview('AURA5', 0, 'low-points-customer@example.com');
--   -- expect: valid=false, reason='not_unlocked'
--
--   select * from list_eligible_coupons(0, 'low-points-customer@example.com');
--   -- expect: AURA5 NOT in the results
--
--   -- same coupon, no email (guest):
--   select * from list_eligible_coupons(0, null);
--   -- expect: AURA5 still listed (can't confirm without an account)
--
--   -- attempt an actual order via place_order() with that coupon code
--   -- and that low-points customer's email:
--   -- expect: error COUPON_INVALID:not_unlocked, no order/rows written
-- ===================================================================
