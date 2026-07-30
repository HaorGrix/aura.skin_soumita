-- ===================================================================
-- aura.skin — fixes for defects found in the 2026-07-30 security audit
-- -------------------------------------------------------------------
-- Each fix below was CONFIRMED against the live project with real
-- authenticated sessions (a disposable editor and admin user), not
-- inferred from reading the schema. Findings, in severity order:
--
--   1. BLOCKER  Saving a CMS block a second time always fails.
--   2. BLOCKER  Nobody can upload a product image — no storage policy.
--   3. HIGH     Anonymous visitors can read stock levels and cost prices.
--   4. HIGH     A staff member who has done anything can never be deleted.
--
-- HOW TO APPLY: Supabase Dashboard → SQL Editor → paste → Run.
-- Each section has a verification query; run them after.
-- ===================================================================


-- -------------------------------------------------------------------
-- 1. BLOCKER — the CMS can only ever be saved once per slot.
--
-- content_blocks has a BEFORE UPDATE trigger that copies the previous
-- payload into content_revisions. snapshot_content() was created WITHOUT
-- `security definer`, so the INSERT runs as the calling user — and
-- content_revisions has RLS enabled with a SELECT policy only. The insert
-- is rejected, the trigger raises, and the whole UPDATE fails.
--
-- Net effect: the first save of a slot is an INSERT (no trigger, works),
-- and every save after that fails with
--   "new row violates row-level security policy for table content_revisions"
-- Reproduced live as both `editor` and `admin`.
--
-- Fix: the trigger is system bookkeeping, so it runs with definer rights —
-- the same reasoning as write_audit(). Revisions stay readable by editors
-- and writable by nobody directly.
-- -------------------------------------------------------------------
create or replace function public.snapshot_content()
returns trigger
language plpgsql
security definer set search_path = public as $$
begin
  insert into public.content_revisions (slot, payload, actor_id)
  values (old.slot, old.payload, auth.uid());
  return new;
end $$;

-- Belt and braces: no direct client INSERT path either way.
drop policy if exists revisions_no_direct_write on public.content_revisions;
create policy revisions_no_direct_write on public.content_revisions
  for insert with check (false);

-- VERIFY: saving the same slot twice should now succeed.
--   update content_blocks set payload = '{"v":2}' where slot = '<any existing slot>';
--   select count(*) from content_revisions where slot = '<same slot>';  -- expect >= 1


-- -------------------------------------------------------------------
-- 2. BLOCKER — product image upload is impossible.
--
-- The bucket `product-images` is public-read, but storage.objects had NO
-- INSERT/UPDATE/DELETE policy at all, so every upload is rejected with
-- "new row violates row-level security policy". Confirmed live: an `admin`
-- session could not upload. The admin panel's ImageManager is therefore
-- completely non-functional today, and lib/api/media.js's comment claiming
-- an is_staff('admin') policy exists was simply wrong.
--
-- Public SELECT is granted explicitly rather than relying on the bucket's
-- `public` flag, so the intent is visible in SQL.
-- -------------------------------------------------------------------
drop policy if exists product_images_public_read on storage.objects;
create policy product_images_public_read on storage.objects
  for select using (bucket_id = 'product-images');

drop policy if exists product_images_staff_insert on storage.objects;
create policy product_images_staff_insert on storage.objects
  for insert with check (bucket_id = 'product-images' and public.is_staff('admin'));

drop policy if exists product_images_staff_update on storage.objects;
create policy product_images_staff_update on storage.objects
  for update using (bucket_id = 'product-images' and public.is_staff('admin'))
  with check (bucket_id = 'product-images' and public.is_staff('admin'));

drop policy if exists product_images_staff_delete on storage.objects;
create policy product_images_staff_delete on storage.objects
  for delete using (bucket_id = 'product-images' and public.is_staff('admin'));

-- Stop a bad upload from filling the bucket: 5 MB cap, images only.
-- Matches the client-side guard in src/admin/components/ImageManager.jsx,
-- which is a courtesy check — this is the one that's enforced.
update storage.buckets
   set file_size_limit = 5242880,
       allowed_mime_types = array['image/jpeg','image/png','image/webp','image/avif']
 where id = 'product-images';

-- VERIFY: sign in to /admin as owner/admin and add an image to any product.


-- -------------------------------------------------------------------
-- 3. HIGH — competitors can read your stock levels and cost prices.
--
-- `products_public` deliberately omits stock, cost_minor, sku and
-- low_stock_at. But the BASE table products is also readable by anon (an
-- earlier policy allows reading active products), so those columns leak
-- anyway. Confirmed live with the anon key:
--     products.stock         -> 5
--     products.low_stock_at  -> 5
--     products.cost_minor    -> null   (only because it isn't populated yet;
--                                       it leaks the moment you use it)
--
-- Column-level REVOKE is used rather than dropping the read policy, because
-- the policy's name isn't known here and dropping the wrong thing would take
-- the storefront offline. Revoking columns is surgical and reversible.
--
-- products_public keeps working because a normal (non-security_invoker) view
-- executes with its OWNER's privileges, not the caller's.
-- -------------------------------------------------------------------
revoke select (stock, cost_minor, sku, low_stock_at, backorder_ok)
  on public.products from anon;

-- VERIFY — run all three. Expect: 139, then 139, then ERROR.
--   select count(*) from products_public;                       -- storefront path
--   -- as anon (REST):  /rest/v1/products_public?select=in_stock  -- expect 139 rows
--   -- as anon (REST):  /rest/v1/products?select=stock            -- expect 42501
--
-- ROLLBACK if products_public breaks (i.e. if it is security_invoker):
--   grant select (stock, cost_minor, sku, low_stock_at, backorder_ok)
--     on public.products to anon;


-- -------------------------------------------------------------------
-- 4. HIGH — a staff member who has done anything can never be removed.
--
-- Every actor/author column references auth.users with no ON DELETE
-- behaviour, which defaults to NO ACTION. So deleting a staff account fails:
--   "update or delete on table users violates foreign key constraint
--    audit_log_actor_id_fkey"
-- Hit for real while cleaning up the audit's own test accounts.
--
-- Offboarding must not be blocked by history, and history must not be
-- deleted to allow offboarding — so these become ON DELETE SET NULL. The
-- audit trail survives regardless because audit_log stores actor_email
-- as plain text alongside the id, exactly for this case.
--
-- Note this is also why the Staff screen offers "revoke access" rather than
-- delete: deactivating keeps the trail attributable to a name.
-- -------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select c.conname, c.conrelid::regclass::text as tbl,
           a.attname as col
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where c.contype = 'f'
       and c.confrelid = 'auth.users'::regclass
       and c.confdeltype = 'a'                       -- 'a' = NO ACTION
       and c.connamespace = 'public'::regnamespace
       and array_length(c.conkey, 1) = 1
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    execute format(
      'alter table %s add constraint %I foreign key (%I) references auth.users(id) on delete set null',
      r.tbl, r.conname, r.col);
    raise notice 'relaxed % on %(%)', r.conname, r.tbl, r.col;
  end loop;
end $$;

-- VERIFY: no single-column FKs to auth.users should remain as NO ACTION.
--   select conrelid::regclass, conname, confdeltype from pg_constraint
--    where confrelid = 'auth.users'::regclass and confdeltype = 'a';


-- -------------------------------------------------------------------
-- 5. MEDIUM — reinstating a cancelled order inflates stock.
--
-- set_order_status() treats only 'delivered' and 'refunded' as terminal, so
-- cancelled -> processing was permitted. Cancelling runs the auto-restock
-- (every line item returns to inventory) but the reverse transition has no
-- matching deduction, so each round trip added the whole order back to
-- stock — permanently, and silently.
--
-- 'cancelled' becomes terminal. Reinstating is rare; quietly wrong
-- inventory is not a fair price for it. The correct action is a new order,
-- which deducts stock through the normal path.
-- (src/lib/api/admin/orders.js nextStatuses() now mirrors this.)
-- -------------------------------------------------------------------
create or replace function public.set_order_status(
  p_order_id uuid, p_status text, p_note text default null
) returns public.orders language plpgsql security definer set search_path = public as $$
declare v_order public.orders; v_from text; v_item record;
begin
  if not public.is_staff('support') then raise exception 'FORBIDDEN'; end if;

  select status::text into v_from from public.orders where id = p_order_id for update;
  if v_from is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_from = p_status then raise exception 'NO_CHANGE'; end if;
  -- cancelled added: see note above.
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
    for v_item in select product_id, quantity from public.order_items
                   where order_id = p_order_id and product_id is not null loop
      update public.products set stock = stock + v_item.quantity where id = v_item.product_id;
      insert into public.inventory_movements (product_id, delta, reason, order_id, actor_id, note)
      values (v_item.product_id, v_item.quantity, 'cancel', p_order_id, auth.uid(), 'auto-restock on ' || p_status);
    end loop;
  end if;

  return v_order;
end $$;

grant execute on function public.set_order_status(uuid,text,text) to authenticated;
