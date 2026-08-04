-- ===================================================================
-- skin.script — place_order(), rewritten to operate on variants
-- -------------------------------------------------------------------
-- Supersedes 0006_place_order.sql's version. Same design rules as before
-- (client never trusted for money, one transaction, rows locked FOR
-- UPDATE in a deterministic order, totals frozen into order_items) — the
-- only thing that changes is WHAT gets locked and priced: a variant, not
-- a product.
--
-- PAYLOAD (variant_id preferred; slug-only still works and resolves to
-- that product's default variant, so nothing that predates variants breaks)
--   {
--     "email": "a@b.com",
--     "items": [
--       { "variant_id": "…", "quantity": 2 },
--       { "slug": "cosrx-…", "quantity": 1 }          -- resolves to default variant
--     ],
--     "shipping_address": { … },
--     "payment_method": "cod" | "card" | "bkash",
--     "shipping_method": "standard" | "express",
--     "coupon_code": "SAVE10"
--   }
--
-- ERRORS — VARIANT_NOT_FOUND replaces PRODUCT_NOT_FOUND at the item level;
-- everything else is unchanged from 0006.
--
-- HOW TO APPLY: Supabase Dashboard → SQL Editor → paste → Run.
-- ===================================================================

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
  -- Resolve every line to a variant, then lock those variant rows in a
  -- deterministic order (by variant id) before any write — same reasoning
  -- as before: consistent lock order avoids deadlocks between two
  -- concurrent checkouts, and locking before the stock check is what
  -- actually prevents overselling the last unit.
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
      -- No variant specified — resolve to the named product's default.
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

    -- Price comes from the VARIANT row we just locked, never the payload.
    v_subtotal := v_subtotal + (v_variant.price_minor * v_qty);
  end loop;

  ------------------------------------------------------------------
  -- Coupon — unchanged from 0006
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
  -- Shipping + tax — unchanged from 0006
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
  -- Customer — unchanged from 0006
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
  -- The order — unchanged from 0006
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
  -- Line items + stock movement — now per VARIANT
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
  -- Coupon redemption + opening status event — unchanged from 0006
  ------------------------------------------------------------------
  if v_coupon.id is not null then
    insert into public.coupon_redemptions (coupon_id, order_id, customer_id, discount_minor)
    values (v_coupon.id, v_order.id, v_customer_id, v_discount);

    update public.coupons set used_count = used_count + 1 where id = v_coupon.id;
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
-- VERIFY
--   select place_order('{
--     "email":"test@example.com",
--     "items":[{"variant_id":"<a real product_variants.id>","quantity":1}],
--     "payment_method":"cod",
--     "shipping_address":{"name":"Test","line1":"1 St","city":"Dhaka"}
--   }'::jsonb);
--
--   select stock_quantity from product_variants where id = '<same id>';
--     -- should be 1 lower
--   select variant_id, size_label, unit_price_minor from order_items
--    order by created_at desc limit 1;
--     -- variant_id populated, size_label matches
-- -------------------------------------------------------------------
