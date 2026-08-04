# Authentication & Authorization Security Audit

**Date:** 2026-08-02
**Scope:** admin auth, customer auth, role enforcement, session lifetime, brute-force protection
**Method:** every claim below was tested live against the production Supabase project — real accounts
created and destroyed, real login attempts, real JWTs decoded, real RLS policies probed with the
anon key and with authenticated-but-non-staff sessions. Nothing here is inferred from reading code
alone unless explicitly labeled "code review only."

---

## Answering your 7 questions directly

### 1. No hardcoded credentials anywhere — ✅ confirmed

- Grepped the entire `src/` tree for password/secret/API-key literals: nothing found. The only
  matches were legitimate (`type="password"` form fields, the word "password" in UI copy/comments).
- `.env.local` is gitignored (verified: `git check-ignore -v .env.local` → matched) and was never
  committed (`git ls-files | grep .env` → only `.env.example`, which contains placeholders only).
- `SUPABASE_SERVICE_ROLE_KEY` never appears in `src/` — confirmed by grep. It's confined to
  `scripts/*.mjs`, deliberately not `VITE_`-prefixed so Vite can never inline it into the browser
  bundle.
- `src/lib/api/client.js` constructs the Supabase client from `import.meta.env.VITE_SUPABASE_*` only
  — no fallback literal, no hardcoded key.

Admin authentication runs entirely on Supabase Auth. Passwords are never seen or stored by this
app's code — `signInWithPassword()`/`signUp()` send credentials directly to Supabase's GoTrue
service, which hashes them (bcrypt) server-side. That's a platform guarantee, not something this
codebase could get wrong even if it tried.

### 2. Public signup can't be used to grant `role: 'admin'` — ✅ confirmed, but the real reason is more interesting than "the code checks for it"

**There is currently no public signup path that touches `role` at all**, for two independent reasons,
both verified live:

- **Storefront customer "sign up" is a complete mock.** `AuthModal.jsx` → `UserContext.signup()`
  writes a profile to `localStorage` only. It never calls Supabase Auth, never sends a password
  anywhere, never creates a real account. There is no server round-trip to attack. (This is a
  separate, larger finding — see **HIGH-2** below — but it does mean today's literal answer to
  "can I inject `role:'admin'` through the signup UI" is "there's no real signup to inject into.")

- **The platform-level path (`supabase.auth.signUp()`) is architecturally incapable of setting a
  trusted role, even in the worst case.** I proved this by simulating something *worse* than what a
  public signup could ever achieve: I created a real account via the admin API, and forced
  `app_metadata.role = 'admin'` onto it directly (an operation the public `signUp()` API cannot even
  perform — `options.data` only ever writes to `user_metadata`, a field this app never reads for
  authorization). I then signed in as that user with a real session and real JWT — literally
  containing `"role":"admin"` in its decoded claims — and tested it against everything:

  ```
  JWT app_metadata (as actually decoded from the token): {"is_admin":true,"is_staff":true,"role":"admin", ...}

  is_staff('support')  = false   ✅ ignored the claim
  is_staff('editor')   = false   ✅
  is_staff('admin')    = false   ✅
  is_staff('owner')    = false   ✅
  SELECT orders         → 0 rows
  SELECT audit_log       → 0 rows
  adjust_stock() RPC     → denied: FORBIDDEN
  INSERT own profiles row (role=owner) → denied: RLS violation
  ```

  The reason: `is_staff()` (defined in `0002_admin_foundation.sql`) is `SECURITY DEFINER` and looks
  up `public.profiles` by the caller's `auth.uid()` — it does not read the JWT's role claim at all.
  No row in `profiles` → no access, full stop, regardless of what the JWT says. A JWT claiming
  `role: admin` is worth exactly nothing without a matching `profiles` row, and only an existing
  owner can create one (see #4).

**Recommendation, not yet built:** if/when real customer signup is implemented (replacing the
localStorage mock), it should go through `supabase.auth.signUp()` for the account, and — if any
`customers`/`profiles`-adjacent row needs creating — that insert must be done by a trigger or RPC
that hardcodes the customer role server-side and ignores any role-shaped field in the payload,
exactly per your spec. Today there's no such write path to harden, because there's no real signup
write path at all yet.

### 3. RLS enforces role-based access at the database level, tested both ways — ✅ confirmed

**Backend (direct API/RPC calls, bypassing the UI entirely):** using the same forged-admin-JWT
session as above — a genuinely authenticated user, not anonymous — direct queries against every
staff-gated table were tested:

| Table | Authenticated non-staff sees | Verdict |
|---|---|---|
| `orders` | 0 rows | ✅ |
| `order_items` | 0 rows | ✅ |
| `order_events` | 0 rows | ✅ |
| `customers` | 0 rows | ✅ |
| `coupon_redemptions` | 0 rows | ✅ |
| `profiles` | 0 rows | ✅ |
| `audit_log` | 0 rows (of 490) | ✅ |
| `inventory_movements` | 0 rows | ✅ |
| `content_revisions` | 0 rows | ✅ |
| **`coupons`** | **4 of 4 rows** | ❌ — see **HIGH-1** below |

RPCs: `adjust_stock()` → `FORBIDDEN`. Direct `profiles` self-promotion (`insert role='owner'`) →
denied by RLS.

**Frontend (the actual admin panel UI, real login form, real browser):** created a genuine Supabase
Auth customer (real email/password, real session — no mock), then drove the actual `/admin` login
form with Playwright:

```
Signed in as zz-ui-customer-...@example.org (a real, confirmed Supabase user with no profiles row)
→ UI shows "This account isn't staff" screen                          ✅ blocked
→ Forced a direct deep link to /admin/staff (bypassing all nav links) ✅ still shows "not staff" — no bypass
```

So both layers were tested independently and both hold, with one confirmed exception (coupons — fixed below).

### 4. No public UI path to create an admin account — ✅ confirmed

- Grepped every storefront file for any write to `profiles`: zero matches. The mock customer auth
  never touches the `profiles` table at all.
- The only code that writes `profiles.role` is `src/lib/api/admin/settings.js`
  (`setStaffRole`/`setStaffActive`), called only from `src/admin/screens/Staff.jsx`, which is gated
  at `min: "owner"` in the nav (`Shell.jsx`) — but as established throughout this audit, the UI gate
  is a courtesy; the real enforcement is the RLS policy `profiles_owner_write`, which requires
  `is_staff('owner')` for any write to `profiles`. Tested directly above: denied for a non-owner,
  even one holding a JWT that claims to be an admin.
- The former `admin_bootstrap_owner()` self-promotion RPC was deliberately removed in an earlier pass
  (migration `0003`) — confirmed still gone (`PGRST202` on call).
- First-admin creation is `node scripts/admin-account.mjs`, a local script requiring the
  `service_role` key. Every subsequent staff account requires an existing owner to grant it from
  inside `/admin/staff`. There is no third path.

### 5. Rate limiting on login attempts — ⚠️ present, but thin (MEDIUM — see below)

- **Signup mailer:** genuinely rate-limited. Three signup attempts from different addresses in quick
  succession all returned `429 over_email_send_rate_limit`.
- **Password login:** rate-limited, but only after **45 rapid wrong-password attempts** against a
  real account (tested against the actual owner email, all guesses obviously failed — no real risk
  taken). This is Supabase's platform-default GoTrue rate limit, not anything this app configured
  itself. No account lockout, no CAPTCHA, no progressive backoff, no "your account was just probed"
  notification — the app adds no layer on top of the platform default.

### 6. Session token expiry — ✅ confirmed reasonable

Decoded a real, freshly-issued access token:

```
issued:  2026-08-01T22:51:13Z
expires: 2026-08-01T23:51:13Z
lifetime: 60 minutes
```

Standard Supabase default. The long-lived refresh token exists alongside it (by design — that's how
"stay signed in" works without re-entering a password every hour) but every actual API/RLS check
runs against the 60-minute access token, not the refresh token. Not indefinite, not excessive.

### 7. Your own account role — ✅ confirmed, with one nuance

```
soumitapaul344@gmail.com  →  profiles.role = "owner"   (is_active: true)
```

**Note:** you asked me to confirm `role = 'admin'`; the actual stored value is `'owner'`, which is
the *top* of the role hierarchy (`owner > admin > editor > support` — `is_staff()` treats `owner` as
satisfying every lower threshold, including `'admin'`). So your account has strictly *more* access
than plain `'admin'`, not less — but if anything in the app or your own mental model specifically
checks for the literal string `'admin'` rather than using the role hierarchy, it's worth knowing the
exact stored value isn't that string. Also noted in passing: `profiles.email` is `NULL` for this row
(the real email lives on `auth.users`, which is authoritative for login) — cosmetic only, but it
means the Staff screen's roster will show a blank email for this row. Low priority, not a security
issue.

There is exactly **one** staff account in the entire system. No other `profiles` rows exist.

---

## Prioritized findings

### 🔴 CRITICAL
None found.

### 🟠 HIGH

**HIGH-1 — `coupons` table publicly readable by anyone, no session required. Fix written, not yet applied.**

Confirmed with a fully anonymous request (no JWT at all): all 4 coupon codes, their exact discount
values, `usage_limit`, and `used_count` are returned in full.

Root cause: `0002_admin_foundation.sql` defines exactly one SELECT policy on this table
(`coupons_staff_read`, requiring `is_staff('support')`), and `is_staff()` correctly returns `false`
for an anonymous caller — so that policy alone would deny the read. It didn't. That means a
**second, more permissive SELECT policy exists on the live database that is not defined in any
tracked migration file** — almost certainly added directly via the Supabase dashboard at some point
before this project's migration files existed, and never captured in version control.

I confirmed the write side is *not* affected — a crafted anonymous `INSERT` of a 100%-off coupon was
correctly denied with a real RLS violation — so this is read-only exposure, not a write hole. I also
confirmed nothing in the app actually needs this: the storefront never queries `coupons` directly
(only the staff-only admin module does); checkout validates coupons entirely inside `place_order()`,
which is `SECURITY DEFINER` and needs no table grant.

**Fix:** [`supabase/migrations/0015_lock_down_coupons_table.sql`](supabase/migrations/0015_lock_down_coupons_table.sql)
— drops every existing policy on the table (regardless of the untracked one's actual name) and
recreates exactly the two `0002` already intended.

**⚠️ I could not apply this myself.** I have the `service_role` key, but that grants elevated *data*
access via PostgREST — it does not grant DDL execution (`CREATE POLICY`, `ALTER TABLE`) over the REST
API. Every migration in this project's history has required you to paste it into the Supabase SQL
Editor, and this is no exception. **This is the one action I'd ask you to take right now** — it's a
two-minute paste-and-run, and closes the only confirmed live gap in this audit.

**HIGH-2 — Customer-facing "accounts" are not real accounts at all.**

Not something you asked me to test directly, but it bears directly on your framing ("auth must go
entirely through Supabase Auth with hashed passwords") — for **admin**, that's true today; for
**customers**, it is not. `AuthModal.jsx`'s login/signup form collects a password, validates only its
*length* client-side, and then **never sends it anywhere** — `login()`/`signup()` take an email (and
name) only. "Signing in" as a customer means typing any email into a box; there is no password
check against anything, because nothing is stored to check against. The whole thing lives in
`localStorage`, keyed by email string.

Practical impact is narrower than it sounds, because nothing privileged trusts this identity — every
RLS policy keys off `auth.uid()` from a *real* Supabase session, which this mock never creates, so a
customer's "account" here cannot read another real customer's orders or any protected data (verified
throughout this audit). The risk is misrepresentation and a broken trust model, not a data leak: the
UI presents "Welcome back" and an account relationship that provides zero actual protection, and
orders placed while "signed in" this way link to the database by typed email alone, not a verified
identity.

Not fixed in this pass — it's a feature-scale rebuild (real signup, real password, linking orders to
`auth.uid()`), not a policy tweak, and doing it hastily inside a security audit risks a worse outcome
than leaving it flagged. Flagging it here because it's the most consequential fact relevant to your
original ask.

### 🟡 MEDIUM

**MEDIUM-1 — Login rate limiting is thin.** 45 attempts before throttling, purely the Supabase
platform default, no app-level hardening (CAPTCHA after N failures, progressive backoff, lockout
alerting). Reasonable for now given there's exactly one staff account and no public admin-creation
path, but worth tightening before this ever has more than a handful of staff logins to protect, or if
customer accounts become real (see HIGH-2) and are worth brute-forcing individually.

**MEDIUM-2 — `product_images` errors instead of failing closed for anonymous readers.** Side effect
of an earlier migration (`0005`) that locked the base `products` table to staff-only: something in
`product_images`'s own RLS appears to subquery `products` for its visibility check, and now errors
(`permission denied for table products`) instead of cleanly returning zero rows. Confirmed harmless —
nothing in the storefront queries this table directly; images reach the browser via
`products_public.gallery`, a pre-joined column on a view that runs with elevated privileges. Untidy,
not exploitable, no user-facing effect. Worth a follow-up policy fix for hygiene, not urgency.

### 🟢 LOW

- `profiles.email` is `NULL` on the one existing staff row (cosmetic — Staff screen shows a blank
  email; `auth.users.email` is what's actually authoritative).
- No MFA enforced for owner/admin accounts (noted in an earlier audit pass too; still outstanding).
- No session-timeout / "sign out everywhere" control surfaced to the user.

---

## What's already solid (no action needed)

- No hardcoded credentials anywhere in the codebase.
- Admin auth fully on Supabase Auth; passwords bcrypt-hashed server-side, never touched by app code.
- `is_staff()` is the sole authority for every privileged check, reads only a real `profiles` row via
  `auth.uid()`, and provably ignores JWT claims — tested with a JWT that *literally claimed*
  `role: admin` and was still refused everywhere.
- No client code writes to `profiles` outside the owner-gated Staff screen; RLS backs that up
  independently.
- The former self-promotion RPC is confirmed removed.
- Admin route protection is enforced at both layers — verified with a real browser, a real Supabase
  session, and a forced deep link, not just a code read.
- 9 of 10 staff-only tables correctly return zero rows to both anonymous and authenticated-non-staff
  callers.
- Session tokens expire in a sane 60 minutes; not indefinite.
- Signup is genuinely rate-limited at the mailer.
- Secrets hygiene (`.gitignore`, key placement) is correct throughout.

---

## Action required from you

1. **Apply `0015_lock_down_coupons_table.sql`** in the Supabase SQL Editor — the one confirmed live
   gap, fix already written and ready.
2. Decide whether HIGH-2 (real customer accounts) is worth scoping as its own piece of work — it's
   larger than a policy fix and deserves its own pass rather than a rushed patch here.
