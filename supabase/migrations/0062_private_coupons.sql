-- =====================================================================
-- 0062 — private coupons: valid at checkout, never listed on the site
-- ---------------------------------------------------------------------
-- The shop hands some codes out personally (a friend, an influencer, a
-- complaint). Those must still work when typed, but must not appear in
-- the cart/checkout "You qualify for…" hints, which read
-- list_eligible_coupons().
--
-- `is_public` defaults to true, so every existing coupon keeps being
-- listed exactly as before. Only list_eligible_coupons() gains the filter;
-- validate_coupon_preview() and place_order() are deliberately untouched,
-- so a private code still validates and applies when a shopper types it.
-- =====================================================================

alter table public.coupons
  add column if not exists is_public boolean not null default true;

comment on column public.coupons.is_public is
  'false = private code: works when typed at checkout but is never listed by list_eligible_coupons()';

CREATE OR REPLACE FUNCTION public.list_eligible_coupons(p_subtotal_minor integer DEFAULT 0, p_email text DEFAULT NULL::text)
 RETURNS TABLE(code text, kind text, value_percent numeric, value_minor integer, max_discount_minor integer, also_free_shipping boolean, min_subtotal_minor integer, first_order_only boolean, required_points integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_email text := nullif(trim(coalesce(p_email, '')), '');
begin
  return query
  select
    c.code::text, c.kind::text, c.value_percent, c.value_minor, c.max_discount_minor,
    c.also_free_shipping, c.min_subtotal_minor, c.first_order_only, c.required_points
  from public.coupons c
  where c.is_active
    and c.is_public
    and (c.starts_at is null or now() >= c.starts_at)
    and (c.ends_at is null or now() <= c.ends_at)
    and coalesce(p_subtotal_minor, 0) >= coalesce(c.min_subtotal_minor, 0)
    and (c.usage_limit is null or c.used_count < c.usage_limit)
    and (
      c.required_points is null
      or v_email is null  -- can't confirm yet — list it, place_order() is the real gate
      or (select coalesce(max(cu.points), 0) from public.customers cu where cu.email = v_email) >= c.required_points
    )
    and (
      not c.first_order_only
      or v_email is null
      or not exists (
        select 1 from public.orders o
         where o.email = v_email and o.status <> 'cancelled'
      )
    )
    and (
      v_email is null
      or (
        select count(*) from public.coupon_redemptions r
          join public.orders o on o.id = r.order_id
         where r.coupon_id = c.id and o.email = v_email
      ) < coalesce(c.usage_limit_per_customer, 1)
    )
  order by coalesce(c.value_percent, 0) desc, coalesce(c.value_minor, 0) desc;
end $function$;

