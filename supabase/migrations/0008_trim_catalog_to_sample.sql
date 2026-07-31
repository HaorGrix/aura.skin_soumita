-- ===================================================================
-- skin.script — trim the 139-item dummy catalog to a lean sample set
-- -------------------------------------------------------------------
-- The full 139-product catalog was seed/migration data for building and
-- testing the storefront. The real client will load their own inventory,
-- so this migration keeps only 3 top-rated products per category (27
-- total) — enough to exercise every piece of logic (cart, filtering,
-- checkout, coupons, wishlist) without carrying dummy weight forward.
--
-- Selection: for each category, the 3 products with the highest
-- rating (ties broken by review_count, then name) were kept. The exact
-- list is pinned by slug below so this migration is self-documenting
-- and reproducible regardless of what the ids happen to be.
--
-- Deletes cascade in this order: order_items reference products with
-- ON DELETE, but at the time this was written there were zero orders
-- and zero order_items in production — verified live before running.
-- product_images are deleted explicitly first regardless of the FK's
-- cascade behaviour, so this is safe even if that assumption changes.
--
-- HOW TO APPLY: Supabase Dashboard → SQL Editor → paste → Run.
-- ===================================================================

do $$
declare
  v_keep text[] := array[
    'anua-heartleaf-70-intense-calming-cream',
    'anua-heartleaf-77-soothing-toner',
    'anua-peach-70-niacinamide-serum',
    'beauty-of-joseon-dayscreen-moisturizer-spf30-green-tea-ha-ceramide',
    'beauty-of-joseon-revive-eye-serum-ginseng-retinal',
    'beauty-of-joseon-revive-under-eye-patch-ginseng-retinal',
    'cerave-pm-facial-moisturizing-lotion',
    'cosrx-acne-pimple-master-patch',
    'cosrx-advanced-snail-96-mucin-power-essence',
    'cosrx-aha-bha-clarifying-treatment-toner',
    'cosrx-aloe-soothing-sun-cream-spf50',
    'cosrx-bha-blackhead-power-liquid',
    'cosrx-salicylic-acid-daily-gentle-cleanser',
    'dr-althea-345-relief-cream',
    'isntree-hyaluronic-acid-watery-sun-gel-spf50',
    'isntree-hyper-niacinamide-20-serum',
    'isntree-hyper-vitamin-c-23-serum',
    'isntree-mugwort-calming-clay-mask',
    'isntree-real-rose-calming-mask',
    'missha-artemisia-calming-essence',
    'missha-blackhead-off-cleansing-oil',
    'missha-super-off-cleansing-oil-dust-off',
    'missha-time-revolution-the-first-treatment-essence',
    'skin1004-centella-teca-soothing-toner',
    'skin1004-hyalu-cica-sleeping-pack',
    'the-ordinary-azelaic-acid-suspension-10',
    'the-ordinary-multi-peptide-eye-serum'
  ];
begin
  delete from public.product_images
   where product_id in (select id from public.products where slug <> all(v_keep));

  delete from public.products
   where slug <> all(v_keep);
end $$;

-- VERIFY — expect exactly 27 rows, 3 per category:
--   select c.name, count(*) from products p
--     join categories c on c.id = p.category_id
--    group by c.name order by c.name;
