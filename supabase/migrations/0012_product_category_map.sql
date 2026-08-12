-- ===================================================================
-- skin.theory — product → category identity map (was 0010, renumbered)
-- -------------------------------------------------------------------
-- `products_public` exposes a category NAME, and that was unambiguous while
-- the taxonomy was flat. It isn't any more: after 0009 the reference menu
-- repeats names across columns —
--     Skin Care ▸ Serum      and     K-Beauty ▸ Serum
--     Skin Care ▸ Facewash   and     K-Beauty ▸ Facewash
--     Skin Care ▸ Powder     and     Body Care ▸ Powder
--
-- So filtering the shop by name now matches the WRONG column: clicking
-- K-Beauty returns Skin Care's serums and moisturisers, because those
-- products' category name is literally "Serum". Verified live — K-Beauty,
-- which owns no products at all, returned a full page of them.
--
-- The fix is to filter by category IDENTITY (slug), not label. This view
-- gives the storefront that mapping without touching products_public, whose
-- definition lives outside these migration files — recreating it blind to
-- add two columns would risk the whole catalog for a small gain.
--
-- HOW TO APPLY: Supabase Dashboard → SQL Editor → paste → Run.
-- ===================================================================

create or replace view public.product_category_map as
  select
    p.id            as product_id,
    p.legacy_id     as legacy_id,     -- the cart/URL key the storefront uses
    p.category_id   as category_id,
    c.slug          as category_slug,
    c.name          as category_name,
    parent.slug     as parent_slug,
    parent.name     as parent_name
  from public.products p
  join public.categories c on c.id = p.category_id
  left join public.categories parent on parent.id = c.parent_id
  where p.status = 'active';

-- Runs with the owner's rights so it keeps working after 0005 locks the
-- base `products` table down to staff — same reasoning as products_public.
alter view public.product_category_map set (security_invoker = false);

grant select on public.product_category_map to anon, authenticated;

-- -------------------------------------------------------------------
-- VERIFY — every active product should appear exactly once, and the
-- parent column should be populated for anything nested.
-- -------------------------------------------------------------------
--   select count(*) from product_category_map;                  -- = active products
--   select parent_name, category_name, count(*)
--     from product_category_map group by 1,2 order by 1,2;
