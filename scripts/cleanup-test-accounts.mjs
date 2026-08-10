#!/usr/bin/env node
/* =================================================================== *
 * skin.script — delete every disposable staff account, by DB flag
 * -------------------------------------------------------------------
 * Filters on profiles.is_test_account = true (0024_profiles_test_account_flag.sql)
 * — an explicit column, not the zz-*@example.org naming convention. The
 * naming convention still holds (scripts/create-test-account.mjs enforces
 * it too), but this script no longer TRUSTS it: a row only gets deleted
 * here because the flag says so, checked directly against the database.
 *
 * Scope, deliberately narrow: this deletes AUTH USERS + PROFILE ROWS only.
 * It does NOT touch products, testimonials, images, or anything else a
 * test session created — those are scoped and cleaned up by that session's
 * own throwaway script (which knows exactly what ids it made), same as
 * every live-test in this project's history. Running this after forgetting
 * that step would leave orphaned test data with no matching staff account,
 * which is a much easier state to notice and clean up than the reverse
 * (an orphaned auth account with no idea what it touched).
 *
 * Dry-run by default — lists what WOULD be deleted and exits. Add
 * --confirm to actually delete.
 *
 * USAGE
 *   node scripts/cleanup-test-accounts.mjs             (dry run)
 *   node scripts/cleanup-test-accounts.mjs --confirm    (actually deletes)
 * =================================================================== */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv(file = ".env.local") {
  const out = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}
function die(msg) { console.error(`\n✗ ${msg}\n`); process.exit(1); }

const confirm = process.argv.includes("--confirm");

const env = loadEnv();
const url = env.VITE_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url) die("VITE_SUPABASE_URL is missing from .env.local");
if (!serviceKey) die("SUPABASE_SERVICE_ROLE_KEY is missing from .env.local");

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: rows, error } = await admin
  .from("profiles")
  .select("id, email, role, created_at")
  .eq("is_test_account", true)
  .order("created_at", { ascending: true });

if (error) {
  die(
    `Couldn't query profiles: ${error.message}\n` +
    "  If this mentions is_test_account, apply supabase/migrations/0024_profiles_test_account_flag.sql first."
  );
}

if (!rows.length) {
  console.log("\nNo accounts flagged is_test_account = true. Nothing to do.\n");
  process.exit(0);
}

console.log(`\n${confirm ? "Deleting" : "Would delete"} ${rows.length} test account(s):\n`);
for (const r of rows) console.log(`  · ${r.email}  (role: ${r.role}, created: ${r.created_at})`);

if (!confirm) {
  console.log("\nDry run only — nothing deleted. Re-run with --confirm to actually delete.\n");
  process.exit(0);
}

let ok = 0, failed = 0;
for (const r of rows) {
  const { error: profileErr } = await admin.from("profiles").delete().eq("id", r.id);
  if (profileErr) {
    console.log(`  ✗ ${r.email} — profile delete failed: ${profileErr.message}`);
    failed++;
    continue;
  }
  const { error: authErr } = await admin.auth.admin.deleteUser(r.id);
  if (authErr) {
    console.log(`  ✗ ${r.email} — profile deleted, but auth user delete failed: ${authErr.message}`);
    failed++;
    continue;
  }
  console.log(`  ✓ ${r.email} — deleted`);
  ok++;
}

console.log(`\nDone — ${ok} deleted, ${failed} failed.\n`);
process.exit(failed > 0 ? 1 : 0);
