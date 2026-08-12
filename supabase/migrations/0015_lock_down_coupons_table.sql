-- ===================================================================
-- skin.theory — close a public-read hole on `coupons`
-- -------------------------------------------------------------------
-- FOUND during a 2026-08-02 security audit, confirmed live with a fully
-- anonymous (no session, no JWT) request:
--
--   anon SELECT coupons  ->  all 4 rows returned in full: code, kind,
--   value_percent, value_minor, required_points, usage_limit, used_count
--
-- 0002 defines exactly one SELECT policy on this table —
--   coupons_staff_read: for select using (is_staff('support'))
-- — and is_staff() correctly returns false for an anonymous/no-profile
-- caller (verified separately in the same audit). So that policy alone
-- would deny this read. It didn't, which means a SECOND, more permissive
-- SELECT policy exists on the live database that is not defined in any
-- file in this migrations/ directory — added directly via the Supabase
-- dashboard at some point before these migrations existed, and never
-- captured in version control.
--
-- Confirmed there is no legitimate reader for this access: nothing in the
-- storefront queries `coupons` directly (checked: only
-- src/lib/api/admin/promos.js, a staff-only admin module, ever does).
-- Checkout validates coupons entirely inside place_order(), which is
-- SECURITY DEFINER and needs no table grant to do it. So whatever the
-- untracked policy's original purpose was, nothing in the current app
-- depends on it.
--
-- IMPORTANT — a write-side check was also run and came back correctly
-- denied (a crafted anon INSERT of a 100%-off coupon failed with a real
-- RLS violation), so this is confirmed READ-only exposure, not a write
-- hole. Still fixed regardless, since letting the public read exact
-- discount values, remaining usage_limit and used_count on every coupon
-- makes them trivial to exhaust or reverse-engineer.
--
-- FIX: drop every existing policy on `coupons` (whatever it's actually
-- called — the point of doing it this way, same pattern as
-- 0005_lock_down_products_table.sql, is that it's correct regardless of
-- what that untracked policy turned out to be) and recreate exactly the
-- two 0002 already intended.
--
-- HOW TO APPLY: Supabase Dashboard → SQL Editor → paste → Run.
-- ===================================================================

do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
     where schemaname = 'public' and tablename = 'coupons'
  loop
    execute format('drop policy %I on public.coupons', p.policyname);
    raise notice 'dropped coupons policy: %', p.policyname;
  end loop;
end $$;

-- Belt and braces — confirm RLS itself is actually on (it tested as on via
-- the INSERT probe, but there is no cost to being explicit here).
alter table public.coupons enable row level security;

create policy coupons_staff_read on public.coupons
  for select using (public.is_staff('support'));

create policy coupons_admin_write on public.coupons
  for all using (public.is_staff('admin')) with check (public.is_staff('admin'));

-- -------------------------------------------------------------------
-- VERIFY
-- -------------------------------------------------------------------
--   -- as the anon key (REST): /rest/v1/coupons?select=code
--   --   expect: [] (empty array), NOT the 4 codes
--
--   select policyname from pg_policies
--    where schemaname='public' and tablename='coupons';
--   -- expect EXACTLY: coupons_staff_read, coupons_admin_write
--
-- If checkout ever needs a public "is this code valid" lookup in the
-- future (it doesn't today — place_order() handles it server-side),
-- add a narrow RPC for that, not a table-wide SELECT policy: a function
-- can return {valid: bool, label: text} without exposing used_count,
-- usage_limit, or every other live code in the table.
