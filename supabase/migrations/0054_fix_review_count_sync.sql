-- ===================================================================
-- skin.theory — fix stale products.review_count/rating (2 root causes)
-- -------------------------------------------------------------------
-- Live audit found "Reviews (N)" disagreeing with the actual reviews
-- shown, across the WHOLE catalog, not just one product — 27 of 33
-- products had a mismatched review_count. Two distinct causes:
--
-- CAUSE A (25 products): review_count/rating were seeded with fabricated
-- demo numbers from the old static mock catalog (e.g.
-- cosrx-advanced-snail-96-mucin-power-essence showed 4561 — the exact
-- number from the pre-CMS mock data) and have simply never been touched,
-- because submit_review() (0031) only ever recomputes the ONE product
-- being reviewed, at review time. A product that's never received a
-- real review still shows whatever fake number it was seeded with.
--
-- CAUSE B (2 products — the reported bug): submit_review() recomputes
-- review_count/rating correctly on INSERT, but nothing recomputes it on
-- DELETE. The `reviews` table is entirely empty right now (0 rows, any
-- status) — every real review ever submitted during this project's live
-- testing was later deleted directly (`delete from reviews where ...`,
-- the standard test-cleanup pattern used throughout this project) — but
-- since only submit_review()'s INSERT path ever recomputed the counter,
-- those deletes left it stuck at whatever it was before the delete.
--
-- FIX: a trigger, not another manual recompute call site to remember —
-- same "enforce the invariant once, in the database" reasoning
-- 0051_auto_create_default_variant.sql already established for the
-- default-variant invariant. Covers INSERT, UPDATE (e.g. a future
-- moderation status change), and DELETE uniformly, so this entire bug
-- class can't recur regardless of what deletes/changes a review's
-- status later — a raw admin/service-role delete included.
--
-- submit_review()'s own manual recompute block is removed — redundant
-- now that the trigger fires on the same INSERT.
--
-- Then a one-time backfill recomputes review_count/rating for EVERY
-- product from the real table, fixing all 27 mismatches (both causes)
-- in one sweep.
-- ===================================================================

-- -------------------------------------------------------------------
-- 1. Trigger — keeps products.review_count/rating exactly in sync with
--    reviews, no matter what inserts, updates, or deletes a row.
-- -------------------------------------------------------------------
create or replace function public.sync_product_review_stats()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_product_id uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products p set
    review_count = coalesce((
      select count(*) from public.reviews r
       where r.product_id = v_product_id and r.status = 'approved'
    ), 0),
    -- 0, not null, when there are no approved reviews — several storefront
    -- call sites do product.rating.toFixed(1) with no null guard, and a
    -- freshly-reviewless product showing "0.0" is normal, sensible UI,
    -- not a bug to work around.
    rating = coalesce((
      select round(avg(r.rating)::numeric, 2) from public.reviews r
       where r.product_id = v_product_id and r.status = 'approved'
    ), 0)
  where p.id = v_product_id;
  return coalesce(new, old);
end $$;

drop trigger if exists reviews_sync_product_stats on public.reviews;
create trigger reviews_sync_product_stats
  after insert or update or delete on public.reviews
  for each row execute function public.sync_product_review_stats();

-- -------------------------------------------------------------------
-- 2. submit_review() — remove the now-redundant manual recompute block
--    (the trigger above fires on the same INSERT); everything else is
--    unchanged from 0045's version.
-- -------------------------------------------------------------------
create or replace function public.submit_review(
  p_order_item_id uuid,
  p_rating         int,
  p_title          text,
  p_body           text
)
returns public.reviews
language plpgsql security definer set search_path = public as $$
declare
  v_email          citext;
  v_order          record;
  v_order_item     record;
  v_customer_name  text;
  v_points         int;
  v_review         public.reviews;
begin
  if auth.uid() is null then
    raise exception 'NOT_VERIFIED';
  end if;

  v_email := lower(auth.jwt() ->> 'email');
  if v_email is null or v_email = '' then
    raise exception 'NOT_VERIFIED';
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'INVALID_RATING';
  end if;
  if p_body is null or char_length(trim(p_body)) < 4 then
    raise exception 'INVALID_BODY';
  end if;
  if char_length(p_body) > 3000 then
    raise exception 'INVALID_BODY';
  end if;
  if p_title is not null and char_length(p_title) > 200 then
    raise exception 'INVALID_TITLE';
  end if;

  select oi.id, oi.product_id, oi.order_id
    into v_order_item
    from public.order_items oi
   where oi.id = p_order_item_id;
  if not found then
    raise exception 'ORDER_ITEM_NOT_FOUND';
  end if;

  select o.email, o.status, o.customer_id
    into v_order
    from public.orders o
   where o.id = v_order_item.order_id;
  if not found or v_order.email is null then
    raise exception 'ORDER_ITEM_NOT_FOUND';
  end if;

  if lower(v_order.email) <> v_email then
    raise exception 'NOT_YOUR_ORDER';
  end if;

  if v_order.status <> 'delivered' then
    raise exception 'NOT_DELIVERED';
  end if;

  select coalesce(full_name, split_part(v_email::text, '@', 1))
    into v_customer_name
    from public.customers where id = v_order.customer_id;

  begin
    insert into public.reviews (
      product_id, order_item_id, customer_id, email, display_name, rating, title, body
    ) values (
      v_order_item.product_id, v_order_item.id, v_order.customer_id, v_email,
      coalesce(v_customer_name, 'Verified Buyer'),
      p_rating, nullif(trim(coalesce(p_title, '')), ''), trim(p_body)
    )
    returning * into v_review;
  exception when unique_violation then
    raise exception 'ALREADY_REVIEWED';
  end;

  select points_per_review into v_points from public.store_settings where id = true;
  if coalesce(v_points, 0) > 0 and v_order.customer_id is not null then
    update public.customers set points = points + v_points where id = v_order.customer_id;
  end if;

  -- review_count/rating are now kept in sync by reviews_sync_product_stats
  -- (fires on this same INSERT) — no manual recompute needed here.

  return v_review;
end $$;

grant execute on function public.submit_review(uuid, int, text, text) to authenticated;

-- -------------------------------------------------------------------
-- 3. One-time backfill — recompute every product's review_count/rating
--    from the real table right now, fixing both causes in one sweep.
-- -------------------------------------------------------------------
update public.products p set
  review_count = coalesce((select count(*) from public.reviews r where r.product_id = p.id and r.status = 'approved'), 0),
  rating = coalesce((select round(avg(r.rating)::numeric, 2) from public.reviews r where r.product_id = p.id and r.status = 'approved'), 0);

-- -------------------------------------------------------------------
-- VERIFY
--   select slug, review_count, rating from products order by slug;
--   -- expect: every product's review_count/rating now matches
--   -- select count(*) from reviews where product_id = <id> and status='approved'
--
--   -- trigger works going forward:
--   -- submit a real review -> review_count/rating update immediately
--   -- delete that review row directly -> review_count/rating drop back
--   --   down immediately too (this is the actual regression test for
--   --   the bug that was found)
-- ===================================================================
