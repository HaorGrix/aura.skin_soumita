-- ===================================================================
-- skin.theory — server-side input validation + fix a real regression
-- -------------------------------------------------------------------
-- URGENT, SELF-INFLICTED BUG FIRST: 0044_revenue_and_refund_reversal.sql
-- redefined place_order() using 0037's body as its base. But 0038
-- (shipping_methods) and 0039 (flash_sales_storefront) BOTH redefined
-- place_order() again AFTER 0037, adding real shipping_method_id/
-- shipping_zone_id validation+pricing and flash-sale line pricing
-- (best_sale_price_minor()). 0044 silently reverted both of those —
-- since 2026-08-15 (when 0044 was applied), every live checkout has
-- been charging the OLD flat standard_shipping_minor instead of the
-- real selected zone's price, and NOT applying any running flash-sale
-- discount at the line level, even though products_public correctly
-- showed the discounted price. This migration's place_order() is based
-- on 0039's body (the true latest) with ONLY points_earned (0044) and
-- the new validation below added — nothing else changed, nothing else
-- lost this time.
--
-- Then, the actually-requested work — server-side validation, so a
-- direct API call bypassing the frontend can't write malformed data:
--   - email: format-checked (mirrors src/lib/email-validation.js's
--     regex) and disposable-domain-blocked, same generic EMAIL_INVALID
--     either way (never distinguish "disposable" to the caller — same
--     reasoning as the client-side check).
--   - phone: now REQUIRED and must normalize via normalize_bd_phone()
--     (previously optional, only consulted for coupon-abuse checks).
--   - shipping address fields: reasonable length caps, so a raw API
--     call can't plant a multi-KB string into name/address/city/postal.
--
-- And a review length cap: submit_review() and the reviews table only
-- ever enforced a MINIMUM body length — no maximum existed anywhere,
-- so a direct RPC call could write an arbitrarily large review.
-- ===================================================================

-- -------------------------------------------------------------------
-- 0. Disposable email domain check — mirrors
--    src/lib/email-validation.js's DISPOSABLE_DOMAINS set exactly, so
--    the server rejects the same providers the client already warns
--    about. Kept as its own function (not inlined) so the list only
--    needs updating in one place if it needs to grow later.
-- -------------------------------------------------------------------
create or replace function public.is_disposable_email_domain(p_domain text)
returns boolean
language sql immutable as $$
  select exists (
    select 1 from unnest(array[
      'mailinator.com','mailinator.net','mailinator.org',
      'guerrillamail.com','guerrillamail.net','guerrillamail.org','guerrillamail.biz',
      'guerrillamailblock.com','sharklasers.com','grr.la','spam4.me','pokemail.net',
      '10minutemail.com','10minutemail.net','10minutemail.co.za','20minutemail.com',
      'temp-mail.org','tempmail.com','tempmail.net','tempmail.plus','tempmailo.com',
      'tempmail.dev','tmpmail.org','tmpmail.net','tmpeml.com',
      'throwawaymail.com','throwawaymail.net','getnada.com','nada.email',
      'yopmail.com','yopmail.fr','yopmail.net','cool.fr.nf','jetable.fr.nf',
      'trashmail.com','trashmail.net','trashmail.me','trash-mail.com',
      'dispostable.com','fakeinbox.com','fakemailgenerator.com','maildrop.cc',
      'mintemail.com','mytemp.email','moakt.com','mohmal.com',
      'emailondeck.com','spamgourmet.com','getairmail.com','mail-temporaire.fr',
      'minuteinbox.com','meltmail.com','burnermail.io','inboxbear.com',
      'correotemporal.org','einrot.com','einrot.de','wegwerfemail.de',
      'byom.de','spambog.com','spambog.de','spambog.ru','discard.email',
      'discardmail.com','discardmail.de','mailnesia.com','mailcatch.com',
      'anonaddy.me','33mail.com','emailfake.com','fakemail.net'
    ]) as d(domain)
    where lower(p_domain) = d.domain or lower(p_domain) like ('%.' || d.domain)
  );
$$;

-- -------------------------------------------------------------------
-- 1. place_order() — full redefinition. Base is 0039's version (the
--    TRUE latest before this migration — see header above), plus:
--      a) points_earned persistence (carried over from 0044)
--      b) NEW: email format + disposable-domain validation
--      c) NEW: phone now required, must normalize
--      d) NEW: shipping address field length caps
-- -------------------------------------------------------------------
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

  -- NEW: format + disposable-domain check. Mirrors
  -- src/lib/email-validation.js's EMAIL_RE (no lookaround support in
  -- Postgres regex, so the "no leading/trailing/double dot" rules are
  -- split into explicit checks instead of a single lookahead pattern).
  -- Single generic error either way — matches the client's own
  -- deliberate refusal to say "disposable" out loud.
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
  -- NEW: phone was previously optional (only consulted for coupon-abuse
  -- checks) — now required and must be a real BD number, closing the
  -- direct-API-call gap the client's own required PhoneInput doesn't
  -- protect against.
  if v_phone_normalized is null then
    raise exception 'PHONE_INVALID';
  end if;

  -- NEW: reasonable length caps on the free-text shipping fields — the
  -- client's own inputs are already this bounded (or tighter, e.g.
  -- postal's 4-digit maxLength); this just closes the same gap for a
  -- raw API call that skips the UI entirely.
  if length(coalesce(payload -> 'shipping_address' ->> 'name', '')) > 100
     or length(coalesce(payload -> 'shipping_address' ->> 'address', '')) > 200
     or length(coalesce(payload -> 'shipping_address' ->> 'city', '')) > 80
     or length(coalesce(payload -> 'shipping_address' ->> 'postal', '')) > 20
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
-- 2. submit_review() — add an upper length cap. Only a MINIMUM ever
--    existed (rating range + body >= 4 chars, both already enforced by
--    the table's CHECK constraints and this function). A direct RPC
--    call could otherwise write an arbitrarily large title/body.
-- -------------------------------------------------------------------
alter table public.reviews
  add constraint reviews_body_max_length check (char_length(body) <= 3000);
alter table public.reviews
  add constraint reviews_title_max_length check (title is null or char_length(title) <= 200);

create or replace function public.submit_review(
  p_order_item_id uuid,
  p_rating         int,
  p_title          text,
  p_body           text
)
returns public.reviews
language plpgsql security definer set search_path = public as $$
declare
  v_email          citext;
  v_order          record;
  v_order_item     record;
  v_customer_name  text;
  v_points         int;
  v_review         public.reviews;
begin
  if auth.uid() is null then
    raise exception 'NOT_VERIFIED';
  end if;

  v_email := lower(auth.jwt() ->> 'email');
  if v_email is null or v_email = '' then
    raise exception 'NOT_VERIFIED';
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'INVALID_RATING';
  end if;
  if p_body is null or char_length(trim(p_body)) < 4 then
    raise exception 'INVALID_BODY';
  end if;
  -- NEW: upper bounds, checked here for a clear error code — the table's
  -- CHECK constraints above are the real backstop for any other path.
  if char_length(p_body) > 3000 then
    raise exception 'INVALID_BODY';
  end if;
  if p_title is not null and char_length(p_title) > 200 then
    raise exception 'INVALID_TITLE';
  end if;

  select oi.id, oi.product_id, oi.order_id
    into v_order_item
    from public.order_items oi
   where oi.id = p_order_item_id;
  if not found then
    raise exception 'ORDER_ITEM_NOT_FOUND';
  end if;

  select o.email, o.status, o.customer_id
    into v_order
    from public.orders o
   where o.id = v_order_item.order_id;
  if not found or v_order.email is null then
    raise exception 'ORDER_ITEM_NOT_FOUND';
  end if;

  if lower(v_order.email) <> v_email then
    raise exception 'NOT_YOUR_ORDER';
  end if;

  if v_order.status <> 'delivered' then
    raise exception 'NOT_DELIVERED';
  end if;

  select coalesce(full_name, split_part(v_email::text, '@', 1))
    into v_customer_name
    from public.customers where id = v_order.customer_id;

  begin
    insert into public.reviews (
      product_id, order_item_id, customer_id, email, display_name, rating, title, body
    ) values (
      v_order_item.product_id, v_order_item.id, v_order.customer_id, v_email,
      coalesce(v_customer_name, 'Verified Buyer'),
      p_rating, nullif(trim(coalesce(p_title, '')), ''), trim(p_body)
    )
    returning * into v_review;
  exception when unique_violation then
    raise exception 'ALREADY_REVIEWED';
  end;

  select points_per_review into v_points from public.store_settings where id = true;
  if coalesce(v_points, 0) > 0 and v_order.customer_id is not null then
    update public.customers set points = points + v_points where id = v_order.customer_id;
  end if;

  update public.products p set
    review_count = (select count(*) from public.reviews r where r.product_id = p.id and r.status = 'approved'),
    rating = (select round(avg(r.rating)::numeric, 2) from public.reviews r where r.product_id = p.id and r.status = 'approved')
  where p.id = v_order_item.product_id;

  return v_review;
end $$;

grant execute on function public.submit_review(uuid, int, text, text) to authenticated;

-- -------------------------------------------------------------------
-- VERIFY
--   -- place_order regression fix:
--   select sale_price_minor from products_public where id = '<product in an active sale>';
--   -- then place an order for that product with no coupon — order_items.unit_price_minor
--   -- for that line should equal sale_price_minor, not the full price_minor.
--
--   -- place an order with a real shipping_method_id/shipping_zone_id -> orders.shipping_minor
--   -- should equal that zone's price_minor, not store_settings.standard_shipping_minor.
--
--   -- new validation:
--   select place_order('{"email":"not-an-email","items":[...]}'::jsonb);  -- EMAIL_INVALID
--   select place_order('{"email":"x@mailinator.com","items":[...]}'::jsonb);  -- EMAIL_INVALID
--   select place_order('{"email":"real@gmail.com","items":[...], "shipping_address":{}}'::jsonb);
--     -- no phone -> PHONE_INVALID
--
--   -- review length cap:
--   select submit_review('<order_item_id>', 5, null, repeat('a', 3001));  -- INVALID_BODY
-- ===================================================================
