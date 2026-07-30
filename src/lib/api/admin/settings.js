/* =================================================================== *
 * skin.script admin — store settings, staff, audit log
 * -------------------------------------------------------------------
 * `store_settings` is a single row (id = true). It replaces the hardcoded
 * constants in lib/shop-config.js — free shipping threshold, shipping
 * rates, tax, loyalty earn rates — so the client can change commercial
 * terms without a rebuild.
 * =================================================================== */
import { supabase } from "../client.js";

export async function getSettings() {
  const { data, error } = await supabase
    .from("store_settings").select("*").eq("id", true).maybeSingle();
  return { data, error };
}

const SETTINGS_FIELDS = [
  "store_name", "free_shipping_threshold_minor", "standard_shipping_minor",
  "express_shipping_minor", "tax_rate", "currency_code", "currency_symbol",
  "points_per_taka", "points_per_review", "low_stock_threshold",
  "support_email", "support_phone", "socials", "announcement_enabled",
  "maintenance_mode",
];

export async function saveSettings(input) {
  const row = {};
  for (const k of SETTINGS_FIELDS) if (input[k] !== undefined) row[k] = input[k];

  const { data: userData } = await supabase.auth.getUser();
  row.updated_by = userData?.user?.id ?? null;
  row.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("store_settings").update(row).eq("id", true).select().single();
  return { data, error };
}

/* ---------------------------------------------------------------- *
 * Staff — owner only. RLS enforces that; this is the UI's data source.
 * ---------------------------------------------------------------- */

export async function listStaff() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, full_name, email, is_active, created_at, last_seen_at")
    .order("created_at", { ascending: true });
  return { data, error };
}

export async function setStaffRole(userId, role) {
  const { data, error } = await supabase
    .from("profiles").update({ role }).eq("id", userId).select().single();
  return { data, error };
}

/** Revoke access without deleting the row, so the audit trail still resolves
 *  this person's past actions to a name. */
export async function setStaffActive(userId, isActive) {
  const { data, error } = await supabase
    .from("profiles").update({ is_active: isActive }).eq("id", userId).select().single();
  return { data, error };
}

/* ---------------------------------------------------------------- *
 * Audit log — owner-readable, append-only at the database level.
 * ---------------------------------------------------------------- */

export async function listAudit({ table = "", search = "", page = 0, pageSize = 50 } = {}) {
  let q = supabase
    .from("audit_log")
    .select("id, actor_email, action, table_name, record_id, diff, created_at", { count: "exact" });

  if (table) q = q.eq("table_name", table);
  if (search.trim()) q = q.ilike("actor_email", `%${search.trim()}%`);

  const start = page * pageSize;
  q = q.order("created_at", { ascending: false }).range(start, start + pageSize - 1);

  const { data, error, count } = await q;
  return { data, error, count: count ?? 0 };
}
