-- =====================================================================
-- 0065 — product ratings come only from real customer reviews
-- ---------------------------------------------------------------------
-- products.rating defaulted to 4.8, and the catalog was seeded with
-- ratings of 3.9–4.9 and review counts up to 7 while the reviews table was
-- empty — so every product showed made-up stars. The storefront now shows
-- stars only when review_count > 0 (the client asked for the demo ratings
-- to go).
--
-- • New products start at 0 / 0.
-- • Every product is recomputed from its approved reviews, with the same
--   formula sync_product_review_stats() uses on each review change, so a
--   product that does have real reviews keeps its real numbers.
--
-- Idempotent: safe to run more than once.
-- =====================================================================

alter table public.products alter column rating set default 0;

update public.products p set
  review_count = coalesce(s.n, 0),
  rating = coalesce(s.avg_rating, 0)
from (
  select pr.id,
         (select count(*) from public.reviews r
           where r.product_id = pr.id and r.status = 'approved') as n,
         (select round(avg(r.rating)::numeric, 2) from public.reviews r
           where r.product_id = pr.id and r.status = 'approved') as avg_rating
  from public.products pr
) s
where s.id = p.id
  and (p.review_count is distinct from coalesce(s.n, 0)
       or p.rating is distinct from coalesce(s.avg_rating, 0));
