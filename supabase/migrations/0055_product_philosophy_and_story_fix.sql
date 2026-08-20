-- ===================================================================
-- skin.theory — fix: admin subtitle/description not shown; "Our
-- Philosophy" not per-product or editable at all
-- -------------------------------------------------------------------
-- ROOT CAUSE (both bugs), confirmed live: the PDP's "Description" tab
-- ("The story" / "Our philosophy") never reads the real, admin-saved
-- products.description at all. src/data/product-details.js's buildPdp()
-- unconditionally FABRICATES a `longDescription` template string from
-- brand/category/ingredients on every render, and a single hardcoded
-- `philosophy` blurb reused for every product in the catalog — neither
-- ever looks at the real DB row. The admin's description IS saved and
-- fetched correctly (products_public already selects it, mapProduct()
-- maps it) — it just gets silently discarded at display time in favour
-- of the generated copy. "Short subtitle" is saved/fetched correctly
-- too, but has never had ANY place in the UI that renders it at all.
--
-- Fixes shipped alongside this migration (frontend, no schema needed):
--   - buildPdp() now prefers the real product.description/philosophy
--     when present, falling back to the generated template only when
--     the admin hasn't written one — same "storefront never breaks"
--     contract every other CMS-backed field in this project honours.
--   - Subtitle now actually renders on the PDP, under the title.
--
-- This migration is the one DB change genuinely needed: "Our
-- Philosophy" never had a per-product column to prefer in the first
-- place — it was a single string shared by the whole catalog, not a
-- disconnected field. Adds products.philosophy (nullable — absent means
-- "use the generated blurb", not an error).
-- ===================================================================

alter table public.products add column if not exists philosophy text;

-- -------------------------------------------------------------------
-- products_public — add philosophy alongside every existing column.
-- Full view redefinition (current source: 0039_flash_sales_storefront.sql).
-- -------------------------------------------------------------------
create or replace view public.products_public as
select p.id,
    p.slug,
    p.name,
    p.subtitle,
    p.description,
    p.how_to_use,
    p.brand,
    c.name as category,
    p.tone,
    p.is_new,
    p.popularity,
    p.price_minor,
    p.compare_at_minor,
    p.max_per_order,
    p.concern,
    p.skin_type,
    p.ingredients,
    p.stock > 0 or p.backorder_ok as in_stock,
    p.stock > 0 and p.stock <= p.low_stock_at as is_low_stock,
    p.compare_at_minor is not null and p.compare_at_minor > p.price_minor as is_on_sale,
        case
            when p.compare_at_minor > p.price_minor then round((1::numeric - p.price_minor::numeric / p.compare_at_minor::numeric) * 100::numeric)::integer
            else 0
        end as discount_percent,
        case
            when p.stock > 0 then p.sales_count
            else 0
        end as sales_count,
    (rank() over (order by (
        case
            when p.stock > 0 then p.sales_count
            else 0
        end) desc) <= 10) or p.is_best_seller_manual as is_best_seller,
    coalesce(( select jsonb_agg(jsonb_build_object('path', i.storage_path, 'alt', i.alt) order by i."position") as jsonb_agg
           from product_images i
          where i.product_id = p.id), '[]'::jsonb) as gallery,
    p.rating,
    p.review_count,
    p.is_staff_pick,
    p.is_limited_edition,
    p.video_url,
    sp.new_price_minor as sale_price_minor,
    sp.sale_id as active_sale_id,
    -- Appended at the end, not inserted alongside subtitle/description
    -- above: CREATE OR REPLACE VIEW only allows adding new trailing
    -- columns — inserting one in the middle repositions every column
    -- after it, which Postgres rejects as a column rename.
    p.philosophy
   from products p
     join categories c on c.id = p.category_id
     left join lateral (
       select s.id as sale_id,
              public.best_sale_price_minor(p.price_minor, p.id, p.category_id, p.brand) as new_price_minor
       from public.sales s
       where s.is_active and s.starts_at <= now() and s.ends_at >= now()
         and (
           coalesce((s.scope ->> 'all')::boolean, false)
           or s.scope -> 'products'   ? p.id::text
           or s.scope -> 'categories' ? p.category_id::text
           or s.scope -> 'brands'     ? p.brand
         )
       order by s.priority desc, s.starts_at desc
       limit 1
     ) sp on true
  where p.status = 'active'::text and c.is_active;

alter view public.products_public set (security_invoker = false);
grant select on public.products_public to anon, authenticated;

-- -------------------------------------------------------------------
-- VERIFY
--   select subtitle, description, philosophy from products_public where slug = '<any product>';
--   -- expect: philosophy present (null until an admin writes one)
-- ===================================================================
