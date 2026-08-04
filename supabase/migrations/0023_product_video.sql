-- ===================================================================
-- skin.script — real product video: base column + view passthrough
-- -------------------------------------------------------------------
-- Part 5 removed the fake `hasVideo: true` that showed a video tab/thumb
-- and a static "60s ritual demo" caption on every single product,
-- regardless of whether one existed. This adds the real thing: one
-- optional video per product, uploaded through the admin the same way
-- images are, stored in the existing `site-media` bucket (0011) under a
-- `products/` prefix — no new bucket or storage policy needed, since
-- 0011's site_media_staff_insert/update/delete policies already allow any
-- is_staff('admin') write to any path in that bucket, the same gate
-- product images already require.
--
-- `video_url` stores a STORAGE PATH (like product_images.storage_path),
-- not a full URL — resolved client-side via publicUrl(path, "site-media"),
-- same pattern as testimonials images.
--
-- HOW TO APPLY: Supabase Dashboard -> SQL Editor -> paste -> Run.
-- ===================================================================

alter table public.products add column if not exists video_url text;

-- Column must be appended at the END of the select list — Postgres refuses
-- to reorder/insert-in-the-middle of a view via CREATE OR REPLACE VIEW
-- (see 0022's fix for the same issue). Built from the live view as of
-- 0022, with exactly one addition: p.video_url at the end.
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
    p.is_limited_edition,
    p.video_url
   FROM products p
     JOIN categories c ON c.id = p.category_id
  WHERE p.status = 'active'::text AND c.is_active;

-- -------------------------------------------------------------------
-- VERIFY
--   select video_url from products_public limit 1;
--   -- expect: column present, null for every product until one is uploaded
-- ===================================================================
