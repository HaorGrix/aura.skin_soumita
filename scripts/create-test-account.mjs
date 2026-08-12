#!/usr/bin/env node
/* =================================================================== *
 * skin.theory — create a DISPOSABLE staff account for live e2e testing
 * -------------------------------------------------------------------
 * The one place a throwaway admin/editor account gets created, so it's
 * the one place that can guarantee `is_test_account = true` gets set.
 * Companion to scripts/admin-account.mjs (real, permanent staff) and
 * scripts/cleanup-test-accounts.mjs (deletes everything this creates).
 *
 * Requires 0024_profiles_test_account_flag.sql to be applied first
 * (profiles.is_test_account must exist).
 *
 * Email is always auto-generated as zz-<label>-<role>-<timestamp>@example.org
 * — never accepted as a raw argument — so there is no way to accidentally
 * point this at a real address. That naming convention is now a SECOND,
 * redundant safeguard on top of the is_test_account flag, not the only one.
 *
 * USAGE
 *   node scripts/create-test-account.mjs --label=gallery
 *   node scripts/create-test-account.mjs --label=badge --role=editor
 *
 * FLAGS
 *   --label=…   short, readable tag for what this test is for (default: test)
 *   --role=…    owner | admin | editor | support     (default: admin)
 *
 * Prints the id/email/password plus a ready-to-paste JSON blob — write that
 * to a session-local .{label}-meta.json exactly as before; the difference
 * now is cleanup no longer depends on that file existing or being correct,
 * because scripts/cleanup-test-accounts.mjs deletes by the DB flag instead.
 * =================================================================== */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const ROLES = ["owner", "admin", "editor", "support"];

function loadEnv(file = ".env.local") {
  const out = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}
function die(msg) { console.error(`\n✗ ${msg}\n`); process.exit(1); }

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const label = (flag("label", "test") || "test").toLowerCase().replace(/[^a-z0-9-]/g, "-");
const role = (flag("role", "admin") || "admin").toLowerCase();
if (!ROLES.includes(role)) die(`--role must be one of: ${ROLES.join(", ")}`);

const env = loadEnv();
const url = env.VITE_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url) die("VITE_SUPABASE_URL is missing from .env.local");
if (!serviceKey) die("SUPABASE_SERVICE_ROLE_KEY is missing from .env.local");

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const stamp = Date.now();
const email = `zz-${label}-${role}-${stamp}@example.org`;
const password = "Zz" + Math.random().toString(36).slice(2) + "-" + Math.random().toString(36).slice(2);

const { data: created, error } = await admin.auth.admin.createUser({
  email, password, email_confirm: true,
  user_metadata: { full_name: `ZZ ${label} Test Bot` },
});
if (error) die(`createUser failed: ${error.message}`);

// is_test_account: true is the whole point of this script existing —
// never omitted, never conditional.
const { error: profileError } = await admin.from("profiles").upsert({
  id: created.user.id, role, email,
  full_name: `ZZ ${label} Test Bot`, is_active: true, is_test_account: true,
});
if (profileError) {
  die(
    `Auth user created but profile upsert failed: ${profileError.message}\n` +
    "  If this mentions is_test_account, apply supabase/migrations/0024_profiles_test_account_flag.sql first."
  );
}

const { data: check } = await admin.from("profiles").select("is_test_account").eq("id", created.user.id).single();
if (check?.is_test_account !== true) die("Verification failed: is_test_account did not persist as true.");

console.log("\n" + "─".repeat(58));
console.log("  Disposable test account ready (is_test_account = true)");
console.log("─".repeat(58));
console.log(`  email    ${email}`);
console.log(`  password ${password}`);
console.log(`  role     ${role}`);
console.log(`  staffId  ${created.user.id}`);
console.log("─".repeat(58));
console.log(JSON.stringify({ email, password, staffId: created.user.id, role }, null, 2));
console.log("─".repeat(58) + "\n");

process.exit(0);
