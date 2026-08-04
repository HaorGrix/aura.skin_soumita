-- ===================================================================
-- skin.script — fix: editor-role staff can't upload testimonial images
-- -------------------------------------------------------------------
-- FOUND during live end-to-end testing of the testimonials feature
-- (2026-08), driving the real admin UI as a disposable editor-role
-- account.
--
-- 0014_testimonials.sql lets any editor+ staffer create/edit rows in
-- `testimonials` (testimonials_staff_write uses is_staff('editor')).
-- But testimonial images are uploaded into the `site-media` bucket,
-- whose insert/update/delete policies (0011_hero_carousel_media.sql)
-- were written for the hero carousel and require is_staff('admin').
--
-- Net effect, confirmed live: an editor can fill out and save an
-- "image" testimonial's text fields, but the actual file upload gets
-- silently rejected by storage RLS (400, no useful client-side
-- message) before the row is ever saved. The feature is broken for
-- anyone below admin, which is not what 0014 intended.
--
-- FIX — add editor-level policies scoped to the testimonials/ prefix
-- only, so the hero-carousel admin-only rule (any other path in this
-- bucket) is untouched.
--
-- HOW TO APPLY: Supabase Dashboard -> SQL Editor -> paste -> Run.
-- ===================================================================

create policy site_media_testimonials_editor_insert on storage.objects
  for insert with check (
    bucket_id = 'site-media'
    and (storage.foldername(name))[1] = 'testimonials'
    and public.is_staff('editor')
  );

create policy site_media_testimonials_editor_update on storage.objects
  for update using (
    bucket_id = 'site-media'
    and (storage.foldername(name))[1] = 'testimonials'
    and public.is_staff('editor')
  )
  with check (
    bucket_id = 'site-media'
    and (storage.foldername(name))[1] = 'testimonials'
    and public.is_staff('editor')
  );

create policy site_media_testimonials_editor_delete on storage.objects
  for delete using (
    bucket_id = 'site-media'
    and (storage.foldername(name))[1] = 'testimonials'
    and public.is_staff('editor')
  );

-- -------------------------------------------------------------------
-- VERIFY
--   -- as an editor-role staffer (not admin), uploading to
--   -- testimonials/<anything> should now succeed, while uploading to
--   -- hero-carousel/<anything> should still be rejected (admin only).
-- ===================================================================
