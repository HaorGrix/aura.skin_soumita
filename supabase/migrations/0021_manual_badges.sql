-- ===================================================================
-- skin.theory — manual badge flags: Staff Pick, Limited Edition, and a
-- Bestseller override
-- -------------------------------------------------------------------
-- Today `is_best_seller` is entirely computed by the products_public view
-- from sales data, with no way for a client to feature a badge on a new
-- product before it has earned real sales. "Staff Pick" and "Limited
-- Edition" don't exist anywhere — no column, no Badge.jsx variant, nothing.
--
-- Adds three plain boolean columns, edited the same way `is_new` already
-- is (admin form -> products table). `is_best_seller_manual` is additive,
-- not a replacement: products_public still OR's it with the real sales
-- computation, so this can only ever ADD the badge, never hide one a
-- product actually earned by selling well (see the accompanying view
-- update — apply that alongside this).
--
-- HOW TO APPLY: Supabase Dashboard -> SQL Editor -> paste -> Run.
-- ===================================================================

alter table public.products add column if not exists is_staff_pick boolean not null default false;
alter table public.products add column if not exists is_limited_edition boolean not null default false;
alter table public.products add column if not exists is_best_seller_manual boolean not null default false;

-- -------------------------------------------------------------------
-- VERIFY
--   select is_staff_pick, is_limited_edition, is_best_seller_manual
--   from products limit 1;
--   -- expect: all three columns present, default false
-- ===================================================================
