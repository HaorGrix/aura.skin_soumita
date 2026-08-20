-- ===================================================================
-- skin.theory — fix ADDRESS_INVALID checking the wrong payload keys
-- -------------------------------------------------------------------
-- 0045 added shipping-address length caps, but checked
-- shipping_address ->> 'address' and ->> 'postal'. The real client
-- (src/pages/Checkout.jsx) has never sent those keys — it sends
-- line1 / line2 / area / postcode. coalesce(...,'') on a key that
-- never exists always evaluates to '', so the address/postal length
-- checks have been dead code since 0045 shipped: verified live by
-- submitting a 250-character address through the real checkout UI —
-- it went through uncapped. A direct RPC call using the correct keys
-- (address/postal) DID get rejected, confirming the check logic
-- itself was fine — only the key names were wrong.
--
-- Full place_order() redefinition (current source: 0045), with ONLY
-- the validation block's field names/caps changed to match what's
-- actually sent — name, line1, line2, area, city, postcode, country.
-- No other line differs from 0045's version.
--
-- HOW TO APPLY: Supabase Dashboard -> SQL Editor -> paste -> Run.
-- ===================================================================

create or replace function public.place_order(payload jsonb)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email            citext;
  v_local            text;
  v_domain           text;
  v_item             jsonb;
  v_variant          public.product_variants%rowtype;
  v_product          public.products%rowtype;
  v_qty              int;
  v_line_price       int;
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
  v_ship_method_id   uuid;
  v_ship_zone_id     uuid;
  v_ship_method      public.shipping_methods%rowtype;
  v_ship_zone        public.shipping_zones%rowtype;
begin
  ------------------------------------------------------------------
  -- Validate the shape of the request
  ------------------------------------------------------------------
  v_email := lower(trim(payload ->> 'email'));
  if v_email is null or v_email = '' then raise exception 'EMAIL_REQUIRED'; end if;

  if position('@' in v_email) = 0
     or (length(v_email) - length(replace(v_email, '@', ''))) <> 1
     or v_email like '%..%'
  then
    raise exception 'EMAIL_INVALID';
  end if;

  v_local  := split_part(v_email, '@', 1);
  v_domain := split_part(v_email, '@', 2);

  if v_local = ''
     or v_local like '.%' or v_local like '%.'
     or v_local !~ '^[A-Za-z0-9.!#$%&''*+/=?^_`{|}~-]+$'
     or v_domain !~ '^([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?$'
  then
    raise exception 'EMAIL_INVALID';
  end if;

  if public.is_disposable_email_domain(v_domain) then
    raise exception 'EMAIL_INVALID';
  end if;

  if payload -> 'items' is null
     or jsonb_typeof(payload -> 'items') <> 'array'
     or jsonb_array_length(payload -> 'items') = 0 then
    raise exception 'EMPTY_CART';
  end if;

  v_phone_normalized := public.normalize_bd_phone(payload -> 'shipping_address' ->> 'phone');
  if v_phone_normalized is null then
    raise exception 'PHONE_INVALID';
  end if;

  -- FIXED: these are the keys Checkout.jsx actually sends (see
  -- shippingAddress in src/pages/Checkout.jsx's placeOrderRpc call) —
  -- name, line1, line2, area, city, postcode, country. 0045 checked
  -- 'address' and 'postal', which don't exist in the real payload, so
  -- those two caps never fired. Caps chosen to comfortably exceed any
  -- legitimate value while still closing the raw-API-call gap:
  --   name       <= 100   line1/line2/area <= 200   city <= 80
  --   postcode   <= 10     country          <= 60
  if length(coalesce(payload -> 'shipping_address' ->> 'name', '')) > 100
     or length(coalesce(payload -> 'shipping_address' ->> 'line1', '')) > 200
     or length(coalesce(payload -> 'shipping_address' ->> 'line2', '')) > 200
     or length(coalesce(payload -> 'shipping_address' ->> 'area', '')) > 200
     or length(coalesce(payload -> 'shipping_address' ->> 'city', '')) > 80
     or length(coalesce(payload -> 'shipping_address' ->> 'postcode', '')) > 10
     or length(coalesce(payload -> 'shipping_address' ->> 'country', '')) > 60
  then
    raise exception 'ADDRESS_INVALID';
  end if;

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

    -- Flash-sale price, if a currently-running sale applies to this
    -- product — never higher than the variant's own price, so a
    -- misconfigured sale can only ever discount, not surcharge.
    v_line_price := least(
      v_variant.price_minor,
      coalesce(
        public.best_sale_price_minor(v_variant.price_minor, v_product.id, v_product.category_id, v_product.brand),
        v_variant.price_minor
      )
    );

    v_subtotal := v_subtotal + (v_line_price * v_qty);
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
  v_ship_method_id := nullif(payload ->> 'shipping_method_id', '')::uuid;
  v_ship_zone_id   := nullif(payload ->> 'shipping_zone_id', '')::uuid;

  if v_ship_method_id is not null then
    select * into v_ship_method from public.shipping_methods
     where id = v_ship_method_id and is_active;
    if not found then raise exception 'SHIPPING_METHOD_INVALID'; end if;
  else
    select * into v_ship_method from public.shipping_methods
     where is_active order by sort_order asc, created_at asc limit 1;
    if not found then raise exception 'SHIPPING_METHOD_INVALID'; end if;
  end if;

  if v_ship_zone_id is not null then
    select * into v_ship_zone from public.shipping_zones
     where id = v_ship_zone_id and method_id = v_ship_method.id;
    if not found then raise exception 'SHIPPING_ZONE_INVALID'; end if;
  else
    select * into v_ship_zone from public.shipping_zones
     where method_id = v_ship_method.id
     order by sort_order asc, created_at asc limit 1;
    if not found then raise exception 'SHIPPING_ZONE_INVALID'; end if;
  end if;

  if v_free_shipping
     or (v_subtotal - v_discount) >= coalesce(v_settings.free_shipping_threshold_minor, 0) then
    v_shipping := 0;
  else
    v_shipping := v_ship_zone.price_minor;
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
    coupon_code, shipping_address, shipping_method_id, shipping_zone_id
  ) values (
    'AUR-' || lpad(nextval('public.order_number_seq')::text, 6, '0'),
    v_customer_id, v_email, 'pending',
    coalesce(payload ->> 'payment_method', 'cod'),
    'unpaid',
    v_subtotal, v_discount, v_shipping, v_tax, v_total,
    nullif(v_code, ''), coalesce(payload -> 'shipping_address', '{}'::jsonb),
    v_ship_method.id, v_ship_zone.id
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

    v_line_price := least(
      v_variant.price_minor,
      coalesce(
        public.best_sale_price_minor(v_variant.price_minor, v_product.id, v_product.category_id, v_product.brand),
        v_variant.price_minor
      )
    );

    insert into public.order_items (
      order_id, product_id, variant_id, product_name, product_slug, brand_name,
      size_label, image_path, unit_price_minor, quantity, line_total_minor
    ) values (
      v_order.id, v_product.id, v_variant.id, v_product.name, v_product.slug, v_product.brand,
      v_variant.size_label, v_image, v_line_price, v_qty, v_line_price * v_qty
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
    update public.orders set points_earned = v_points_earned where id = v_order.id;
    v_order.points_earned := v_points_earned;
  end if;

  return v_order;
end $$;

grant execute on function public.place_order(jsonb) to anon, authenticated;

-- -------------------------------------------------------------------
-- VERIFY
--   -- oversized line1 (the exact field the real checkout sends) is
--   -- now correctly rejected:
--   select place_order('{"email":"real@gmail.com","items":[{"slug":"<a real slug>","quantity":1}],
--     "shipping_address":{"phone":"01712345678","line1":"' || repeat('A', 250) || '","city":"Dhaka"}}'::jsonb);
--   -- expect: ADDRESS_INVALID
--
--   -- a normal, real-length address still succeeds unchanged.
-- ===================================================================
