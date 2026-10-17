-- ===================================================================
-- skin.theory — Google Analytics 4 settings on store_settings
-- -------------------------------------------------------------------
-- Adds a GA4 Measurement ID + enable toggle to the single-row
-- store_settings table, mirroring the Meta Pixel pair in
-- 0035_meta_pixel_settings.sql. The storefront reads these live
-- (src/lib/api/settings.js) and loads gtag.js only when both an ID is
-- present AND the toggle is on — never a half-configured/empty tag.
-- ===================================================================

alter table public.store_settings
  add column if not exists ga4_measurement_id text,
  add column if not exists ga4_enabled boolean not null default false;

-- GA4 Measurement IDs look like G-XXXXXXXXXX (the "G-" stream id, not the
-- numeric property id and not a GTM "GTM-" container). Empty string is
-- allowed and treated as "not configured", exactly like the pixel guard.
alter table public.store_settings
  drop constraint if exists store_settings_ga4_measurement_id_format;
alter table public.store_settings
  add constraint store_settings_ga4_measurement_id_format
  check (
    ga4_measurement_id is null
    or ga4_measurement_id = ''
    or ga4_measurement_id ~* '^G-[A-Z0-9]{6,12}$'
  );
