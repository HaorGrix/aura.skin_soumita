-- =====================================================================
-- 0066 — bulk price change from the admin Products list
-- ---------------------------------------------------------------------
-- The admin's "Change price on N products" wrote {id, price_minor} rows
-- with an upsert. An upsert is an INSERT first, so every row failed on the
-- products' required columns and nothing changed — silently. It also
-- targeted products.price_minor, while prices live on product_variants
-- (variants_mirror_to_product copies the default size onto the product).
--
-- bulk_update_prices() reprices EVERY size of the selected products in one
-- transaction:
--   p_mode 'percent' → price × (1 + amount/100)   (e.g. -20 = 20% off)
--          'fixed'   → price + amount taka          (e.g. -100)
--          'set'     → exactly amount taka
-- Prices are rounded to whole taka and never go below 0. A "compare at"
-- price that would no longer be above the new price is cleared (the table
-- requires compare_at > price), so the strike-through never shows a lower
-- "was" price.
--
-- SECURITY INVOKER: RLS decides — only admins can write product_variants.
-- Returns the number of sizes repriced.
-- =====================================================================

create or replace function public.bulk_update_prices(p_ids uuid[], p_mode text, p_amount numeric)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count integer;
begin
  if p_mode not in ('percent', 'fixed', 'set') then
    raise exception 'bulk_update_prices: unknown mode %', p_mode;
  end if;
  if p_amount is null then
    raise exception 'bulk_update_prices: amount is required';
  end if;
  if p_mode = 'percent' and p_amount <= -100 then
    raise exception 'bulk_update_prices: a discount of 100%% or more would make products free';
  end if;

  with priced as (
    select v.id,
           greatest(0, round(
             case p_mode
               when 'percent' then v.price_minor * (1 + p_amount / 100)
               when 'fixed'   then v.price_minor + p_amount * 100
               else p_amount * 100
             end / 100) * 100)::integer as new_price
    from public.product_variants v
    where v.product_id = any(p_ids)
  )
  update public.product_variants v
     set price_minor = priced.new_price,
         compare_at_price_minor = case
           when v.compare_at_price_minor > priced.new_price then v.compare_at_price_minor
           else null end,
         updated_at = now()
    from priced
   where v.id = priced.id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Supabase grants new functions to anon by default; revoking PUBLIC alone
-- leaves that grant, so anon is revoked explicitly.
revoke all on function public.bulk_update_prices(uuid[], text, numeric) from public, anon;
grant execute on function public.bulk_update_prices(uuid[], text, numeric) to authenticated;
