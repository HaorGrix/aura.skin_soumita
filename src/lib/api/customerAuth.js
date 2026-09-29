/* =================================================================== *
 * skin.theory — shopper accounts (Supabase Auth)
 * -------------------------------------------------------------------
 * Real accounts: sign-up checks that the email is really the shopper's
 * (one confirmation link, once), log-in checks the password, and a
 * forgotten password is reset with a 6-digit code sent by email.
 *
 * Staff use the same auth system but get admin access only through a
 * staff profile (is_staff()), which sign-up never creates.
 *
 * The Supabase SDK is imported on demand so it stays out of the first
 * page load (same reason as lib/api/content.js).
 * =================================================================== */

const client = async () => (await import("./client.js")).supabase;
const redirect = () => `${window.location.origin}/account`;

/** Plain-language messages for the errors shoppers can actually hit. */
function friendly(error) {
  if (!error) return null;
  const m = String(error.message ?? "").toLowerCase();
  if (m.includes("invalid login credentials")) return "Wrong email or password.";
  if (m.includes("email not confirmed")) return "Please confirm your email first — open the link we sent you, then log in.";
  if (m.includes("already registered")) return "An account with this email already exists. Log in, or use Forgot password.";
  if (m.includes("token has expired") || m.includes("otp") || m.includes("invalid token")) return "That code is wrong or has expired. Request a new one.";
  if (m.includes("rate limit") || m.includes("too many") || error.status === 429) return "Too many attempts. Please wait a few minutes and try again.";
  if (m.includes("password") && m.includes("characters")) return "Password needs at least 6 characters.";
  if (m.includes("same as the old") || m.includes("different from the old")) return "Choose a password different from your old one.";
  return "Something went wrong. Please try again.";
}

/** @returns {{ error: string|null, needsConfirmation: boolean }} */
export async function signUpCustomer({ name, email, password }) {
  const supabase = await client();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name }, emailRedirectTo: redirect() },
  });
  if (error) return { error: friendly(error), needsConfirmation: false };
  // An existing, confirmed email comes back as a user with no identities
  // (Supabase hides whether the address is registered).
  if (data.user && (data.user.identities?.length ?? 0) === 0) {
    return { error: friendly({ message: "already registered" }), needsConfirmation: false };
  }
  return { error: null, needsConfirmation: !data.session };
}

/** @returns {{ error: string|null }} */
export async function signInCustomer({ email, password }) {
  const supabase = await client();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error: friendly(error) };
}

/** Emails a 6-digit reset code. Succeeds silently for unknown emails, so
 *  the form can't be used to find out who has an account. */
export async function sendPasswordResetCode(email) {
  const supabase = await client();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirect() });
  return { error: friendly(error) };
}

/** Checks the emailed code, then sets the new password (signed in after). */
export async function resetPasswordWithCode({ email, code, password }) {
  const supabase = await client();
  const { error: verifyError } = await supabase.auth.verifyOtp({ email, token: code, type: "recovery" });
  if (verifyError) return { error: friendly(verifyError) };
  const { error } = await supabase.auth.updateUser({ password });
  return { error: friendly(error) };
}

export async function signOutCustomer() {
  const supabase = await client();
  await supabase.auth.signOut();
}

/** Current session + a subscription to sign-in / sign-out. Returns an
 *  unsubscribe function. */
export async function watchSession(onChange) {
  const supabase = await client();
  const { data } = await supabase.auth.getSession();
  onChange(data.session ?? null);
  const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => onChange(session ?? null));
  return () => sub.subscription.unsubscribe();
}
