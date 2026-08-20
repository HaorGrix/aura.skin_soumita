-- ===================================================================
-- skin.theory — TEMPORARY: introspect the untracked customers policy
-- -------------------------------------------------------------------
-- The security audit found a working RLS policy on `customers` that
-- lets a verified user read their own row, but it doesn't appear in
-- any of the 45 tracked migration files — it predates this migration
-- history (same "base schema" situation as orders/products/coupons
-- themselves). This function is a one-time read of pg_policies so its
-- EXACT current definition can be captured and committed as a real,
-- tracked migration. It will be DROPPED again in that follow-up
-- migration — this file makes no lasting change on its own.
--
-- HOW TO APPLY: Supabase Dashboard -> SQL Editor -> paste -> Run, then
-- run the SELECT in the VERIFY block below and share the output.
-- ===================================================================

create or replace function public.debug_list_customers_policies()
returns table (
  policyname text,
  cmd        text,
  roles      name[],
  qual       text,
  with_check text
)
language sql security definer set search_path = public, pg_catalog as $$
  select policyname, cmd, roles, qual, with_check
  from pg_policies
  where schemaname = 'public' and tablename = 'customers';
$$;

grant execute on function public.debug_list_customers_policies() to authenticated;

-- -------------------------------------------------------------------
-- VERIFY — run this and share the result:
--   select * from public.debug_list_customers_policies();
-- -------------------------------------------------------------------
