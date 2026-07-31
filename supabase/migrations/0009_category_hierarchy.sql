-- ===================================================================
-- skin.script — unified category hierarchy (from the reference layout)
-- -------------------------------------------------------------------
-- One taxonomy, three consumers: the navbar mega menu, the shop filters
-- and the admin product form all read `categories`. Adding, renaming or
-- re-nesting a category in /admin/categories changes all three — no code
-- edit, no SQL.
--
-- ── WHY THE CONSTRAINTS CHANGE ──────────────────────────────────────
-- The reference menu repeats child names across columns:
--     Facewash   → Skin Care AND K-Beauty
--     Serum, Moisturizer, Sunscreen, Toner, Essence, Ampoule → both
--     Powder     → Skin Care AND Body Care
--
-- `categories.name` and `categories.slug` are both GLOBALLY unique today
-- (verified against the live database: a second row named "Facewash" is
-- rejected by categories_name_key). So the requested menu is impossible to
-- store as-is — this is a schema problem, not a seeding one.
--
-- Fix:
--   • name  — unique PER PARENT instead of globally. Two "Facewash" rows are
--     fine as long as they sit under different parents. Two top-level
--     categories still can't share a name.
--   • slug  — stays globally unique, because it is the URL key and must
--     resolve to exactly one category. Children therefore get a
--     parent-prefixed slug: skin-care-facewash vs k-beauty-facewash.
--
-- ── STRUCTURE ───────────────────────────────────────────────────────
--   Skin Care ─ Facewash · Moisturizer · Sunscreen · Ampoule · Toner ·
--               Essence · Face Mask · Serum · Special Treatments ·
--               Double Cleansing · Powder · Japanese · Try & Glow ·
--               Skin Care Combo
--   Lip Care  ─ Lip Balm · Lip Mask · Lip Oil · Lip Palette
--   K-Beauty  ─ Facewash · Serum · Moisturizer · Ampoule · Sunscreen ·
--               Toner · Essence
--   Eye Care  ─ Eye Cream · Eye Serum        (also holds products directly)
--   Body Care ─ Body Lotion · Body Wash · Powder · Body Oil · Deodorant ·
--               Body Sunscreen · Grooming Tools · Bar Soap
--
-- Two deliberate departures from the reference image, both trivially
-- reversible in /admin/categories:
--   • "Lip Pallette" appears TWICE in the reference. Taken as a duplication
--     slip; seeded once, spelled "Lip Palette".
--   • Existing categories are RENAMED into their reference equivalents
--     rather than duplicated, so their products come with them:
--       Cleanser → Facewash · Treatment → Special Treatments · Mask → Face Mask
--     A second empty "Facewash" beside a populated "Cleanser" would be worse
--     than either.
--
-- Products are never reassigned: re-parenting touches only
-- `categories.parent_id`, so every product keeps the category_id it had.
--
-- Idempotent — safe to re-run.
-- HOW TO APPLY: Supabase Dashboard → SQL Editor → paste → Run.
-- ===================================================================


-- -------------------------------------------------------------------
-- 1. Constraints: name unique per parent, slug unique globally
-- -------------------------------------------------------------------
alter table public.categories drop constraint if exists categories_name_key;

-- Two partial indexes rather than one on (parent_id, name): in Postgres NULLs
-- are distinct in a unique index, so a plain (parent_id, name) index would
-- happily allow two top-level categories both called "Skin Care".
create unique index if not exists categories_child_name_idx
  on public.categories (parent_id, name) where parent_id is not null;

create unique index if not exists categories_root_name_idx
  on public.categories (name) where parent_id is null;

create index if not exists categories_parent_idx
  on public.categories (parent_id, sort_order);

-- A category cannot be its own parent — cheap guard against an admin slip
-- that would make the tree walk infinite.
do $$ begin
  alter table public.categories
    add constraint categories_no_self_parent check (parent_id is null or parent_id <> id);
exception when duplicate_object then null; end $$;


-- -------------------------------------------------------------------
-- 2. Top-level columns, left to right as the menu reads
-- -------------------------------------------------------------------
insert into public.categories (name, slug, parent_id, sort_order, is_active) values
  ('Skin Care', 'skin-care', null, 10, true),
  ('Lip Care',  'lip-care',  null, 20, true),
  ('K-Beauty',  'k-beauty',  null, 30, true),
  ('Body Care', 'body-care', null, 50, true)
on conflict (slug) do update
  set name = excluded.name, parent_id = null,
      sort_order = excluded.sort_order, is_active = true;

-- Eye Care already exists AND holds 3 products. It becomes a parent while
-- staying directly shoppable — a column header that is itself a link.
update public.categories set parent_id = null, sort_order = 40 where slug = 'eye-care';


-- -------------------------------------------------------------------
-- 3. Re-home the nine existing categories (they carry the products)
--
-- Runs BEFORE the inserts below so the renames free up their target
-- names/slugs and the new rows can't collide with the old ones.
-- -------------------------------------------------------------------
update public.categories c
   set name       = v.new_name,
       slug       = v.new_slug,
       parent_id  = (select id from public.categories where slug = 'skin-care'),
       sort_order = v.ord
  from (values
    ('cleanser',    'Facewash',           'skin-care-facewash',    1),
    ('moisturizer', 'Moisturizer',        'skin-care-moisturizer', 2),
    ('sunscreen',   'Sunscreen',          'skin-care-sunscreen',   3),
    ('toner',       'Toner',              'skin-care-toner',       5),
    ('essence',     'Essence',            'skin-care-essence',     6),
    ('mask',        'Face Mask',          'skin-care-face-mask',   7),
    ('serum',       'Serum',              'skin-care-serum',       8),
    ('treatment',   'Special Treatments', 'skin-care-special-treatments', 9)
  ) as v(old_slug, new_name, new_slug, ord)
 where c.slug = v.old_slug;


-- -------------------------------------------------------------------
-- 4. The rest of the tree
-- -------------------------------------------------------------------
with parents as (
  select slug, id from public.categories where parent_id is null
)
insert into public.categories (name, slug, parent_id, sort_order, is_active)
select v.name, v.slug, p.id, v.ord, true
  from (values
    -- Skin Care (the ones with no existing row yet)
    ('skin-care', 'Ampoule',           'skin-care-ampoule',           4),
    ('skin-care', 'Double Cleansing',  'skin-care-double-cleansing', 10),
    ('skin-care', 'Powder',            'skin-care-powder',           11),
    ('skin-care', 'Japanese',          'skin-care-japanese',         12),
    ('skin-care', 'Try & Glow',        'skin-care-try-and-glow',     13),
    ('skin-care', 'Skin Care Combo',   'skin-care-combo',            14),

    ('lip-care',  'Lip Balm',          'lip-care-lip-balm',           1),
    ('lip-care',  'Lip Mask',          'lip-care-lip-mask',           2),
    ('lip-care',  'Lip Oil',           'lip-care-lip-oil',            3),
    ('lip-care',  'Lip Palette',       'lip-care-lip-palette',        4),

    ('k-beauty',  'Facewash',          'k-beauty-facewash',           1),
    ('k-beauty',  'Serum',             'k-beauty-serum',              2),
    ('k-beauty',  'Moisturizer',       'k-beauty-moisturizer',        3),
    ('k-beauty',  'Ampoule',           'k-beauty-ampoule',            4),
    ('k-beauty',  'Sunscreen',         'k-beauty-sunscreen',          5),
    ('k-beauty',  'Toner',             'k-beauty-toner',              6),
    ('k-beauty',  'Essence',           'k-beauty-essence',            7),

    ('eye-care',  'Eye Cream',         'eye-care-eye-cream',          1),
    ('eye-care',  'Eye Serum',         'eye-care-eye-serum',          2),

    ('body-care', 'Body Lotion',       'body-care-body-lotion',       1),
    ('body-care', 'Body Wash',         'body-care-body-wash',         2),
    ('body-care', 'Powder',            'body-care-powder',            3),
    ('body-care', 'Body Oil',          'body-care-body-oil',          4),
    ('body-care', 'Deodorant',         'body-care-deodorant',         5),
    ('body-care', 'Body Sunscreen',    'body-care-body-sunscreen',    6),
    ('body-care', 'Grooming Tools',    'body-care-grooming-tools',    7),
    ('body-care', 'Bar Soap',          'body-care-bar-soap',          8)
  ) as v(parent_slug, name, slug, ord)
  join parents p on p.slug = v.parent_slug
on conflict (slug) do update
  set name = excluded.name, parent_id = excluded.parent_id,
      sort_order = excluded.sort_order, is_active = true;


-- -------------------------------------------------------------------
-- VERIFY — expect 5 roots and 35 children (14/4/7/2/8).
-- -------------------------------------------------------------------
--   select p.name as column_head, count(c.id) as items
--     from categories p left join categories c on c.parent_id = p.id
--    where p.parent_id is null
--    group by p.name, p.sort_order order by p.sort_order;
--
--   -- products still attached, nothing orphaned:
--   select count(*) from products where category_id is null;          -- 0
--   select count(*) from categories c
--    where c.parent_id is not null
--      and c.parent_id not in (select id from categories);            -- 0
