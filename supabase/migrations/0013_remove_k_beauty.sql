-- ===================================================================
-- skin.script — remove the K-Beauty category (genuinely, not hidden)
-- -------------------------------------------------------------------
-- K-Beauty and all 7 of its children (Facewash, Serum, Moisturizer,
-- Ampoule, Sunscreen, Toner, Essence) carry ZERO products — verified live
-- against production before writing this migration. There is nothing to
-- reassign: an empty category has no products to preserve, and reassigning
-- the children under Skin Care is not possible as a straight move anyway —
-- Skin Care already has children with those exact 7 names, and
-- categories.name is unique per parent (migration 0009's
-- categories_child_name_idx), so the move would fail on a constraint
-- violation before it got anywhere.
--
-- No code in the app hardcodes the "k-beauty" slug (checked: mega menu,
-- Shop filters, product lookups all read categories dynamically from this
-- table), so nothing in the storefront breaks when these rows go.
--
-- SAFETY: the guard below re-checks the "zero products" assumption at
-- migration time, not just at the time this file was written. If a product
-- has been assigned to K-Beauty or any of its children in the meantime,
-- the whole migration aborts with an exception and deletes nothing — it
-- will NOT silently orphan a product's category.
--
-- Expected result: categories 40 -> 32 (K-Beauty + its 7 children removed).
--
-- HOW TO APPLY: Supabase Dashboard → SQL Editor → paste → Run.
-- ===================================================================

do $$
declare
  v_kbeauty_id uuid;
  v_product_count int;
begin
  select id into v_kbeauty_id from public.categories where slug = 'k-beauty';

  if v_kbeauty_id is null then
    raise notice 'k-beauty category not found — nothing to do (already removed?)';
    return;
  end if;

  select count(*) into v_product_count
    from public.products
   where category_id = v_kbeauty_id
      or category_id in (select id from public.categories where parent_id = v_kbeauty_id);

  if v_product_count > 0 then
    raise exception
      'ABORTED: % product(s) are now assigned to K-Beauty or a child category. '
      'This migration only removes an EMPTY K-Beauty tree — reassign or remove '
      'those products first, then re-run.', v_product_count;
  end if;

  -- Children first (no FK constraint requires this — categories.parent_id
  -- has no explicit ON DELETE behavior set — but deleting the parent first
  -- would leave orphaned children behind rather than removing them).
  delete from public.categories where parent_id = v_kbeauty_id;
  delete from public.categories where id = v_kbeauty_id;

  raise notice 'K-Beauty and its children removed.';
end $$;

-- -------------------------------------------------------------------
-- VERIFY
-- -------------------------------------------------------------------
--   select count(*) from categories;                        -- expect 32 (was 40)
--   select * from categories where slug like 'k-beauty%';    -- expect 0 rows
--   select p.name, m.category_name, m.parent_name
--     from products p join product_category_map m on m.product_id = p.id
--    where m.parent_slug = 'k-beauty' or m.category_slug = 'k-beauty';
--                                                              -- expect 0 rows
