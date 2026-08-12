-- ===================================================================
-- skin.theory — Meta Pixel settings on store_settings
-- -------------------------------------------------------------------
-- Adds a pixel ID + enable toggle to the existing single-row
-- store_settings table (see 0002_admin_foundation.sql). The storefront
-- reads these live (src/lib/api/settings.js) and injects the Meta
-- Pixel base code only when both an ID is present AND the toggle is on
-- — never a half-configured/empty pixel script.
-- ===================================================================

alter table public.store_settings
  add column if not exists meta_pixel_id text,
  add column if not exists meta_pixel_enabled boolean not null default false;

-- Loose numeric-ID guard — Meta Pixel IDs are all-digit strings, typically
-- 15-16 characters. Empty string is allowed (treated as "not configured").
alter table public.store_settings
  drop constraint if exists store_settings_meta_pixel_id_format;
alter table public.store_settings
  add constraint store_settings_meta_pixel_id_format
  check (meta_pixel_id is null or meta_pixel_id = '' or meta_pixel_id ~ '^[0-9]{6,20}$');
