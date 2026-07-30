-- ===================================================================
-- aura.skin — seed the coupon codes the storefront already promises
-- -------------------------------------------------------------------
-- The `coupons` table is empty, but the Rewards page, the loyalty
-- milestones and lib/coupons.js all advertise these codes. place_order()
-- validates coupons against the DATABASE, so the moment 0006 is applied
-- every one of them would fail with COUPON_INVALID:unknown — the site
-- would be offering discounts it then refuses at checkout.
--
-- Values are converted from the legacy float scale the static file used:
-- a "flat 5" was rendered through formatPrice() as 5 × 120 = BDT 600, so
-- it becomes 60000 paisa. Percentages carry over unchanged.
--
-- `required_points` marks the loyalty tiers. The admin Coupons screen shows
-- those with a "Loyalty" badge and locks their points threshold, because
-- the Rewards page's copy is derived from these numbers.
--
-- Idempotent: re-running updates the same rows rather than duplicating.
--
-- HOW TO APPLY: Supabase Dashboard → SQL Editor → paste → Run.
-- ===================================================================

insert into public.coupons
  (code, kind, value_percent, value_minor, also_free_shipping,
   min_subtotal_minor, first_order_only, required_points,
   usage_limit_per_customer, is_active)
values
  -- Welcome offer: BDT 600 off, first order only.
  ('BLOOM5',  'fixed',   null, 60000, false, 0, true,  null, 1, true),

  -- Loyalty milestones. `required_points` mirrors lib/coupons.js and is what
  -- the Rewards page unlocks against.
  ('AURA3',   'percent', 3,    null,  false, 0, false, 25,   1, true),
  ('AURA5',   'percent', 5,    null,  false, 0, false, 60,   1, true),
  ('AURA8FS', 'percent', 8,    null,  true,  0, false, 120,  1, true)

on conflict (code) do update set
  kind                     = excluded.kind,
  value_percent            = excluded.value_percent,
  value_minor              = excluded.value_minor,
  also_free_shipping       = excluded.also_free_shipping,
  min_subtotal_minor       = excluded.min_subtotal_minor,
  first_order_only         = excluded.first_order_only,
  required_points          = excluded.required_points,
  usage_limit_per_customer = excluded.usage_limit_per_customer,
  is_active                = excluded.is_active;

-- VERIFY — expect 4 rows, and AURA8FS with also_free_shipping = true:
--   select code, kind, value_percent, value_minor, required_points,
--          also_free_shipping, first_order_only
--     from coupons order by code;
--
-- NOTE: place_order() enforces required_points only in the sense that the
-- code must exist and be active — it does NOT yet check the customer's
-- points balance, because loyalty points live on `customers` and guests have
-- none. Gating milestone codes on points is part of roadmap item 8.
