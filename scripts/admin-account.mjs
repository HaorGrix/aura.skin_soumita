#!/usr/bin/env node
/* =================================================================== *
 * aura.skin — create or repair an admin account
 * -------------------------------------------------------------------
 * The correct, secure way to bootstrap staff access. Run locally; it uses
 * the service-role key, which is why it is a Node script and not a button
 * in the panel — creating users or setting passwords requires a key that
 * must never reach a browser.
 *
 * It does three things, idempotently:
 *   1. Creates the Supabase Auth user if it doesn't exist (email pre-confirmed,
 *      so there's no "confirm your email" round trip for a staff account).
 *   2. Sets a password — supplied, or a strong generated one printed once.
 *   3. Upserts the `profiles` row with the requested role, which is what
 *      is_staff() reads and therefore what RLS actually enforces.
 *
 * USAGE
 *   node scripts/admin-account.mjs you@example.com
 *   node scripts/admin-account.mjs you@example.com --password='S0me·Strong·Pass'
 *   node scripts/admin-account.mjs staff@example.com --role=editor --name='Jane'
 *
 * FLAGS
 *   --password=…  set this password (otherwise one is generated and printed)
 *   --role=…      owner | admin | editor | support     (default: owner)
 *   --name=…      display name shown in the panel
 * =================================================================== */
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const ROLES = ["owner", "admin", "editor", "support"];

/* ---- env ---------------------------------------------------------- */
function loadEnv(file = ".env.local") {
  const out = {};
  let raw;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    die(`Can't read ${file}. Copy .env.example to .env.local and fill it in.`);
  }
  for (const line of raw.split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

function die(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

/* ---- args --------------------------------------------------------- */
const args = process.argv.slice(2);
const email = args.find((a) => !a.startsWith("--"));
const flag = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  die("Pass the account's email address.\n  node scripts/admin-account.mjs you@example.com [--password=…] [--role=owner] [--name='Your Name']");
}

const role = (flag("role") || "owner").toLowerCase();
if (!ROLES.includes(role)) die(`--role must be one of: ${ROLES.join(", ")}`);

const fullName = flag("name") || email.split("@")[0];

// 24 bytes of base64url ≈ 192 bits. Generated rather than prompted so a weak
// password never gets typed in out of convenience.
const generated = !flag("password");
const password = flag("password") || randomBytes(24).toString("base64url");
if (!generated && password.length < 10) {
  die("--password should be at least 10 characters.");
}

/* ---- client ------------------------------------------------------- */
const env = loadEnv();
const url = env.VITE_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) die("VITE_SUPABASE_URL is missing from .env.local");
if (!serviceKey) die("SUPABASE_SERVICE_ROLE_KEY is missing from .env.local");
// A real service-role key is a JWT. Catching a placeholder here gives a clear
// message instead of a confusing 401 several calls later.
if (!serviceKey.startsWith("ey") || serviceKey.length < 100) {
  die(
    "SUPABASE_SERVICE_ROLE_KEY doesn't look like a real key (expected a long JWT starting 'ey').\n" +
    "  Dashboard → Settings → API → service_role → reveal and copy."
  );
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/* ---- run ---------------------------------------------------------- */
console.log(`\naura.skin — admin account setup`);
console.log(`  project : ${url}`);
console.log(`  email   : ${email}`);
console.log(`  role    : ${role}\n`);

// 1. Find or create the auth user. listUsers is paged, so page through rather
//    than assuming the account is on page 1 of a growing customer table.
let user = null;
for (let page = 1; page <= 20 && !user; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
  if (error) die(`Couldn't list users: ${error.message}`);
  user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
  if (data.users.length < 200) break;
}

if (user) {
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
  });
  if (error) die(`Couldn't update the account: ${error.message}`);
  console.log("· existing auth user found — password reset, email confirmed");
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // staff shouldn't need to chase a confirmation email
    user_metadata: { full_name: fullName },
  });
  if (error) die(`Couldn't create the account: ${error.message}`);
  user = data.user;
  console.log("· auth user created (email pre-confirmed)");
}

// 2. Upsert the profile. This row — not the JWT — is what is_staff() reads,
//    so it is what actually grants access under RLS.
const { error: profileError } = await admin
  .from("profiles")
  .upsert(
    { id: user.id, role, email, full_name: fullName, is_active: true },
    { onConflict: "id" }
  );

if (profileError) {
  die(
    `Auth user is ready, but writing the profile failed: ${profileError.message}\n` +
    "  If this mentions a missing column, apply supabase/migrations/0002_admin_foundation.sql first."
  );
}
console.log(`· profile upserted with role "${role}"`);

// 3. Verify by reading back through the same path the app uses.
const { data: check, error: checkError } = await admin
  .from("profiles")
  .select("id, role, full_name, is_active")
  .eq("id", user.id)
  .single();

if (checkError || check?.role !== role) {
  die(`Verification failed: ${checkError?.message ?? `role is "${check?.role}", expected "${role}"`}`);
}

console.log("· verified\n");
console.log("─".repeat(58));
console.log("  Sign in at /admin with:");
console.log(`    email    ${email}`);
if (generated) {
  console.log(`    password ${password}`);
  console.log("\n  ⚠  This password is shown once and is not stored anywhere.");
  console.log("     Save it in a password manager now, or change it after signing in.");
} else {
  console.log("    password (the one you passed via --password)");
}
console.log("─".repeat(58) + "\n");

process.exit(0);
