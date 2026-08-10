-- ===================================================================
-- skin.script — profiles.is_test_account: an explicit flag, not a naming
-- convention, for what's safe to auto-delete
-- -------------------------------------------------------------------
-- Every disposable staff account created during live end-to-end testing
-- (testimonials, badges, gallery, video, skin-type filters…) has so far
-- been identified purely by a `zz-<feature>-<role>-<timestamp>@example.org`
-- email convention, tracked in a session-local meta file and deleted by
-- exact id afterward. That's worked, but it's a PROCEDURAL safeguard, not
-- a schema one — nothing stops a future cleanup script from matching too
-- broadly, or a real account that happens to start with "zz-" (unlikely,
-- but not impossible) from getting swept up.
--
-- default FALSE is deliberate and matches scripts/admin-account.mjs
-- (real, permanent staff accounts) unchanged — it never sets this column,
-- so every account it creates or updates is false by default, exactly as
-- it should be. Only the throwaway-account helper below sets it true.
--
-- HOW TO APPLY: Supabase Dashboard -> SQL Editor -> paste -> Run.
-- ===================================================================

alter table public.profiles add column if not exists is_test_account boolean not null default false;

-- Index for the cleanup script's WHERE is_test_account filter — this table
-- is small today, but the point of adding the column at all is to make
-- that filter cheap and exact rather than a LIKE scan forever.
create index if not exists profiles_is_test_account_idx on public.profiles (is_test_account) where is_test_account;

-- -------------------------------------------------------------------
-- VERIFY
--   select is_test_account, count(*) from profiles group by 1;
--   -- expect: is_test_account=false for every existing row (including the
--   -- real owner account created via admin-account.mjs) — no leftover
--   -- test accounts should exist at migration time; every prior session
--   -- cleaned its own up before ending.
-- ===================================================================
