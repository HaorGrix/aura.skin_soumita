-- ===================================================================
-- skin.theory — fix "product not found" on click: normalize product
-- slugs at the database boundary, backfill the 7 currently-broken rows,
-- and close the (previously unenforced) slug-collision gap
-- -------------------------------------------------------------------
-- ROOT CAUSE (audited live, 2026-09-04, via an exact simulation of the
-- real navigation path — ProductCard.jsx's href, the browser's own
-- WHATWG URL parsing of that href, then App.jsx's decodeURIComponent —
-- against every product.slug in the live database):
--
-- The admin's product Slug field accepts free-typed/pasted text with NO
-- normalization. slugify() (lib/api/admin/catalog.js) exists and IS
-- correct, but it only ever runs as a fallback when the field is left
-- BLANK (`row.slug = row.slug || slugify(...)`) — a slug the admin
-- actually typed or pasted is stored completely as-is. In practice that
-- means most of the catalog's slugs are raw product names: mixed case,
-- spaces, '%', '+', ':', '&', '(', ')', even invisible Unicode —
-- whatever was in the clipboard.
--
-- Most of those characters are harmless — the browser's URL parser
-- percent-encodes them on the way out and decodeURIComponent() correctly
-- restores the exact original string on the way back in, so the id used
-- for the live lookup matches the stored value and the page loads fine.
-- Two specific things do NOT round-trip:
--   1. Leading/trailing whitespace — the WHATWG URL spec strips
--      leading/trailing C0-control-or-space characters from a URL
--      before parsing it. A trailing space in the stored slug is
--      silently gone from `window.location.pathname` by the time
--      App.jsx reads it, so the id used to query never matches the
--      whitespace-padded value actually stored in `products.slug`.
--   2. A literal, un-escaped '%' not followed by two hex digits (e.g.
--      "...10%-Serum") is an invalid percent-escape sequence.
--      decodeURIComponent() throws URIError: URI malformed on it —
--      App.jsx's catch block keeps the raw (still-wrong) string, which
--      also never matches the stored slug.
--
-- getProductBySlug() (lib/api/products.js) does a plain exact-match
-- `.eq('slug', slug)` against products_public — so a slug that differs
-- by even one trailing space returns zero rows, which Product.jsx
-- correctly (if unhelpfully, from the shopper's perspective) renders as
-- "We couldn't find that product."
--
-- Confirmed: exactly 7 products are currently affected by this — the 2
-- reported (CAPLINO Niacinamide 10% Serum, Anua Azelaic Acid 10
-- Hyaluron...) plus 5 more found only by running every live slug through
-- the same simulation: DABO Rice Ferment Foam, MARS Oil Blotter Gel
-- Compact, BIOAQUA Suck Out Blackheads Nasal Mask- 6 gm (all `active` —
-- currently unclickable on the live storefront), and 2 `draft` products
-- (Celimax Retinal Shot Tightening Booster, DABO All In One Black Snail
-- Repair Cream) that would hit the same bug the moment they're published.
-- The catalog's other ~40 products with non-alphanumeric characters in
-- their slug (colons, ampersands, parens, uppercase, invisible Unicode)
-- are NOT affected — those characters round-trip correctly — so they are
-- deliberately left untouched here rather than re-slugified on spec.
--
-- CORRECTION (added after applying, for anyone reading this file later):
-- this migration originally also added a "collision safeguard" unique
-- index (products_slug_unique_idx), on the belief that products.slug had
-- no unique constraint at all. That belief was WRONG — it came from a
-- collision test that (ironically) had the exact same case-sensitivity
-- bug this migration fixes: it tried to collide against a lowercased
-- guess of an existing slug that was actually still mixed-case at the
-- time, so it was never a real collision test. products.slug already had
-- a real `products_slug_key UNIQUE (slug)` constraint in the untracked
-- base schema the whole time (confirmed via pg_constraint) — collisions
-- were never actually possible. products_slug_unique_idx below is
-- therefore redundant, not a new safeguard; it's harmless (a second
-- index enforcing the same uniqueness products_slug_key already does)
-- but can be dropped once convenient:
--   drop index if exists public.products_slug_unique_idx;
--
-- FIX (root cause, not a patch on the symptom):
--   1. public.slugify(text) — a SQL port of the existing JS slugify(),
--      byte-identical rules (lower, collapse any run of non [a-z0-9]
--      into '-', trim leading/trailing '-'). Single source of truth
--      going forward: this function is what enforces the slug, not
--      whatever the client happened to send.
--   2. A BEFORE INSERT OR UPDATE OF slug trigger that runs every write
--      through it. This is the actual, load-bearing fix — it's what
--      makes it IMPOSSIBLE to store an un-normalized slug again, from
--      ANY caller (admin UI, a script, a future different write path),
--      the same "enforce the invariant once, in the database" idiom
--      this file already uses for product_variants (0016) and the
--      default-variant backfill (0051). products_slug_key (pre-existing)
--      already made a POST-normalization collision a hard error.
--   3. A backfill that re-normalizes exactly the 7 affected rows (by
--      touching their slug column, which fires the new trigger) —
--      nothing else in the catalog is touched.
--
-- HOW TO APPLY: Supabase Dashboard -> SQL Editor -> paste -> Run.
-- ===================================================================

-- -------------------------------------------------------------------
-- 1. Canonical slugify(), ported from lib/api/admin/catalog.js /
--    src/data/products.js — same three rules, same order:
--    lowercase -> collapse non-[a-z0-9] runs to '-' -> trim edge '-'.
-- -------------------------------------------------------------------
create or replace function public.slugify(input text)
returns text
language sql immutable as $$
  select trim(both '-' from regexp_replace(lower(coalesce(input, '')), '[^a-z0-9]+', '-', 'g'));
$$;

-- -------------------------------------------------------------------
-- 2. Enforce it on every write, going forward. Idempotent by nature
--    (slugify(slugify(x)) = slugify(x)), so this is safe even if a
--    caller already sends a clean slug.
-- -------------------------------------------------------------------
create or replace function public.product_normalize_slug()
returns trigger language plpgsql as $$
begin
  new.slug := public.slugify(new.slug);
  return new;
end $$;

drop trigger if exists products_normalize_slug on public.products;
create trigger products_normalize_slug
  before insert or update of slug on public.products
  for each row execute function public.product_normalize_slug();

-- -------------------------------------------------------------------
-- 3. Close the collision gap — confirmed live there was no constraint
--    at all. No existing duplicates today, so this applies cleanly.
-- -------------------------------------------------------------------
create unique index if not exists products_slug_unique_idx on public.products (slug);

-- -------------------------------------------------------------------
-- 4. Backfill — touch only the 7 confirmed-broken rows. Setting
--    slug = slug fires the trigger above, which normalizes it; nothing
--    else about these rows changes, and no other product is touched.
-- -------------------------------------------------------------------
update public.products set slug = slug
 where id in (
  'a325faec-4099-42f9-9e01-f08dc0398c2f', -- Anua Azelaic Acid 10 Hyaluron Redness-Soothing Serum
  '499ed092-8c2b-4bf3-a59b-1affd8496107', -- CAPLINO Niacinamide 10% Serum
  '90db9660-58a1-4e68-8a2f-44dae8804d49', -- DABO Rice Ferment Foam
  '5d1c3595-2a36-48b1-b663-3e476b31a981', -- MARS Oil Blotter Gel Compact
  '1ac40078-1a61-4b6f-a321-86d985a84f6d', -- BIOAQUA Suck Out Blackheads Nasal Mask- 6 gm
  '56dca47d-5654-416d-b601-b338a276ac29', -- Celimax Retinal Shot Tightening Booster (draft)
  '630ae51b-758f-4c63-ac1e-88632f3c1005'  -- DABO All In One Black Snail Repair Cream (draft)
 );

-- -------------------------------------------------------------------
-- VERIFY
--   -- the 7 rows now have clean, round-trip-safe slugs:
--   select id, slug, status from public.products
--    where id in (
--      'a325faec-4099-42f9-9e01-f08dc0398c2f','499ed092-8c2b-4bf3-a59b-1affd8496107',
--      '90db9660-58a1-4e68-8a2f-44dae8804d49','5d1c3595-2a36-48b1-b663-3e476b31a981',
--      '1ac40078-1a61-4b6f-a321-86d985a84f6d','56dca47d-5654-416d-b601-b338a276ac29',
--      '630ae51b-758f-4c63-ac1e-88632f3c1005');
--   -- expect e.g. "anua-azelaic-acid-10-hyaluron-redness-soothing-serum",
--   --             "caplino-niacinamide-10-serum", no leading/trailing
--   --             whitespace, no '%'
--
--   -- the trigger works going forward:
--   update public.products set slug = '  Sneaky Slug!! ' where id = (select id from products limit 1);
--   select slug from public.products where id = (select id from products limit 1);
--   -- expect: "sneaky-slug" -- then restore the original slug for that row
--
--   -- collisions are now a hard error:
--   -- insert a product with a slug matching any existing one -> expect
--   -- a unique-violation, not a silently-created duplicate.
--
--   -- untouched products (the other ~40 with colons/ampersands/etc.)
--   -- still have their EXACT original slug — confirm a couple by id.
-- ===================================================================
