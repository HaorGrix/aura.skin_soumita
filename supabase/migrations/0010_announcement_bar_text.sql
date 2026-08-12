-- ===================================================================
-- skin.theory — make the header announcement bar admin-editable
-- -------------------------------------------------------------------
-- store_settings already had `announcement_enabled` from 0002, but no
-- text field, and nothing on the storefront actually read either column
-- — the announcement bar's copy was a hardcoded constant in Navbar.jsx.
-- This adds the text column and seeds it with the current line, so
-- flipping it in /admin/settings takes effect immediately with no
-- rebuild/redeploy.
--
-- HOW TO APPLY: Supabase Dashboard → SQL Editor → paste → Run.
-- ===================================================================

alter table public.store_settings
  add column if not exists announcement_text text
  not null default 'Script Your Skin. Reveal Your Confidence.';

update public.store_settings
   set announcement_text = 'Script Your Skin. Reveal Your Confidence.'
 where id = true;

-- The bar was always visible before this migration (Navbar.jsx rendered it
-- unconditionally); flip the existing dormant flag to match that behaviour
-- so applying this migration doesn't silently hide it.
update public.store_settings
   set announcement_enabled = true
 where id = true;

-- VERIFY:
--   select announcement_enabled, announcement_text from store_settings;
