-- ===================================================================
-- aura.skin — Admin panel foundation (additive migration)
-- -------------------------------------------------------------------
-- The core commerce schema (products, products_public, categories,
-- product_images, orders, order_items, order_events, customers,
-- coupons, coupon_redemptions, content_blocks, profiles,
-- product_slug_history) is ALREADY APPLIED on the project. This
-- migration adds only what the admin panel needs on top of it:
--
--   1. Missing columns on existing tables
--   2. store_settings      — editable shipping/tax/loyalty config
--   3. inventory_movements — the stock ledger
--   4. sales               — flash / seasonal campaigns
--   5. content_revisions   — undo history for the CMS
--   6. audit_log           — immutable record of every staff write
--   7. Role helpers + RLS policies for staff access
--   8. RPCs: adjust_stock, set_order_status, admin_bootstrap_owner
--
-- Every statement is idempotent (IF NOT EXISTS / OR REPLACE / DROP..
-- CREATE for policies), so re-running this file is safe.
--
-- HOW TO APPLY: Supabase Dashboard → SQL Editor → paste → Run.
-- ===================================================================

-- -------------------------------------------------------------------
-- 1. Missing columns on existing tables
-- -------------------------------------------------------------------
alter table public.coupons        add column if not exists applies_to jsonb;
alter table public.coupons        add column if not exists also_free_shipping boolean not null default false;
alter table public.coupons        add column if not exists created_by uuid references auth.users;
alter table public.coupons        add column if not exists created_at timestamptz not null default now();

alter table public.content_blocks add column if not exists schema_version int not null default 1;

alter table public.product_images add column if not exists width int;
alter table public.product_images add column if not exists height int;

alter table public.categories     add column if not exists image_path text;

alter table public.profiles       add column if not exists email text;
alter table public.profiles       add column if not exists is_active boolean not null default true;
alter table public.profiles       add column if not exists last_seen_at timestamptz;

-- -------------------------------------------------------------------
-- 2. Role helpers
-- -------------------------------------------------------------------
-- `app_role` and `is_staff(app_role)` ALREADY EXIST from the earlier
-- migration. Two things about the existing setup drive what follows:
--
--   1. is_staff's parameter is the app_role ENUM, not text. Declaring it as
--      text here would create a second, overloaded function rather than
--      replacing the original — and then every `is_staff('support')` call in
--      a policy becomes ambiguous ("function is_staff(unknown) is not
--      unique") and errors at query time. The signature below matches the
--      existing one exactly, so this genuinely replaces it.
--
--   2. The existing auth_role() ends in `coalesce(…, 'support')`, so it
--      returns 'support' for a caller with no JWT and no profile row. That
--      makes is_staff('support') TRUE for anonymous visitors and for any
--      signed-in shopper. The staff read policies added further down are
--      gated on is_staff('support') — with the old definition they would
--      have published every order and every customer's PII to the public
--      internet. auth_role() is left untouched (other objects may depend on
--      it); is_staff is redefined to be authoritative instead.
--
-- The rule now: staff status requires an ACTIVE ROW IN profiles. No row,
-- no access — regardless of what any JWT claim says.
do $$ begin
  create type app_role as enum ('owner','admin','editor','support');
exception when duplicate_object then null; end $$;

-- SECURITY DEFINER matters twice over here. It lets the function read
-- profiles even though profiles has its own RLS, and — because the function
-- owner bypasses row security — it stops the profiles SELECT policy below
-- (which itself calls is_staff) from recursing into itself.
create or replace function public.is_staff(min_role app_role default 'editor')
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from public.profiles p
     where p.id = auth.uid()
       and coalesce(p.is_active, true)
       and case p.role
             when 'owner'   then true
             when 'admin'   then min_role in ('admin','editor','support')
             when 'editor'  then min_role in ('editor','support')
             when 'support' then min_role = 'support'
             else false
           end
  );
$$;

-- Keep the JWT claim in step with profiles.role.
create or replace function public.sync_role_claim()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data,'{}'::jsonb)
                             || jsonb_build_object('role', new.role::text)
   where id = new.id;
  return new;
end $$;

drop trigger if exists profiles_sync_role on public.profiles;
create trigger profiles_sync_role
  after insert or update of role on public.profiles
  for each row execute function public.sync_role_claim();

-- -------------------------------------------------------------------
-- 3. store_settings — one row, id is forced to true
-- -------------------------------------------------------------------
create table if not exists public.store_settings (
  id                            boolean primary key default true check (id),
  store_name                    text    not null default 'aura.skin',
  free_shipping_threshold_minor int     not null default 600000,
  standard_shipping_minor       int     not null default 10000,
  express_shipping_minor        int     not null default 15000,
  tax_rate                      numeric(5,4) not null default 0,
  currency_code                 text    not null default 'BDT',
  currency_symbol               text    not null default '৳',
  points_per_taka               numeric not null default 0.01,
  points_per_review             int     not null default 5,
  low_stock_threshold           int     not null default 5,
  support_email                 text,
  support_phone                 text,
  socials                       jsonb   not null default '{}'::jsonb,
  announcement_enabled          boolean not null default false,
  maintenance_mode              boolean not null default false,
  updated_by                    uuid references auth.users,
  updated_at                    timestamptz not null default now()
);
insert into public.store_settings (id) values (true) on conflict (id) do nothing;

-- -------------------------------------------------------------------
-- 4. inventory_movements — append-only stock ledger.
--    products.stock is the running balance; this table explains it.
--    Without the ledger "why is stock 3?" is unanswerable, which is
--    exactly the question that makes a client phone a developer.
-- -------------------------------------------------------------------
create table if not exists public.inventory_movements (
  id         bigserial primary key,
  product_id uuid not null references public.products(id) on delete cascade,
  delta      int  not null,
  reason     text not null check (reason in ('sale','restock','adjust','cancel','return','damage','recount')),
  order_id   uuid references public.orders(id) on delete set null,
  actor_id   uuid references auth.users,
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists inventory_movements_product_idx
  on public.inventory_movements (product_id, created_at desc);

-- -------------------------------------------------------------------
-- 5. sales — flash / seasonal campaigns
-- -------------------------------------------------------------------
create table if not exists public.sales (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  kind           text not null default 'percent' check (kind in ('percent','fixed')),
  value_percent  numeric(5,2),
  value_minor    int,
  starts_at      timestamptz not null,
  ends_at        timestamptz not null,
  scope          jsonb not null default '{"all":false,"products":[],"categories":[],"brands":[]}'::jsonb,
  banner_text    text,
  show_countdown boolean not null default true,
  priority       int not null default 0,
  is_active      boolean not null default true,
  created_by     uuid references auth.users,
  created_at     timestamptz not null default now(),
  check (ends_at > starts_at)
);

-- Pre-sale prices, so an expiring campaign can never leave a wrong price behind.
create table if not exists public.sale_price_snapshots (
  sale_id                uuid not null references public.sales(id) on delete cascade,
  product_id             uuid not null references public.products(id) on delete cascade,
  prev_price_minor       int not null,
  prev_compare_at_minor  int,
  primary key (sale_id, product_id)
);

-- -------------------------------------------------------------------
-- 6. content_revisions — every CMS save, so the client can undo
-- -------------------------------------------------------------------
create table if not exists public.content_revisions (
  id         bigserial primary key,
  slot       text not null,
  payload    jsonb not null,
  actor_id   uuid references auth.users,
  created_at timestamptz not null default now()
);
create index if not exists content_revisions_slot_idx
  on public.content_revisions (slot, created_at desc);

create or replace function public.snapshot_content()
returns trigger language plpgsql as $$
begin
  -- Snapshot the OLD payload on update, so restoring gives you the state
  -- before the edit you regret (not the one you just saved).
  insert into public.content_revisions (slot, payload, actor_id)
  values (old.slot, old.payload, auth.uid());
  return new;
end $$;

drop trigger if exists content_blocks_snapshot on public.content_blocks;
create trigger content_blocks_snapshot
  before update on public.content_blocks
  for each row execute function public.snapshot_content();

-- -------------------------------------------------------------------
-- 7. audit_log — immutable. One trigger function, attached to N tables.
-- -------------------------------------------------------------------
create table if not exists public.audit_log (
  id          bigserial primary key,
  actor_id    uuid references auth.users,
  actor_email text,
  action      text not null,
  table_name  text not null,
  record_id   text not null,
  diff        jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists audit_log_record_idx
  on public.audit_log (table_name, record_id, created_at desc);
create index if not exists audit_log_time_idx
  on public.audit_log (created_at desc);

create or replace function public.write_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  v_new jsonb := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
  v_diff jsonb := '{}'::jsonb;
  k text;
begin
  -- Store changed keys only. A full row-pair per edit makes the log
  -- unreadable and enormous; the diff is what anyone actually reviews.
  for k in select jsonb_object_keys(v_old) union select jsonb_object_keys(v_new) loop
    if v_old -> k is distinct from v_new -> k then
      v_diff := v_diff || jsonb_build_object(k, jsonb_build_object('from', v_old -> k, 'to', v_new -> k));
    end if;
  end loop;

  if v_diff = '{}'::jsonb and tg_op = 'UPDATE' then
    return coalesce(new, old);  -- no-op write, nothing worth logging
  end if;

  insert into public.audit_log (actor_id, actor_email, action, table_name, record_id, diff)
  values (
    auth.uid(),
    auth.jwt() ->> 'email',
    lower(tg_op),
    tg_table_name,
    coalesce(v_new ->> 'id', v_old ->> 'id', v_new ->> 'slot', v_old ->> 'slot', '?'),
    v_diff
  );
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'products','product_images','categories','coupons','sales',
    'content_blocks','store_settings','profiles','orders'
  ] loop
    execute format('drop trigger if exists audit_%1$s on public.%1$I', t);
    execute format(
      'create trigger audit_%1$s after insert or update or delete on public.%1$I
       for each row execute function public.write_audit()', t);
  end loop;
end $$;

-- -------------------------------------------------------------------
-- 8. RLS — deny by default, staff access by role
-- -------------------------------------------------------------------
alter table public.store_settings       enable row level security;
alter table public.inventory_movements  enable row level security;
alter table public.sales                enable row level security;
alter table public.sale_price_snapshots enable row level security;
alter table public.content_revisions    enable row level security;
alter table public.audit_log            enable row level security;

-- store_settings: the storefront needs to read it (shipping thresholds),
-- only owner/admin may write.
drop policy if exists settings_public_read on public.store_settings;
create policy settings_public_read on public.store_settings for select using (true);
drop policy if exists settings_admin_write on public.store_settings;
create policy settings_admin_write on public.store_settings for update
  using (public.is_staff('admin')) with check (public.is_staff('admin'));

drop policy if exists inv_staff_read on public.inventory_movements;
create policy inv_staff_read on public.inventory_movements for select
  using (public.is_staff('support'));
-- Writes go through adjust_stock() only — it keeps ledger and balance in step.
drop policy if exists inv_no_direct_write on public.inventory_movements;
create policy inv_no_direct_write on public.inventory_movements for insert with check (false);

drop policy if exists sales_public_read on public.sales;
create policy sales_public_read on public.sales for select
  using (is_active and now() between starts_at and ends_at);
drop policy if exists sales_staff_read on public.sales;
create policy sales_staff_read on public.sales for select using (public.is_staff('support'));
drop policy if exists sales_admin_write on public.sales;
create policy sales_admin_write on public.sales for all
  using (public.is_staff('admin')) with check (public.is_staff('admin'));

drop policy if exists snap_admin on public.sale_price_snapshots;
create policy snap_admin on public.sale_price_snapshots for all
  using (public.is_staff('admin')) with check (public.is_staff('admin'));

drop policy if exists revisions_staff_read on public.content_revisions;
create policy revisions_staff_read on public.content_revisions for select
  using (public.is_staff('editor'));

-- Audit log: owner reads, nobody edits. No UPDATE/DELETE policy exists at
-- all, which means those operations are denied to every role including owner.
drop policy if exists audit_owner_read on public.audit_log;
create policy audit_owner_read on public.audit_log for select
  using (public.is_staff('owner'));

-- --- Staff policies on the pre-existing commerce tables -------------
drop policy if exists products_staff_read on public.products;
create policy products_staff_read on public.products for select using (public.is_staff('support'));
drop policy if exists products_admin_write on public.products;
create policy products_admin_write on public.products for all
  using (public.is_staff('admin')) with check (public.is_staff('admin'));

drop policy if exists images_admin_write on public.product_images;
create policy images_admin_write on public.product_images for all
  using (public.is_staff('admin')) with check (public.is_staff('admin'));

drop policy if exists categories_admin_write on public.categories;
create policy categories_admin_write on public.categories for all
  using (public.is_staff('admin')) with check (public.is_staff('admin'));

drop policy if exists coupons_staff_read on public.coupons;
create policy coupons_staff_read on public.coupons for select using (public.is_staff('support'));
drop policy if exists coupons_admin_write on public.coupons;
create policy coupons_admin_write on public.coupons for all
  using (public.is_staff('admin')) with check (public.is_staff('admin'));

drop policy if exists content_editor_write on public.content_blocks;
create policy content_editor_write on public.content_blocks for all
  using (public.is_staff('editor')) with check (public.is_staff('editor'));

drop policy if exists orders_staff_read on public.orders;
create policy orders_staff_read on public.orders for select using (public.is_staff('support'));
drop policy if exists order_items_staff_read on public.order_items;
create policy order_items_staff_read on public.order_items for select using (public.is_staff('support'));
drop policy if exists order_events_staff_read on public.order_events;
create policy order_events_staff_read on public.order_events for select using (public.is_staff('support'));
drop policy if exists customers_staff_read on public.customers;
create policy customers_staff_read on public.customers for select using (public.is_staff('support'));

drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles for select
  using (id = auth.uid() or public.is_staff('support'));
-- Only the owner grants roles — otherwise an admin could promote themselves.
drop policy if exists profiles_owner_write on public.profiles;
create policy profiles_owner_write on public.profiles for all
  using (public.is_staff('owner')) with check (public.is_staff('owner'));

-- -------------------------------------------------------------------
-- 9. RPCs
-- -------------------------------------------------------------------

-- Stock adjustment: ledger entry + balance update in ONE transaction, so
-- the two can never disagree. The admin UI never writes products.stock.
create or replace function public.adjust_stock(
  p_product_id uuid, p_delta int, p_reason text default 'adjust', p_note text default null
) returns int language plpgsql security definer set search_path = public as $$
declare v_new int;
begin
  if not public.is_staff('admin') then raise exception 'FORBIDDEN'; end if;
  if p_delta = 0 then raise exception 'DELTA_ZERO'; end if;

  update public.products
     set stock = stock + p_delta, updated_at = now()
   where id = p_product_id
  returning stock into v_new;

  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
  if v_new < 0 then raise exception 'NEGATIVE_STOCK'; end if;

  insert into public.inventory_movements (product_id, delta, reason, actor_id, note)
  values (p_product_id, p_delta, p_reason, auth.uid(), p_note);

  return v_new;
end $$;

-- Order status transition: validates the move, writes the event, and
-- restocks automatically on cancel/refund.
create or replace function public.set_order_status(
  p_order_id uuid, p_status text, p_note text default null
) returns public.orders language plpgsql security definer set search_path = public as $$
declare v_order public.orders; v_from text; v_item record;
begin
  if not public.is_staff('support') then raise exception 'FORBIDDEN'; end if;

  select status::text into v_from from public.orders where id = p_order_id for update;
  if v_from is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_from = p_status then raise exception 'NO_CHANGE'; end if;
  if v_from in ('delivered','refunded') then raise exception 'TERMINAL_STATUS:%', v_from; end if;

  update public.orders
     set status = p_status::order_status,
         cancelled_at = case when p_status in ('cancelled','refunded') then now() else cancelled_at end
   where id = p_order_id
  returning * into v_order;

  insert into public.order_events (order_id, from_status, to_status, note, actor_id)
  values (p_order_id, v_from::order_status, p_status::order_status, p_note, auth.uid());

  -- Cancelling releases the held units back to sellable stock.
  if p_status in ('cancelled','refunded') and v_from not in ('cancelled','refunded') then
    for v_item in select product_id, quantity from public.order_items
                   where order_id = p_order_id and product_id is not null loop
      update public.products set stock = stock + v_item.quantity where id = v_item.product_id;
      insert into public.inventory_movements (product_id, delta, reason, order_id, actor_id, note)
      values (v_item.product_id, v_item.quantity, 'cancel', p_order_id, auth.uid(), 'auto-restock on ' || p_status);
    end loop;
  end if;

  return v_order;
end $$;

-- Dashboard counters in one round trip instead of six.
create or replace function public.admin_stats()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not public.is_staff('support') then '{}'::jsonb else jsonb_build_object(
    'orders_today',    (select count(*) from orders where placed_at >= current_date),
    'revenue_today',   (select coalesce(sum(total_minor),0) from orders
                          where placed_at >= current_date and status <> 'cancelled'),
    'revenue_30d',     (select coalesce(sum(total_minor),0) from orders
                          where placed_at >= current_date - 30 and status <> 'cancelled'),
    'pending_orders',  (select count(*) from orders where status in ('pending','processing')),
    'total_products',  (select count(*) from products where status = 'active'),
    'low_stock',       (select count(*) from products where status='active' and stock > 0 and stock <= low_stock_at),
    'out_of_stock',    (select count(*) from products where status='active' and stock = 0),
    'customers',       (select count(*) from customers),
    'active_coupons',  (select count(*) from coupons where is_active
                          and (ends_at is null or ends_at > now()))
  ) end;
$$;

-- First-run bootstrap: promotes a signed-in user to owner, but ONLY while
-- no owner exists. After the first call it can never grant anything again.
create or replace function public.admin_bootstrap_owner()
returns text language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.profiles where role = 'owner') then
    raise exception 'OWNER_EXISTS';
  end if;
  if auth.uid() is null then raise exception 'NOT_SIGNED_IN'; end if;

  insert into public.profiles (id, role, email, full_name)
  values (auth.uid(), 'owner', auth.jwt() ->> 'email', coalesce(auth.jwt() -> 'user_metadata' ->> 'full_name', 'Owner'))
  on conflict (id) do update set role = 'owner';

  return 'ok';
end $$;

grant execute on function public.admin_bootstrap_owner() to authenticated;
grant execute on function public.adjust_stock(uuid,int,text,text) to authenticated;
grant execute on function public.set_order_status(uuid,text,text) to authenticated;
grant execute on function public.admin_stats() to authenticated;
