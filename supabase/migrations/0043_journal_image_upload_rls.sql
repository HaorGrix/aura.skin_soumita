-- ===================================================================
-- skin.theory — fix: editor-role staff can't upload Journal images
-- -------------------------------------------------------------------
-- SAME BUG CLASS as 0020_testimonials_image_upload_rls.sql, confirmed
-- live: 0042_journal_articles.sql lets any editor+ staffer create/edit
-- rows in `journal_articles` (journal_articles_staff_write uses
-- is_staff('editor')), and its own header comment claimed uploading
-- into the site-media bucket under a journal/ prefix needed "no new
-- bucket or storage policy" — that was wrong. The bucket's actual
-- insert/update/delete policies (0011_hero_carousel_media.sql) require
-- is_staff('admin'), written for the hero carousel and never revisited
-- when Journal (or testimonials, before 0020) started using the same
-- bucket for a different purpose.
--
-- Net effect, confirmed live with an editor-role test account: clicking
-- "Click to upload" for the cover image or an inline body image opens
-- the file picker fine, a file gets selected, but the actual
-- supabase.storage.from('site-media').upload() call is silently
-- rejected by storage RLS (403) — no readable error surfaces in the
-- editor UI beyond the upload spinner never resolving to an image.
--
-- FIX — same shape as 0020: editor-level policies scoped to the
-- journal/ prefix only, so the hero-carousel admin-only rule (any
-- other path in this bucket) is untouched.
--
-- HOW TO APPLY: Supabase Dashboard -> SQL Editor -> paste -> Run.
-- ===================================================================

create policy site_media_journal_editor_insert on storage.objects
  for insert with check (
    bucket_id = 'site-media'
    and (storage.foldername(name))[1] = 'journal'
    and public.is_staff('editor')
  );

create policy site_media_journal_editor_update on storage.objects
  for update using (
    bucket_id = 'site-media'
    and (storage.foldername(name))[1] = 'journal'
    and public.is_staff('editor')
  )
  with check (
    bucket_id = 'site-media'
    and (storage.foldername(name))[1] = 'journal'
    and public.is_staff('editor')
  );

create policy site_media_journal_editor_delete on storage.objects
  for delete using (
    bucket_id = 'site-media'
    and (storage.foldername(name))[1] = 'journal'
    and public.is_staff('editor')
  );

-- -------------------------------------------------------------------
-- VERIFY
--   -- as an editor-role staffer (not admin), uploading to
--   -- journal/<anything> should now succeed, while uploading to
--   -- hero-carousel/<anything> should still be rejected (admin only).
-- ===================================================================
