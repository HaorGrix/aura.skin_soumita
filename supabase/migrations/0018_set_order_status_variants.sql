-- ===================================================================
-- skin.script — set_order_status(): restock the VARIANT, not the product
-- -------------------------------------------------------------------
-- order_items now carries variant_id (0016), and place_order() now
-- decrements product_variants.stock_quantity, not products.stock (0017).
-- The cancel/refund auto-restock in set_order_status() (from 0004) still
-- wrote directly to `products.stock` by product_id — for a variant order
-- that puts the units back on the WRONG row (the product mirror, not the
-- variant that was actually sold), so the variant's own stock count would
-- stay wrong forever after a cancellation.
--
-- Fixed to restock product_variants.stock_quantity by variant_id, with a
-- fallback to the product's default variant for any older order_items row
-- that predates variant_id (nothing in existing order history breaks).
--
-- HOW TO APPLY: Supabase Dashboard → SQL Editor → paste → Run.
-- ===================================================================

create or replace function public.set_order_status(
  p_order_id uuid, p_status text, p_note text default null
) returns public.orders language plpgsql security definer set search_path = public as $$
declare v_order public.orders; v_from text; v_item record; v_variant_id uuid;
begin
  if not public.is_staff('support') then raise exception 'FORBIDDEN'; end if;

  select status::text into v_from from public.orders where id = p_order_id for update;
  if v_from is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_from = p_status then raise exception 'NO_CHANGE'; end if;
  if v_from in ('delivered','refunded','cancelled') then
    raise exception 'TERMINAL_STATUS:%', v_from;
  end if;

  update public.orders
     set status = p_status::order_status,
         cancelled_at = case when p_status in ('cancelled','refunded') then now() else cancelled_at end
   where id = p_order_id
  returning * into v_order;

  insert into public.order_events (order_id, from_status, to_status, note, actor_id)
  values (p_order_id, v_from::order_status, p_status::order_status, p_note, auth.uid());

  if p_status in ('cancelled','refunded') then
    for v_item in select product_id, variant_id, quantity from public.order_items
                   where order_id = p_order_id and product_id is not null loop
      -- Older order_items rows (placed before variants existed) have no
      -- variant_id — fall back to that product's current default variant
      -- so the restock still lands somewhere real instead of being lost.
      v_variant_id := coalesce(
        v_item.variant_id,
        (select id from public.product_variants where product_id = v_item.product_id and is_default)
      );

      if v_variant_id is not null then
        update public.product_variants
           set stock_quantity = stock_quantity + v_item.quantity, updated_at = now()
         where id = v_variant_id;
      end if;

      insert into public.inventory_movements (product_id, variant_id, delta, reason, order_id, actor_id, note)
      values (v_item.product_id, v_variant_id, v_item.quantity, 'cancel', p_order_id, auth.uid(), 'auto-restock on ' || p_status);
    end loop;
  end if;

  return v_order;
end $$;

grant execute on function public.set_order_status(uuid,text,text) to authenticated;

-- -------------------------------------------------------------------
-- VERIFY
--   -- place a test order, note the variant's stock_quantity, cancel it,
--   -- confirm stock_quantity went back up by the ordered quantity:
--   select set_order_status('<order id>', 'cancelled', 'test');
--   select stock_quantity from product_variants where id = '<variant id>';
-- -------------------------------------------------------------------
