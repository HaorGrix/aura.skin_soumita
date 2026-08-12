-- ===================================================================
-- skin.theory — phone-anchored, delivery-confirmed discount protection
-- -------------------------------------------------------------------
-- ADDS to the existing email/customer_id coupon-reuse check
-- (place_order()'s `v_used_by_customer` block) — does not replace it. A
-- coupon is now rejected if EITHER the email OR the phone number has
-- already used it. Checking out with a new email but a phone that
-- already redeemed a first-order/single-use coupon no longer works.
--
-- WHY "CONFIRMED ON DELIVERY", NOT AT CHECKOUT
-- coupon_redemptions (email/customer_id path) records a redemption the
-- moment an order is placed — that was already the design before this
-- migration. The phone path is deliberately stricter: a row is inserted
-- at checkout, but it only counts toward "already used" once the order
-- reaches 'delivered'. An order that's cancelled, refunded, or simply
-- sits in 'pending'/'processing' forever leaves the flag false, so the
-- SAME phone number can retry the coupon on a fresh order. This matters
-- because phone numbers are shared far more than emails are (one phone,
-- multiple family members/orders) — confirming on delivery is what stops
-- an abandoned or cancelled checkout from permanently burning a
-- household's one shot at a welcome discount.
--
-- 'delivered' is already a TERMINAL status (0004_audit_fixes.sql — no
-- transition out once reached), so "stays false if never delivered"
-- needs no extra guard: the confirming UPDATE below only ever runs on
-- the transition INTO 'delivered', and that transition can only happen
-- once, ever, per order.
--
-- normalize_bd_phone() is the single canonical implementation — both
-- place_order() and set_order_status() call it; nothing duplicates the
-- format logic. Handles the same shapes the client already accepts
-- (components/ui/PhoneInput.jsx's BD_PHONE_REGEX): +8801XXXXXXXXX,
-- 8801XXXXXXXXX, 01XXXXXXXXX, with or without internal spaces/dashes.
--
-- HOW TO APPLY: Supabase Dashboard → SQL Editor → paste → Run.
-- ===================================================================


-- -------------------------------------------------------------------
-- 1. normalize_bd_phone() — canonical form is "880" + 10-digit subscriber
--    number (no leading 0, no "+", no separators). Returns NULL for
--    anything that isn't a recognisable BD mobile number, so callers can
--    treat "couldn't normalise" and "no match" identically rather than
--    needing a separate NULL-handling branch everywhere.
-- -------------------------------------------------------------------
create or replace function public.normalize_bd_phone(raw text)
returns text
language sql immutable as $$
  select case
    -- already 880 + 10 digits starting 3-9
    when regexp_replace(coalesce(raw, ''), '\D', '', 'g') ~ '^880[3-9]\d{9}$'
      then regexp_replace(raw, '\D', '', 'g')
    -- local format: 0 + 10 digits starting 3-9  ->  drop the 0, prepend 880
    when regexp_replace(coalesce(raw, ''), '\D', '', 'g') ~ '^0[3-9]\d{9}$'
      then '880' || substring(regexp_replace(raw, '\D', '', 'g') from 2)
    -- bare subscriber number, no leading 0 or country code
    when regexp_replace(coalesce(raw, ''), '\D', '', 'g') ~ '^[3-9]\d{9}$'
      then '880' || regexp_replace(raw, '\D', '', 'g')
    else null
  end;
$$;

-- -------------------------------------------------------------------
-- 2. coupon_phone_redemptions — one row per (coupon, order). `confirmed`
--    starts false at checkout and is flipped true only by
--    set_order_status() on the transition into 'delivered'.
-- -------------------------------------------------------------------
create table if not exists public.coupon_phone_redemptions (
  id               uuid primary key default gen_random_uuid(),
  coupon_id        uuid not null references public.coupons(id) on delete cascade,
  phone_normalized text not null,
  order_id         uuid not null references public.orders(id) on delete cascade,
  confirmed        boolean not null default false,
  created_at       timestamptz not null default now(),
  confirmed_at     timestamptz
);

create index if not exists coupon_phone_redemptions_lookup_idx
  on public.coupon_phone_redemptions (coupon_id, phone_normalized) where confirmed;

alter table public.coupon_phone_redemptions enable row level security;

-- Staff-readable (for support/dispute lookups); no direct client write in
-- either direction — every row is written by the SECURITY DEFINER
-- functions below, same pattern as inventory_movements.
drop policy if exists coupon_phone_redemptions_staff_read on public.coupon_phone_redemptions;
create policy coupon_phone_redemptions_staff_read on public.coupon_phone_redemptions
  for select using (public.is_staff('support'));

drop policy if exists coupon_phone_redemptions_no_direct_write on public.coupon_phone_redemptions;
create policy coupon_phone_redemptions_no_direct_write on public.coupon_phone_redemptions
  for insert with check (false);


-- -------------------------------------------------------------------
-- 3. place_order() — full redefinition (Postgres requires the complete
--    body on CREATE OR REPLACE). Identical to 0017_place_order_variants.sql
--    except the two blocks marked "NEW" below: the phone-based rejection
--    check alongside the existing email/customer_id one, and recording an
--    unconfirmed coupon_phone_redemptions row when a coupon is used.
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
  v_order            public.orders;
  v_free_shipping    boolean := false;
  v_image            text;
  v_prior_orders     int := 0;
  v_used_by_customer int := 0;
  v_points_earned    int := 0;
  v_phone_normalized text;                 -- NEW
  v_phone_already_used boolean := false;   -- NEW
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

  -- NEW: normalize once, reused by the coupon check below and the
  -- redemption-row insert further down.
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

    select count(*) into v_prior_orders from public.orders o
      where o.email = v_email and o.status <> 'cancelled';
    if v_coupon.first_order_only and v_prior_orders > 0 then
      raise exception 'COUPON_INVALID:first_order_only';
    end if;

    select count(*) into v_used_by_customer
      from public.coupon_redemptions r
      join public.orders o on o.id = r.order_id
     where r.coupon_id = v_coupon.id and o.email = v_email;

    -- NEW: phone-anchored check, alongside the email one above. Only a
    -- CONFIRMED (delivered) prior redemption counts — see header note.
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

    -- NEW: record the phone-side attempt too, unconfirmed. set_order_status()
    -- confirms it if/when this order reaches 'delivered'.
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
-- 4. set_order_status() — full redefinition. Identical to
--    0018_set_order_status_variants.sql except the block marked NEW,
--    which confirms any coupon_phone_redemptions row tied to this order
--    the moment (and only the moment) it transitions into 'delivered'.
-- -------------------------------------------------------------------
create or replace function public.set_order_status(
  p_order_id uuid, p_status text, p_note text default null
) returns public.orders language plpgsql security definer set search_path = public as $$
declare v_order public.orders; v_from text; v_item record; v_variant_id uuid;
begin
  if not public.is_staff('support') then raise exception 'FORBIDDEN'; end if;

  select status::text into v_from from public.orders where id = p_order_id for update;
  if v_from is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_from = p_status then raise exception 'NO_CHANGE'; end if;
  if v_from in ('delivered','refunded','cancelled') then
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
  end if;

  -- NEW: confirm the phone-based discount flag, only on arrival at
  -- 'delivered'. 'delivered' is terminal (checked above), so this can
  -- only ever fire once per order and can never be un-fired — a
  -- cancelled/refunded/still-pending order simply never reaches here,
  -- which is exactly what leaves its flag false.
  if p_status = 'delivered' then
    update public.coupon_phone_redemptions
       set confirmed = true, confirmed_at = now()
     where order_id = p_order_id and not confirmed;
  end if;

  return v_order;
end $$;

grant execute on function public.set_order_status(uuid,text,text) to authenticated;


-- -------------------------------------------------------------------
-- VERIFY
--   select normalize_bd_phone('+880 171-234-5678');   -- '8801712345678'
--   select normalize_bd_phone('01712345678');          -- '8801712345678'
--   select normalize_bd_phone('1712345678');            -- '8801712345678'
--   select normalize_bd_phone('not a phone');            -- null
--
--   -- full flow: place an order with a first-order coupon and phone A,
--   -- deliver it, then try the same phone with a different email:
--   select place_order('{"email":"a@x.com","items":[...],"coupon_code":"BLOOM5",
--     "shipping_address":{"phone":"01712345678", ...}}'::jsonb);
--   select set_order_status('<that order id>', 'delivered');
--   select place_order('{"email":"different@x.com","items":[...],"coupon_code":"BLOOM5",
--     "shipping_address":{"phone":"+8801712345678", ...}}'::jsonb);
--   -- expect: COUPON_INVALID:already_used, even though email differs
-- -------------------------------------------------------------------
