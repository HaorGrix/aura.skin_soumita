-- ===================================================================
-- skin.theory — track the untracked customer self-service RLS policies,
-- then drop 0046's temporary debug helper
-- -------------------------------------------------------------------
-- 0046 introspected pg_policies on `customers` to capture a policy that
-- worked in production but predated the migration history. Its output
-- (verified live, 2026-08-16) was THREE policies on public.customers:
--
--   1. customers_staff_read       — already tracked, in 0002_admin_foundation.sql
--   2. "self reads own customer row"   — UNTRACKED until now
--   3. "self updates own customer row" — UNTRACKED until now
--
-- This migration re-creates #2 and #3 verbatim from 0046's captured
-- definition (idempotent — drop-if-exists then create, so it's a no-op
-- on the live DB, which already has them; it only matters for any
-- future fresh environment that replays migration history from
-- scratch, which would otherwise silently lack customer self-service
-- read/update access). Then it drops 0046's debug function — it was
-- explicitly temporary, and left live it lets ANY authenticated user
-- (not just staff) read this table's RLS policy definitions, a minor
-- but unnecessary info-disclosure surface.
--
-- HOW TO APPLY: Supabase Dashboard -> SQL Editor -> paste -> Run.
-- ===================================================================

drop policy if exists "self reads own customer row" on public.customers;
create policy "self reads own customer row" on public.customers
  for select
  using (auth_user_id = auth.uid() or public.is_staff('support'));

drop policy if exists "self updates own customer row" on public.customers;
create policy "self updates own customer row" on public.customers
  for update
  using (auth_user_id = auth.uid() or public.is_staff('admin'))
  with check (auth_user_id = auth.uid() or public.is_staff('admin'));

drop function if exists public.debug_list_customers_policies();

-- -------------------------------------------------------------------
-- VERIFY
--   -- policies still present and unchanged (compare against 0046's
--   -- captured output — should be the same 3 rows, now including the
--   -- two above sourced from a tracked migration instead of history):
--   select policyname, cmd, roles, qual, with_check
--     from pg_policies where schemaname = 'public' and tablename = 'customers';
--
--   -- debug helper is gone:
--   select public.debug_list_customers_policies();
--   -- expect: 42883 function does not exist
-- ===================================================================
