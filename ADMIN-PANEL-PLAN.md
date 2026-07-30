# aura.skin — Admin Panel Architecture & Implementation Plan

**Status**: Proposed
**Date**: 2026-07-29
**Goal**: Complete client independence — the store owner can change *anything* customer-facing without a developer, a deploy, or a code edit.

---

## 0. Where we are today (audited, not assumed)

Before designing anything, here is what the current codebase actually does. Every design decision below is driven by one of these facts.

| Area | Today | Implication for admin |
|---|---|---|
| Backend | **None.** Pure static Vite build, `dist/` served by nginx (`deploy/nginx.conf.example`) | Everything in this plan is net-new infrastructure |
| Catalog | `src/data/products.js` — 723 lines, a `p()` factory + hand-written rows, ~179 SKUs | Must migrate to DB; the `p()` factory's defaults become column defaults |
| Derived fields | A post-process loop (`products.js:476-500`) computes `stock → inStock → isLowStock`, `isOnSale`, `discountPercent`, `salesCount` | This loop is the single source of truth ([[aura-skin-decisions]]). It must move into the DB as a **view**, not be reimplemented in the admin UI |
| Product ID | `id = slug(brand)-slug(name)` — derived from the name | **Renaming a product today would change its URL.** Needs a real PK + mutable slug + redirect history |
| Images | `product-images.js` uses `import.meta.glob` over `/assests` — resolved at **build time** | Admin uploads can't work this way. Needs runtime URLs (Storage) |
| Prices | Floats in USD, multiplied by `CONVERSION_RATE = 120` at render (`lib/format.js`) | Float money + a hardcoded FX rate. Move to integer minor units in BDT |
| Order status | **Derived from the timestamp, never stored** (`lib/order-status.js`) | Direct conflict with your requirement #4 — see §3.3 |
| Orders / users | `localStorage` (`aura_users_store`, `aura-session`) | No server-side record exists to administer. Must be migrated |
| Coupons | `lib/coupons.js` — static map, two kinds (first-order + loyalty-milestone gated on points) | Admin-created coupons must not collide with loyalty-tier semantics |
| Store config | `lib/shop-config.js` — free-shipping threshold, shipping rates, tax | Becomes a settings table |
| Content | Hardcoded — Hero copy is a **word array** for the stagger animation (`Hero.jsx:54-55`), `OFFERS` arrays in both `pages/Offers.jsx` and `components/home/Offers.jsx` | CMS must supply plain strings; the animation splits them at render |
| Routing | Clean URLs via History API (`App.jsx`), nginx SPA fallback | `/admin/*` mounts in the same router, code-split, auth-gated |

### Three conflicts you should decide on before Phase 1

1. **Order status is derived, not stored.** `order-status.js` explicitly documents that storing status was rejected because it goes stale. That reasoning holds for a *mock* store with no fulfilment desk. It does **not** hold once a human marks orders Shipped. Recommendation: **store status, and log every transition** (§3.3). The derived function stays as a read-only fallback for legacy localStorage orders during migration.
2. **Money is a float in USD.** `formatPrice` does `usd * 120`. If the client edits a price in the admin they'll type ৳2280, not $19. Recommendation: **store `price_minor` as `integer` BDT paisa**, drop `CONVERSION_RATE`, keep `formatPrice` as the only render path.
3. **Product ID is the name.** Letting the client rename "Dynasty Cream" would silently 404 every existing link and break `itemIds` on past orders. Recommendation: **UUID PK, mutable `slug`, `product_slug_history` for 301s** (§2.2).

---

## 1. Architecture

### 1.1 Stack decision

**Supabase for the entire backend.** Postgres + Auth + Storage + Row-Level Security + Edge Functions. No separate Node/Express service.

Why this and not a custom API:
- **RLS is the security model.** Roles are enforced in the database, so a bug in the admin UI cannot leak or destroy data. A custom Express layer would put the only guard in application code.
- The client-independence goal means the *panel* is the product, not the API. Every hour spent on bespoke CRUD endpoints is an hour not spent on the UI the client actually touches.
- Storage + image transforms come free — critical for the multi-image product requirement.
- Auth (magic link + TOTP MFA) is a solved problem here; hand-rolling it for an owner account is unjustifiable risk.

**Where we still write server code** — anything that must be atomic or must not be trusted to the client:
- `place_order()` — stock check + decrement + order insert in one transaction (prevents overselling)
- `validate_coupon()` — usage limits and per-customer caps
- `admin_bulk_price_update()` — audited batch writes

These are **Postgres functions (RPC)**, not Edge Functions, so they run inside the transaction. Edge Functions are reserved for things needing the outside world: email receipts, image post-processing webhooks.

### 1.2 Deployment shape

```
                 ┌──────────────────────────────────────┐
                 │  aura.skin (nginx, static dist/)     │
                 │  ├─ /            storefront (public) │
                 │  └─ /admin/*     admin SPA chunk     │
                 └───────────────┬──────────────────────┘
                                 │ anon key + user JWT
                 ┌───────────────▼──────────────────────┐
                 │  Supabase                            │
                 │  ├─ Postgres (RLS on every table)    │
                 │  ├─ Auth (roles in JWT claim)        │
                 │  ├─ Storage (product-images, cms)    │
                 │  └─ RPC: place_order, validate_coupon│
                 └──────────────────────────────────────┘
```

`/admin` is a lazy route in the existing `App.jsx` router, in its own Rollup chunk. It ships zero bytes to storefront visitors. It is **not** a separate app — it reuses `ui/`, the design tokens, `format.js`, and the toast system, which is exactly the "component reuse" the judging criteria reward ([[judging-criteria-weights]]).

### 1.3 The rule that keeps this scalable

> **The database is the single source of truth. Derived values are database views. The admin writes base facts only.**

The admin never writes `discountPercent` or `isOnSale` — it writes `price_minor` and `compare_at_minor`, and the view derives the rest. This is the existing post-process loop, relocated. It is the reason the storefront and admin can never disagree.

---

## 2. Phase 1 — Database schema

### 2.1 Identity & roles

```sql
create type app_role as enum ('owner', 'admin', 'editor', 'support');

create table profiles (
  id          uuid primary key references auth.users on delete cascade,
  role        app_role not null default 'support',
  full_name   text,
  created_at  timestamptz not null default now()
);

-- Role lives in the JWT so RLS checks cost nothing (no per-row subquery).
-- Refreshed by an auth hook on login and on any role change.
create or replace function auth_role() returns app_role
  language sql stable
  as $$ select coalesce(
       (auth.jwt() -> 'app_metadata' ->> 'role')::app_role,
       'support'::app_role) $$;

create or replace function is_staff(min_role app_role default 'editor')
  returns boolean language sql stable as $$
  select case auth_role()
    when 'owner'  then true
    when 'admin'  then min_role <> 'owner'
    when 'editor' then min_role in ('editor','support')
    else min_role = 'support' end $$;
```

**Role capability matrix** (enforced in RLS, mirrored in the UI for affordance only):

| | owner | admin | editor | support |
|---|---|---|---|---|
| Products, inventory, pricing | ✅ | ✅ | read | read |
| CMS / hero / banners | ✅ | ✅ | ✅ | read |
| Coupons & flash sales | ✅ | ✅ | create draft | read |
| Orders: view | ✅ | ✅ | ✅ | ✅ |
| Orders: change status, refund | ✅ | ✅ | ❌ | status only |
| Customer PII (address, phone) | ✅ | ✅ | ❌ | ✅ |
| Staff management, role grants | ✅ | ❌ | ❌ | ❌ |
| Store settings (shipping, tax) | ✅ | ✅ | ❌ | ❌ |
| Audit log | ✅ | read | ❌ | ❌ |

### 2.2 Catalog

```sql
create table brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  logo_path text,
  sort_order int not null default 0,
  is_active boolean not null default true
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,      -- Cleanser, Serum, Sunscreen…
  slug text not null unique,
  parent_id uuid references categories(id),
  sort_order int not null default 0,
  is_active boolean not null default true
);

-- Concerns, skin types, ingredients: same shape. One table, discriminated,
-- so the admin gets ONE "Taxonomy" screen instead of four near-identical ones.
create type taxonomy_kind as enum ('concern','skin_type','ingredient','benefit');
create table taxonomy_terms (
  id uuid primary key default gen_random_uuid(),
  kind taxonomy_kind not null,
  name text not null,
  slug text not null,
  image_path text,               -- Shop-by-Concern tiles
  sort_order int not null default 0,
  is_active boolean not null default true,
  unique (kind, slug)
);

create table products (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  legacy_id         text unique,          -- old "cosrx-advanced-snail…" id
  brand_id          uuid not null references brands(id) on delete restrict,
  category_id       uuid not null references categories(id) on delete restrict,
  name              text not null,
  subtitle          text,
  description       text,
  how_to_use        text,
  price_minor       integer not null check (price_minor >= 0),   -- BDT paisa
  compare_at_minor  integer check (compare_at_minor >= 0),
  cost_minor        integer,               -- margin reporting; staff-only
  sku               text unique,
  stock             integer not null default 0 check (stock >= 0),
  low_stock_at      integer not null default 5,
  max_per_order     integer not null default 6,
  backorder_ok      boolean not null default false,
  status            text not null default 'draft'
                    check (status in ('draft','active','archived')),
  is_new            boolean not null default false,
  popularity        integer not null default 50,
  sales_count       integer not null default 0,
  tone              text not null default 'pink',
  seo_title         text,
  seo_description   text,
  published_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint compare_gt_price
    check (compare_at_minor is null or compare_at_minor > price_minor)
);

create index on products (status, popularity desc);
create index on products (category_id) where status = 'active';
create index on products using gin (to_tsvector('simple', name || ' ' || coalesce(subtitle,'')));

-- Renaming must never break a live URL or a past order.
create table product_slug_history (
  slug text primary key,
  product_id uuid not null references products(id) on delete cascade,
  retired_at timestamptz not null default now()
);

create table product_terms (
  product_id uuid references products(id) on delete cascade,
  term_id    uuid references taxonomy_terms(id) on delete cascade,
  primary key (product_id, term_id)
);

create table product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  storage_path text not null,
  alt text,
  position int not null default 0,     -- 0 = the pinned "front" shot
  width int, height int, blurhash text,
  created_at timestamptz not null default now()
);
create unique index on product_images (product_id, position);
```

**`max_per_order`** and **`low_stock_at`** are per-product columns rather than the current global constants (`MAX_PER_ORDER`, the hardcoded `<= 5` low-stock rule) — the client will eventually want a different cap on a ৳6 pimple patch than on a ৳26 eye serum. Defaults preserve today's behaviour exactly.

### 2.3 The derived view — the post-process loop, relocated

```sql
create view products_public as
select
  p.id, p.slug, p.name, p.subtitle, p.description, p.how_to_use,
  b.name as brand, c.name as category, p.tone, p.is_new, p.popularity,
  p.price_minor, p.compare_at_minor, p.max_per_order,

  -- Exactly the derivations in products.js:485-499
  (p.stock > 0 or p.backorder_ok)                    as in_stock,
  (p.stock > 0 and p.stock <= p.low_stock_at)        as is_low_stock,
  (p.compare_at_minor is not null
     and p.compare_at_minor > p.price_minor)         as is_on_sale,
  case when p.compare_at_minor > p.price_minor
       then round((1 - p.price_minor::numeric / p.compare_at_minor) * 100)::int
       else 0 end                                    as discount_percent,
  case when p.stock > 0 then p.sales_count else 0 end as sales_count,

  -- Best Seller badge follows the data, not a hardcoded list (products.js)
  (rank() over (order by case when p.stock>0 then p.sales_count else 0 end desc)
     <= 10)                                          as is_best_seller,

  coalesce(
    (select jsonb_agg(jsonb_build_object('path', i.storage_path, 'alt', i.alt)
            order by i.position)
     from product_images i where i.product_id = p.id), '[]'::jsonb) as gallery,

  (select jsonb_object_agg(t.kind, t.names) from (
     select tt.kind, jsonb_agg(tt.name order by tt.sort_order) as names
     from product_terms pt join taxonomy_terms tt on tt.id = pt.term_id
     where pt.product_id = p.id group by tt.kind) t)  as terms
from products p
join brands b on b.id = p.brand_id
join categories c on c.id = p.category_id
where p.status = 'active' and b.is_active and c.is_active;
```

Notably `stock` and `cost_minor` are **absent** from the public view. Competitors don't get your inventory depth or your margins. `is_low_stock` (a boolean) is all the "Only a few left" urgency UI needs.

### 2.4 Orders

```sql
create type order_status as enum
  ('pending','processing','shipped','delivered','cancelled','refunded');

create table customers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users on delete set null, -- null = guest
  email citext not null,
  full_name text,
  phone text,
  points int not null default 0,
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index on customers (email) where auth_user_id is null;

create table orders (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,          -- AUR-xxxxxx, generated by sequence
  customer_id uuid references customers(id) on delete set null,
  email citext not null,
  status order_status not null default 'pending',
  payment_method text not null,         -- 'card' | 'cod' | 'bkash'
  payment_status text not null default 'unpaid',
  -- Money snapshot: totals are FROZEN at checkout. Never recompute from
  -- current prices — a later price edit must not rewrite order history.
  subtotal_minor int not null,
  discount_minor int not null default 0,
  shipping_minor int not null default 0,
  tax_minor      int not null default 0,
  total_minor    int not null,
  coupon_code text,
  shipping_address jsonb not null,
  tracking_number text,
  courier text,
  notes text,                            -- internal, staff-only
  placed_at timestamptz not null default now(),
  cancelled_at timestamptz,
  legacy_local_id text                   -- localStorage migration key
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  -- Denormalized on purpose: the order must still read correctly after the
  -- product is renamed, repriced, or deleted.
  product_name text not null,
  product_slug text not null,
  brand_name text not null,
  image_path text,
  unit_price_minor int not null,
  quantity int not null check (quantity > 0),
  line_total_minor int not null
);

-- Every status change is an append-only event. Powers the customer-facing
-- tracker AND the audit trail, and replaces the timestamp-derived status.
create table order_events (
  id bigserial primary key,
  order_id uuid not null references orders(id) on delete cascade,
  from_status order_status,
  to_status   order_status not null,
  note text,
  actor_id uuid references auth.users,   -- null = system
  created_at timestamptz not null default now()
);

create table inventory_movements (
  id bigserial primary key,
  product_id uuid not null references products(id) on delete cascade,
  delta int not null,                    -- -2 sale, +50 restock, -1 damage
  reason text not null,                  -- 'sale'|'restock'|'adjust'|'cancel'|'return'
  order_id uuid references orders(id) on delete set null,
  actor_id uuid references auth.users,
  note text,
  created_at timestamptz not null default now()
);
```

`inventory_movements` is the ledger; `products.stock` is the running balance. Any drift between them is a bug you can *detect* — without the ledger, "why is stock 3?" is unanswerable, which is exactly the question a client calls a developer about.

### 2.5 Promotions

```sql
create type discount_kind as enum ('percent','fixed','free_shipping');

create table coupons (
  id uuid primary key default gen_random_uuid(),
  code citext not null unique,
  kind discount_kind not null,
  value_minor int,                        -- fixed → paisa
  value_percent numeric(5,2),             -- percent → 0-100
  also_free_shipping boolean not null default false,
  min_subtotal_minor int not null default 0,
  max_discount_minor int,                 -- caps a % coupon
  starts_at timestamptz,
  ends_at   timestamptz,
  usage_limit int,                        -- null = unlimited
  usage_limit_per_customer int not null default 1,
  used_count int not null default 0,
  first_order_only boolean not null default false,
  -- Loyalty coupons (AURA3/AURA5/AURA8FS) are gated on points. Manual
  -- coupons leave this null. One table, two behaviours — matches lib/coupons.js.
  required_points int,
  applies_to jsonb,                       -- {products:[], categories:[], brands:[]}
  is_active boolean not null default true,
  created_by uuid references auth.users,
  created_at timestamptz not null default now(),
  check (kind <> 'percent' or value_percent is not null),
  check (kind <> 'fixed'   or value_minor  is not null)
);

create table coupon_redemptions (
  id bigserial primary key,
  coupon_id uuid not null references coupons(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  customer_id uuid references customers(id),
  discount_minor int not null,
  created_at timestamptz not null default now(),
  unique (coupon_id, order_id)
);

create table sales (                       -- flash / seasonal campaigns
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind discount_kind not null,
  value_percent numeric(5,2),
  value_minor int,
  starts_at timestamptz not null,
  ends_at   timestamptz not null,
  scope jsonb not null,                    -- {products:[],categories:[],brands:[],all:false}
  banner_text text,
  banner_theme text,
  show_countdown boolean not null default true,
  priority int not null default 0,         -- highest wins on overlap
  is_active boolean not null default true,
  check (ends_at > starts_at)
);
```

A sale writes `compare_at_minor` on entry and restores it on exit via a scheduled job (`pg_cron`), so the storefront's existing sale/discount logic keeps working untouched. The pre-sale price is stashed in `sales_price_snapshots` so an expiring sale can never leave a wrong price behind.

### 2.6 CMS

```sql
create table content_blocks (
  slot text primary key,       -- 'home.hero', 'global.announcement', 'home.offers'
  payload jsonb not null,
  schema_version int not null default 1,
  updated_by uuid references auth.users,
  updated_at timestamptz not null default now()
);

create table content_revisions (   -- every save, so the client can undo
  id bigserial primary key,
  slot text not null,
  payload jsonb not null,
  actor_id uuid references auth.users,
  created_at timestamptz not null default now()
);
```

**Each slot has a declared field schema in `src/admin/schemas/`** — the admin renders a typed form (text input, image picker, product picker, colour swatch, date range) from it. The client never sees JSON. Example for `home.hero`:

```js
{ slot: "home.hero", label: "Homepage Hero",
  fields: [
    { key: "eyebrow",  type: "text",  max: 40 },
    { key: "line1",    type: "text",  max: 24, help: "Animates word by word" },
    { key: "line2",    type: "text",  max: 40 },
    { key: "ctaLabel", type: "text",  max: 20 },
    { key: "ctaHref",  type: "route" },
    { key: "media",    type: "image", aspect: "3:4", required: true },
    { key: "featured", type: "product-ref", multiple: true, max: 3 },
  ]}
```

`Hero.jsx` currently hardcodes `line1 = ["Glow","within."]` as a word array for the stagger. The CMS supplies a **string**; `Hero.jsx` does `line1.split(" ")` at render. The animation is untouched.

Slots to ship: `global.announcement`, `home.hero`, `home.offers`, `home.concerns`, `home.rituals`, `home.journal`, `home.why`, `page.about`, `page.contact`, `footer.columns`, `nav.links`, `seo.defaults`.

### 2.7 Settings & audit

```sql
create table store_settings (            -- single row, id = true
  id boolean primary key default true check (id),
  free_shipping_threshold_minor int not null default 600000,
  standard_shipping_minor int not null default 10000,
  express_shipping_minor  int not null default 15000,
  tax_rate numeric(5,4) not null default 0,
  currency_code text not null default 'BDT',
  points_per_taka numeric not null default 0.01,
  points_per_review int not null default 5,
  support_email text, support_phone text,
  socials jsonb not null default '{}',
  maintenance_mode boolean not null default false
);

create table audit_log (
  id bigserial primary key,
  actor_id uuid references auth.users,
  actor_email text,
  action text not null,                  -- insert | update | delete
  table_name text not null,
  record_id text not null,
  diff jsonb,                            -- changed keys only, before/after
  ip inet,
  created_at timestamptz not null default now()
);
create index on audit_log (table_name, record_id, created_at desc);
```

One generic trigger function attached to every administered table writes the diff. Not per-table code — one function, N triggers. Money and PII columns are redacted for non-owner readers via a view.

### 2.8 RLS — the actual security boundary

```sql
alter table products enable row level security;

create policy "public reads active products" on products
  for select using (status = 'active');

create policy "staff read all" on products
  for select using (is_staff('support'));

create policy "admins write" on products
  for all using (is_staff('admin')) with check (is_staff('admin'));

-- Customers see only their own orders; staff see all.
create policy "own orders" on orders for select
  using (customer_id in (select id from customers where auth_user_id = auth.uid())
         or is_staff('support'));

-- Nobody writes orders directly. Only the RPC (SECURITY DEFINER) can.
create policy "no direct order writes" on orders for insert with check (false);

-- Audit log is append-only, owner-readable, and immutable to everyone.
create policy "owner reads audit" on audit_log for select using (auth_role() = 'owner');
create policy "nobody updates audit" on audit_log for update using (false);
create policy "nobody deletes audit" on audit_log for delete using (false);
```

RLS is enabled on **every** table with a deny-by-default posture. A missing policy means no access, not open access.

### 2.9 The transactional order RPC

```sql
create or replace function place_order(payload jsonb)
returns orders language plpgsql security definer set search_path = public as $$
declare v_order orders; v_item jsonb; v_stock int; v_product products;
begin
  -- Lock every line's product row first, in a deterministic order, so two
  -- simultaneous checkouts on the last unit cannot both succeed.
  for v_item in select * from jsonb_array_elements(payload->'items') loop
    select * into v_product from products
      where id = (v_item->>'product_id')::uuid for update;
    if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
    if v_product.status <> 'active' then raise exception 'PRODUCT_UNAVAILABLE'; end if;
    if v_product.stock < (v_item->>'quantity')::int and not v_product.backorder_ok
      then raise exception 'INSUFFICIENT_STOCK:%', v_product.slug; end if;
  end loop;

  -- Server recomputes every total from server-side prices. The client's
  -- numbers are display only and are never trusted.
  ... insert orders, order_items, decrement stock,
      insert inventory_movements(reason='sale'),
      insert order_events(to_status='pending'),
      insert coupon_redemptions + increment coupons.used_count ...
  return v_order;
end $$;
```

Cancelling an order runs the mirror function: restock, ledger entry with `reason='cancel'`, status event, coupon redemption reversed.

---

## 3. Phase 2 — Data access layer & migration

### 3.1 Client structure

```
src/lib/api/
  client.js        // supabase client, single instance
  products.js      // listProducts, getProduct, adminUpsertProduct…
  orders.js        // placeOrder (RPC), listOrders, setStatus
  content.js       // getBlock(slot), adminSaveBlock
  coupons.js       // validateCoupon (RPC), adminCrud
  settings.js
  media.js         // upload, delete, signed URLs
```

Every function returns `{ data, error }` — never throws. Callers already have `ErrorBoundary` + `Toast` to surface failures.

**Storefront reads stay fast** by keeping the *shape* the components already consume. `listProducts()` maps `products_public` rows into the exact object shape `ProductCard`/`Gallery`/`queryProducts` expect (`{ id, brand, name, price, image, gallery, inStock, isLowStock, isOnSale, discountPercent, salesCount, ... }`). **No component changes in Phase 2.** `queryProducts`, `lib/search.js`, filters, and sorting all keep working against the same in-memory array — it's just fetched instead of imported.

### 3.2 Migration of the existing catalog

A one-shot Node script, `scripts/migrate-catalog.mjs`:
1. Import `PRODUCTS` from `data/products.js` (post-process already applied).
2. Upsert `brands`, `categories`, `taxonomy_terms` from the distinct values.
3. For each product: insert with `legacy_id = product.id`, `slug = product.id`, `price_minor = round(price * 120 * 100)`, `stock`, `popularity`, `sales_count` carried over verbatim so the Best Seller badge and Featured sort don't shift.
4. Walk `assests/**`, upload each referenced file to the `product-images` bucket, insert `product_images` rows preserving the current gallery order (front shot at `position = 0`).
5. Seed `coupons` from `lib/coupons.js` (loyalty ones get `required_points`), `store_settings` from `shop-config.js`, `content_blocks` from the hardcoded arrays in `Hero.jsx` / `Offers.jsx` / `Footer.jsx`.
6. Print a diff report: any product whose derived fields differ post-migration is a migration bug. **Target: zero diffs.**

Keep `data/products.js` in the repo, unimported, until Phase 6 sign-off. It is the rollback.

### 3.3 Order status cutover

`lib/order-status.js` becomes:

```js
// Stored status wins. The timestamp derivation survives ONLY as a fallback
// for legacy localStorage orders that predate the DB and have no status row.
export function orderStatusId(order) {
  if (order?.status) return order.status;
  return deriveFromTimestamp(order?.timestamp);   // legacy path
}
```

`ORDER_STAGES` gains `cancelled` / `refunded` as terminal states rendered distinctly (the current 4-step progress bar assumes linear advance — a cancelled order needs an interrupted-bar treatment, not step 3 of 4).

Existing localStorage orders migrate on next login: `legacy_local_id` prevents double-import.

---

## 4. Phase 3 — Admin UI

### 4.1 Shell

```
src/admin/
  AdminApp.jsx           // route table, auth gate, role gate
  layout/  Sidebar, Topbar, PageHeader, RoleGate
  components/            // DataTable, FilterBar, BulkActionBar, SaveBar,
                         // ImageUploader, ProductPicker, MoneyInput,
                         // RichText, DateRangePicker, StatusPill, DiffViewer
  screens/  dashboard/ products/ inventory/ orders/ customers/
            content/ promotions/ media/ settings/ staff/ audit/
  schemas/               // CMS slot field definitions (§2.6)
```

Built on the existing `components/ui/` primitives and `index.css` tokens ([[aura-skin-design-tokens]]) — same buttons, fields, toasts, z-index scale. Light theme by default (admins work in daylight; the storefront is dark-first).

**Cross-cutting patterns, built once, used by every screen:**
- `DataTable` — server-side pagination, sort, column filters, saved views, CSV export
- `SaveBar` — sticky, appears on dirty, blocks navigation on unsaved changes
- `ImageUploader` — drag-drop, reorder, crop to aspect, alt-text required, WebP conversion on upload
- Optimistic writes with rollback on error, surfaced through the existing `Toast`

### 4.2 Screens

**Dashboard** — today's revenue/orders/AOV, 30-day sparkline, low-stock list (`stock <= low_stock_at`), out-of-stock count, pending-orders queue, coupons expiring this week, recent audit entries.

**Products**
- List: thumbnail, name, brand, category, price, stock badge, status. Filter by everything the storefront filters by (reuses the same taxonomy). Bulk: activate/archive, price change (%, fixed, set), category assign, delete.
- Editor: tabbed — *Details* (name, slug with auto-generate + manual override + "changing this creates a redirect" warning, brand, category, subtitle, description, how-to-use), *Pricing* (price, compare-at with live discount % preview, cost + margin), *Inventory* (stock, low-stock threshold, max per order, backorder, movement history), *Taxonomy* (concerns / skin types / ingredients as multi-select chips), *Media* (drag-drop gallery, position 0 = front shot), *SEO* (title, description, Google preview).
- **Live storefront preview** — the real `ProductCard` and PDP rendered from unsaved form state, side by side. The client sees the result before publishing.

**Inventory** — dedicated stock-only grid with inline editing (fast restock runs), movement ledger with reason + actor, low-stock alert config, CSV import/export for bulk stocktakes.

**Orders**
- Queue with status tabs, search by number/email/phone, date range, bulk status advance, CSV export.
- Detail: line items with images, frozen totals, customer + shipping address, payment method/status, courier + tracking number, internal notes, full status timeline from `order_events`, printable invoice (HTML → print CSS, no PDF dependency), refund/cancel with automatic restock.

**Customers** — list with lifetime value, order count, points; detail with order history, addresses, reviews, points adjustment (audited), and a GDPR-style export/erase action.

**Content** — a slot list rendered from the field schemas. Hero editor has a live desktop/mobile preview of the actual `Hero.jsx`. Revision history with diff + one-click restore. A global announcement-bar editor with schedule window.

**Promotions**
- Coupons: list with usage progress bars; a generator (code auto-suggest or manual, type, value, min spend, max discount, window, total + per-customer limits, product/category scope, first-order-only). Redemption log per coupon.
- Flash sales: name, scope picker, discount, start/end with timezone, banner text + countdown toggle, and a **preview of exactly which SKUs and prices are affected** before activation. Scheduled activation/expiry via `pg_cron`.

**Media library** — all Storage assets, searchable, with usage references ("used by 3 products, 1 hero"). Deletion is blocked while referenced.

**Settings** — shipping thresholds and rates, tax rate, currency, loyalty earn rates and milestone tiers, contact details, socials, SEO defaults, maintenance mode.

**Staff** (owner only) — invite by email, assign role, revoke, force MFA, session list.

**Audit log** (owner) — filterable by actor/table/date, with a before/after diff viewer.

---

## 5. Phase 4 — Security hardening

1. **MFA (TOTP) mandatory** for `owner` and `admin`. Enforced by an RLS check on a `profiles.mfa_verified_at` column, not by the UI.
2. **Validation at three layers**: Postgres `CHECK` constraints (the real guard) → RPC argument validation → client-side form validation (UX only). Never client-only.
3. **No service-role key in the browser, ever.** The admin bundle uses the anon key plus the user's JWT; RLS does the rest. Any code path needing service-role runs in an Edge Function.
4. **Rate limiting** on `validate_coupon` and auth endpoints — coupon brute-forcing is the realistic attack here.
5. **Storage policies**: public read on `product-images`, staff-only write, 5 MB cap, MIME allowlist, filename sanitisation.
6. **CSP + security headers** in `deploy/nginx.conf` — `default-src 'self'`, Supabase host allowlisted, `frame-ancestors 'none'`, HSTS.
7. **Immutable audit log** — no UPDATE/DELETE policy exists for anyone, including the owner.
8. **Nightly automated backups** with a documented, *tested* restore procedure. An untested backup is not a backup.
9. **Soft deletes** — `status='archived'`, never a hard `DELETE`, on products, coupons and content. The client will archive something by accident.
10. **Frozen order money** — `order_items` denormalizes name, price and image so historical orders are immune to later catalog edits.

---

## 6. Phased delivery

| Phase | Scope | Exit criteria |
|---|---|---|
| **0 — Foundation** | Supabase project, `profiles` + roles + RLS helpers, `/admin` route shell, auth gate, `DataTable`/`SaveBar`/`ImageUploader` primitives | Owner logs in at `/admin`, sees an empty shell, non-staff get 404 |
| **1 — Catalog & inventory** | Catalog tables, `products_public` view, migration script, Products + Inventory screens, media upload | Storefront reads entirely from the DB; migration diff report is zero; client can add a product with images end to end |
| **2 — Orders** | Order tables, `place_order` RPC, stock decrement, status cutover, Orders + Customers screens, invoices | A checkout decrements real stock; client advances an order to Delivered; customer sees it in Account |
| **3 — CMS** | `content_blocks` + schemas + revisions, Content screens with live preview, Hero/announcement/offers/footer wired | Client changes the hero headline and image with no deploy |
| **4 — Promotions** | Coupons + sales tables, `validate_coupon` RPC, checkout wiring, Promotions screens, `pg_cron` scheduling | Client creates a 15%-off coupon capped at ৳500 and it applies correctly at checkout |
| **5 — Hardening** | MFA, CSP, rate limits, audit UI, backups + restore drill, load test | Security review passes; restore-from-backup rehearsed successfully |
| **6 — Independence** | Client walkthrough, screen-recorded runbooks, in-app contextual help, `data/products.js` deleted | Client performs all 12 core tasks unaided, from a cold start |

**Phase 4 has a dependency worth noting**: coupons are still not wired into checkout totals at all today (codes display but don't apply — a known gap in [[aura-skin-current-state]]). Phase 4 closes that gap and builds the admin for it in one pass, rather than wiring the storefront now and rewriting it later.

**The Phase 6 definition of done** — the client, unaided, can: add a product with 5 images; run a 3-day 20%-off flash sale on one brand; change the hero headline and background; restock a sold-out SKU; issue a coupon; mark an order shipped with a tracking number; refund and restock a cancelled order; edit the free-shipping threshold; add a staff member as Editor; publish a journal post; change the announcement bar; and export last month's orders to CSV.

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| Build-time image bundling → runtime URLs is the largest single change | Keep `imageFor()` as a fallback resolver through Phase 2; migrate product by product; both paths coexist |
| Client edits a name, URL changes, SEO dies | `product_slug_history` + nginx/router 301s; the editor warns before it happens |
| Overselling under concurrent checkout | `SELECT … FOR UPDATE` inside `place_order`; never a client-side stock check |
| Storefront gets slower (network vs bundled array) | Cache `products_public` at the edge; keep the derived-view shape identical so no component re-renders differently; a stale-while-revalidate fetch on first paint |
| Client breaks the site via CMS | Field-level validation + max lengths, revision history with one-click restore, preview-before-publish |
| Scope creep into a full ERP | Out of scope, explicitly: multi-warehouse, POS, subscriptions, multi-currency, i18n. Schema leaves room; the panel doesn't build them |
| Float→integer money migration errors | Migration script asserts `round(price * 120 * 100)` round-trips to the exact rendered string for all 179 SKUs before committing |

---

## 8. Open decisions for you

1. **Confirm the three conflicts in §0** — stored order status, integer BDT money, UUID PK + mutable slug. Each is a deliberate reversal of an existing documented decision, and Phase 1 can't start without a call on them.
2. **Payment provider** — bKash/Nagad/SSLCommerz changes `payment_status` handling and adds a webhook Edge Function. COD-only is materially simpler for v1.
3. **Transactional email** — order confirmations and shipping notices need Resend/Postmark and an Edge Function. In or out of scope?
4. **Journal/blog** — the `Journal` component exists on the homepage. Should articles be a full CMS collection (own table, editor, slugs) or stay a static content block?
