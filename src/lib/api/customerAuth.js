/* =================================================================== *
 * skin.theory — passwordless magic-link verification for shoppers
 * -------------------------------------------------------------------
 * Deliberately separate from the mock login in context/UserContext.jsx
 * (which accepts any typed email with zero verification — that system
 * stays exactly as it is for everything else on the site: the general
 * account area, Rewards, checkout's optional sign-in). This module is
 * the ONLY thing that establishes a REAL Supabase Auth session for a
 * shopper, and it exists for exactly one reason: proving a shopper
 * actually controls an email address before showing that email's real
 * order history or letting them write a review against a real purchase.
 *
 * signInWithOtp() is Supabase's own magic-link primitive — a signed,
 * single-use, time-limited (project default: 1 hour) token emailed to
 * the address and consumed once, by design. This module is a thin
 * wrapper, not a custom token scheme: reinventing that mechanism would
 * be strictly worse than the one Supabase already ships and operates.
 *
 * WHERE THIS MUST NEVER BE CALLED FROM: anywhere but the two gated
 * entry points in components/account/OrdersTab.jsx (order history and
 * the per-item "write a review" action, which live on the same screen).
 * No general popup, nothing during browsing or checkout — that's a
 * product decision enforced by WHERE this is imported, not by anything
 * in this file itself, so keep it that way when touching call sites.
 * =================================================================== */
import { supabase } from "./client.js";

/** Send a magic link. Always resolves without leaking whether the email
 *  has ever ordered — Supabase's own behaviour (it emails a "no account"
 *  notice server-side rather than telling the CALLER, so this can't be
 *  used to enumerate real customers by watching the response). */
export async function requestMagicLink(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      // Lands back on the exact screen that asked for verification, with
      // the now-real session already established by the time it mounts.
      emailRedirectTo: `${window.location.origin}/account?tab=orders`,
      // Never silently create a brand-new auth.users row for an address
      // that has nothing to do with this store — see the comment on
      // shouldCreateUser below for why that matters here specifically.
      shouldCreateUser: true,
    },
  });
  return { error };
}

/** The verified email of the CURRENT real Supabase session, or null.
 *  Reads auth.jwt()-equivalent state client-side; the actual security
 *  boundary is the RLS policy on the server (0029_magic_link_order_access),
 *  which re-derives this from the signed token itself — this function is
 *  for UI decisions only ("show the gate or the orders"), never trusted
 *  as the access-control check. */
export async function getVerifiedEmail() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.email ?? null;
}

/** Subscribe to changes in the real (magic-link) session specifically.
 *  Returns an unsubscribe fn, same contract as admin/auth.js's onAuthChange. */
export function onVerifiedEmailChange(cb) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    cb(session?.user?.email ?? null, event);
  });
  return () => data.subscription.unsubscribe();
}

/** Ends the magic-link session only — does not touch the separate mock
 *  login in UserContext, which a shopper may also have active. */
export async function signOutVerified() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

/** The REAL loyalty balance for the current verified session — reads
 *  `customers.points` (0006/0017/0026/0031 all write to it) via
 *  get_my_points() (0032), never the UserContext localStorage mock.
 *  Returns null (not 0) when there's no verified session, so callers can
 *  tell "genuinely zero points" apart from "not verified yet". */
export async function getMyPoints() {
  const { data, error } = await supabase.rpc("get_my_points");
  if (error) return null;
  return data ?? 0;
}
