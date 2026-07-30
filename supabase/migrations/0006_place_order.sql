-- ===================================================================
-- aura.skin — place_order(): the checkout transaction
-- -------------------------------------------------------------------
-- Roadmap item 3, and the single biggest gap in the system. Until now
-- checkout wrote to localStorage: no order was ever recorded server-side,
-- stock never moved on a sale, the Orders/Customers screens could never
-- have data, and cancelling an order ADDED inventory that was never
-- deducted.
--
-- DESIGN RULES
--
--   1. The client is never trusted for money. It sends product ids and
--      quantities; every price, discount, shipping cost and total is read
--      or computed from the database. A tampered cart cannot change what
--      is charged or what is recorded.
--
--   2. One transaction. Stock check, stock decrement, order, line items,
--      ledger entries, coupon redemption and the status event either all
--      happen or none do. A failure halfway cannot leave stock reduced
--      with no order, or an order with no stock movement.
--
--   3. Rows are locked with SELECT … FOR UPDATE in a deterministic order
--      (by product id). That is what actually stops two shoppers buying
--      the same last unit, and ordering the locks consistently is what
--      stops two concurrent checkouts deadlocking each other.
--
--   4. Totals are frozen. order_items copies the product name, brand,
--      price and image, so an order still reads correctly after the
--      catalog is renamed, repriced or archived.
--
-- PAYLOAD
--   {
--     "email": "a@b.com",
--     "items": [{ "slug": "cosrx-…", "quantity": 2 }],   -- or "product_id"
--     "shipping_address": { … },
--     "payment_method": "cod" | "card" | "bkash",
--     "shipping_method": "standard" | "express",
--     "coupon_code": "SAVE10"        -- optional
--   }
--
-- ERRORS (raised as exceptions; the client maps them to messages)
--   EMPTY_CART · EMAIL_REQUIRED · PRODUCT_NOT_FOUND:<ref>
--   PRODUCT_UNAVAILABLE:<slug> · INSUFFICIENT_STOCK:<slug>:<available>
--   MAX_PER_ORDER:<slug>:<max> · COUPON_INVALID:<reason>
--
-- HOW TO APPLY: Supabase Dashboard → SQL Editor → paste → Run.
-- ===================================================================


-- Human-friendly, non-guessable-ish order numbers: AUR-000001, AUR-000002…
create sequence if not exists public.order_number_seq start 1001;


create or replace function public.place_order(payload jsonb)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email            citext;
  v_item             jsonb;
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
  v_order            public.orders;
  v_free_shipping    boolean := false;
  v_image            text;
  v_prior_orders     int := 0;
  v_used_by_customer int := 0;
  v_points_earned    int := 0;
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

  select * into v_settings from public.store_settings where id = true;

  ------------------------------------------------------------------
  -- Lock every product row up front, in a deterministic order.
  --
  -- Sorting by product id means concurrent checkouts always take locks in
  -- the same sequence, so two overlapping orders queue instead of
  -- deadlocking. Locking BEFORE any write means the stock check and the
  -- decrement cannot be separated by another transaction.
  ------------------------------------------------------------------
  for v_item in
    select value from jsonb_array_elements(payload -> 'items') as t(value)
    order by coalesce(
      (value ->> 'product_id'),
      (select p.id::text from public.products p where p.slug = value ->> 'slug'
          or p.legacy_id = value ->> 'slug' limit 1)
    )
  loop
    v_qty := greatest(coalesce((v_item ->> 'quantity')::int, 1), 1);

    select * into v_product
      from public.products
     where (v_item ? 'product_id' and id = (v_item ->> 'product_id')::uuid)
        or (v_item ? 'slug' and (slug = v_item ->> 'slug' or legacy_id = v_item ->> 'slug'))
     limit 1
     for update;

    if not found then
      raise exception 'PRODUCT_NOT_FOUND:%', coalesce(v_item ->> 'slug', v_item ->> 'product_id');
    end if;

    if v_product.status <> 'active' then
      raise exception 'PRODUCT_UNAVAILABLE:%', v_product.slug;
    end if;

    if v_qty > v_product.max_per_order then
      raise exception 'MAX_PER_ORDER:%:%', v_product.slug, v_product.max_per_order;
    end if;

    if v_product.stock < v_qty and not v_product.backorder_ok then
      raise exception 'INSUFFICIENT_STOCK:%:%', v_product.slug, v_product.stock;
    end if;

    -- Price comes from the row we just locked, never from the payload.
    v_subtotal := v_subtotal + (v_product.price_minor * v_qty);
  end loop;

  ------------------------------------------------------------------
  -- Coupon — validated server-side, including limits the UI can't enforce
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

    select count(*) into v_prior_orders from public.orders o
      where o.email = v_email and o.status <> 'cancelled';
    if v_coupon.first_order_only and v_prior_orders > 0 then
      raise exception 'COUPON_INVALID:first_order_only';
    end if;

    select count(*) into v_used_by_customer
      from public.coupon_redemptions r
      join public.orders o on o.id = r.order_id
     where r.coupon_id = v_coupon.id and o.email = v_email;
    if v_used_by_customer >= coalesce(v_coupon.usage_limit_per_customer, 1) then
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
  -- Shipping + tax, from store_settings (the admin's Settings screen)
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
  -- Customer: link to the signed-in user if there is one, else guest-by-email
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
    -- Cash on delivery is unpaid until it is actually collected. Anything
    -- else stays 'unpaid' too until a real payment webhook says otherwise —
    -- this function must never assert that money arrived.
    'unpaid',
    v_subtotal, v_discount, v_shipping, v_tax, v_total,
    nullif(v_code, ''), coalesce(payload -> 'shipping_address', '{}'::jsonb)
  ) returning * into v_order;

  ------------------------------------------------------------------
  -- Line items + stock movement, from the rows locked earlier
  ------------------------------------------------------------------
  for v_item in select value from jsonb_array_elements(payload -> 'items') as t(value)
  loop
    v_qty := greatest(coalesce((v_item ->> 'quantity')::int, 1), 1);

    select * into v_product
      from public.products
     where (v_item ? 'product_id' and id = (v_item ->> 'product_id')::uuid)
        or (v_item ? 'slug' and (slug = v_item ->> 'slug' or legacy_id = v_item ->> 'slug'))
     limit 1;

    select storage_path into v_image
      from public.product_images
     where product_id = v_product.id
     order by position asc limit 1;

    insert into public.order_items (
      order_id, product_id, product_name, product_slug, brand_name,
      image_path, unit_price_minor, quantity, line_total_minor
    ) values (
      v_order.id, v_product.id, v_product.name, v_product.slug, v_product.brand,
      v_image, v_product.price_minor, v_qty, v_product.price_minor * v_qty
    );

    update public.products
       set stock = greatest(stock - v_qty, 0), updated_at = now()
     where id = v_product.id;

    insert into public.inventory_movements (product_id, delta, reason, order_id, note)
    values (v_product.id, -v_qty, 'sale', v_order.id, 'order ' || v_order.number);
  end loop;

  ------------------------------------------------------------------
  -- Coupon redemption + opening status event
  ------------------------------------------------------------------
  if v_coupon.id is not null then
    insert into public.coupon_redemptions (coupon_id, order_id, customer_id, discount_minor)
    values (v_coupon.id, v_order.id, v_customer_id, v_discount);

    update public.coupons set used_count = used_count + 1 where id = v_coupon.id;
  end if;

  insert into public.order_events (order_id, from_status, to_status, note)
  values (v_order.id, null, 'pending', 'Order placed');

  -- Loyalty: points_per_taka is per TAKA, and totals are in paisa.
  v_points_earned := floor((v_total / 100.0) * coalesce(v_settings.points_per_taka, 0));
  if v_points_earned > 0 then
    update public.customers set points = points + v_points_earned where id = v_customer_id;
  end if;

  return v_order;
end $$;


-- Guests must be able to check out, so anon may call it. The function is
-- SECURITY DEFINER and validates everything itself; the direct-insert policy
-- on `orders` stays denied, so this remains the only way an order is created.
grant execute on function public.place_order(jsonb) to anon, authenticated;

-- Let a customer read back the order they just placed. Without this the
-- success page can only show what place_order returned, and "my orders"
-- for a signed-in shopper shows nothing.
drop policy if exists orders_own_read on public.orders;
create policy orders_own_read on public.orders for select
  using (
    public.is_staff('support')
    or (auth.uid() is not null
        and customer_id in (select id from public.customers where auth_user_id = auth.uid()))
  );

drop policy if exists order_items_own_read on public.order_items;
create policy order_items_own_read on public.order_items for select
  using (
    public.is_staff('support')
    or order_id in (
      select o.id from public.orders o
      join public.customers c on c.id = o.customer_id
      where c.auth_user_id = auth.uid()
    )
  );


-- -------------------------------------------------------------------
-- VERIFY
--   select place_order('{
--     "email":"test@example.com",
--     "items":[{"slug":"<any active slug>","quantity":1}],
--     "payment_method":"cod",
--     "shipping_address":{"name":"Test","line1":"1 St","city":"Dhaka"}
--   }'::jsonb);
--
--   -- stock should drop by 1 and a ledger row should exist:
--   select stock from products where slug = '<slug>';
--   select delta, reason from inventory_movements order by created_at desc limit 1;
-- -------------------------------------------------------------------
