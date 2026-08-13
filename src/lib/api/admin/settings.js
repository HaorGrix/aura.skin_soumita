/* =================================================================== *
 * skin.theory admin — store settings, staff, audit log
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
  "tax_rate", "currency_code", "currency_symbol",
  "points_per_taka", "points_per_review", "low_stock_threshold",
  "support_email", "support_phone", "socials", "announcement_enabled",
  "announcement_text", "announcement_link_label", "announcement_link_href",
  "announcement_starts_at", "announcement_ends_at",
  "maintenance_mode", "meta_pixel_id", "meta_pixel_enabled",
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
    .select(
      "id, role, full_name, email, is_active, created_at, last_seen_at, " +
      "is_test_account, invited_by, invited_at, invite_accepted_at"
    )
    .order("created_at", { ascending: true });
  return { data, error };
}

/** Invite a new staff member by email. Runs entirely through the
 *  `invite-staff` edge function — this app never generates or sees a
 *  password. The invitee gets Supabase's own email with a link to set
 *  their own. See supabase/functions/invite-staff for the server side. */
export async function inviteStaff(email, role, fullName = "") {
  const { data, error } = await supabase.functions.invoke("invite-staff", {
    body: { email, role, fullName },
  });
  if (error) {
    // FunctionsHttpError bodies carry the real message; the top-level
    // error is a generic "non-2xx status code" otherwise.
    const detail = await error.context?.json?.().catch(() => null);
    return { data: null, error: { message: detail?.error || error.message } };
  }
  if (data?.error) return { data: null, error: { message: data.error } };
  return { data, error: null };
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
