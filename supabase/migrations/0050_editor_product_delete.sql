-- ===================================================================
-- skin.theory — open product delete (single + bulk) to Editor and up
-- -------------------------------------------------------------------
-- Explicit client decision: hard-delete used to require 'owner' in the
-- UI and, underneath that, 'admin' at the RLS level (products was only
-- ever covered by products_admin_write, a single `for all` policy —
-- there was no delete-specific policy to loosen on its own). Now:
-- Editor, Admin and Owner can all delete a product.
--
-- products_admin_write stays exactly as-is (admin+) for INSERT/UPDATE —
-- creating/editing catalog data is unaffected by this change, only
-- delete moves down to editor. A second, DELETE-only permissive policy
-- is added instead of loosening products_admin_write itself; Postgres
-- ORs permissive policies together for the same command, so this is a
-- pure addition — nothing already granted to admin/owner is narrowed.
--
-- deleteProduct()/deleteProducts() (lib/api/admin/catalog.js) also
-- SELECT product_images.storage_path before deleting, to clean up the
-- actual files in Storage (the product_images ROWS cascade-delete with
-- the product regardless — FK cascades bypass RLS — but the storage
-- objects don't, and that select was previously admin-only via
-- images_admin_write). Without also allowing editor to read
-- product_images, an editor-initiated delete would still succeed but
-- silently leave orphaned files in the product-images bucket. Same
-- pattern: a second, SELECT-only policy added alongside the existing
-- images_admin_write, not a change to it — editor still can't write
-- (upload/replace/delete individual photos), only read paths.
--
-- HOW TO APPLY: Supabase Dashboard -> SQL Editor -> paste -> Run.
-- ===================================================================

drop policy if exists products_editor_delete on public.products;
create policy products_editor_delete on public.products
  for delete using (public.is_staff('editor'));

drop policy if exists images_editor_read on public.product_images;
create policy images_editor_read on public.product_images
  for select using (public.is_staff('editor'));

-- -------------------------------------------------------------------
-- VERIFY
--   select policyname, cmd from pg_policies where tablename = 'products';
--   -- expect: products_staff_read (select), products_admin_write (all),
--   --         products_editor_delete (delete)
--
--   select policyname, cmd from pg_policies where tablename = 'product_images';
--   -- expect: images_admin_write (all), images_editor_read (select)
--
--   -- as an editor-role session: delete a test product -> succeeds, its
--   -- product_images rows AND storage files are both gone, order_items
--   -- referencing it (if any) survive with product_id set null (0049).
--   -- as an editor-role session: try inserting/updating a product ->
--   -- still rejected (products_admin_write still requires admin+).
-- ===================================================================
