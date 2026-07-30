# aura.skin — Security & Systems Audit + Roadmap

**Date:** 2026-07-30
**Scope:** admin panel, database (schema, RLS, RPCs, triggers), storage, auth, storefront wiring
**Method:** every claim below was tested against the **live Supabase project** using real
authenticated sessions — a disposable `editor` and `admin` user were created, exercised, and
deleted. Nothing was inferred from reading SQL alone.

---

## 0. How this audit was run (and one correction)

Two methodology notes, because they change how you should read any similar report:

**PostgREST hides RLS denials.** A `PATCH` that RLS filters to zero rows still returns
`204`. A `SELECT` on a table you cannot read returns `[]`, not an error. My first pass
treated "no error" as "allowed" and produced **four false-positive vulnerabilities**
(anon writing to `products`, `store_settings`, `profiles`, and deleting `audit_log`). All
four were re-tested with `Prefer: return=representation` and by re-reading the rows with
the service key: **zero rows were affected, and no data changed.** Anonymous writes are
correctly blocked. I'm flagging this because the wrong method makes a secure system look
broken and a broken one look fine.

**Verifying an RPC exists needs real arguments.** Calling one with `{}` returns
`PGRST202 "not found in schema cache"` whenever it has required parameters — I briefly
reported `adjust_stock` and `set_order_status` as missing on that basis. They exist.

**Cleanup:** all test users, canary products, test content and revisions were removed.
Final state verified: 139 products, 1 auth user, 1 customer, audit trail intact.

---

## 1. Findings

Severity: **BLOCKER** = a core advertised feature does not work · **HIGH** = data exposure
or operational dead-end · **MEDIUM** = silent data corruption or bad UX under failure.

### 1.1 BLOCKER — Saving any CMS block a second time always fails ✅ fixed

`content_blocks` has a `BEFORE UPDATE` trigger copying the old payload into
`content_revisions`. `snapshot_content()` was **not** `SECURITY DEFINER`, so the insert ran
as the calling user — and `content_revisions` has RLS on with a SELECT policy only. The
insert is rejected, the trigger raises, the whole UPDATE fails.

The first save of a slot is an INSERT (no trigger) and works, which is exactly why this
wasn't caught earlier. Reproduced live as both `editor` and `admin`:

```
1st save (INSERT): ✅ ok
2nd save (UPDATE → fires trigger): ❌ new row violates row-level security
                                      policy for table "content_revisions"
revision rows written: 0
```

The entire "client edits their own content" promise was broken after the first edit.
Fixed in `0004` — trigger is now `SECURITY DEFINER`, matching `write_audit()`.

### 1.2 BLOCKER — Nobody can upload a product image ✅ fixed

The `product-images` bucket is public-read, but `storage.objects` had **no INSERT, UPDATE
or DELETE policy at all**. Every upload was rejected. Confirmed live with an `admin`
session:

```
admin upload: ❌ denied — new row violates row-level security policy
```

`src/lib/api/media.js` carried a comment asserting an `is_staff('admin')` storage policy
existed. It did not. The admin's ImageManager has never worked.

Fixed in `0004`: explicit public read, staff-only write/delete, plus a server-enforced
5 MB limit and image-only MIME allowlist (the client-side check in `ImageManager.jsx` is a
courtesy, not a control).

### 1.3 HIGH — Competitors can read your stock levels and cost prices ✅ fixed

`products_public` deliberately omits `stock`, `cost_minor`, `sku`, `low_stock_at`. But the
**base `products` table is also anon-readable**, so they leak anyway:

```
anon → products.stock         = 5
anon → products.low_stock_at  = 5
anon → products.cost_minor    = null   ← only because unused; leaks the day you use it
```

Fixed in `0004` via column-level `REVOKE` rather than dropping the read policy — the
policy's name is unknown, and dropping the wrong one takes the storefront offline.
`products_public` is unaffected because a non-`security_invoker` view runs with its
owner's privileges. **The migration includes a verification query and a one-line rollback**
in case that view is ever recreated as `security_invoker`.

### 1.4 HIGH — A staff member who has ever acted cannot be deleted ✅ fixed

Every `actor_id` / `created_by` / `updated_by` column references `auth.users` with no
`ON DELETE` clause, which defaults to `NO ACTION`. Hit for real while cleaning up this
audit's own test accounts:

```
DELETE auth user → 500
  violates foreign key constraint "audit_log_actor_id_fkey"
```

Offboarding must not be blocked by history, and history must not be deleted to permit
offboarding. Fixed in `0004`: those FKs become `ON DELETE SET NULL`. The trail survives
because `audit_log` stores `actor_email` as plain text alongside the id — which is also
why the Staff screen offers "revoke access" rather than delete.

### 1.5 HIGH — Production CSP blocks all Supabase traffic and all images ✅ fixed

`deploy/nginx.conf.example` ships `connect-src 'self'; img-src 'self' data:`. That was
correct when written — the app had no backend. It now calls the Supabase API and loads
every product photo from Supabase Storage, so this CSP silently breaks **all data loading
and every image in production**.

Worse, it fails *only* in production: `vite preview` sends no CSP, so no amount of local
testing catches it. Fixed in the example config, now pinned to this project's origin
(`https://gmhqdurhmmkixjlerdqp.supabase.co`, matching `VITE_SUPABASE_URL`) for both
`connect-src` and `img-src`, plus `wss:` for Realtime.

If the project is ever moved to a different Supabase instance, `deploy/nginx.conf.example`
must be updated alongside `.env.local` — they are two copies of the same fact and nothing
enforces that they agree.

### 1.6 MEDIUM — Reinstating a cancelled order inflates stock ✅ fixed

`set_order_status()` treated only `delivered`/`refunded` as terminal, so
`cancelled → processing` was allowed. Cancelling runs the auto-restock; the reverse
transition has **no matching deduction**. Every round trip permanently added the whole
order back to inventory, silently.

Fixed: `cancelled` is now terminal in both the RPC (`0004`) and `nextStatuses()`.

### 1.7 MEDIUM — Low-stock alerts ignored the per-product threshold ✅ fixed

`listLowStock()` and the Inventory "Running low" filter hardcoded `stock <= 5`, ignoring
the `low_stock_at` column the product editor writes. Anything with a higher reorder point
never appeared. Fixed in `catalog.js` (PostgREST can't compare two columns, so the real
rule is applied client-side over a bounded fetch).

### 1.8 MEDIUM — A failed order action destroyed the order page ✅ fixed

`OrderDetail` rendered a full-page error whenever `error` was set — including errors from
a *rejected status change*, which threw away the page the admin was working on. Load
failures are fatal; action failures are now a dismissible inline banner.

---

## 2. What passed

Verified working, not assumed:

| Check | Result |
|---|---|
| Anonymous writes (products, coupons, orders, profiles, settings, sales, audit) | ✅ all blocked, `affected=0`, canary row unchanged |
| Anonymous storage upload | ✅ blocked |
| `is_staff()` hardening | ✅ anon resolves to no role (was `support`) |
| Privilege escalation: editor self-promotes to owner | ✅ blocked, role unchanged |
| Privilege escalation: editor demotes other staff | ✅ blocked |
| Editor writing products / store_settings | ✅ blocked (`affected=0`) |
| Admin writing products | ✅ allowed |
| Editor writing content blocks | ✅ allowed |
| `audit_log` visibility | ✅ hidden from **both** editor and admin (owner-only) |
| Audit trigger actually firing | ✅ 17 rows written during testing |
| `adjust_stock` / `set_order_status` guards | ✅ `FORBIDDEN` to anon and to editor |
| `admin_bootstrap_owner` retired | ✅ gone (`0003` applied) |
| Clean URLs, 6 routes + deep links + 404 | ✅ no `#`, no console errors |
| Admin login, magic link, password reset | ✅ |
| Owner account ↔ profile linkage | ✅ ids match, `role=owner`, `is_active=true` |

---

## 3. Outstanding work

Ordered by what actually blocks launch.

### 3.1 The single biggest gap: checkout never touches the database

**`place_order()` does not exist.** Checkout still writes orders to `localStorage`. The
consequences compound:

- **No order is ever recorded server-side.** The entire Orders + Customers admin area has
  no data and cannot have any. The client cannot fulfil what they cannot see.
- **Stock never decrements on a sale.** The inventory ledger only sees manual adjustments,
  so `products.stock` drifts from reality the moment anyone buys anything.
- **Overselling is unpreventable.** The `SELECT … FOR UPDATE` design that stops two
  shoppers buying the last unit only exists on paper.
- **Cancel-restock is actively dangerous.** `set_order_status('cancelled')` adds units back
  for an order that never deducted them — so today, cancelling *invents* inventory.

Nothing else in this list matters as much. Until it's done, the admin panel is a catalog
and CMS manager, not a store back-office.

### 3.2 Storefront still reads from static files

| Surface | Source |
|---|---|
| Shop grid | ✅ Supabase |
| Homepage Hero | ✅ CMS |
| Product page (PDP) | ❌ `data/products.js` |
| Home: Featured / Concerns / Rituals / Journal / Offers | ❌ static |
| Footer, About, Contact | ❌ static (schemas exist, unread) |
| Shipping / tax / free-shipping threshold | ❌ `lib/shop-config.js`, not `store_settings` |
| Coupons at checkout | ❌ `lib/coupons.js`; DB `coupons` table unused |
| Reviews | ❌ localStorage; `rating`/`review_count` hand-set in admin |

An admin edit to any ❌ row saves correctly and changes nothing a shopper sees.

### 3.3 Features that exist in the admin but do nothing

- **Flash sales are inert.** Campaigns save, the scope preview works, but no code ever
  applies a sale to a price. `sale_price_snapshots` is unused and there's no scheduler
  (`pg_cron`) to start/expire them. The client can build a sale that never happens.
- **Coupon targeting is unenforced.** `applies_to` (product/category/brand scope) exists as
  a column with no UI and no validation logic behind it.

### 3.4 Media — including the video support you asked about

- **No video support at all.** `product_images` is images-only: no `media_type`, no
  poster frame, no duration. Supporting video needs a schema change, a larger size limit,
  a separate MIME allowlist, and a player in the PDP gallery. Currently unstarted.
- **No image processing.** No resize, compression or WebP conversion on upload — a client
  uploading a 4 MB phone photo ships it to every shopper at full size.
- `width`, `height`, `blurhash` columns exist and are never populated, so there's no
  aspect-ratio reservation and layout shifts on image load.
- Alt text is optional; it should be required for accessibility and SEO.
- Gallery reorder does three sequential un-transactional writes (parking a row at
  `position = -1`). A failure mid-swap leaves a product with a `-1` image.

### 3.5 Inventory edge cases

- No stock reservation on add-to-cart — two shoppers can both hold the last unit.
- `backorder_ok` is editable but no storefront logic honours it.
- No CSV import/export for bulk stocktakes (planned, not built).
- No low-stock notification — the client must open the dashboard to find out.

### 3.6 Auth & accounts

- **Customer login is a mock.** `AuthModal` writes to `localStorage` and discards the
  password. Real customer accounts, order history and `customers.auth_user_id` linkage all
  depend on replacing it with Supabase Auth.
- **MFA is not enforced** for owner/admin (the plan called for it).
- No session timeout or "sign out everywhere".

### 3.7 Operational

- **No transactional email** — no order confirmation, no shipping notice, no receipt.
- No rate limiting on coupon validation (brute-forcing codes is the realistic attack).
- Backups exist by default but **restore has never been rehearsed**. An untested backup is
  not a backup.
- **No automated tests of any kind.** For a system with money and RLS in it, at minimum the
  role matrix and the order/stock RPCs should be covered — this audit was manual and will
  rot the moment someone edits a policy.
- Invoices are `window.print()` only.

---

## 4. Roadmap

### Do now — before any real customer

| # | Task | Why |
|---|---|---|
| 1 | **Apply `0004_audit_fixes.sql`** | Unblocks the CMS and image upload; closes the stock/cost leak |
| 2 | **Fill in the CSP** in `deploy/nginx.conf.example` | Otherwise production loads nothing at all |
| 3 | **Build `place_order()`** + wire checkout | §3.1 — everything downstream depends on it |
| 4 | Verify §1.3 rollback isn't needed (`products_public` still returns 139 to anon) | Guards against taking the shop offline |
| 5 | Re-run the role matrix after `0004` | Confirms the storage + revision policies behave |

### Then — make the panel true

| # | Task |
|---|---|
| 6 | Wire PDP to Supabase (largest remaining storefront surface) |
| 7 | Move shipping/tax/free-shipping to `store_settings` — unwind the ÷12000 float bridge |
| 8 | Coupons at checkout against the DB table, incl. `applies_to` + usage limits |
| 9 | Make flash sales real: apply/expire job + price snapshots |
| 10 | Wire remaining CMS slots (home sections, footer, About, Contact) |

### Then — production hardening

| # | Task |
|---|---|
| 11 | Image processing on upload (resize, WebP, dimensions, blurhash); require alt text |
| 12 | Replace mock customer auth with Supabase Auth; link orders to `auth.users` |
| 13 | Transactional email (order confirmation, shipping) |
| 14 | Enforce MFA for owner/admin; rate-limit coupon validation |
| 15 | Automated tests: role matrix, `place_order` concurrency, stock ledger integrity |
| 16 | Rehearse a restore from backup |

### Later — scope explicitly deferred

Video upload (§3.4), reviews in the database, CSV bulk import, stock reservation on
add-to-cart, multi-warehouse, POS, subscriptions, multi-currency, i18n.

---

## 5. Migration status

| File | Status |
|---|---|
| `0002_admin_foundation.sql` | ✅ applied |
| `0003_retire_bootstrap_rpc.sql` | ✅ applied — bootstrap RPC confirmed gone |
| `0004_audit_fixes.sql` | ⚠️ applied — 3 of 4 fixes verified working, **§1.3 was a no-op** |
| `0005_lock_down_products_table.sql` | ⬜ **not applied** — redoes §1.3 properly |
| `0006_place_order.sql` | ⬜ **not applied** — the checkout transaction |

### Re-verified live after applying 0004

| Fix | Result |
|---|---|
| §1.1 CMS second save | ✅ fixed — 2nd save succeeds, revision row written |
| §1.2 Admin image upload | ✅ fixed — upload allowed, non-image correctly rejected by the MIME allowlist |
| §1.4 Staff deletable with audit history | ✅ fixed |
| §1.3 Hide stock/cost from anon | ❌ **no-op — anon still reads `stock`, `cost_minor`, `sku`, `low_stock_at`** |

**Why §1.3 failed.** It used `revoke select (col…) on products from anon`. In PostgreSQL,
table-level and column-level privileges are separate grants, and Supabase grants `anon`
table-wide SELECT by default — a table-level grant authorises every column, and revoking a
*column* privilege doesn't subtract from a *table* one. The statement succeeded and changed
nothing. `0005` fixes it by locking the base table to staff and pointing the public at
`products_public`, which is what that view was for.
