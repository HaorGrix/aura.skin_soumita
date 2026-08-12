/* =================================================================== *
 * skin.theory — connect Flash Sales (admin) to the real storefront
 * -------------------------------------------------------------------
 * The `sales` table (0002_admin_foundation.sql) and its admin screen
 * have existed for a while with nothing on the storefront reading them —
 * `sale_price_snapshots` even anticipated a "burn the discount into
 * products.price_minor, then restore from snapshot when it ends" design
 * that was never built. That approach was abandoned here in favour of
 * the same pattern coupons already use: compute LIVE, at read time,
 * never write a temporary price into the source-of-truth row. An admin
 * edit (new campaign, changed %, early end) is then correct everywhere
 * on the very next fetch, with nothing to forget to revert.
 *
 * Two new pieces:
 *   1. best_sale_price_minor() — one function, reused by both the public
 *      products_public view (storefront display) AND place_order() (what
 *      is actually charged), so those two can never disagree. Picks the
 *      highest-priority sale (ties broken by newest) whose scope matches
 *      the product and whose window is live right now.
 *   2. list_active_sales() — campaign metadata (name, badge, image,
 *      banner text, window) for the homepage's "Glow deals" grid. Same
 *      is_active + window filter as (1), so a card can never show while
 *      its discount isn't actually being applied.
 * =================================================================== */

alter table public.sales add column if not exists image_path  text;
alter table public.sales add column if not exists badge_label text;

-- -------------------------------------------------------------------
-- 1. best_sale_price_minor — one product's price after the best currently
--    running sale that applies to it, or null if none applies.
-- -------------------------------------------------------------------
create or replace function public.best_sale_price_minor(
  p_base_price_minor int,
  p_product_id       uuid,
  p_category_id      uuid,
  p_brand            text
) returns int
language sql stable security definer set search_path = public as $$
  select case
           when s.kind = 'percent'
             then greatest(round(p_base_price_minor * (1 - coalesce(s.value_percent, 0) / 100.0))::int, 0)
           else greatest(p_base_price_minor - coalesce(s.value_minor, 0), 0)
         end
  from public.sales s
  where s.is_active
    and s.starts_at <= now()
    and s.ends_at   >= now()
    and (
      coalesce((s.scope ->> 'all')::boolean, false)
      or (p_product_id  is not null and s.scope -> 'products'   ? p_product_id::text)
      or (p_category_id is not null and s.scope -> 'categories' ? p_category_id::text)
      or (p_brand        is not null and s.scope -> 'brands'     ? p_brand)
    )
  order by s.priority desc, s.starts_at desc
  limit 1;
$$;

comment on function public.best_sale_price_minor is
  'Highest-priority active sale price for one product, or null — shared by products_public and place_order() so display and checkout never disagree.';

-- -------------------------------------------------------------------
-- 2. products_public — add the live sale price + which sale it's from,
--    on top of every existing column (0023_product_video.sql's shape).
-- -------------------------------------------------------------------
create or replace view public.products_public as
SELECT p.id,
    p.slug,
    p.name,
    p.subtitle,
    p.description,
    p.how_to_use,
    p.brand,
    c.name AS category,
    p.tone,
    p.is_new,
    p.popularity,
    p.price_minor,
    p.compare_at_minor,
    p.max_per_order,
    p.concern,
    p.skin_type,
    p.ingredients,
    p.stock > 0 OR p.backorder_ok AS in_stock,
    p.stock > 0 AND p.stock <= p.low_stock_at AS is_low_stock,
    p.compare_at_minor IS NOT NULL AND p.compare_at_minor > p.price_minor AS is_on_sale,
        CASE
            WHEN p.compare_at_minor > p.price_minor THEN round((1::numeric - p.price_minor::numeric / p.compare_at_minor::numeric) * 100::numeric)::integer
            ELSE 0
        END AS discount_percent,
        CASE
            WHEN p.stock > 0 THEN p.sales_count
            ELSE 0
        END AS sales_count,
    (rank() OVER (ORDER BY (
        CASE
            WHEN p.stock > 0 THEN p.sales_count
            ELSE 0
        END) DESC) <= 10) OR p.is_best_seller_manual AS is_best_seller,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('path', i.storage_path, 'alt', i.alt) ORDER BY i."position") AS jsonb_agg
           FROM product_images i
          WHERE i.product_id = p.id), '[]'::jsonb) AS gallery,
    p.rating,
    p.review_count,
    p.is_staff_pick,
    p.is_limited_edition,
    p.video_url,
    sp.new_price_minor AS sale_price_minor,
    sp.sale_id AS active_sale_id
   FROM products p
     JOIN categories c ON c.id = p.category_id
     LEFT JOIN LATERAL (
       select s.id as sale_id,
              public.best_sale_price_minor(p.price_minor, p.id, p.category_id, p.brand) as new_price_minor
       from public.sales s
       where s.is_active and s.starts_at <= now() and s.ends_at >= now()
         and (
           coalesce((s.scope ->> 'all')::boolean, false)
           or s.scope -> 'products'   ? p.id::text
           or s.scope -> 'categories' ? p.category_id::text
           or s.scope -> 'brands'     ? p.brand
         )
       order by s.priority desc, s.starts_at desc
       limit 1
     ) sp ON true
  WHERE p.status = 'active'::text AND c.is_active;

-- -------------------------------------------------------------------
-- 3. list_active_sales — campaign cards for the homepage grid. Public,
--    read-only, and deliberately narrow (no created_by/internal fields) —
--    same "why an RPC, not a wider RLS policy" reasoning as coupons
--    (0015_lock_down_coupons_table.sql, 0030_validate_coupon_rpc.sql).
-- -------------------------------------------------------------------
create or replace function public.list_active_sales()
returns table (
  id             uuid,
  name           text,
  kind           text,
  value_percent  numeric,
  value_minor    int,
  scope          jsonb,
  banner_text    text,
  badge_label    text,
  image_path     text,
  show_countdown boolean,
  priority       int,
  starts_at      timestamptz,
  ends_at        timestamptz
)
language sql stable security definer set search_path = public as $$
  select id, name, kind, value_percent, value_minor, scope, banner_text, badge_label, image_path,
         show_countdown, priority, starts_at, ends_at
  from public.sales
  where is_active and starts_at <= now() and ends_at >= now()
  order by priority desc, starts_at desc;
$$;

grant execute on function public.best_sale_price_minor(int, uuid, uuid, text) to anon, authenticated;
grant execute on function public.list_active_sales() to anon, authenticated;

-- -------------------------------------------------------------------
-- 4. place_order() — apply the same best_sale_price_minor() at the line
--    level, so what's charged always matches what products_public just
--    showed. Full redefinition (plpgsql functions replace whole-body),
--    based on 0038_shipping_methods.sql's version with ONLY the pricing
--    lines changed — everything else (shipping/coupon/customer/points)
--    is untouched.
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
  -- ---------------------------------------------------------------
  -- Shipping method/zone come from real, admin-managed tables — the
  -- client sends WHICH method/zone it wants, never what it costs. Both
  -- are re-read here and the zone's price_minor is what's actually
  -- charged; a tampered/stale client price is never trusted. Omitting
  -- shipping_method_id falls back to the lowest-sort_order active
  -- method (today's single "Home Delivery"), so an older cached client
  -- keeps working unchanged.
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
  end if;

  return v_order;
end $$;

grant execute on function public.place_order(jsonb) to anon, authenticated;

-- -------------------------------------------------------------------
-- VERIFY
--   select sale_price_minor, active_sale_id, price_minor from products_public
--   where id = '<a product in an active sale''s scope>';
--   -- expect: sale_price_minor < price_minor, active_sale_id = that sale
--
--   select * from list_active_sales();
--   -- expect: only sales with is_active and now() between starts_at/ends_at
--
--   place an order containing that product with no coupon
--   -- expect: order_items.unit_price_minor = sale_price_minor, not price_minor
-- ===================================================================
