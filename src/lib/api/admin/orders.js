/* =================================================================== *
 * skin.script admin — orders & customers
 * -------------------------------------------------------------------
 * Status changes go through the set_order_status() RPC, never a direct
 * UPDATE. The RPC validates the transition, appends an order_events row,
 * and — on cancel/refund — restocks every line item back into the
 * inventory ledger. Doing that from the client would leave stock wrong
 * whenever a request failed halfway.
 * =================================================================== */
import { supabase } from "../client.js";

export const ORDER_STATUSES = [
  { id: "pending",    label: "Pending",    tone: "amber" },
  { id: "processing", label: "Processing", tone: "sky" },
  { id: "shipped",    label: "Shipped",    tone: "violet" },
  { id: "delivered",  label: "Delivered",  tone: "green" },
  { id: "cancelled",  label: "Cancelled",  tone: "grey" },
  { id: "refunded",   label: "Refunded",   tone: "red" },
];

export function statusMeta(id) {
  return ORDER_STATUSES.find((s) => s.id === id) ?? ORDER_STATUSES[0];
}

/**
 * Which statuses can this order move to next? Mirrors the RPC's guards, so
 * the UI never offers a transition the database will reject.
 *
 * `cancelled` is terminal here, which it previously wasn't. Cancelling runs
 * the auto-restock (every line item goes back into inventory), but there is
 * no inverse — re-activating a cancelled order does NOT re-deduct those
 * units. So cancel → processing silently inflated stock by the whole order
 * every time it was used. Reinstating a cancelled order is rare; getting
 * inventory quietly wrong is not an acceptable price for it. The correct
 * action is to place a new order, which deducts stock properly.
 */
export function nextStatuses(current) {
  if (current === "delivered" || current === "refunded" || current === "cancelled") return [];
  return ORDER_STATUSES.map((s) => s.id).filter((s) => s !== current);
}

export async function listOrders({
  search = "", status = "", from = "", to = "",
  page = 0, pageSize = 25,
} = {}) {
  let q = supabase
    .from("orders")
    .select(
      "id, number, email, status, payment_method, payment_status, total_minor, placed_at, tracking_number",
      { count: "exact" }
    );

  if (search.trim()) {
    const term = `%${search.trim()}%`;
    q = q.or(`number.ilike.${term},email.ilike.${term},tracking_number.ilike.${term}`);
  }
  if (status) q = q.eq("status", status);
  if (from) q = q.gte("placed_at", from);
  if (to) q = q.lte("placed_at", `${to}T23:59:59`);

  const start = page * pageSize;
  q = q.order("placed_at", { ascending: false }).range(start, start + pageSize - 1);

  const { data, error, count } = await q;
  return { data, error, count: count ?? 0 };
}

/** Full order for the detail screen: lines, customer, and status timeline. */
export async function getOrder(id) {
  const { data, error } = await supabase
    .from("orders")
    .select(`
      *,
      order_items (id, product_id, product_name, product_slug, brand_name,
                   image_path, unit_price_minor, quantity, line_total_minor),
      order_events (id, from_status, to_status, note, created_at),
      customers (id, email, full_name, phone, points)
    `)
    .eq("id", id)
    .maybeSingle();

  if (error) return { data: null, error };
  if (data?.order_events) {
    data.order_events.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }
  return { data, error: null };
}

export async function setStatus(orderId, status, note = null) {
  const { data, error } = await supabase.rpc("set_order_status", {
    p_order_id: orderId, p_status: status, p_note: note,
  });
  return { data, error };
}

/** Courier + tracking number. Plain column write — no stock side effects. */
export async function setTracking(orderId, { courier, tracking_number }) {
  const { data, error } = await supabase
    .from("orders")
    .update({ courier, tracking_number })
    .eq("id", orderId)
    .select()
    .single();
  return { data, error };
}

export async function setInternalNote(orderId, notes) {
  const { data, error } = await supabase
    .from("orders").update({ notes }).eq("id", orderId).select().single();
  return { data, error };
}

export async function listCustomers({ search = "", page = 0, pageSize = 25 } = {}) {
  let q = supabase
    .from("customers")
    .select("id, email, full_name, phone, points, created_at", { count: "exact" });

  if (search.trim()) {
    const term = `%${search.trim()}%`;
    q = q.or(`email.ilike.${term},full_name.ilike.${term},phone.ilike.${term}`);
  }

  const start = page * pageSize;
  q = q.order("created_at", { ascending: false }).range(start, start + pageSize - 1);

  const { data, error, count } = await q;
  return { data, error, count: count ?? 0 };
}

export async function getCustomerOrders(customerId) {
  const { data, error } = await supabase
    .from("orders")
    .select("id, number, status, total_minor, placed_at")
    .eq("customer_id", customerId)
    .order("placed_at", { ascending: false });
  return { data, error };
}

/** Dashboard counters — one RPC round trip instead of six queries. */
export async function getStats() {
  const { data, error } = await supabase.rpc("admin_stats");
  return { data, error };
}

/** Recent orders for the dashboard queue. */
export async function recentOrders(limit = 8) {
  const { data, error } = await supabase
    .from("orders")
    .select("id, number, email, status, total_minor, placed_at")
    .order("placed_at", { ascending: false })
    .limit(limit);
  return { data, error };
}
