-- ===================================================================
-- skin.theory — fix concerns RLS: storefront visitors must be able to
-- read it too
-- -------------------------------------------------------------------
-- 0059 copied brands' exact RLS shape (`is_staff('support')`-gated
-- select), but that was the wrong precedent: `brands`/`skin_type` are
-- read live ONLY by admin screens — the storefront's own brand/skin-type
-- filters use the static lists in src/data/products.js, never those
-- tables. `concerns` is different by design: the storefront (Shop's
-- concern filter, the Shop-by-Concern tiles, the mobile quick-chip row)
-- reads this table LIVE, as an anonymous shopper, same as `categories`
-- already does. Verified live: the anon key got `[]` from `concerns`
-- before this, silently emptying every concern-name label and dropdown
-- on the public site while admin screens (signed-in) looked fine — the
-- kind of bug that hides behind an authenticated testing session.
--
-- HOW TO APPLY: `supabase db push`, or Dashboard -> SQL Editor -> Run.
-- ===================================================================

drop policy if exists concerns_staff_read on public.concerns;
create policy concerns_public_read on public.concerns for select using (true);

-- concerns_admin_write (admin-only write) is untouched — this only widens
-- who can SELECT.

-- -------------------------------------------------------------------
-- VERIFY (run with the anon key, not service role):
--   select count(*) from concerns;  -- expect 9, not 0/empty
-- ===================================================================
