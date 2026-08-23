-- ===================================================================
-- skin.theory — fix: Bestseller badge showing on products the admin
-- never flagged
-- -------------------------------------------------------------------
-- ROOT CAUSE, confirmed live: products_public.is_best_seller was
-- `(rank <= 10 by sales_count) OR is_best_seller_manual` — meant to
-- auto-badge genuinely popular products on top of a manual override.
-- With only 4 active products, all at sales_count = 0, the rank clause
-- ranks every product "top 4 of 10" and fires for all of them
-- regardless of the manual toggle — confirmed: a product with
-- is_best_seller_manual = false and 0 sales still showed the badge.
--
-- New / Staff Pick / Limited Edition never had this problem — they're
-- already pure admin-toggle passthroughs. Bestseller now matches them:
-- badges are exactly what the admin selected, nothing inferred.
--
-- HOW TO APPLY: Supabase Dashboard -> SQL Editor -> paste -> Run.
-- ===================================================================

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
    -- Purely the admin's own toggle now — no automatic top-10-by-sales
    -- inference (see header for why that degenerated to "always true").
    p.is_best_seller_manual as is_best_seller,
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
--   select slug, is_best_seller_manual, is_best_seller from products_public;
--   -- expect: is_best_seller exactly matches is_best_seller_manual for
--   -- every row, regardless of sales_count
-- ===================================================================
