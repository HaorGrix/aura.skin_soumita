-- =====================================================================
-- 0067 — coupons are private unless the shop chooses to advertise them
-- ---------------------------------------------------------------------
-- 0062 added coupons.is_public with default true, so every coupon was
-- listed at checkout ("You qualify for 2 coupons") without anyone having
-- chosen that — the client reported codes showing automatically.
--
-- From now on a coupon is private (works when typed, never suggested) until
-- "Show to shoppers" is switched on for it in Admin → Coupons. Existing
-- ordinary codes are switched to private once; the toggle stays per coupon.
-- Rewards codes (required_points set) stay visible: they are only ever
-- offered to a signed-in member who has earned the points.
-- =====================================================================

alter table public.coupons alter column is_public set default false;

update public.coupons set is_public = false where is_public and required_points is null;
