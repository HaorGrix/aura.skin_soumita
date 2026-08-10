// =====================================================================
// aura.skin — invite-staff edge function
// ---------------------------------------------------------------------
// This is the ONE place the service_role key is allowed to run outside a
// local script: inside Supabase's own server, never shipped to a browser.
//
// Flow:
//   1. Caller's own access token (forwarded from the browser) is verified
//      against a plain anon-key client — this proves who is calling and
//      that they are an active `owner`. Same is_staff() the DB already
//      trusts; nothing new to audit.
//   2. Only then does a separate service-role client call
//      auth.admin.inviteUserByEmail(), which creates the auth user in
//      "invited" state and sends Supabase's own invite email — a link to
//      set a password, chosen by the invitee, never generated or seen by
//      this app or anyone using it.
//   3. A `profiles` row is upserted with the requested role but
//      `is_active: false` — the invite grants no access until the person
//      actually accepts it and signs in for the first time, at which
//      point the client flips it (see acceptInvite in auth.js).
//
// Deploy:   supabase functions deploy invite-staff
// Secrets:  SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are auto-injected by
//           the platform for every edge function — nothing to set by hand.
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const ROLES = ["support", "editor", "admin", "owner"];
const RANK = Object.fromEntries(ROLES.map((r, i) => [r, i]));

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Missing bearer token" }, 401);

  let body: { email?: string; role?: string; fullName?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const email = (body.email || "").trim().toLowerCase();
  const role = (body.role || "").trim().toLowerCase();
  const fullName = (body.fullName || "").trim() || null;

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Enter a valid email address." }, 400);
  if (!ROLES.includes(role)) return json({ error: `role must be one of: ${ROLES.join(", ")}` }, 400);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Step 1 — who is calling, and are they an owner? Uses the anon client so
  // RLS applies exactly as it would to the browser — no elevated trust yet.
  const callerClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData?.user) return json({ error: "Not signed in." }, 401);

  const { data: callerProfile, error: profileError } = await callerClient
    .from("profiles")
    .select("role, is_active")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError) return json({ error: "Couldn't verify caller role." }, 500);
  if (!callerProfile || callerProfile.is_active === false || RANK[callerProfile.role] < RANK.owner) {
    return json({ error: "Only an active owner can invite staff." }, 403);
  }

  // An owner cannot invite a role above their own — moot today since owner
  // is the top rank, but keeps this correct if roles are ever extended.
  if (RANK[role] > RANK[callerProfile.role]) {
    return json({ error: "You can't invite a role higher than your own." }, 403);
  }

  // Step 2 — the privileged part. Separate client, never exposed to the
  // browser; only this deployed function ever holds it.
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const redirectTo = Deno.env.get("INVITE_REDIRECT_URL") || undefined;

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: fullName ? { full_name: fullName } : undefined,
    redirectTo,
  });

  if (inviteError) {
    // "already registered" is the common real-world case — surface it plainly.
    const msg = inviteError.message?.toLowerCase().includes("already")
      ? "That email already has an account. Ask them to sign in, or change their role from the staff list instead of re-inviting."
      : inviteError.message;
    return json({ error: msg }, 400);
  }

  const invitedUser = invited.user;

  // Step 3 — role is recorded now, but inactive until the invite is accepted.
  const { error: upsertError } = await admin.from("profiles").upsert(
    {
      id: invitedUser.id,
      role,
      email,
      full_name: fullName,
      is_active: false,
      invited_by: userData.user.id,
      invited_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (upsertError) {
    return json({ error: `Invite sent, but saving the role failed: ${upsertError.message}` }, 500);
  }

  return json({ ok: true, userId: invitedUser.id, email });
});
