-- ===================================================================
-- skin.theory — announcement bar: link + scheduling
-- -------------------------------------------------------------------
-- The Content & Banners admin section had a completely separate,
-- never-wired "Announcement Bar" content_blocks slot (global.announcement)
-- with richer fields (a clickable link, a start/end date window) than the
-- announcement bar that's actually live (Settings -> Announcement bar,
-- announcement_enabled/announcement_text on this table, read by
-- Navbar.jsx). Rather than build a THIRD system, this upgrades the one
-- that's actually working with the two fields the dead one had that this
-- one didn't. The redundant content_blocks slot is removed from the admin
-- schema in the same change that ships this (see schemas.js SLOTS).
--
-- HOW TO APPLY: Supabase Dashboard -> SQL Editor -> paste -> Run.
-- ===================================================================

alter table public.store_settings
  add column if not exists announcement_link_label text,
  add column if not exists announcement_link_href   text,
  add column if not exists announcement_starts_at    timestamptz,
  add column if not exists announcement_ends_at      timestamptz;

-- -------------------------------------------------------------------
-- VERIFY
--   select announcement_link_label, announcement_link_href,
--          announcement_starts_at, announcement_ends_at
--     from store_settings where id = true;
--   -- expect: one row, all four columns present (null until an admin sets them)
-- -------------------------------------------------------------------
