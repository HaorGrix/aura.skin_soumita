-- ===================================================================
-- skin.theory — make product hard-delete safe for order history
-- -------------------------------------------------------------------
-- The admin panel has only ever offered "Archive" (products.status =
-- 'archived'), never a real delete — on purpose, per the comment on
-- archiveProduct() in lib/api/admin/catalog.js: a hard delete cascades
-- through product_variants, product_images, inventory_movements,
-- sale_price_snapshots and reviews, all of which is fine (that data only
-- exists to describe the product). The one exception is order_items:
-- its product_id FK predates this repo's migration history, so its
-- ON DELETE behaviour is unknown/unverified — if it happens to be
-- CASCADE, deleting a product would silently delete line items out of
-- PAST orders, corrupting real receipts.
--
-- order_items already stores its own snapshot of everything a receipt
-- needs (product_name, product_slug, brand_name, size_label, image_path,
-- unit_price_minor — written once at place_order() time and never re-read
-- from products), so the fix is simple: make product_id → products
-- ON DELETE SET NULL, exactly like variant_id already is (0016). Losing
-- the FK link on a deleted product changes nothing a shopper or admin
-- sees on that order; the row itself just survives.
--
-- Written defensively (find-then-drop-then-recreate) since the original
-- constraint's name isn't known from this migration history.
-- ===================================================================

do $$
declare
  v_conname text;
begin
  select con.conname into v_conname
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_class frel on frel.oid = con.confrelid
  where con.contype = 'f'
    and rel.relname = 'order_items'
    and frel.relname = 'products';

  if v_conname is not null then
    execute format('alter table public.order_items drop constraint %I', v_conname);
  end if;

  -- product_id must accept null for ON DELETE SET NULL to ever apply.
  alter table public.order_items alter column product_id drop not null;

  alter table public.order_items
    add constraint order_items_product_id_fkey
    foreign key (product_id) references public.products(id) on delete set null;
end $$;

-- -------------------------------------------------------------------
-- VERIFY
--   select confdeltype from pg_constraint
--   where conname = 'order_items_product_id_fkey';
--   -- expect: 'n' (SET NULL)
--
--   delete a product that has past order_items -- expect: the order and
--   its order_items rows survive, product_id on those rows becomes null,
--   product_name/product_slug/unit_price_minor etc. are untouched.
-- ===================================================================
