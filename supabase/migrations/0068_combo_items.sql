-- =====================================================================
-- 0068 — combos: a product made of other products
-- ---------------------------------------------------------------------
-- A combo is an ordinary product (own price, photos, stock, SEO, cart and
-- checkout all unchanged), usually filed under a combo category such as
-- "Skin Care Combo". combo_items lists what is inside it, so the admin can
-- build combos and the product page can show "What's inside" and the
-- saving against buying the items separately.
--
-- Stock: a combo sells from its OWN stock (set in Admin → Inventory), like
-- a pre-packed set. Component stock is not decremented.
--
-- Read: anyone, for combos that are published (same rule as product
-- images). Write: admins only.
-- =====================================================================

create table if not exists public.combo_items (
  id uuid primary key default gen_random_uuid(),
  combo_product_id uuid not null references public.products(id) on delete cascade,
  item_product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null default 1 check (quantity between 1 and 99),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint combo_items_not_self check (combo_product_id <> item_product_id),
  constraint combo_items_unique unique (combo_product_id, item_product_id)
);

create index if not exists combo_items_combo_idx on public.combo_items (combo_product_id, sort_order);

alter table public.combo_items enable row level security;

drop policy if exists "combo items of published combos are public" on public.combo_items;
create policy "combo items of published combos are public" on public.combo_items
  for select to anon, authenticated
  using (
    exists (select 1 from public.products p where p.id = combo_product_id and p.status = 'active')
    or public.is_staff('support'::app_role)
  );

drop policy if exists "admins write combo items" on public.combo_items;
create policy "admins write combo items" on public.combo_items
  for all to authenticated
  using (public.is_staff('admin'::app_role))
  with check (public.is_staff('admin'::app_role));

grant select on public.combo_items to anon, authenticated;
grant insert, update, delete on public.combo_items to authenticated;
