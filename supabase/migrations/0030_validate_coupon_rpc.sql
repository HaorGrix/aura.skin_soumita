-- ===================================================================
-- skin.theory — fix: coupon edits (amount, expiry, active status, even
-- the CODE itself) never reached the storefront
-- -------------------------------------------------------------------
-- ROOT CAUSE, confirmed by tracing the actual code path, not guessing:
-- the storefront's entire coupon apply/validate flow
-- (CartContext.applyPromo, used by both the Cart page and Checkout) ran
-- against `src/lib/coupons.js` — a fully STATIC, hand-written JS object
-- bundled into the client at BUILD time. It never queried the real
-- `coupons` table the admin Coupons screen actually writes to
-- (lib/api/admin/promos.js's saveCoupon(), confirmed to genuinely UPDATE
-- the DB row). So:
--   - A brand-new coupon the admin creates can't be applied AT ALL —
--     findCoupon() only recognizes the 4 codes hardcoded in that file.
--   - Editing an existing coupon's amount/expiry/active flag has zero
--     effect on what the cart/checkout preview shows or accepts, no
--     matter how long you wait or how many times you refresh — the
--     numbers are baked into the JS bundle, not read from anywhere live.
--
-- This was NOT a checkout-time money bug: place_order() (0006/0017) has
-- always independently re-validated every coupon against the live table
-- and computed the real discount server-side, ignoring whatever the
-- client claimed. So no order was ever charged the wrong amount — but a
-- customer could see one discount in their cart and have checkout apply
-- a different one (or reject the code entirely) at the very last step,
-- which is exactly the "customers still see/can apply the old coupon
-- details" symptom reported.
--
-- WHY AN RPC, NOT JUST GRANTING SELECT ON coupons
-- 0015_lock_down_coupons_table.sql deliberately closed public read access
-- to this table (it was leaking exact discount values, usage_limit and
-- used_count to anyone, unauthenticated) and left this note verbatim:
--   "If checkout ever needs a public 'is this code valid' lookup in the
--    future... add a narrow RPC for that, not a table-wide SELECT
--    policy: a function can return {valid, label} without exposing
--    used_count, usage_limit, or every other live code in the table."
-- This is exactly that RPC. It mirrors place_order()'s own validation
-- logic (same checks, same order) so the preview matches what checkout
-- will actually do, and it only ever reveals details about the ONE code
-- passed in — never enumerable, never leaks used_count/usage_limit.
--
-- HOW TO APPLY: Supabase Dashboard -> SQL Editor -> paste -> Run.
-- ===================================================================

create or replace function public.validate_coupon_preview(
  p_code text,
  p_subtotal_minor integer default 0,
  p_email text default null
)
returns table (
  valid               boolean,
  reason              text,   -- null on success; else one of the same
                               -- COUPON_INVALID:<reason> tags place_order() raises
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
begin
  if v_code = '' then
    return query select false, 'unknown', v_code, null::text, null::numeric, null::int, null::int, null::boolean, null::int, null::boolean, null::int;
    return;
  end if;

  -- `code` is qualified because it's ALSO this function's own OUT
  -- parameter name (see RETURNS TABLE above) — an unqualified `code` here
  -- is ambiguous between that and coupons.code, and Postgres correctly
  -- refuses to guess.
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

  -- Per-customer checks only run once we actually have an email (a guest
  -- browsing the Cart page before Checkout won't yet) — same limitation
  -- the old client-side check had. place_order() re-checks these
  -- unconditionally regardless of what this preview said.
  if reason is null and p_email is not null and trim(p_email) <> '' then
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

  -- Two columns need an explicit cast, confirmed against the LIVE schema
  -- via PostgREST's own OpenAPI definition (GET /rest/v1/), not assumed:
  --   coupons.code -> public.citext (case-insensitive text)
  --   coupons.kind -> public.discount_kind (a custom enum), not plain text
  -- Either one left uncast makes Postgres reject the whole RETURNS TABLE
  -- row with "structure of query does not match function result type".
  return query select
    (reason is null), reason, v_coupon.code::text, v_coupon.kind::text, v_coupon.value_percent,
    v_coupon.value_minor, v_coupon.max_discount_minor, v_coupon.also_free_shipping,
    v_coupon.min_subtotal_minor, v_coupon.first_order_only, v_coupon.required_points;
end $$;

-- Anyone can call this — anon (browsing Cart pre-login) and authenticated
-- (Checkout) both need it. It never returns more than one code's worth of
-- non-sensitive info, so this is a narrower, deliberate exposure, not the
-- table-wide hole 0015 closed.
grant execute on function public.validate_coupon_preview(text, integer, text) to anon, authenticated;

-- -------------------------------------------------------------------
-- VERIFY
--   -- as anon (no session):
--   select * from validate_coupon_preview('BLOOM5', 100000, null);
--   -- expect: one row, valid depends on current BLOOM5 state — NOT a
--   -- permission error, and NOT the full coupons table
--
--   select * from validate_coupon_preview('NOT-A-REAL-CODE', 100000, null);
--   -- expect: valid=false, reason='unknown', every other column null
--
--   -- confirm the table itself is STILL locked down (0015 unaffected):
--   select count(*) from coupons;  -- as anon, still 0 rows / permission denied
-- ===================================================================
