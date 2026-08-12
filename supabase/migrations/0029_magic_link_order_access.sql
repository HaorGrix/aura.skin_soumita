-- ===================================================================
-- skin.theory — order/review access via verified magic-link email
-- -------------------------------------------------------------------
-- orders_own_read (0006) only ever matches customer_id -> auth_user_id,
-- which is set ONLY when a customer checks out while already signed in.
-- The overwhelming majority of orders here are GUEST checkouts (email in
-- the payload, no session at all) — for those, auth_user_id is null
-- forever, so a guest who later verifies their email via magic link would
-- still see nothing under the old policy alone.
--
-- This ADDS a second select policy (Postgres OR's permissive policies
-- together, so 0006's policy is untouched) matching on the EMAIL embedded
-- in the caller's own signed JWT — auth.jwt()->>'email' — not a
-- client-supplied string. That email can only get into the JWT by
-- actually completing Supabase's real magic-link flow (a signed,
-- single-use, time-limited token emailed to that address and clicked).
-- This is the mechanism that makes "different email cannot see this
-- email's orders" a real, testable property rather than a raw lookup:
-- there is no code path that lets a client assert an email without
-- Supabase's own auth server having verified it first.
--
-- HOW TO APPLY: Supabase Dashboard -> SQL Editor -> paste -> Run.
-- ===================================================================

drop policy if exists orders_verified_email_read on public.orders;
create policy orders_verified_email_read on public.orders for select
  using (
    auth.uid() is not null
    and email = lower(auth.jwt() ->> 'email')
  );

drop policy if exists order_items_verified_email_read on public.order_items;
create policy order_items_verified_email_read on public.order_items for select
  using (
    order_id in (
      select o.id from public.orders o
      where o.email = lower(auth.jwt() ->> 'email')
    )
  );

-- -------------------------------------------------------------------
-- VERIFY
--   -- as an authenticated session whose JWT email is "a@x.com":
--   select count(*) from orders;              -- only orders with email = a@x.com
--   select count(*) from order_items;          -- only items on those orders
--
--   -- sign in with a DIFFERENT verified email and repeat — must return a
--   -- disjoint set (zero overlap with the first identity's orders).
-- -------------------------------------------------------------------
