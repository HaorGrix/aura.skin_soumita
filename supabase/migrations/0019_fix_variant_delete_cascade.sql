-- ===================================================================
-- skin.script — fix: a product with variants could never be deleted
-- -------------------------------------------------------------------
-- FOUND during live end-to-end testing of the variants feature (2026-08).
--
-- variant_prevent_last_delete() (0016) blocks deleting a product_variants
-- row when it's the last one for that product — correct when the intent
-- is "keep the product, remove its only size" (that really should be
-- blocked: a product can't exist with zero prices/stock to sell at).
--
-- But it does NOT distinguish that from "the whole PRODUCT is being
-- deleted anyway" — ON DELETE CASCADE on products_id fires this same
-- trigger for every cascaded variant row, and by the time it gets to the
-- last one, the count is 1 and it refuses. Net effect, confirmed live:
--
--   delete from products where id = '<any product with >=1 variant>';
--   -- ERROR: LAST_VARIANT: a product must keep at least one size option
--
-- A product can never be hard-deleted at all, once it has a variant row —
-- which every product has, since the 0016 backfill gave all of them one.
--
-- No admin code path hits this today (archiveProduct() sets status =
-- 'archived', never a real DELETE — confirmed in src/lib/api/admin/
-- catalog.js), so nothing in the live app was broken by it. Still a real
-- bug: any future hard-delete (a cleanup script, a manual fix, a later
-- admin feature) would silently fail with a confusing error.
--
-- FIX — the standard Postgres idiom for this exact problem: check whether
-- the parent PRODUCT row still exists. On a genuine "delete this variant,
-- keep the product" call, it does, and the block still applies. On a
-- cascade from deleting the product, Postgres removes the parent row from
-- `products` before cascading to `product_variants`, so by the time this
-- trigger fires the parent is already gone — and the check correctly lets
-- the cascade finish.
--
-- HOW TO APPLY: Supabase Dashboard → SQL Editor → paste → Run.
-- ===================================================================

create or replace function public.variant_prevent_last_delete()
returns trigger language plpgsql as $$
begin
  -- The whole product is being deleted (this row is disappearing as part
  -- of that cascade) — nothing left to protect, let it proceed.
  if not exists (select 1 from public.products where id = old.product_id) then
    return old;
  end if;

  if (select count(*) from public.product_variants where product_id = old.product_id) <= 1 then
    raise exception 'LAST_VARIANT: a product must keep at least one size option';
  end if;
  return old;
end $$;


-- -------------------------------------------------------------------
-- Cleanup — a disposable end-to-end test product got stuck by this exact
-- bug mid-test and couldn't be removed until the fix above landed. Scoped
-- to its literal slug prefix, nothing else is touched.
-- -------------------------------------------------------------------
delete from public.products where slug like 'zz-e2e-variant-test-%';


-- -------------------------------------------------------------------
-- VERIFY
--   -- pick any real product with a variant and confirm a delete now
--   -- cascades cleanly (ROLL BACK afterward if you don't actually want
--   -- to delete it!):
--   begin;
--     delete from products where slug = '<some real product slug>';
--     -- expect: DELETE 1, no error
--   rollback;
--
--   -- confirm the "keep at least one size" rule still blocks the
--   -- NON-cascade case (deleting a variant while keeping the product):
--   -- (run this against a product that has exactly one variant)
--   delete from product_variants where product_id = '<that product id>';
--   -- expect: still ERROR LAST_VARIANT
--
--   -- confirm the test product is gone:
--   select count(*) from products where slug like 'zz-e2e-variant-test-%';
--   -- expect: 0
-- ===================================================================
