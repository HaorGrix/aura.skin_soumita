-- =====================================================================
-- 0061 — public order tracking by order number + phone
-- ---------------------------------------------------------------------
-- The storefront's "Track order" page needs the REAL order status (the one
-- staff set in /admin via set_order_status), for guests as well, without
-- any login. Orders are otherwise invisible to anon under RLS.
--
-- track_order() is the only way in:
--   • both the order number AND the phone used at checkout must match
--     (phone compared through normalize_bd_phone, so 017…, +88017… and
--     88017… are the same number);
--   • it returns status, dates, courier/tracking number and the item names
--     only — never the address, email, full phone or prices per line;
--   • a miss returns NULL whether the number or the phone was wrong, so it
--     can't be used to learn which order numbers exist.
-- =====================================================================

create or replace function public.track_order(p_number text, p_phone text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_phone text := public.normalize_bd_phone(p_phone);
  v_order public.orders%rowtype;
begin
  if coalesce(btrim(p_number), '') = '' or v_phone is null then
    return null;
  end if;

  select * into v_order
  from public.orders o
  where upper(o.number) = upper(btrim(p_number))
    and public.normalize_bd_phone(o.shipping_address ->> 'phone') = v_phone
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'number', v_order.number,
    'status', v_order.status,
    'placed_at', v_order.placed_at,
    'cancelled_at', v_order.cancelled_at,
    'courier', v_order.courier,
    'tracking_number', v_order.tracking_number,
    'total_minor', v_order.total_minor,
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'name', oi.product_name, 'size', oi.size_label, 'qty', oi.quantity)
             order by oi.product_name), '[]'::jsonb)
      from public.order_items oi
      where oi.order_id = v_order.id
    ),
    'events', (
      select coalesce(jsonb_agg(jsonb_build_object('status', e.to_status, 'at', e.created_at)
             order by e.created_at), '[]'::jsonb)
      from public.order_events e
      where e.order_id = v_order.id
    )
  );
end;
$$;

revoke all on function public.track_order(text, text) from public;
grant execute on function public.track_order(text, text) to anon, authenticated;
