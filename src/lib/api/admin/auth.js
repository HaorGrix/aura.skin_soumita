/* =================================================================== *
 * skin.theory admin — authentication & role resolution
 * -------------------------------------------------------------------
 * The role shown in the UI comes from `profiles.role`, but it is NOT the
 * security boundary — every table is guarded by RLS policies that read the
 * same role server-side (see supabase/migrations/0002_admin_foundation.sql).
 * Tampering with the client state here changes which buttons render, and
 * nothing else: the database still refuses the write.
 * =================================================================== */
import { supabase } from "../client.js";

/**
 * Where password-reset (and, via Supabase's Site URL, invite) links should
 * land. Deliberately NOT `window.location.origin` — that broke production
 * emails whenever someone triggered "Forgot password?" from a local dev
 * server, since the link then pointed at their own localhost. `VITE_SITE_URL`
 * is set once in the deploy environment (see `.env.example`) and always
 * wins when present; only a genuinely unconfigured environment falls back
 * to the current origin, which is what you want for local-only testing.
 */
const SITE_URL = (import.meta.env.VITE_SITE_URL || window.location.origin).replace(/\/+$/, "");

/** Privilege ordering — mirrors is_staff() in SQL. Index = rank. */
export const ROLES = ["support", "editor", "admin", "owner"];

/** Does `role` meet or exceed `min`? Used for UI affordance only. */
export function hasRole(role, min = "editor") {
  const have = ROLES.indexOf(role);
  const need = ROLES.indexOf(min);
  return have >= 0 && need >= 0 && have >= need;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

/**
 * Resolve the signed-in user's staff profile.
 * Returns `{ data: null }` (not an error) when the user has no profile row —
 * that's a normal customer who typed /admin, not a failure.
 */
export async function getStaffProfile() {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) return { data: null, error: null };

  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, full_name, email, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (error) return { data: null, error };
  if (!data || data.is_active === false) return { data: null, error: null };

  return { data: { ...data, email: data.email ?? user.email }, error: null };
}

/**
 * Check whether the signed-in user has a not-yet-accepted staff invite —
 * a `profiles` row with `invited_by` set, `is_active: false`, and no
 * `invite_accepted_at` yet. Distinct from a revoked account, which also
 * has `is_active: false` but no `invited_by`.
 */
export async function getPendingInvite() {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) return { data: null, error: null };

  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, full_name, email, is_active, invited_by, invite_accepted_at")
    .eq("id", user.id)
    .maybeSingle();

  if (error) return { data: null, error };
  const pending = data && data.invited_by && !data.is_active && !data.invite_accepted_at;
  return { data: pending ? data : null, error: null };
}

/** Accept a pending invite: flips the caller's own profile active. Must be
 *  called after they've set a password, so "accepted" always means the
 *  account is actually usable, not just clicked-through. */
export async function acceptInvite() {
  const { data, error } = await supabase.rpc("accept_staff_invite");
  return { data, error };
}

/**
 * Email a password-reset link — but ONLY if the address genuinely has a
 * staff role (0040_is_staff_email_rpc.sql). Supabase's own
 * resetPasswordForEmail() would happily email ANY real auth user,
 * including a customer who only ever verified via magic link
 * (customerAuth.js's signInWithOtp auto-provisions one) — this is the
 * admin panel, so a customer-only account must never receive an admin
 * password-reset email.
 *
 * Always resolves without an error for a non-staff or non-existent
 * email — the caller (Login.jsx) shows the SAME generic message in
 * every case, staff or not, so this alone doesn't leak who's staff via
 * the UI. (See 0040's header comment for the one channel this doesn't
 * close: raw network inspection of the is_staff_email() response.)
 *
 * `redirectTo` points back at /admin, where <AdminApp> notices the
 * PASSWORD_RECOVERY event and shows the set-a-new-password screen.
 */
export async function sendPasswordReset(email) {
  const { data: isStaff, error: checkError } = await supabase.rpc("is_staff_email", { p_email: email });
  if (checkError) return { data: null, error: checkError };
  if (!isStaff) return { data: null, error: null };

  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${SITE_URL}/admin`,
  });
  return { data, error };
}

/** Set a new password for the currently signed-in (or recovering) user. */
export async function updatePassword(password) {
  const { data, error } = await supabase.auth.updateUser({ password });
  return { data, error };
}

/**
 * Detect a failed auth redirect — an expired or already-used invite /
 * recovery link. Supabase sends these back with `error=...` in the URL
 * hash (implicit flow) rather than establishing a session, so neither
 * PASSWORD_RECOVERY nor a pending-invite check ever fires for them; without
 * this, the user would land on a plain sign-in form with zero explanation.
 * Reads once and strips the params from the URL so a page refresh doesn't
 * keep re-showing a stale error.
 */
export function consumeAuthRedirectError() {
  const hash = window.location.hash?.replace(/^#/, "") ?? "";
  const search = window.location.search?.replace(/^\?/, "") ?? "";
  const params = new URLSearchParams(hash || search);
  const code = params.get("error_code");
  const description = params.get("error_description");
  if (!params.get("error") && !code) return null;

  // Only strip if we actually found an error — never touch a URL that's
  // mid-way through a real (successful) Supabase redirect.
  window.history.replaceState(null, "", window.location.pathname);

  return {
    code,
    message: description
      ? decodeURIComponent(description.replace(/\+/g, " "))
      : "This link is invalid or has expired.",
  };
}

/**
 * Subscribe to auth changes. The callback receives `(session, event)` — the
 * event matters because PASSWORD_RECOVERY arrives with a valid session and
 * must NOT be treated as a normal sign-in, or the user lands on the dashboard
 * without ever setting the new password they came to set.
 */
export function onAuthChange(cb) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => cb(session, event));
  return () => data.subscription.unsubscribe();
}

/**
 * Turn a Supabase auth error into something a store owner can act on.
 * "Invalid login credentials" is technically accurate and practically
 * useless — it's the same message whether the account doesn't exist or the
 * password is simply wrong.
 */
export function friendlyAuthError(error) {
  const raw = (error?.message || "").toLowerCase();

  if (raw.includes("invalid login credentials")) {
    return "That email and password combination didn't work. If you're not sure of the password, use “Forgot your password?” below to reset it.";
  }
  if (raw.includes("email not confirmed")) {
    return "This account's email hasn't been confirmed yet. Ask an owner to check the account, or use “Forgot your password?” to reset it.";
  }
  if (raw.includes("rate limit") || raw.includes("too many")) {
    return "Too many attempts. Wait a minute and try again.";
  }
  if (raw.includes("user not found")) {
    return "No account exists for that email address.";
  }
  if (raw.includes("password should be")) {
    return "That password is too short — use at least 6 characters.";
  }
  if (raw.includes("failed to fetch") || raw.includes("networkerror")) {
    return "Couldn't reach the server. Check your connection and try again.";
  }
  return error?.message || "Something went wrong. Please try again.";
}
