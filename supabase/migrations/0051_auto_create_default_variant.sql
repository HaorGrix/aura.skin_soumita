-- ===================================================================
-- skin.theory — auto-create a default variant on product insert, and
-- backfill the products that are currently missing one
-- -------------------------------------------------------------------
-- ROOT CAUSE (audited live, 2026-08-20): 0016_product_variants.sql's own
-- header states the intended invariant — "A product that has never
-- needed sizes gets exactly ONE variant automatically" — but that was
-- only ever a ONE-TIME BACKFILL (0016 §4) for products that existed at
-- the moment that migration ran. createProduct() in
-- lib/api/admin/catalog.js inserts into `products` only; it has never
-- inserted a matching product_variants row. Nothing has enforced the
-- invariant for a product created since — only if the admin happens to
-- also open the Variants tab and add one by hand.
--
-- Consequence: any product saved without ever visiting Variants has NO
-- product_variants row at all. place_order() can't resolve a default
-- variant for it (raises VARIANT_NOT_FOUND) — the product LOOKS orderable
-- (products_public shows it, price and an in_stock flag included) but
-- checkout fails for every shopper who tries to buy it. Confirmed live:
-- every currently-active, in-stock product with this problem hit exactly
-- that error.
--
-- This is a genuine, currently-live gap, not stale legacy data — all 4
-- affected products were created 2026-08-14 through 2026-08-17, days
-- after 0016 shipped.
--
-- FIX, two parts:
--   1. A trigger — AFTER INSERT ON products — that creates the matching
--      default variant automatically, so this can't happen to any future
--      product regardless of which admin screen/flow creates it (UI,
--      script, or a direct insert). Same idiom this file already uses
--      elsewhere (variant_prevent_last_delete, mirror_variant_to_product):
--      the invariant is enforced once, in the database, not
--      re-implemented in every caller.
--   2. A backfill for the products that are ALREADY missing one —
--      identical logic to 0016 §4, so this is exactly what would have
--      happened if the trigger had existed from day one.
--
-- HOW TO APPLY: Supabase Dashboard -> SQL Editor -> paste -> Run.
-- ===================================================================

-- -------------------------------------------------------------------
-- 1. Trigger: every new product gets a 'Standard' default variant,
--    mirroring its own price/compare-at/sku/stock exactly — the same
--    shape 0016 §4's backfill used. mirror_variant_to_product (0016)
--    fires right after this and mirrors those same values back onto
--    the product row; since they already match, that's a harmless no-op.
-- -------------------------------------------------------------------
create or replace function public.product_create_default_variant()
returns trigger language plpgsql as $$
begin
  insert into public.product_variants
    (product_id, size_label, sku, price_minor, compare_at_price_minor, stock_quantity, is_default, sort_order)
  values
    (new.id, 'Standard', new.sku, coalesce(new.price_minor, 0), new.compare_at_minor, coalesce(new.stock, 0), true, 0);
  return new;
end $$;

drop trigger if exists products_create_default_variant on public.products;
create trigger products_create_default_variant
  after insert on public.products
  for each row execute function public.product_create_default_variant();

-- -------------------------------------------------------------------
-- 2. Backfill — every product (any status) currently missing a variant
--    gets one now, wrapping its own current price/stock/sku as-is.
--    Idempotent: skips any product that already has a variant, so
--    re-running this migration is harmless.
-- -------------------------------------------------------------------
insert into public.product_variants
  (product_id, size_label, sku, price_minor, compare_at_price_minor, stock_quantity, is_default, sort_order)
select p.id, 'Standard', p.sku, p.price_minor, p.compare_at_minor, p.stock, true, 0
  from public.products p
 where not exists (select 1 from public.product_variants v where v.product_id = p.id);

-- -------------------------------------------------------------------
-- VERIFY
--   -- no product, of any status, is without a variant:
--   select id, slug, name, status from public.products p
--    where not exists (select 1 from public.product_variants v where v.product_id = p.id);
--   -- expect 0 rows
--
--   -- the trigger works going forward:
--   insert into public.products (slug, name, brand, category_id, price_minor, status)
--   values ('trigger-test-delete-me', 'Trigger Test', 'Test', (select id from categories limit 1), 12300, 'draft')
--   returning id;
--   -- then: select * from product_variants where product_id = '<returned id>';
--   -- expect exactly one row, is_default = true, price_minor = 12300
--   -- clean up: delete from products where slug = 'trigger-test-delete-me';
--
--   -- the 4 previously-broken live products now resolve:
--   select place_order('{"email":"real@gmail.com","items":[{"slug":"revive-eye-serum-ginseng-retinal","quantity":1}], ...}'::jsonb);
--   -- expect: no longer VARIANT_NOT_FOUND
-- ===================================================================
