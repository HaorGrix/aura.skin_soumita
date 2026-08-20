-- ===================================================================
-- skin.theory — flash-sale price on product_variants_public
-- -------------------------------------------------------------------
-- Live audit finding: place_order() has always applied best_sale_price_
-- minor() per line item (0039), and products_public exposes it too — but
-- product_variants_public (0016), which the PDP/cart/checkout actually
-- read the displayed unit price from, was never updated when flash sales
-- shipped. Verified live: a product under an active, store-wide sale
-- charged the correct discounted price at place_order() time, but every
-- screen before that (PDP, cart line, checkout summary) showed the full
-- undiscounted price throughout — shoppers never saw the price they were
-- about to be charged until after the order was placed.
--
-- Same fix shape as 0039 used for products_public: a LEFT JOIN LATERAL
-- calling the existing best_sale_price_minor() per row, exposing the
-- result as two new nullable columns. Nothing already selected from this
-- view changes shape or meaning — this is a pure addition.
--
-- HOW TO APPLY: Supabase Dashboard -> SQL Editor -> paste -> Run.
-- ===================================================================

create or replace view public.product_variants_public as
select
  pv.id, pv.product_id, pv.size_label, pv.sort_order, pv.is_default,
  pv.price_minor, pv.compare_at_price_minor,
  (pv.compare_at_price_minor is not null and pv.compare_at_price_minor > pv.price_minor) as is_on_sale,
  case when pv.compare_at_price_minor > pv.price_minor
       then round((1 - pv.price_minor::numeric / pv.compare_at_price_minor) * 100)::int
       else 0 end as discount_percent,
  (pv.stock_quantity > 0)                                        as in_stock,
  (pv.stock_quantity > 0 and pv.stock_quantity <= coalesce(p.low_stock_at, 5)) as is_low_stock,
  sp.new_price_minor as sale_price_minor,
  sp.sale_id         as active_sale_id
from public.product_variants pv
join public.products p on p.id = pv.product_id
left join lateral (
  select s.id as sale_id,
         public.best_sale_price_minor(pv.price_minor, p.id, p.category_id, p.brand) as new_price_minor
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
where p.status = 'active';

alter view public.product_variants_public set (security_invoker = false);
grant select on public.product_variants_public to anon, authenticated;

-- -------------------------------------------------------------------
-- VERIFY
--   select id, price_minor, sale_price_minor, active_sale_id
--   from product_variants_public
--   where product_id = '<a product covered by an active sale>';
--   -- expect: sale_price_minor < price_minor, active_sale_id = that sale
--
--   -- and matches what place_order() actually charges for the same
--   -- variant right now:
--   select public.best_sale_price_minor(pv.price_minor, pv.product_id, p.category_id, p.brand)
--   from product_variants pv join products p on p.id = pv.product_id
--   where pv.id = '<same variant id>';
-- ===================================================================
