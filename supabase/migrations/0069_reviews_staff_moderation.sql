-- =====================================================================
-- 0069 — staff can see and moderate product reviews
-- ---------------------------------------------------------------------
-- Shoppers now write real reviews from their order history
-- (submit_review(): verified buyer, delivered order, one per order line).
-- They publish immediately (reviews.status defaults to 'approved'), but the
-- admin had no way to see or hide one: reviews had no staff policy at all.
--
--   read   — support and up (same as orders)
--   update — editors and up; the Admin → Reviews screen only changes
--            `status` (approved / rejected). The review-stats trigger
--            recounts the product rating on every change, so hiding a
--            review immediately takes it out of the stars.
-- Reviews are never deleted from the admin (a hidden review can be
-- published again).
-- =====================================================================

drop policy if exists "staff read reviews" on public.reviews;
create policy "staff read reviews" on public.reviews
  for select to authenticated
  using (public.is_staff('support'::app_role));

drop policy if exists "editors moderate reviews" on public.reviews;
create policy "editors moderate reviews" on public.reviews
  for update to authenticated
  using (public.is_staff('editor'::app_role))
  with check (public.is_staff('editor'::app_role));

grant select, update on public.reviews to authenticated;
