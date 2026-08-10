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

## 3. (Optional) point the invite link somewhere specific

By default the invite email's link lands the person back on your site's
root. If you want it to land directly on `/admin`, set:

```
npx supabase secrets set INVITE_REDIRECT_URL=https://your-domain.com/admin
```

## 4. Check the email template

Dashboard → Authentication → Email Templates → **Invite user**. The default
Supabase copy is generic ("You have been invited") — worth customizing to
mention the store by name so it doesn't look like spam to someone who wasn't
expecting it.

## 5. Test it

1. In `/admin/staff`, click **Invite staff**, use a real inbox you control
   (a `+test` alias on your own address works — e.g. `you+staffcheck@gmail.com`).
2. Confirm the email arrives (check spam if not within a minute or two).
3. Click the link — it should land you on a "set your password" screen.
4. Set a password, confirm you land on the dashboard, and that the role
   shown matches what you invited them as.
5. Back in `/admin/staff`, confirm the row now shows **active**, not
   *invited — pending*.
6. Delete that test account from **Staff & roles** (Revoke, or if it was
   flagged as a test account, `node scripts/cleanup-test-accounts.mjs --confirm`).

Only invite the client's real account after this passes end-to-end.
