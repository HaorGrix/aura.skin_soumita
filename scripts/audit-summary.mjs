#!/usr/bin/env node
/* =================================================================== *
 * skin.theory — audit log summary, for a pre-handover review
 * -------------------------------------------------------------------
 * The audit log itself is append-only and already browsable inside the
 * admin panel (Staff & roles → Audit log). This script exists for the
 * bird's-eye view that screen doesn't give you: totals by actor, by
 * table, by action, and the full date range covered — read entirely
 * from the ground up, with no summary/count function to trust blindly.
 *
 * Read-only. Prints to stdout; changes nothing.
 *
 * USAGE
 *   node scripts/audit-summary.mjs
 * =================================================================== */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv(file = ".env.local") {
  const out = {};
  let raw;
  try { raw = readFileSync(file, "utf8"); }
  catch { die(`Can't read ${file}. Copy .env.example to .env.local and fill it in.`); }
  for (const line of raw.split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}
function die(msg) { console.error(`\n✗ ${msg}\n`); process.exit(1); }

const env = loadEnv();
const url = env.VITE_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url) die("VITE_SUPABASE_URL is missing from .env.local");
if (!serviceKey) die("SUPABASE_SERVICE_ROLE_KEY is missing from .env.local");

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

// Paged fetch — audit_log has no row cap in this script; a handover review
// wants the whole project's history, not a sampled slice.
let rows = [];
for (let page = 0; ; page++) {
  const { data, error } = await admin
    .from("audit_log")
    .select("actor_email, action, table_name, created_at")
    .order("created_at", { ascending: true })
    .range(page * 1000, page * 1000 + 999);
  if (error) die(`Couldn't query audit_log: ${error.message}`);
  rows = rows.concat(data);
  if (data.length < 1000) break;
}

if (!rows.length) {
  console.log("\nAudit log is empty — no admin actions recorded yet.\n");
  process.exit(0);
}

const byActor = tally(rows, (r) => r.actor_email || "system");
const byTable = tally(rows, (r) => r.table_name);
const byAction = tally(rows, (r) => r.action);

console.log(`\naura.skin — audit log summary`);
console.log(`  total entries : ${rows.length}`);
console.log(`  date range    : ${new Date(rows[0].created_at).toLocaleString()} → ${new Date(rows[rows.length - 1].created_at).toLocaleString()}\n`);

printTally("By who", byActor);
printTally("By action", byAction);
printTally("By table", byTable);

console.log("For the full row-by-row history with before/after values, use the Audit log screen in /admin/audit.\n");

function tally(list, keyFn) {
  const counts = new Map();
  for (const r of list) counts.set(keyFn(r), (counts.get(keyFn(r)) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function printTally(title, entries) {
  console.log(`${title}:`);
  for (const [key, count] of entries) console.log(`  ${String(count).padStart(5)}  ${key}`);
  console.log("");
}
