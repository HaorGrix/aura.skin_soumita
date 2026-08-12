-- ===================================================================
-- skin.theory — list_eligible_coupons(): every active coupon this cart
-- actually qualifies for, not just "is this one code valid"
-- -------------------------------------------------------------------
-- Companion to validate_coupon_preview() (0030) — same checks, same
-- source of truth (the live `coupons` table), but returns every match
-- instead of validating one typed code. This is what lets the storefront
-- show "you qualify for these N coupons" as a pickable list, rather than
-- a customer having to already know a code exists to type it.
--
-- Checks applied (deliberately the SAME set validate_coupon_preview()
-- checks, no more): is_active, starts_at/ends_at window, min_subtotal,
-- usage_limit (global), first_order_only + usage_limit_per_customer
-- (only when p_email is provided — a guest browsing Cart before
-- Checkout won't have one yet, same limitation the preview RPC has).
--
-- NOT checked here either, matching validate_coupon_preview() exactly:
-- required_points. Loyalty gating has always been client-side only
-- (CartContext.applyPromo) — place_order() itself doesn't enforce it yet
-- (see 0007_seed_coupons.sql's own note: "roadmap item 8"). A loyalty
-- coupon a customer hasn't earned will still be LISTED here; the
-- existing client-side gate in applyPromo is what actually blocks
-- applying it. Not fixing that pre-existing gap here — flagged, not
-- silently carried forward.
--
-- SECURITY: same reasoning as 0030 — coupons is deliberately locked down
-- (0015_lock_down_coupons_table.sql). This never exposes used_count or
-- usage_limit, and only ever returns coupons that are genuinely usable
-- right now for the given subtotal/email — not an enumerable dump of
-- every code that exists (inactive/expired/exhausted ones are excluded
-- entirely, not returned-with-a-reason like the single-code preview).
--
-- HOW TO APPLY: Supabase Dashboard -> SQL Editor -> paste -> Run.
-- ===================================================================

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
      not c.first_order_only
      or v_email is null  -- can't confirm either way yet — list it, applyPromo/validate_coupon_preview gate the actual apply
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
--   select * from list_eligible_coupons(0, null);
--   -- expect: every active coupon with min_subtotal_minor = 0, first-
--   -- order-only ones included (email is null, can't exclude them yet)
--
--   select * from list_eligible_coupons(500000, null);
--   -- expect: also includes coupons requiring up to ৳5000 minimum spend
--
--   -- as a repeat customer's email:
--   select * from list_eligible_coupons(0, 'someone-with-a-prior-order@example.com');
--   -- expect: first_order_only coupons EXCLUDED
-- ===================================================================
