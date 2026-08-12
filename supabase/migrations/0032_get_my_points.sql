-- ===================================================================
-- skin.theory — real loyalty-point balance for a verified session
-- -------------------------------------------------------------------
-- ROOT CAUSE this fixes: `customers.points` has been the real, durable
-- balance since place_order() (0006) and submit_review() (0031) both
-- write to it — but the account UI (Navbar, Rewards page, LoyaltyTab)
-- has only ever displayed UserContext's separate localStorage mock
-- (`points` useState, seeded from `skinscript_users_store`). A shopper
-- could earn real points via a real purchase or a real verified review
-- and never see the number move, because the UI was reading a
-- completely disconnected fake counter.
--
-- WHY AN RPC, NOT A SELECT POLICY ON customers
-- `customers` only has a staff-read policy today (0002). Opening a
-- broad self-read policy would need to handle: (a) a shopper's
-- customer_id not matching auth.uid() for a guest checkout later
-- verified by magic link (same "auth_user_id is null" gap 0029's order
-- policy was written to close), and (b) the same email possibly having
-- TWO customer rows (one from a guest checkout, one from a logged-in
-- checkout) whose points should be reported as one combined balance,
-- not silently picking one row via unspecified `LIMIT 1` ordering. An
-- RPC resolves both deliberately instead of leaving a policy to guess.
--
-- HOW TO APPLY: Supabase Dashboard -> SQL Editor -> paste -> Run.
-- ===================================================================

create or replace function public.get_my_points()
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_email  citext;
  v_points int;
begin
  if auth.uid() is null then
    raise exception 'NOT_VERIFIED';
  end if;

  v_email := lower(auth.jwt() ->> 'email');
  if v_email is null or v_email = '' then
    raise exception 'NOT_VERIFIED';
  end if;

  -- Sum rather than pick one row: a shopper who has both a guest-checkout
  -- customer row and a signed-in-checkout customer row under the same
  -- email owns the combined balance, not just whichever row happened to
  -- be created first.
  select coalesce(sum(points), 0) into v_points
    from public.customers
   where lower(email) = v_email;

  return coalesce(v_points, 0);
end $$;

-- Returns only a single int scoped to the CALLER's own verified email —
-- never a full customers row, never another identity's balance.
grant execute on function public.get_my_points() to authenticated;

-- -------------------------------------------------------------------
-- VERIFY
--   -- as a magic-link-verified session:
--   select get_my_points();
--   -- expect: the real integer matching `select points from customers
--   -- where email = '<that email>'` (or the sum, if more than one row)
--
--   -- as anon (no session):
--   select get_my_points();
--   -- expect: error NOT_VERIFIED
-- -------------------------------------------------------------------
