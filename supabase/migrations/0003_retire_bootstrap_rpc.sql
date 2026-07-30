-- ===================================================================
-- aura.skin — retire the owner self-promotion RPC
-- -------------------------------------------------------------------
-- 0002 shipped admin_bootstrap_owner(), a client-callable function that
-- promoted the caller to `owner` while no owner existed. It was a
-- convenience for first-run setup and it is no longer needed:
--
--   • An owner now exists, so the function refuses every call anyway.
--   • It could never do the whole job — creating the Supabase Auth user
--     requires the service-role key, so a script was always necessary.
--   • Staff accounts now come from `node scripts/admin-account.mjs`, which
--     creates the auth user, sets a password and writes the profile row in
--     one place, using a key that never reaches a browser.
--
-- What's left is an endpoint any anonymous visitor can call that grants
-- owner rights under one condition. That condition is currently false, but
-- it becomes true again the moment the profiles table is ever emptied — by
-- a bad restore, a botched migration, or a mistaken delete. Keeping a
-- dormant privilege-escalation path around for a convenience we no longer
-- use is a poor trade, so it goes.
--
-- 0002 is left untouched: it is already applied, and rewriting applied
-- migrations desynchronises the file from the database.
--
-- HOW TO APPLY: Supabase Dashboard → SQL Editor → paste → Run.
-- ===================================================================

revoke all on function public.admin_bootstrap_owner() from authenticated, anon;
drop function if exists public.admin_bootstrap_owner();

-- Verify: this should return 0 rows.
--   select proname from pg_proc
--    where pronamespace = 'public'::regnamespace
--      and proname = 'admin_bootstrap_owner';
