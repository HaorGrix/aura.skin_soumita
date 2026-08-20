-- ===================================================================
-- skin.theory — CRITICAL FIX: customers self-update let a shopper set
-- their own loyalty points to any value
-- -------------------------------------------------------------------
-- Introspected the live `customers` table (via a temporary debug RPC,
-- 0046) to document an untracked RLS policy the security audit found.
-- It turned out there were TWO untracked policies, not one:
--
--   "self reads own customer row"   (SELECT, auth_user_id = auth.uid())
--   "self updates own customer row" (UPDATE, auth_user_id = auth.uid())
--
-- The SELECT one is fine — read-only, own row only — and is documented
-- below with NO behavior change, just a tracked, clearly-named policy.
--
-- The UPDATE one is a REAL, CONFIRMED, LIVE vulnerability: Postgres RLS
-- UPDATE policies check which ROW you're touching, not which COLUMNS —
-- so "can update your own row" means EVERY column, including `points`.
-- Verified live: a real magic-link-verified shopper (whose customers
-- row has auth_user_id set — this happens for anyone who checks out
-- while already signed in, or has an auto-provisioned row from
-- verifying) can run
--   supabase.from('customers').update({ points: 999999 }).eq('id', ownId)
-- directly from the browser and it SUCCEEDS — confirmed with a live
-- test, balance actually became 999999. Those points then redeem for
-- real coupons (AURA3/AURA5/AURA8FS's required_points gates) — this is
-- a direct, trivial path to fraudulent discounts, not a theoretical gap.
--
-- Fix: DROP the update policy outright, not narrow it. A grep of the
-- entire src/ tree confirms ZERO frontend code anywhere calls
-- `.from("customers").update(...)` — nothing in the current app
-- depends on shoppers being able to write to this table directly at
-- all. Every legitimate points/customer-data write already goes
-- through a SECURITY DEFINER RPC (place_order, submit_review,
-- set_order_status) — this policy was a dormant, unused attack surface
-- with no real feature behind it. If a genuine "edit my profile"
-- feature is built later, it should be a narrow RPC that explicitly
-- excludes points/email/auth_user_id from what it can touch — not a
-- direct table policy.
--
-- Also drops the temporary introspection helper from 0046.
--
-- HOW TO APPLY: Supabase Dashboard -> SQL Editor -> paste -> Run.
-- ===================================================================

-- 1. Document the safe SELECT policy under this codebase's naming
--    convention, with the EXACT same logic (no behavior change).
drop policy if exists "self reads own customer row" on public.customers;
drop policy if exists customers_self_read on public.customers;
create policy customers_self_read on public.customers
  for select
  using (auth_user_id = auth.uid() or public.is_staff('support'));

-- 2. CRITICAL FIX: remove the self-update policy entirely — see header.
drop policy if exists "self updates own customer row" on public.customers;

-- 3. Clean up the temporary introspection helper (0046).
drop function if exists public.debug_list_customers_policies();

-- -------------------------------------------------------------------
-- VERIFY
--   -- as a verified customer session (own row, auth_user_id = auth.uid()):
--   select * from customers where auth_user_id = auth.uid();
--   -- expect: their own row, still readable (SELECT unaffected)
--
--   update customers set points = 999999 where auth_user_id = auth.uid();
--   -- expect: 0 rows affected / permission denied — the exploit is closed
--
--   -- confirm the introspection helper is gone:
--   select public.debug_list_customers_policies();
--   -- expect: function does not exist
-- ===================================================================
