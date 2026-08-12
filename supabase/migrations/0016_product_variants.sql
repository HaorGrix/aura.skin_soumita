-- ===================================================================
-- skin.theory — product variants (multiple sizes per product)
-- -------------------------------------------------------------------
-- Each product can now have one or more size options (e.g. 30ml, 150ml),
-- each with its own price, compare-at price, stock and SKU. A product that
-- has never needed sizes gets exactly ONE variant automatically — nothing
-- about it changes for the shopper or the admin.
--
-- ARCHITECTURE — the one decision that makes this safe to ship
--
-- `products_public` (the storefront's main read path — Shop grid, search,
-- filters, badges, sort) is NOT modified by this migration. Its definition
-- isn't in any tracked migration file (pre-existing baseline, same
-- situation `0012_product_category_map.sql` hit for the same reason), so
-- reconstructing it via CREATE OR REPLACE VIEW would mean guessing its
-- exact join/window-function logic from a sample row — exactly the kind
-- of blind rewrite that caused the §1.3 regression in the 2026-07-30
-- audit. Not repeating that.
--
-- Instead: `products` keeps a mirror of its DEFAULT variant's price,
-- compare-at price, stock and SKU, kept in sync by triggers in both
-- directions. So every existing consumer of `products` /
-- `products_public` — cards, filters, sort, is_on_sale, is_best_seller,
-- the Shop grid, wishlist, related-product scoring — keeps working
-- completely unchanged, because as far as they're concerned nothing
-- happened. The PDP is the only surface that needs to know about the
-- FULL variant list, and it fetches that separately (`product_variants_public`,
-- a small parallel view — same proven shape as `product_category_map`).
--
-- PRIVACY — matches the existing rule, doesn't relax it
--
-- `0005_lock_down_products_table.sql` deliberately hides exact stock counts
-- and cost price from the public (competitors reading your inventory depth).
-- `product_variants_public` follows the same rule: booleans only
-- (`in_stock`, `is_low_stock`), never the raw `stock_quantity`. Staff
-- read the real table directly, same split as `products` / `products_public`.
--
-- HOW TO APPLY: Supabase Dashboard → SQL Editor → paste → Run.
-- ===================================================================


-- -------------------------------------------------------------------
-- 1. The table
-- -------------------------------------------------------------------
create table if not exists public.product_variants (
  id                     uuid primary key default gen_random_uuid(),
  product_id             uuid not null references public.products(id) on delete cascade,
  size_label             text not null,                 -- '30ml', '150ml', 'Standard'…
  sku                    text,
  price_minor            integer not null check (price_minor >= 0),
  compare_at_price_minor integer check (compare_at_price_minor is null or compare_at_price_minor > price_minor),
  stock_quantity         integer not null default 0 check (stock_quantity >= 0),
  is_default             boolean not null default false,
  sort_order             integer not null default 0,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (product_id, size_label)
);

create index if not exists product_variants_product_idx
  on public.product_variants (product_id, sort_order);

-- Exactly one default per product. A plain unique index on (product_id) —
-- not (product_id) where is_default — would forbid a second NON-default
-- variant from ever existing, so the predicate matters.
create unique index if not exists product_variants_one_default_idx
  on public.product_variants (product_id) where is_default;


-- -------------------------------------------------------------------
-- 2. Behaviour triggers — the admin form stays simple because these
--    invariants are enforced here, not re-implemented in every caller.
-- -------------------------------------------------------------------

-- Ticking "default" on one variant un-defaults every sibling automatically.
create or replace function public.variant_clear_other_defaults()
returns trigger language plpgsql as $$
begin
  if new.is_default then
    update public.product_variants
       set is_default = false
     where product_id = new.product_id and id <> new.id and is_default;
  end if;
  return new;
end $$;

drop trigger if exists variants_clear_other_defaults on public.product_variants;
create trigger variants_clear_other_defaults
  before insert or update of is_default on public.product_variants
  for each row when (new.is_default) execute function public.variant_clear_other_defaults();

-- A product can never be left with zero variants — that would mean a
-- price/stock with nowhere to live, and every downstream query assumes
-- at least one row exists.
create or replace function public.variant_prevent_last_delete()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.product_variants where product_id = old.product_id) <= 1 then
    raise exception 'LAST_VARIANT: a product must keep at least one size option';
  end if;
  return old;
end $$;

drop trigger if exists variants_prevent_last_delete on public.product_variants;
create trigger variants_prevent_last_delete
  before delete on public.product_variants
  for each row execute function public.variant_prevent_last_delete();

-- Deleting the default variant promotes the next one (by sort_order) —
-- "exactly one default, always" holds even across a delete.
--
-- Postgres's UPDATE has no ORDER BY / LIMIT clause at all (that's MySQL
-- syntax, not Postgres — the first version of this function used it and
-- Supabase correctly rejected it: "ERROR 42601: syntax error at or near
-- order"). The fix is the standard Postgres idiom: pick the target row
-- with a SELECT ... ORDER BY ... LIMIT 1 subquery, then UPDATE ... WHERE
-- id = (that subquery). The subquery naturally excludes the just-deleted
-- row, since an AFTER DELETE trigger runs once it's already gone.
create or replace function public.variant_promote_next_default()
returns trigger language plpgsql as $$
begin
  if old.is_default then
    update public.product_variants
       set is_default = true
     where id = (
       select id from public.product_variants
        where product_id = old.product_id
        order by sort_order, created_at
        limit 1
     );
  end if;
  return old;
end $$;

drop trigger if exists variants_promote_next_default on public.product_variants;
create trigger variants_promote_next_default
  after delete on public.product_variants
  for each row execute function public.variant_promote_next_default();


-- -------------------------------------------------------------------
-- 3. Two-way price/stock mirror with `products`
--
-- variant -> product: whenever the DEFAULT variant's price, compare-at,
-- stock or SKU change (insert, update, or a delete that promoted a new
-- default), copy those values onto the parent product row. This is what
-- lets every existing view/query/component read `products` unchanged.
--
-- product -> variant: the reverse, for the admin's existing Pricing tab,
-- which still writes price_minor/compare_at_minor/sku straight to
-- `products` for a single-variant product (unchanged code, unchanged UX —
-- see ADMIN section below). Guarded with IS DISTINCT FROM on both sides,
-- which is what stops this from ping-ponging forever: the second hop's
-- values are already identical to what's there, so it's a no-op write.
--
-- Stock is deliberately NOT mirrored product -> variant here: `products.stock`
-- is never written by a plain UPDATE anywhere in the app (the existing
-- convention: only adjust_stock() touches it), so there is no raw-column
-- write on that side to react to. adjust_stock() itself is updated in
-- section 6 to operate on the default variant directly.
-- -------------------------------------------------------------------

create or replace function public.mirror_variant_to_product()
returns trigger language plpgsql as $$
declare v_default public.product_variants%rowtype;
begin
  select * into v_default from public.product_variants
   where product_id = coalesce(new.product_id, old.product_id) and is_default;

  if found then
    update public.products
       set price_minor = v_default.price_minor,
           compare_at_minor = v_default.compare_at_price_minor,
           stock = v_default.stock_quantity,
           sku = v_default.sku,
           updated_at = now()
     where id = v_default.product_id
       and (price_minor is distinct from v_default.price_minor
            or compare_at_minor is distinct from v_default.compare_at_price_minor
            or stock is distinct from v_default.stock_quantity
            or sku is distinct from v_default.sku);
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists variants_mirror_to_product on public.product_variants;
create trigger variants_mirror_to_product
  after insert or update or delete on public.product_variants
  for each row execute function public.mirror_variant_to_product();

create or replace function public.mirror_product_to_default_variant()
returns trigger language plpgsql as $$
begin
  if new.price_minor is distinct from old.price_minor
     or new.compare_at_minor is distinct from old.compare_at_minor
     or new.sku is distinct from old.sku then
    update public.product_variants
       set price_minor = new.price_minor,
           compare_at_price_minor = new.compare_at_minor,
           sku = new.sku,
           updated_at = now()
     where product_id = new.id and is_default
       and (price_minor is distinct from new.price_minor
            or compare_at_price_minor is distinct from new.compare_at_minor
            or sku is distinct from new.sku);
  end if;
  return new;
end $$;

drop trigger if exists product_mirror_to_default_variant on public.products;
create trigger product_mirror_to_default_variant
  after update of price_minor, compare_at_minor, sku on public.products
  for each row execute function public.mirror_product_to_default_variant();


-- -------------------------------------------------------------------
-- 4. Backfill — every existing product gets one 'Standard' default
--    variant, wrapping its current price/stock/sku exactly as-is.
--    Idempotent: skips any product that already has a variant.
-- -------------------------------------------------------------------
insert into public.product_variants
  (product_id, size_label, sku, price_minor, compare_at_price_minor, stock_quantity, is_default, sort_order)
select p.id, 'Standard', p.sku, p.price_minor, p.compare_at_minor, p.stock, true, 0
  from public.products p
 where not exists (select 1 from public.product_variants v where v.product_id = p.id);


-- -------------------------------------------------------------------
-- 5. Public read surface — booleans only, never the raw stock count or
--    SKU, matching products_public's existing privacy rule exactly.
-- -------------------------------------------------------------------
create or replace view public.product_variants_public as
select
  pv.id, pv.product_id, pv.size_label, pv.sort_order, pv.is_default,
  pv.price_minor, pv.compare_at_price_minor,
  (pv.compare_at_price_minor is not null and pv.compare_at_price_minor > pv.price_minor) as is_on_sale,
  case when pv.compare_at_price_minor > pv.price_minor
       then round((1 - pv.price_minor::numeric / pv.compare_at_price_minor) * 100)::int
       else 0 end as discount_percent,
  (pv.stock_quantity > 0)                                        as in_stock,
  (pv.stock_quantity > 0 and pv.stock_quantity <= coalesce(p.low_stock_at, 5)) as is_low_stock
from public.product_variants pv
join public.products p on p.id = pv.product_id
where p.status = 'active';

-- Runs with the owner's rights, same reasoning as products_public and
-- product_category_map — 0005 locked anon out of the base `products` table,
-- and this view's own JOIN against it would otherwise break for anon too.
alter view public.product_variants_public set (security_invoker = false);
grant select on public.product_variants_public to anon, authenticated;


-- -------------------------------------------------------------------
-- 6. RLS on the base table — staff only, same shape as `products` itself
-- -------------------------------------------------------------------
alter table public.product_variants enable row level security;

drop policy if exists product_variants_staff_read on public.product_variants;
create policy product_variants_staff_read on public.product_variants
  for select using (public.is_staff('support'));

drop policy if exists product_variants_admin_write on public.product_variants;
create policy product_variants_admin_write on public.product_variants
  for all using (public.is_staff('admin')) with check (public.is_staff('admin'));

-- No direct anon/authenticated grant at all — product_variants_public is
-- the only public-facing surface, exactly mirroring products_public.


-- -------------------------------------------------------------------
-- 7. order_items — carry the specific variant + its frozen size label,
--    additive only (existing columns untouched).
-- -------------------------------------------------------------------
alter table public.order_items add column if not exists variant_id uuid references public.product_variants(id) on delete set null;
alter table public.order_items add column if not exists size_label text;

-- inventory_movements gets the same addition, so stock history can be
-- read per-variant, not just per-product.
alter table public.inventory_movements add column if not exists variant_id uuid references public.product_variants(id) on delete set null;


-- -------------------------------------------------------------------
-- 8. RPCs
-- -------------------------------------------------------------------

-- Variant-aware stock adjustment. adjust_stock() (product-level) is kept
-- for anything not yet updated to call this directly — it now resolves to
-- the product's DEFAULT variant, so single-variant products (the common
-- case) work through EITHER call unchanged.
create or replace function public.adjust_stock_variant(
  p_variant_id uuid, p_delta int, p_reason text default 'adjust', p_note text default null
) returns int language plpgsql security definer set search_path = public as $$
declare v_new int; v_product_id uuid;
begin
  if not public.is_staff('admin') then raise exception 'FORBIDDEN'; end if;
  if p_delta = 0 then raise exception 'DELTA_ZERO'; end if;

  update public.product_variants
     set stock_quantity = stock_quantity + p_delta, updated_at = now()
   where id = p_variant_id
  returning stock_quantity, product_id into v_new, v_product_id;

  if not found then raise exception 'VARIANT_NOT_FOUND'; end if;
  if v_new < 0 then raise exception 'NEGATIVE_STOCK'; end if;

  insert into public.inventory_movements (product_id, variant_id, delta, reason, actor_id, note)
  values (v_product_id, p_variant_id, p_delta, p_reason, auth.uid(), p_note);

  return v_new;
end $$;

grant execute on function public.adjust_stock_variant(uuid,int,text,text) to authenticated;

create or replace function public.adjust_stock(
  p_product_id uuid, p_delta int, p_reason text default 'adjust', p_note text default null
) returns int language plpgsql security definer set search_path = public as $$
declare v_variant_id uuid;
begin
  select id into v_variant_id from public.product_variants
   where product_id = p_product_id and is_default;
  if v_variant_id is null then raise exception 'PRODUCT_NOT_FOUND'; end if;
  return public.adjust_stock_variant(v_variant_id, p_delta, p_reason, p_note);
end $$;

grant execute on function public.adjust_stock(uuid,int,text,text) to authenticated;


-- -------------------------------------------------------------------
-- VERIFY
-- -------------------------------------------------------------------
--   -- every active product has exactly one default variant:
--   select p.id from products p
--    where p.status = 'active'
--      and (select count(*) from product_variants v
--            where v.product_id = p.id and v.is_default) <> 1;
--   -- expect 0 rows
--
--   -- products.price_minor / stock still mirror the default variant:
--   select p.price_minor, p.stock, v.price_minor, v.stock_quantity
--     from products p join product_variants v
--       on v.product_id = p.id and v.is_default
--    limit 5;
--   -- the two columns on each side should match exactly
--
--   -- anon cannot read raw stock_quantity:
--   -- REST: /rest/v1/product_variants?select=stock_quantity  -> expect 401/empty
--   -- REST: /rest/v1/product_variants_public?select=in_stock -> expect rows, booleans only
-- ===================================================================
