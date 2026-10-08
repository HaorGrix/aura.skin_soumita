-- =====================================================================
-- 0075 — a product is in stock when ANY of its sizes is
-- ---------------------------------------------------------------------
-- products_public decided in_stock / is_low_stock (and the best-seller
-- ranking) from products.stock alone, which can disagree with the sizes:
-- "30ml in stock, 100ml sold out" showed the whole product as Stock Out
-- in the shop. Stock is now the total across the product's sizes, or
-- products.stock for a product without sizes. Idempotent.
-- =====================================================================

create or replace function public.product_total_stock(p_id uuid, p_fallback integer)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select sum(v.stock_quantity)::integer from public.product_variants v where v.product_id = p_id), p_fallback);
$$;
grant execute on function public.product_total_stock(uuid, integer) to anon, authenticated;

do $$
declare v_def text;
begin
  v_def := pg_get_viewdef('public.products_public'::regclass);
  if position('product_total_stock' in v_def) > 0 then
    return;
  end if;
  if position('(p.stock > 0)' in v_def) = 0 then
    raise exception 'products_public: stock anchor not found, view changed';
  end if;
  v_def := replace(v_def, '(p.stock > 0)', '(public.product_total_stock(p.id, p.stock) > 0)');
  v_def := replace(v_def, '(p.stock <= p.low_stock_at)', '(public.product_total_stock(p.id, p.stock) <= p.low_stock_at)');
  execute 'create or replace view public.products_public as ' || v_def;
end $$;
