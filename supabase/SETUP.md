# Admin panel — setup runbook

## Current state (verified against the live project, 2026-07-30)

| | Status |
|---|---|
| Service-role key in `.env.local` | ✅ real key present |
| Core commerce schema | ✅ applied |
| **Admin migration `0002`** | ✅ **applied** (all tables + RPCs verified live) |
| `is_staff()` hardened | ✅ anonymous callers now resolve to no role |
| Catalog seeded | ✅ 139 products, 250 images, 9 categories |
| Storage bucket `product-images` | ✅ public, images serve (200) |
| Clean URLs (no `#`) | ✅ restored — see below |
| Shop page reading from Supabase | ✅ wired |
| Homepage Hero reading from the CMS | ✅ wired (falls back to shipped copy) |
| Owner account | ✅ exists — but needs a password set (step 3) |
| **Migration `0003`** | ❌ not applied — retires the bootstrap RPC |
| Orders / customers / coupons | empty (no orders placed yet) |

Outstanding: **step 3** (get signed in) and **migration `0003`** (a two-line
hardening step, not a blocker).

---

## Security note: the `is_staff` hardening in `0002`

Worth knowing, because it constrains how you write future policies.

The original schema's `auth_role()` ends in `coalesce(…, 'support')`, so it
returned `'support'` for a caller with **no JWT and no profile row** — meaning
`is_staff('support')` was **true for the anonymous key**. `0002` adds staff read
policies on `orders`, `order_items`, `customers` and `products` gated on exactly
that check. Together those would have published every order and every
customer's name, email and phone number to the open internet.

`0002` therefore redefines `is_staff` to require an **active row in `profiles`**
— no row, no access, whatever a JWT claims. Verified live after applying:
anonymous `is_staff('support')` now returns `false`.

`auth_role()` itself is deliberately left untouched, because other objects may
depend on it. So:

> **Write new policies against `is_staff('…')`, never `auth_role()`.**
> `auth_role()` still returns `'support'` for anonymous callers.

Note also that `is_staff`'s parameter is the `app_role` **enum**, not `text`. A
`text` overload would make every `is_staff('support')` call in a policy
ambiguous and error at query time.

---

## 1. Migrations

[`0002_admin_foundation.sql`](migrations/0002_admin_foundation.sql) — **applied.**
Adds store settings, the stock ledger, flash sales, CMS revision history, the
audit log, RLS policies and the RPCs. Verified live: all six tables present,
`adjust_stock` / `set_order_status` / `admin_stats` all callable and correctly
returning `FORBIDDEN` to non-staff.

[`0003_retire_bootstrap_rpc.sql`](migrations/0003_retire_bootstrap_rpc.sql) —
**not yet applied.** Two lines; drops the now-unused owner self-promotion RPC.
Paste into the SQL Editor and run.

All statements are idempotent, so re-running is safe.

<details>
<summary>Verifying an RPC exists (a trap worth knowing)</summary>

Calling an RPC with an empty body to check whether it exists gives a **false
negative** for any function with required parameters — PostgREST returns
`PGRST202 "no matches found in the schema cache"` because it's looking for a
zero-argument overload, not because the function is missing. Pass real
arguments; `FORBIDDEN` back from a staff-guarded function proves it exists *and*
that its guard works.

```bash
# ✗ misleading: reports "missing" even when present
curl -X POST "$URL/rest/v1/rpc/adjust_stock" -d '{}'
# ✓ meaningful
curl -X POST "$URL/rest/v1/rpc/adjust_stock" \
     -d '{"p_product_id":"00000000-0000-0000-0000-000000000000","p_delta":1}'
```
</details>

---

## 2. Seed the catalog — already done

139 products, 250 images and 9 categories are live. Re-run only if you need to
reset:

```bash
node scripts/migrate-catalog.mjs
node scripts/migrate-images-to-storage.mjs
```

---

## 3. Staff accounts

> **Correction to an earlier version of this file.** It said to "sign up
> normally on the storefront, then click Claim ownership". That does not work.
> The storefront's login modal is a **mock** — `AuthModal` calls
> `UserContext.signup()`, which writes to `localStorage` and *discards the
> password*. It never creates a Supabase Auth user. That is the whole reason
> `/admin` returned "Invalid credentials".

Staff accounts are created with a script, because creating a user or setting a
password requires the service-role key — the one credential that must never
reach a browser:

```bash
# owner, with a generated password (printed once)
node scripts/admin-account.mjs you@example.com

# or choose your own
node scripts/admin-account.mjs you@example.com --password='pick-something-long'

# additional staff
node scripts/admin-account.mjs jane@example.com --role=editor --name='Jane'
```

It is idempotent and safe to re-run — **it is also the password-reset tool** if
an owner is ever locked out. It creates the auth user if missing (email
pre-confirmed, so there's no confirmation email to chase), sets the password,
and upserts the `profiles` row with the role. `profiles.role` is what
`is_staff()` reads, so it is what RLS actually enforces.

After the first owner exists, further roles can be granted in-panel under
**Staff & roles** — but the person must already have an auth account, so the
script is still how that account comes into being.

### If you're locked out right now

The project already has an owner: `soumitapaul344@gmail.com` is a confirmed
auth user whose `profiles` row has `role='owner'` and `is_active=true`. The
account simply has no working password. Two ways in:

- **Fastest:** `/admin` → "Email me a sign-in link" → open the emailed link.
- **Or set a password:** `node scripts/admin-account.mjs soumitapaul344@gmail.com`

There is no longer a "Claim ownership" button, and migration `0003` drops the
`admin_bootstrap_owner()` RPC that backed it — see that file for why.

---

## 4. Check it works

```bash
npm run dev
```

Open `http://localhost:5173/admin`.

You should land on the Dashboard with live counts. Try: open a product, change
its price, save; adjust stock and watch the movement appear in Stock history;
edit the homepage hero under **Content & banners**.

---

## Routing — clean URLs, no `#`

Every route is a real path: `/`, `/shop`, `/shop?concern=Hydration`,
`/product/<slug>`, `/admin`, `/admin/products/<id>`.

If you ever see `#/shop` again, the cause is almost certainly **not** a code
regression. The clean-URL work lives in commit `ac1727d` on the
`feat/clean-urls` branch; a branch forked from before it (as
`feat/supabase-data-layer` was) simply won't have it. Check with:

```bash
git merge-base --is-ancestor ac1727d HEAD && echo "clean URLs present" || echo "MISSING — merge feat/clean-urls"
```

How it works — there is no react-router in this project:

- `useRoute()` in [`src/App.jsx`](../src/App.jsx) parses `location.pathname`.
- [`src/lib/navigate.js`](../src/lib/navigate.js) provides `navigate()` plus
  `installLinkInterceptor()`, installed once in `main.jsx`. One delegated click
  listener promotes internal `<a href="/…">` clicks to SPA navigations, so
  components keep plain `<a>` tags — only the href *string* changed. It
  correctly ignores modified clicks, `target="_blank"`, `download`,
  `rel="external"`, cross-origin links, and in-page `#fragment` anchors.
- Query state (Shop's facets) lives in `location.search` via `replaceState`, so
  filter clicks don't bloat the history stack.
- `#fragment` still means "scroll to this element", which is what it should
  mean — that's why the hero's "explore" anchor keeps working.

### The one hosting requirement

Clean URLs mean the server gets a request for `/shop` on a hard refresh. It must
serve `index.html` for any unmatched path or every deep link 404s.

A ready-made config is in
[`deploy/nginx.conf.example`](../deploy/nginx.conf.example). The essential line:

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

**Netlify** (`public/_redirects`): `/*  /index.html  200`
**Vercel** (`vercel.json`): `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`

`vite dev` and `vite preview` already do this, so local testing won't warn you
if production is misconfigured — verify a hard refresh on `/shop` after deploy.

Also remember: `VITE_`-prefixed env vars are inlined at **build** time. Changing
the Supabase URL or anon key means a rebuild and redeploy, not just a restart.

---

## Who can do what

Roles are enforced by RLS in Postgres, not by the admin UI. Hiding a button
changes what renders; the database still refuses the write either way.

| | owner | admin | editor | support |
|---|---|---|---|---|
| Products, pricing, inventory | ✅ | ✅ | read | read |
| Content & banners | ✅ | ✅ | ✅ | read |
| Coupons & flash sales | ✅ | ✅ | ✅ | read |
| Orders — view | ✅ | ✅ | ✅ | ✅ |
| Orders — change status | ✅ | ✅ | ❌ | ✅ |
| Customers | ✅ | ✅ | ❌ | ✅ |
| Store settings | ✅ | ✅ | ❌ | ❌ |
| Staff & roles | ✅ | ❌ | ❌ | ❌ |
| Audit log | ✅ | ❌ | ❌ | ❌ |

---

## Storefront ↔ database: what's connected

| Surface | Source | Notes |
|---|---|---|
| Shop grid | ✅ Supabase | `listProducts()`; filters/sort/search unchanged |
| Homepage Hero | ✅ CMS (`home.hero`) | copy, image, CTA, eyebrow |
| Product page (PDP) | ❌ static | still `data/products.js` |
| Home: Featured / Concerns / Rituals / Journal / Offers | ❌ static | schemas exist, components not read from them yet |
| Footer, About, Contact copy | ❌ static | ditto |
| Cart & checkout money rules | ❌ static | `lib/shop-config.js` constants, not `store_settings` |
| Coupons at checkout | ❌ static | `lib/coupons.js`; DB `coupons` table unused by checkout |
| Reviews | ❌ localStorage | `products.rating` / `review_count` are hand-set seeds |

The admin writes correctly to every table it owns. The gap is on the **read**
side: for the rows above marked ❌, an admin edit is saved but won't change the
storefront until that component is pointed at the database.

Two of those have a design decision attached, not just work:

- **Money rules.** Prices in the DB are integer paisa (`price_minor`), but the
  cart, `formatPrice()` and `PRICE_RANGES` still run on the old USD-ish float
  scale, so `listProducts()` currently converts *back* (÷12000). Wiring
  `store_settings` into checkout means unwinding that bridge — worth doing
  deliberately, not as a side effect.
- **Reviews.** There's no reviews table. Until there is, `rating` and
  `review_count` are editable seed values in the admin; once it exists they
  become derived and must come out of the writable field list in
  `lib/api/admin/catalog.js`.

### Adding a component to the CMS

Everything needed is already there — no new table, no new admin screen:

1. Add the slot to `SLOTS` in [`src/lib/api/admin/schemas.js`](../src/lib/api/admin/schemas.js).
   Set each field's `default` to the **exact copy currently hardcoded** in the
   component, so going live changes nothing visually until the client edits it.
2. In the component: `const { content } = useContent("your.slot")` and read
   `content.field`. Use `contentImage(content.image, BUNDLED_FALLBACK)` for
   images and `words(content.headline)` for per-word animations.

`useContent` returns the schema defaults synchronously on first render and swaps
in saved values when the fetch lands — so there's no spinner, no layout shift,
and a missing row / offline Supabase / un-run migration all degrade to the
original copy rather than a blank section.
