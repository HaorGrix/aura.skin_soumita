-- =====================================================================
-- 0064 — atomic product photo reorder + repair of half-reordered galleries
-- ---------------------------------------------------------------------
-- The admin used to reorder a gallery with one UPDATE per row from the
-- browser: park every row on a negative position, then write the final
-- positions. When the second pass failed part-way (a second upload started
-- while the first was still reordering, so the id list was stale), rows were
-- left on their negative "parking" positions. Negative positions sort first
-- and in REVERSE order, so the last photo uploaded became the product's main
-- photo — the "picture changes by itself on upload" report.
--
-- reorder_product_images() does the same two passes inside one transaction,
-- so it either fully applies or not at all. Rows missing from p_ids (a stale
-- list) are kept, after the listed ones, in their current order, instead of
-- blocking the reorder.
--
-- SECURITY INVOKER: the caller's RLS still decides — only admins can write
-- product_images ("admins write images" policy).
-- =====================================================================

create or replace function public.reorder_product_images(p_product_id uuid, p_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if exists (
    select 1 from unnest(p_ids) as t(id)
    where not exists (
      select 1 from public.product_images i where i.id = t.id and i.product_id = p_product_id
    )
  ) then
    raise exception 'reorder_product_images: an id does not belong to product %', p_product_id;
  end if;

  -- Pass 1: park every row far below any real position, so pass 2 can
  -- assign 0..n-1 without tripping the (product_id, position) unique index.
  with ranked as (
    select id, row_number() over (order by position, created_at) as rn
    from public.product_images
    where product_id = p_product_id
  )
  update public.product_images i
     set position = -(1000000 + ranked.rn)
    from ranked
   where i.id = ranked.id;

  -- Pass 2: listed ids first in the given order, then any others in the
  -- order they had before this call.
  with ordered as (
    select i.id,
           row_number() over (
             order by coalesce(array_position(p_ids, i.id), 2147483647),
                      -i.position
           ) - 1 as new_pos
    from public.product_images i
    where i.product_id = p_product_id
  )
  update public.product_images i
     set position = ordered.new_pos
    from ordered
   where i.id = ordered.id;
end;
$$;

-- Supabase grants new functions to anon by default; revoking PUBLIC alone
-- leaves that grant, so anon is revoked explicitly.
revoke all on function public.reorder_product_images(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_product_images(uuid, uuid[]) to authenticated;

-- ---------------------------------------------------------------------
-- Repair: renumber every gallery to 0..n-1. A row stranded on a parking
-- position -(k+1) was meant to be k-th, so it sorts as k; gaps left by
-- deleted photos close up. Idempotent: a clean gallery keeps its order.
-- ---------------------------------------------------------------------
with ranked as (
  select id, product_id,
         row_number() over (
           partition by product_id
           order by case when position < 0 then -position - 1 else position end, created_at
         ) as rn
  from public.product_images
)
update public.product_images i
   set position = -(1000000 + ranked.rn)
  from ranked
 where i.id = ranked.id;

update public.product_images
   set position = -position - 1000001
 where position <= -1000000;
