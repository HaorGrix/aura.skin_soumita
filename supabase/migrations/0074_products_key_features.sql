-- =====================================================================
-- 0074 — Key features per product (and combo)
-- ---------------------------------------------------------------------
-- A short list of selling points the admin writes (Products → Details,
-- and Combos → New combo), shown as "Key features" on the product page.
-- Exposed on products_public by appending the column to the view.
-- Idempotent.
-- =====================================================================

alter table public.products add column if not exists key_features text[] not null default '{}';
comment on column public.products.key_features is 'Shopper-facing key features, one per item (product page "Key features").';

do $$
declare v_def text;
begin
  v_def := pg_get_viewdef('public.products_public'::regclass);
  if position('key_features' in v_def) > 0 then
    return; -- already exposed
  end if;
  if position(E'p.philosophy\n   FROM ' in v_def) = 0 then
    raise exception 'products_public: anchor not found, view changed';
  end if;
  v_def := replace(v_def, E'p.philosophy\n   FROM ', E'p.philosophy,\n    p.key_features\n   FROM ');
  execute 'create or replace view public.products_public as ' || v_def;
end $$;
