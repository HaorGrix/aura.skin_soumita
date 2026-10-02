-- =====================================================================
-- 0070 — Rewards programme fully run from the admin (Admin → Rewards)
-- ---------------------------------------------------------------------
-- Until now the storefront's Rewards page used hardcoded tiers (SKN3/
-- SKN5/SKN8FS) and earn rates ("1 point per ৳1000, 5 per review") that
-- matched neither the real reward coupons (AURA3/AURA5/AURA8FS) nor the
-- live earn settings (both 0). Everything now comes from the database:
--
--   store_settings.rewards_enabled  — the whole programme on/off. Off:
--       no points are earned (orders, reviews), reward coupons can't be
--       used or suggested, and the storefront hides the programme.
--   store_settings.rewards_name     — programme name ("<store> Rewards"
--       when empty).
--   store_settings.points_per_taka / points_per_review — earn rates
--       (existing columns, now edited on the Rewards screen).
--   coupons.reward_label            — how a reward tier is described to
--       shoppers ("Free shipping + 8% off"); tiers are the coupons that
--       have required_points.
--   list_reward_tiers()             — the public list of active tiers.
--
-- The existing functions are patched in place (one line each); every patch
-- checks its anchor text so a changed function fails loudly instead of
-- being silently skipped. Idempotent.
-- =====================================================================

alter table public.store_settings add column if not exists rewards_enabled boolean not null default true;
alter table public.store_settings add column if not exists rewards_name text;
alter table public.coupons add column if not exists reward_label text;

comment on column public.store_settings.rewards_enabled is 'Rewards programme on/off (Admin → Rewards).';
comment on column public.coupons.reward_label is 'Shopper-facing description of a reward tier (coupons with required_points).';

-- Public list of reward tiers (active reward coupons), lowest first. Empty
-- while the programme is off.
create or replace function public.list_reward_tiers()
returns table (
  code text, required_points integer, kind text, value_percent numeric,
  value_minor integer, also_free_shipping boolean, label text
)
language sql
stable
security definer
set search_path = public
as $$
  select c.code::text, c.required_points, c.kind::text, c.value_percent, c.value_minor,
         c.also_free_shipping, c.reward_label
    from public.coupons c
   where c.required_points is not null
     and c.is_active
     and (c.starts_at is null or c.starts_at <= now())
     and (c.ends_at is null or c.ends_at >= now())
     and coalesce((select s.rewards_enabled from public.store_settings s where s.id = true), true)
   order by c.required_points, c.code;
$$;
revoke all on function public.list_reward_tiers() from public;
grant execute on function public.list_reward_tiers() to anon, authenticated;

-- Patch helper: replace one anchor in a function's definition and re-create it.
create or replace function pg_temp.patch_fn(p_sig text, p_marker text, p_old text, p_new text)
returns void language plpgsql as $$
declare v_def text;
begin
  v_def := pg_get_functiondef(p_sig::regprocedure);
  if position(p_marker in v_def) > 0 then
    return; -- already patched
  end if;
  -- Some functions were created from Windows-edited files and keep CRLF
  -- line endings; match multi-line anchors either way.
  if position(p_old in v_def) = 0 and position(replace(p_old, E'\n', E'\r\n') in v_def) > 0 then
    p_old := replace(p_old, E'\n', E'\r\n');
    p_new := replace(p_new, E'\n', E'\r\n');
  end if;
  if position(p_old in v_def) = 0 then
    raise exception 'patch anchor not found in %: %', p_sig, left(p_old, 80);
  end if;
  execute replace(v_def, p_old, p_new);
end $$;

-- place_order: no points while the programme is off …
select pg_temp.patch_fn('public.place_order(jsonb)', 'rewards_enabled, true) then floor',
  'v_points_earned := floor((v_total / 100.0) * coalesce(v_settings.points_per_taka, 0));',
  'v_points_earned := case when coalesce(v_settings.rewards_enabled, true) then floor((v_total / 100.0) * coalesce(v_settings.points_per_taka, 0)) else 0 end;');
-- … and reward coupons can't be used.
select pg_temp.patch_fn('public.place_order(jsonb)', 'rewards programme off',
  E'    if v_coupon.required_points is not null then\n      select coalesce(max(points), 0) into v_customer_points',
  E'    if v_coupon.required_points is not null then\n      -- rewards programme off: reward coupons are switched off with it\n      if not coalesce(v_settings.rewards_enabled, true) then raise exception ''COUPON_INVALID:inactive''; end if;\n      select coalesce(max(points), 0) into v_customer_points');

-- submit_review: no review points while the programme is off.
select pg_temp.patch_fn('public.submit_review(uuid,integer,text,text)', 'rewards_enabled, true) then points_per_review',
  'select points_per_review into v_points from public.store_settings where id = true;',
  'select case when coalesce(rewards_enabled, true) then points_per_review else 0 end into v_points from public.store_settings where id = true;');

-- validate_coupon_preview: a reward coupon reads as inactive while off.
select pg_temp.patch_fn('public.validate_coupon_preview(text,integer,text)', 'rewards_enabled from public.store_settings',
  'if not v_coupon.is_active then',
  'if not v_coupon.is_active or (v_coupon.required_points is not null and not coalesce((select rewards_enabled from public.store_settings where id = true), true)) then');

-- list_eligible_coupons: never suggest reward coupons while off.
select pg_temp.patch_fn('public.list_eligible_coupons(integer,text)', 'rewards_enabled from public.store_settings',
  'or (select coalesce(max(cu.points), 0) from public.customers cu where cu.email = v_email) >= c.required_points',
  'or (coalesce((select rewards_enabled from public.store_settings where id = true), true) and (select coalesce(max(cu.points), 0) from public.customers cu where cu.email = v_email) >= c.required_points)');

-- Describe the existing reward tiers for shoppers.
update public.coupons set reward_label = '3% off your order' where code = 'AURA3' and reward_label is null;
update public.coupons set reward_label = '5% off your order' where code = 'AURA5' and reward_label is null;
update public.coupons set reward_label = 'Free shipping + 8% off' where code = 'AURA8FS' and reward_label is null;
