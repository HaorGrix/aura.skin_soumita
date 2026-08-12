-- ===================================================================
-- skin.theory — dedicated storage bucket for CMS-uploaded media
-- -------------------------------------------------------------------
-- The existing `product-images` bucket is locked to image mimetypes only
-- (0004) — correct for product photos, but the new admin-editable Hero
-- Carousel (Homepage Hero → Banners) needs to accept VIDEO uploads too.
-- Rather than loosen product-images' constraints (and risk a 300MB video
-- landing in the product catalog bucket), this adds a separate bucket
-- scoped to general site media: hero banners today, anything else the CMS
-- grows into later.
--
-- Policies mirror 0004's product-images pattern exactly: public read,
-- staff-only (admin) write.
--
-- HOW TO APPLY: Supabase Dashboard → SQL Editor → paste → Run.
-- ===================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-media', 'site-media', true,
  31457280, -- 30 MB — enough for a short, compressed hero banner video
  array['image/jpeg','image/png','image/webp','image/avif','video/mp4','video/webm']
)
on conflict (id) do update
  set public = true,
      file_size_limit = 31457280,
      allowed_mime_types = array['image/jpeg','image/png','image/webp','image/avif','video/mp4','video/webm'];

drop policy if exists site_media_public_read on storage.objects;
create policy site_media_public_read on storage.objects
  for select using (bucket_id = 'site-media');

drop policy if exists site_media_staff_insert on storage.objects;
create policy site_media_staff_insert on storage.objects
  for insert with check (bucket_id = 'site-media' and public.is_staff('admin'));

drop policy if exists site_media_staff_update on storage.objects;
create policy site_media_staff_update on storage.objects
  for update using (bucket_id = 'site-media' and public.is_staff('admin'))
  with check (bucket_id = 'site-media' and public.is_staff('admin'));

drop policy if exists site_media_staff_delete on storage.objects;
create policy site_media_staff_delete on storage.objects
  for delete using (bucket_id = 'site-media' and public.is_staff('admin'));

-- VERIFY: sign in to /admin as owner/admin and upload a video to
-- Content → Homepage Hero Carousel → a banner's Media field.
