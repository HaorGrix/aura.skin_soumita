# Handover checklist

Everything here is outside the app itself — dashboard/console actions only
you can take, since they involve accounts and access this codebase can't see
or change.

## Before inviting the client

- [ ] Deploy the invite system: `supabase/functions/invite-staff/README.md`
      (apply migration `0025`, `supabase functions deploy invite-staff`).
- [ ] Test the invite flow end-to-end with a disposable email you control
      (see step 5 in that README). Don't skip this — it's the one part of
      this handover that sends a real email and creates a real account.
- [ ] Review **Staff & roles** (`/admin/staff`) — every row flagged **test**
      is one you created for QA. Delete them:
      `node scripts/cleanup-test-accounts.mjs` (dry run) then `--confirm`.
- [ ] Review the audit log for anything you don't want the client seeing
      unexplained: `node scripts/audit-summary.mjs` for the bird's-eye
      view, or `/admin/audit` for row-by-row detail.

## Inviting the client

- [ ] `/admin/staff` → **Invite staff** → their real email, role **Owner**.
- [ ] Ask them to check their inbox (and spam folder) and complete signup —
      they choose their own password; you never see it.
- [ ] Once they're active, ask them to turn on **two-factor authentication**
      from the same screen. Owner accounts can change every other account's
      role, so this is the single highest-value one to protect.
- [ ] Confirm you can no longer do anything they haven't also granted you —
      i.e. if you keep a staff account, make sure it's the *role* you two
      agreed on, not owner-by-default because it was first.

## Your own access — pick one

**Full handoff (client owns everything independently):**
- [ ] Supabase → Project Settings → Team → remove yourself, or downgrade
      from Owner/Admin to no access.
- [ ] Vercel (or your host) → Project → Settings → Members → remove
      yourself.
- [ ] GitHub → repo → Settings → Collaborators → remove yourself (or
      transfer the repo to their account/org first if they don't have one).
- [ ] Rotate the Supabase `service_role` key (Dashboard → Settings → API →
      "Reset" ) if you ever had it in a `.env.local` on a machine you're not
      handing over — this invalidates anything cached under the old key,
      including your local scripts.
- [ ] Delete or hand over your own `.env.local` — it holds their live
      credentials.

**Ongoing support (you keep limited access):**
- [ ] Agree explicitly with the client on scope — e.g. "I fix bugs, I don't
      touch billing/domain settings."
- [ ] Supabase → keep **Developer**, not **Owner**, if that's enough for
      what you'll actually do (can't manage billing/members, can everything
      else).
- [ ] Vercel → keep **Member**, not **Owner** — same logic.
- [ ] GitHub → keep **Write**, not **Admin**, unless you'll be managing
      branch protection or repo settings.
- [ ] Set a calendar reminder to revisit this in 3–6 months — "ongoing
      support" access has a way of quietly becoming permanent otherwise.

## Either way

- [ ] Make sure the client (or their own IT/dev contact) knows where the
      Supabase project and the code repo actually live — the exact project
      ref and repo URL, not just "it's on Supabase somewhere."
- [ ] Point them at `scripts/admin-account.mjs` and `AUTH-SECURITY-AUDIT.md`
      in the repo if they ever need to recover access without you (e.g. they
      lose every owner account at once — extremely unlikely now that invites
      don't depend on you, but worth them knowing the escape hatch exists).
