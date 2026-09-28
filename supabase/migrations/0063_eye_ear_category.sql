-- =====================================================================
-- 0063 — "Eye & Ear Care" next to Body Care
-- ---------------------------------------------------------------------
-- The client wants an Eye & Ear category beside Body Care in the menu and
-- the home tiles. The existing top-level "Eye Care" becomes "Eye & Ear
-- Care" and moves to just after Body Care (50), before Hair Care (60).
-- Its slug stays `eye-care`, so existing links, the home tile and every
-- product already filed under Eye Cream / Eye Serum keep working.
--
-- An "Ear Care" subcategory is added beside Eye Cream and Eye Serum so
-- ear products can be filed there from /admin/products.
--
-- Idempotent: safe to run more than once.
-- =====================================================================

update public.categories
   set name = 'Eye & Ear Care',
       sort_order = 55
 where slug = 'eye-care'
   and parent_id is null;

insert into public.categories (name, slug, parent_id, sort_order, is_active)
select 'Ear Care', 'eye-care-ear-care', c.id, 3, true
  from public.categories c
 where c.slug = 'eye-care'
   and c.parent_id is null
   and not exists (select 1 from public.categories where slug = 'eye-care-ear-care');
