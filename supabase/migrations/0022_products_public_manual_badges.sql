-- ===================================================================
-- skin.script — wire is_staff_pick / is_limited_edition / the bestseller
-- override into products_public
-- -------------------------------------------------------------------
-- Companion to 0021_manual_badges.sql (adds the three base columns on
-- `products`). This is a straight `create or replace view`, built from
-- the LIVE view definition (pulled via pg_get_viewdef against the real
-- project, not reconstructed from memory) with exactly two changes:
--
--   1. `p.is_staff_pick` and `p.is_limited_edition` added to the select
--      list, passed straight through — no computation, same as `is_new`.
--   2. `is_best_seller` becomes `(the existing top-10-by-sales rank) OR
--      p.is_best_seller_manual` — additive only. A product that already
--      qualifies by real sales is unaffected; the manual flag can only
--      ever ADD the badge to a product that hasn't earned it yet, never
--      remove it from one that has.
--
-- Every other column/expression below is copied verbatim from the live
-- view — nothing else changes.
--
-- HOW TO APPLY: Supabase Dashboard -> SQL Editor -> paste -> Run
-- (run 0021 first if you haven't already — this references those columns).
-- ===================================================================

create or replace view public.products_public as
SELECT p.id,
    p.slug,
    p.name,
    p.subtitle,
    p.description,
    p.how_to_use,
    p.brand,
    c.name AS category,
    p.tone,
    p.is_new,
    p.popularity,
    p.price_minor,
    p.compare_at_minor,
    p.max_per_order,
    p.concern,
    p.skin_type,
    p.ingredients,
    p.stock > 0 OR p.backorder_ok AS in_stock,
    p.stock > 0 AND p.stock <= p.low_stock_at AS is_low_stock,
    p.compare_at_minor IS NOT NULL AND p.compare_at_minor > p.price_minor AS is_on_sale,
        CASE
            WHEN p.compare_at_minor > p.price_minor THEN round((1::numeric - p.price_minor::numeric / p.compare_at_minor::numeric) * 100::numeric)::integer
            ELSE 0
        END AS discount_percent,
        CASE
            WHEN p.stock > 0 THEN p.sales_count
            ELSE 0
        END AS sales_count,
    (rank() OVER (ORDER BY (
        CASE
            WHEN p.stock > 0 THEN p.sales_count
            ELSE 0
        END) DESC) <= 10) OR p.is_best_seller_manual AS is_best_seller,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('path', i.storage_path, 'alt', i.alt) ORDER BY i."position") AS jsonb_agg
           FROM product_images i
          WHERE i.product_id = p.id), '[]'::jsonb) AS gallery,
    p.rating,
    p.review_count,
    p.is_staff_pick,
    p.is_limited_edition
   FROM products p
     JOIN categories c ON c.id = p.category_id
  WHERE p.status = 'active'::text AND c.is_active;

-- -------------------------------------------------------------------
-- VERIFY
--   select is_best_seller, is_staff_pick, is_limited_edition
--   from products_public limit 3;
--   -- expect: three new/changed columns present, no errors
--
--   -- confirm the additive-only claim: pick a real top-10-by-sales
--   -- product (is_best_seller already true) and toggle
--   -- is_best_seller_manual to false — is_best_seller in
--   -- products_public should stay true (still earned by real sales).
-- ===================================================================
