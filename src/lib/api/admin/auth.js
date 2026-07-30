/* =================================================================== *
 * skin.script admin — authentication & role resolution
 * -------------------------------------------------------------------
 * The role shown in the UI comes from `profiles.role`, but it is NOT the
 * security boundary — every table is guarded by RLS policies that read the
 * same role server-side (see supabase/migrations/0002_admin_foundation.sql).
 * Tampering with the client state here changes which buttons render, and
 * nothing else: the database still refuses the write.
 * =================================================================== */
import { supabase } from "../client.js";

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

/** Passwordless fallback — useful for a client who forgets passwords. */
export async function signInWithMagicLink(email) {
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}/admin` },
  });
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
 * Email a password-reset link.
 *
 * `redirectTo` points back at /admin, where <AdminApp> notices the
 * PASSWORD_RECOVERY event and shows the set-a-new-password screen.
 */
export async function sendPasswordReset(email) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/admin`,
  });
  return { data, error };
}

/** Set a new password for the currently signed-in (or recovering) user. */
export async function updatePassword(password) {
  const { data, error } = await supabase.auth.updateUser({ password });
  return { data, error };
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
 * useless — it's the same message whether the account doesn't exist, the
 * password is wrong, or the account has no password set at all (which is
 * the case for a user created by an invite or a magic link).
 */
export function friendlyAuthError(error) {
  const raw = (error?.message || "").toLowerCase();

  if (raw.includes("invalid login credentials")) {
    return "That email and password combination didn't work. If this account was set up with an email link, it may not have a password yet — use “Email me a sign-in link” below, or reset the password.";
  }
  if (raw.includes("email not confirmed")) {
    return "This account's email hasn't been confirmed yet. Use the sign-in link option below.";
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
