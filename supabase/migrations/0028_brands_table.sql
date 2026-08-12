-- ===================================================================
-- skin.theory — brands table, with a real FK and live-cascading rename
-- -------------------------------------------------------------------
-- Today `products.brand` is free text — typing a new brand on a product
-- doesn't add it anywhere reusable, so it can't be picked again or
-- renamed in one place. This adds the missing table, a real
-- `products.brand_id` relationship, and backfills both from every
-- distinct brand already in use, so no existing product loses its brand.
--
-- WHY A TRIGGER, NOT A VIEW JOIN (the categories precedent)
-- `products.brand` is read as a plain string in ~20 places across the
-- storefront and admin (mapProduct, ProductCard, Shop's brand filter,
-- admin listBrands()...). Converting every one of those to join against
-- `brands` is a much bigger change than this feature calls for. This
-- project already has a proven pattern for exactly this shape of problem
-- — product_variants/products mirror each other via trigger
-- (mirror_variant_to_product / mirror_product_to_default_variant, see
-- 0016_product_variants.sql) rather than making every reader join. Same
-- idea here: `brand_id` is the real relationship; a trigger keeps the
-- existing `products.brand` text column in sync with it automatically,
-- so renaming a brand in the Brands section cascades to every product
-- using it — live, everywhere — with zero changes to any existing
-- consumer of `.brand`.
--
-- RLS mirrors products' own pattern: any signed-in staff can read (the
-- product editor's dropdown needs this even for editor/support roles who
-- can only VIEW a product), only admin+ can write.
--
-- HOW TO APPLY: Supabase Dashboard -> SQL Editor -> paste -> Run.
-- ===================================================================

create table if not exists public.brands (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null,
  created_at timestamptz not null default now(),
  constraint brands_name_key unique (name),
  constraint brands_slug_key unique (slug)
);

alter table public.brands enable row level security;

drop policy if exists brands_staff_read on public.brands;
create policy brands_staff_read on public.brands for select using (public.is_staff('support'));

drop policy if exists brands_admin_write on public.brands;
create policy brands_admin_write on public.brands for all
  using (public.is_staff('admin')) with check (public.is_staff('admin'));

-- -------------------------------------------------------------------
-- Backfill brands — one row per distinct, trimmed brand name already in
-- use. Slug uses the same rule as slugify() in lib/api/admin/catalog.js:
-- lowercase, non-alphanumeric runs collapsed to '-', trimmed of leading/
-- trailing '-'.
-- -------------------------------------------------------------------
insert into public.brands (name, slug)
select distinct
  trim(p.brand) as name,
  trim(both '-' from regexp_replace(lower(trim(p.brand)), '[^a-z0-9]+', '-', 'g')) as slug
from public.products p
where p.brand is not null and trim(p.brand) <> ''
on conflict (name) do nothing;

-- -------------------------------------------------------------------
-- The real relationship, plus backfilling it from the text that's there.
-- -------------------------------------------------------------------
alter table public.products add column if not exists brand_id uuid references public.brands(id);

update public.products p
   set brand_id = b.id
  from public.brands b
 where b.name = trim(p.brand)
   and p.brand_id is null
   and p.brand is not null;

-- -------------------------------------------------------------------
-- Keep products.brand (the text column every existing reader already
-- uses) in step with brand_id — the same mirror-via-trigger shape as
-- 0016's variant/product price sync, just one field instead of three.
-- BEFORE, not AFTER: rewriting NEW.brand here lands in the SAME row
-- write, no second UPDATE/recursion needed.
-- -------------------------------------------------------------------
create or replace function public.sync_product_brand_from_id()
returns trigger language plpgsql as $$
begin
  if new.brand_id is not null then
    select name into new.brand from public.brands where id = new.brand_id;
  end if;
  return new;
end $$;

drop trigger if exists products_brand_id_sync on public.products;
create trigger products_brand_id_sync
  before insert or update of brand_id on public.products
  for each row execute function public.sync_product_brand_from_id();

-- -------------------------------------------------------------------
-- Rename cascade — renaming a brand updates every product.brand that
-- references it, in the same transaction as the rename.
-- -------------------------------------------------------------------
create or replace function public.cascade_brand_rename()
returns trigger language plpgsql as $$
begin
  if new.name is distinct from old.name then
    update public.products set brand = new.name where brand_id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists brands_rename_cascade on public.brands;
create trigger brands_rename_cascade
  after update of name on public.brands
  for each row execute function public.cascade_brand_rename();

-- -------------------------------------------------------------------
-- VERIFY
--   select count(*) from brands;                    -- one per distinct existing brand
--   select count(*) from products where brand_id is null and brand is not null;
--   -- expect: 0 — every product with a brand backfilled a matching brand_id
--
--   -- cascade check (rollback after, don't leave test data behind):
--   begin;
--     update brands set name = name || ' TEST' where name = (select name from brands limit 1);
--     select brand from products where brand_id = (select id from brands where name like '% TEST');
--     -- expect: every matching product's brand text already shows " TEST" appended
--   rollback;
-- ===================================================================
