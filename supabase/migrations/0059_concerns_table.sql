-- ===================================================================
-- skin.theory — concerns table, admin-editable in place
-- -------------------------------------------------------------------
-- Today's CONCERNS is a hardcoded array in src/data/products.js — an
-- admin can't rename "Dark Spots" vs "Uneven Skin Tone" apart, or attach
-- an image, without a developer editing that file and redeploying. This
-- adds the missing table and backfills it with the 9 concerns already
-- live, preserving their current names exactly.
--
-- WHY SLUG-LOOKUP, NOT THE BRANDS TRIGGER-MIRROR PATTERN
-- 0028 (brands) kept `products.brand` as a free-text column and used a
-- trigger to cascade a rename into it, specifically because `.brand` was
-- already read as a plain string in ~20 places and rewriting every one of
-- them was a bigger change than that feature called for.
--
-- Concerns are different: every consumer (Shop's filter, the tile-concern
-- dropdown, the product-tagging multi-select) is being updated in this
-- same change anyway, and a product can carry MULTIPLE concerns (an
-- array), which a single trigger-mirrored column can't model as cleanly
-- as it can a single brand. So this follows the CATEGORIES precedent
-- instead: the stable reference stored everywhere (products.concern
-- array elements, a Shop-by-Concern tile's `concern` field) is the
-- concern's SLUG, and every display site does a live slug -> name lookup
-- (src/lib/api/concerns.js, mirroring lib/api/categories.js's
-- findBySlug/categoryNamesFor shape). Renaming only ever touches
-- concerns.name — nothing else has to be rewritten, and nothing can go
-- stale, because nothing but the slug is stored anywhere else.
--
-- RLS mirrors brands' own pattern: any signed-in staff can read (the
-- product editor's dropdown needs this even for editor/support roles who
-- can only VIEW a product), only admin+ can write.
--
-- HOW TO APPLY: `supabase db push` (project is linked), or Dashboard ->
-- SQL Editor -> paste -> Run.
-- ===================================================================

create table if not exists public.concerns (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null,
  image_path text,
  created_at timestamptz not null default now(),
  constraint concerns_name_key unique (name),
  constraint concerns_slug_key unique (slug)
);

alter table public.concerns enable row level security;

drop policy if exists concerns_staff_read on public.concerns;
create policy concerns_staff_read on public.concerns for select using (public.is_staff('support'));

drop policy if exists concerns_admin_write on public.concerns;
create policy concerns_admin_write on public.concerns for all
  using (public.is_staff('admin')) with check (public.is_staff('admin'));

-- -------------------------------------------------------------------
-- Seed the 9 concerns already live in src/data/products.js's CONCERNS
-- array, preserving their exact current names. Slug uses the same rule
-- as slugify() in lib/api/admin/catalog.js: lowercase, non-alphanumeric
-- runs collapsed to '-', trimmed of leading/trailing '-'.
-- -------------------------------------------------------------------
insert into public.concerns (name, slug) values
  ('Hydration',        'hydration'),
  ('Barrier Repair',   'barrier-repair'),
  ('Brightening',      'brightening'),
  ('Acne & Blemishes', 'acne-blemishes'),
  ('Pores',            'pores'),
  ('Anti-Aging',       'anti-aging'),
  ('Soothing',         'soothing'),
  ('Exfoliation',      'exfoliation'),
  ('Sun Protection',   'sun-protection')
on conflict (name) do nothing;

-- -------------------------------------------------------------------
-- Migrate existing data from the old "store the display name" scheme to
-- "store the stable slug" — the only two places anything already
-- referenced a concern by name:
--   1. products.concern (text[]) — replace any element that's an exact
--      canonical name with its slug. Anything else in there (free-text
--      marketing copy from a bulk import, never canonical to begin with)
--      is left untouched; it never matched the storefront filter before
--      this and still won't after.
--   2. content_blocks payload for slot "home.concerns" — each tile's
--      `concern` field. Done as one jsonb-manipulating update since
--      there's no per-item column to alter directly.
-- -------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in select name, slug from public.concerns loop
    update public.products
       set concern = array_replace(concern, r.name, r.slug)
     where r.name = any(concern);
  end loop;
end $$;

update public.content_blocks cb
   set payload = jsonb_set(
     cb.payload,
     '{items}',
     (
       select coalesce(jsonb_agg(
         case
           when (item->>'concern') is not null and (item->>'concern') <> ''
             and exists (select 1 from public.concerns c where c.name = item->>'concern')
           then jsonb_set(item, '{concern}', to_jsonb((select c.slug from public.concerns c where c.name = item->>'concern')))
           else item
         end
       ), '[]'::jsonb)
       from jsonb_array_elements(cb.payload->'items') as item
     )
   )
 where cb.slot = 'home.concerns';

-- -------------------------------------------------------------------
-- VERIFY
--   select count(*) from concerns;                                  -- 9
--   select id, concern from products where concern && (select array_agg(name) from concerns);
--   -- expect: 0 rows — no product still carries a canonical NAME (all converted to slugs)
--   select payload->'items' from content_blocks where slot = 'home.concerns';
--   -- expect: every non-blank `concern` field is now a slug like "acne-blemishes"
-- ===================================================================
