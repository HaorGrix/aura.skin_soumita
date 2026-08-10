# Deploying `invite-staff`

One-time setup so the "Invite staff" button in `/admin/staff` works. This is
the only piece of the invite system that needs the Supabase CLI — everything
else (the DB migration, the UI) ships with the app as usual.

## 1. Apply the migration

Paste `supabase/migrations/0025_staff_invites.sql` into the Supabase
dashboard's SQL Editor and run it (same process as every other migration in
this project — see the other files in `supabase/migrations/` for the
pattern). Adds `invited_by` / `invited_at` / `invite_accepted_at` to
`profiles` and the `accept_staff_invite()` function.

## 2. Deploy the function

```
npx supabase login
npx supabase link --project-ref <your-project-ref>     # Dashboard → Settings → General → Reference ID
npx supabase functions deploy invite-staff
```

No secrets to set by hand — `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` are injected automatically into every edge
function by the platform.

## 3. Point the invite link at production, explicitly

Without this, the link falls back to Supabase's **Site URL** — which is easy
to leave pointing at `localhost:3000` from early development and forget
about (this is exactly what broke previously). Set it explicitly:

```
npx supabase secrets set INVITE_REDIRECT_URL=https://your-production-domain.com/admin
```

This should be the same host as `VITE_SITE_URL` in your production
environment variables (`.env.example` — used by the password-reset flow,
which redirects the same way).

**Also required, separately, in the dashboard:** Authentication → URL
Configuration → **Redirect URLs** must include
`https://your-production-domain.com/admin` (or a wildcard covering it,
e.g. `https://your-production-domain.com/**`). Supabase silently ignores
any `redirectTo` that isn't on this allow-list and falls back to the Site
URL instead — setting the secret above alone is not enough if this list is
missing or still has a `localhost` entry.

## 4. Check the email template

Dashboard → Authentication → Email Templates → **Invite user**. The default
Supabase copy is generic ("You have been invited") — worth customizing to
mention the store by name so it doesn't look like spam to someone who wasn't
expecting it.

## 5. Test it

1. In `/admin/staff`, click **Invite staff**, use a real inbox you control
   (a `+test` alias on your own address works — e.g. `you+staffcheck@gmail.com`).
   Don't use a made-up address at a domain with no mail server (e.g.
   `@example.org`, used by this project's other disposable test-account
   scripts) — Supabase validates deliverability before sending and rejects
   it outright with "Email address is invalid", which looks like a bug but
   isn't one.
2. Confirm the email arrives (check spam if not within a minute or two).
3. Click the link — it should land you on a "set your password" screen.
4. Set a password, confirm you land on the dashboard, and that the role
   shown matches what you invited them as.
5. Back in `/admin/staff`, confirm the row now shows **active**, not
   *invited — pending*.
6. Delete that test account from **Staff & roles** (Revoke, or if it was
   flagged as a test account, `node scripts/cleanup-test-accounts.mjs --confirm`).

Only invite the client's real account after this passes end-to-end.
