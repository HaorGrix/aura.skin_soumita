-- ===================================================================
-- skin.theory — real, verified-purchase product reviews
-- -------------------------------------------------------------------
-- Reviews have never had a database table. `WriteReviewModal` wrote to
-- `UserContext`'s localStorage mock (`myReviews`), and the PDP showed a
-- static seeded array from `data/product-details.js`. Neither survives
-- a browser, a device switch, or shows one shopper's review to another.
--
-- This table + RPC replace that for the REAL, magic-link-verified path
-- (0029_magic_link_order_access.sql) — a shopper who has actually
-- verified their email can now write a review that:
--   - persists in Postgres, visible to every visitor on the PDP
--   - can only be written once per purchased line item (order_items.id)
--   - can only be written for an item on a DELIVERED order belonging to
--     that verified email — never someone else's purchase
--   - awards a real point onto the SAME `customers.points` column
--     place_order() already writes (0006/0017/0026), not a second,
--     disconnected ledger
--
-- WHY AN RPC, NOT A PLAIN INSERT POLICY
-- The ownership check (does this order_item belong to MY verified
-- email?), the delivery-status check, and the points award all have to
-- happen atomically and be trusted server-side — exactly the reasoning
-- `place_order()` and `validate_coupon_preview()` already established
-- in this codebase (see their own header comments). A client cannot be
-- trusted to self-report "I received this" or "award me a point."
--
-- WHY A SEPARATE `reviews_public` VIEW
-- The base table stores the verified email on each row (so a future
-- moderation pass or the reviewer's own re-edit can find their review).
-- A public SELECT policy on the table itself would leak every
-- reviewer's email to any visitor. `products_public` already
-- established this pattern (deriving a public-safe surface via a view
-- rather than opening the base table) — same move here.
--
-- HOW TO APPLY: Supabase Dashboard -> SQL Editor -> paste -> Run.
-- ===================================================================

create table if not exists public.reviews (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  customer_id   uuid references public.customers(id) on delete set null,
  email         citext not null,
  display_name  text not null default 'Verified Buyer',
  rating        smallint not null check (rating between 1 and 5),
  title         text,
  body          text not null check (char_length(trim(body)) >= 4),
  status        text not null default 'approved' check (status in ('pending', 'approved', 'rejected')),
  created_at    timestamptz not null default now(),
  -- One review per purchased line item — the actual anti-farming lock.
  -- A shopper who bought the same product across 3 separate orders gets
  -- 3 order_items and can legitimately leave up to 3 reviews; but the
  -- exact same purchase can never be reviewed twice.
  unique (order_item_id)
);

create index if not exists reviews_product_id_idx on public.reviews (product_id) where status = 'approved';

alter table public.reviews enable row level security;

-- No general SELECT/INSERT/UPDATE/DELETE policy for anon/authenticated on
-- the base table. Public reads go through `reviews_public` below; all
-- writes go through `submit_review()`, which is SECURITY DEFINER and so
-- bypasses RLS entirely (same pattern as place_order/set_order_status).
--
-- One exception: a verified shopper reading their OWN rows (own email,
-- from the same signed JWT claim 0029 uses) — this is what lets
-- OrdersTab show "already reviewed" per line item without exposing
-- anyone else's review or email. Same mechanism as
-- orders_verified_email_read, same reasoning.
drop policy if exists reviews_own_read on public.reviews;
create policy reviews_own_read on public.reviews for select
  using (
    auth.uid() is not null
    and email = lower(auth.jwt() ->> 'email')
  );

-- security_invoker = false (the default) is REQUIRED here, not optional:
-- anon has no direct SELECT grant on public.products (see
-- 0005_lock_down_products_table.sql), so a security_invoker view join
-- to it fails for anon with "permission denied for table products".
-- Fixed for real in 0033_fix_reviews_public_view.sql after this exact
-- bug shipped once — left explicit here so it can't regress.
drop view if exists public.reviews_public;
create view public.reviews_public
with (security_invoker = false)
as
select
  r.id,
  p.slug as product_slug,
  r.rating,
  r.title,
  r.body,
  r.display_name,
  r.created_at
from public.reviews r
join public.products p on p.id = r.product_id
where r.status = 'approved';

grant select on public.reviews_public to anon, authenticated;

-- ===================================================================
-- submit_review() — the only way a review is ever written
-- ===================================================================
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

  -- Award the same loyalty point ledger place_order() writes to — not a
  -- second, disconnected balance.
  select points_per_review into v_points from public.store_settings where id = true;
  if coalesce(v_points, 0) > 0 and v_order.customer_id is not null then
    update public.customers set points = points + v_points where id = v_order.customer_id;
  end if;

  -- Keep products.rating / products.review_count (both pre-existing
  -- columns) in sync so the storefront's summary doesn't need a live
  -- aggregate query on every PDP load.
  update public.products p set
    review_count = (select count(*) from public.reviews r where r.product_id = p.id and r.status = 'approved'),
    rating = (select round(avg(r.rating)::numeric, 2) from public.reviews r where r.product_id = p.id and r.status = 'approved')
  where p.id = v_order_item.product_id;

  return v_review;
end $$;

grant execute on function public.submit_review(uuid, int, text, text) to authenticated;

-- -------------------------------------------------------------------
-- VERIFY
--   -- as a magic-link-verified session (real order_item you own, order
--   -- status = 'delivered'):
--   select * from submit_review('<order_item id>', 5, 'Loved it', 'Great texture, cleared up in a week.');
--   -- expect: one row back, status='approved'
--
--   -- run the exact same call again:
--   -- expect: error ALREADY_REVIEWED
--
--   -- as anon (no session):
--   select * from reviews_public where product_slug = '<some slug>';
--   -- expect: rows returned (public read works), but calling submit_review
--   -- raises NOT_VERIFIED
--
--   -- confirm the base table is NOT publicly readable:
--   select * from reviews;  -- as anon: 0 rows / permission denied
--
--   -- as the SAME verified session that wrote the review above:
--   select order_item_id from reviews where email = lower(auth.jwt()->>'email');
--   -- expect: that row back (own-row read works)
--   -- as a DIFFERENT verified session: expect 0 rows for the first one's review
-- -------------------------------------------------------------------
