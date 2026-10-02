-- =====================================================================
-- 0071 — Combos are their own thing (Admin → Combos)
-- ---------------------------------------------------------------------
-- A combo used to be "a product filed under a combo category", but no such
-- category exists, so the home Combo tile (/shop?category=skin-care-combo)
-- always showed an empty shop. A combo is now any product flagged is_combo,
-- whatever category it sits in; the storefront's /shop?combo=1 lists the
-- published combos that have items. Idempotent.
-- =====================================================================

alter table public.products add column if not exists is_combo boolean not null default false;
comment on column public.products.is_combo is 'Combo product (Admin → Combos); its contents are in combo_items.';

-- Products that already have combo items are combos.
update public.products p set is_combo = true
 where not p.is_combo
   and exists (select 1 from public.combo_items ci where ci.combo_product_id = p.id);

-- The home Combo tile pointed at a category that was never created.
update public.content_blocks
   set payload = replace(payload::text, '/shop?category=skin-care-combo', '/shop?combo=1')::jsonb
 where payload::text like '%/shop?category=skin-care-combo%';
-- … and both links were stored with the old preview domain in front.
update public.content_blocks
   set payload = replace(payload::text, 'https://aura-skin-soumita.vercel.app/shop?combo=1', '/shop?combo=1')::jsonb
 where payload::text like '%https://aura-skin-soumita.vercel.app/shop?combo=1%';

-- combo_items' public read policy looked the combo up in `products`, which
-- shoppers can't read, so every shopper read failed (permission denied) —
-- "What's inside" never showed and the Combo tile listed nothing.
create or replace function public.is_published_product(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.products p where p.id = p_id and p.status = 'active');
$$;
revoke all on function public.is_published_product(uuid) from public;
grant execute on function public.is_published_product(uuid) to anon, authenticated;

drop policy if exists "combo items of published combos are public" on public.combo_items;
create policy "combo items of published combos are public" on public.combo_items
  for select to anon, authenticated
  using (public.is_published_product(combo_product_id) or public.is_staff('support'::app_role));
