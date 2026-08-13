-- ===================================================================
-- skin.theory — admin "Forgot password?" must never email a customer
-- -------------------------------------------------------------------
-- ROOT CAUSE: the admin login's reset flow called
-- supabase.auth.resetPasswordForEmail() directly for whatever email was
-- typed. That call succeeds (and sends a real email) for ANY email that
-- has a Supabase Auth user — which now includes every customer who's
-- ever verified via magic link (0029_magic_link_order_access.sql,
-- signInWithOtp with shouldCreateUser: true auto-provisions a real
-- auth.users row for them). A customer-only account has no row in
-- `profiles`, so it was never meant to receive an admin password-reset
-- email at all.
--
-- This RPC is the check the admin login screen runs BEFORE deciding
-- whether to call resetPasswordForEmail() — it only sends when the
-- typed email genuinely belongs to an active staff member.
--
-- WHY auth.users, NOT profiles.email
-- profiles.email is a convenience column, backfilled inconsistently
-- (confirmed live: some existing staff rows have it null). The
-- authoritative link is profiles.id = auth.users.id, so this joins
-- through that instead of trusting profiles.email to be populated.
--
-- WHY THIS DOESN'T FULLY CLOSE EMAIL ENUMERATION ON ITS OWN
-- The admin UI shows the same generic message regardless of this
-- function's answer (that's the actual enumeration defense — see
-- Login.jsx). This RPC's own response is still a plain boolean over the
-- wire; anyone inspecting raw network traffic (not just reading the UI)
-- could theoretically distinguish staff vs non-staff emails from it.
-- That's a real, known limitation of doing the check as a separate
-- pre-flight call rather than folding it into GoTrue's own reset
-- endpoint (which this app doesn't control the internals of) — flagged
-- here rather than silently claimed as airtight.
--
-- HOW TO APPLY: Supabase Dashboard -> SQL Editor -> paste -> Run.
-- ===================================================================

create or replace function public.is_staff_email(p_email text)
returns boolean
language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1
      from auth.users u
      join public.profiles p on p.id = u.id
     where lower(u.email) = lower(trim(p_email))
       and coalesce(p.is_active, true)
       and p.role is not null
  );
$$;

-- Must be callable BEFORE sign-in — the admin login screen's reset form
-- has no session yet. Returns only true/false, never a row.
grant execute on function public.is_staff_email(text) to anon, authenticated;

-- -------------------------------------------------------------------
-- VERIFY
--   select is_staff_email('<a real owner/admin/editor/support email>');
--   -- expect: true
--
--   select is_staff_email('<a customer-only, magic-link-verified email>');
--   -- expect: false
--
--   select is_staff_email('definitely-not-a-real-account@example.com');
--   -- expect: false
-- -------------------------------------------------------------------
