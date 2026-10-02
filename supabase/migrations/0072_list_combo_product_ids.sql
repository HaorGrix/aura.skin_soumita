-- =====================================================================
-- 0072 — one public call for "which products are combos"
-- ---------------------------------------------------------------------
-- The shop's Combo view read combo_items directly, so whether it worked
-- depended on the visitor's role and RLS path; any failure showed shoppers
-- an empty "0 products" page. This definer function returns the published
-- combos (is_combo, active, with items) the same way for everyone.
-- =====================================================================

create or replace function public.list_combo_product_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
    from public.products p
   where p.is_combo
     and p.status = 'active'
     and exists (select 1 from public.combo_items ci where ci.combo_product_id = p.id);
$$;
revoke all on function public.list_combo_product_ids() from public;
grant execute on function public.list_combo_product_ids() to anon, authenticated;
