-- ===================================================================
-- aura.skin — actually hide stock + cost from the public
-- -------------------------------------------------------------------
-- Supersedes finding §1.3 of 0004, whose fix was a no-op.
--
-- WHY 0004 DIDN'T WORK
-- It used:
--     revoke select (stock, cost_minor, sku, low_stock_at) on products from anon;
--
-- In PostgreSQL, table-level and column-level privileges are separate
-- grants. Supabase grants `anon` table-wide SELECT on public tables by
-- default, and a table-level SELECT authorises every column. Revoking a
-- COLUMN privilege does not subtract from a TABLE privilege — there was no
-- column grant to revoke, so the statement succeeded and changed nothing.
-- Verified after applying 0004: anon still read products.stock = 5.
--
-- To restrict columns you must remove the table-level grant first. But the
-- cleaner fix is simpler: the public has no business reading the base table
-- at all. `products_public` exists precisely to be the public projection.
--
-- WHAT THIS DOES
--   1. Pins products_public to run with its OWNER's rights, so locking the
--      base table cannot take the storefront offline.
--   2. Replaces every policy on `products` with staff-only access.
--   3. Removes anon's table grant.
--
-- Customers (role `authenticated`) keep the grant but see zero rows through
-- RLS — they read products_public like everyone else. Staff see everything.
--
-- HOW TO APPLY: Supabase Dashboard → SQL Editor → paste → Run.
-- ===================================================================


-- -------------------------------------------------------------------
-- 1. Make the view's privilege model explicit BEFORE locking the table.
--
-- A view runs with its owner's privileges unless `security_invoker = true`,
-- in which case it runs with the caller's. If products_public were ever
-- created (or recreated) as security_invoker, step 3 would break the entire
-- storefront. Setting it explicitly removes the guesswork rather than
-- relying on the default.
-- -------------------------------------------------------------------
alter view public.products_public set (security_invoker = false);


-- -------------------------------------------------------------------
-- 2. products: staff-only.
--
-- The permissive "public can read active products" policy from the original
-- schema is what exposed stock and cost. Its name isn't known here, so every
-- policy on the table is dropped and the intended two are recreated — which
-- also removes any duplicate/overlapping policies that accumulated across
-- migrations. Permissive policies OR together, so a single forgotten one is
-- enough to undo the rest.
-- -------------------------------------------------------------------
do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
     where schemaname = 'public' and tablename = 'products'
  loop
    execute format('drop policy %I on public.products', p.policyname);
    raise notice 'dropped products policy: %', p.policyname;
  end loop;
end $$;

create policy products_staff_read on public.products
  for select using (public.is_staff('support'));

create policy products_admin_write on public.products
  for all using (public.is_staff('admin')) with check (public.is_staff('admin'));


-- -------------------------------------------------------------------
-- 3. Drop anon's table grant.
--
-- `authenticated` keeps its grant because staff are authenticated too, and
-- column grants cannot tell a shop owner from a shopper — that separation is
-- RLS's job, and step 2 does it.
-- -------------------------------------------------------------------
revoke select on public.products from anon;


-- -------------------------------------------------------------------
-- VERIFY — run all four. Expected results in the comments.
-- -------------------------------------------------------------------
-- As ANON (use the anon key against the REST API):
--   /rest/v1/products?select=stock        -> 401/403  (blocked)
--   /rest/v1/products_public?select=id    -> 139 rows (storefront intact)
--
-- As the SQL editor (postgres, bypasses RLS):
--   select count(*) from products;                          -- 139
--   select policyname from pg_policies where tablename='products';
--       -- exactly: products_staff_read, products_admin_write
--
-- ROLLBACK (restores the previous, leaky behaviour):
--   grant select on public.products to anon;
--   create policy products_public_read on public.products
--     for select using (status = 'active');
