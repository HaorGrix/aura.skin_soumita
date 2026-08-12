-- ===================================================================
-- skin.theory — configurable shipping methods + zone-based pricing
-- -------------------------------------------------------------------
-- Replaces the single store_settings.standard_shipping_minor figure with
-- a real admin-managed table: multiple shipping methods (Home Delivery,
-- Courier Hub Pickup, …), each either flat-priced or priced per zone
-- (Inside Dhaka / Inside Sylhet / Outside Dhaka-Sylhet, etc). A method
-- with exactly one zone (empty matching_districts) IS today's flat-price
-- behaviour — no special-casing needed anywhere that reads this data.
--
-- RLS mirrors store_settings' own pattern exactly (0002_admin_foundation.
-- sql): public read (checkout needs to price a cart before any auth
-- exists), admin-only write. Price lists aren't sensitive data — same
-- reasoning that already justifies store_settings_public_read.
--
-- HOW TO APPLY: Supabase Dashboard -> SQL Editor -> paste -> Run.
-- ===================================================================

-- -------------------------------------------------------------------
-- 1. Tables
-- -------------------------------------------------------------------
create table if not exists public.shipping_methods (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  is_active   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.shipping_zones (
  id                  uuid primary key default gen_random_uuid(),
  method_id           uuid not null references public.shipping_methods(id) on delete cascade,
  zone_name           text not null,
  price_minor         int  not null check (price_minor >= 0),
  -- District/area keywords this zone matches against the shopper's typed
  -- city (case-insensitive substring match — see resolveShippingZone() in
  -- lib/api/shipping.js). Empty array = catch-all / flat-rate zone,
  -- always evaluated last so specific zones win when they match.
  matching_districts  text[] not null default '{}',
  sort_order          int not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists shipping_zones_method_idx on public.shipping_zones (method_id, sort_order);

alter table public.shipping_methods enable row level security;
alter table public.shipping_zones   enable row level security;

drop policy if exists shipping_methods_public_read on public.shipping_methods;
create policy shipping_methods_public_read on public.shipping_methods for select using (true);
drop policy if exists shipping_methods_admin_write on public.shipping_methods;
create policy shipping_methods_admin_write on public.shipping_methods for all
  using (public.is_staff('admin')) with check (public.is_staff('admin'));

drop policy if exists shipping_zones_public_read on public.shipping_zones;
create policy shipping_zones_public_read on public.shipping_zones for select using (true);
drop policy if exists shipping_zones_admin_write on public.shipping_zones;
create policy shipping_zones_admin_write on public.shipping_zones for all
  using (public.is_staff('admin')) with check (public.is_staff('admin'));

-- -------------------------------------------------------------------
-- 2. Seed — migrate the current flat standard_shipping_minor into a
--    single "Home Delivery" method with one catch-all zone, so nothing
--    changes for an existing store that hasn't touched the new admin
--    screen yet. Only runs once (guarded by a name check), so re-running
--    this migration is harmless.
-- -------------------------------------------------------------------
do $$
declare
  v_method_id uuid;
  v_standard_minor int;
begin
  if not exists (select 1 from public.shipping_methods where name = 'Home Delivery') then
    select standard_shipping_minor into v_standard_minor from public.store_settings where id = true;

    insert into public.shipping_methods (name, description, is_active, sort_order)
    values ('Home Delivery', 'Delivered to your door.', true, 0)
    returning id into v_method_id;

    insert into public.shipping_zones (method_id, zone_name, price_minor, matching_districts, sort_order)
    values (v_method_id, 'Flat rate', coalesce(v_standard_minor, 10000), '{}', 0);
  end if;
end $$;

-- -------------------------------------------------------------------
-- 3. orders — record which method/zone were actually charged, for
--    record-keeping (order detail, reporting). Nullable + ON DELETE SET
--    NULL so deleting a method/zone later never blocks deleting it and
--    never corrupts a historical order's own shipping_minor/shipping_address.
-- -------------------------------------------------------------------
alter table public.orders add column if not exists shipping_method_id uuid references public.shipping_methods(id) on delete set null;
alter table public.orders add column if not exists shipping_zone_id   uuid references public.shipping_zones(id) on delete set null;

-- -------------------------------------------------------------------
-- 4. place_order() — full redefinition (current source: 0037), with the
--    shipping block replaced: it now resolves shipping_method_id +
--    shipping_zone_id from the payload, VALIDATES them against the live
--    tables (never trusts a client-submitted price), and stores which
--    method/zone were used. No other line differs from 0037's version.
--
--    Backward compatible: if the payload omits shipping_method_id (an
--    older/cached client), it falls back to the lowest-sort_order active
--    method and its own lowest-sort_order zone — today's single "Home
--    Delivery" flat price, automatically.
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
  -- ---------------------------------------------------------------
  -- CHANGED (0038): shipping method/zone now come from real, admin-
  -- managed tables — the client sends WHICH method/zone it wants, never
  -- what it costs. Both are re-read here and the zone's price_minor is
  -- what's actually charged; a tampered/stale client price is never
  -- trusted. Omitting shipping_method_id falls back to the lowest-
  -- sort_order active method (today's single "Home Delivery"), so an
  -- older cached client keeps working unchanged.
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
-- VERIFY
--   -- default (no shipping_method_id sent) still charges today's
--   -- Home Delivery flat rate:
--   select shipping_minor from place_order('{"email":"t@example.com", ...}');
--   -- expect: equals the Flat rate zone's price_minor
--
--   -- add a second method via the admin Shipping screen (e.g. "Courier
--   -- Hub Pickup", flat ৳50), place an order with its shipping_method_id
--   -- -- expect shipping_minor = 5000
--
--   -- send a shipping_zone_id that belongs to a DIFFERENT method than
--   -- shipping_method_id -- expect exception SHIPPING_ZONE_INVALID
--
--   -- send a shipping_method_id for a method with is_active = false
--   -- -- expect exception SHIPPING_METHOD_INVALID
-- ===================================================================
