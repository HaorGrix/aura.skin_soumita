/* =================================================================== *
 * skin.theory admin — shipping methods + zones (0038_shipping_methods.sql)
 * -------------------------------------------------------------------
 * Same shape as catalog.js's Brands/Categories section: list, upsert,
 * delete, reorder — one round trip each, RLS (shipping_*_admin_write)
 * is the real enforcement, this is just the client-side call site.
 *
 * Zones are always edited through their parent method (deleteMethod
 * cascades to its zones via the FK's ON DELETE CASCADE — no separate
 * cleanup needed here).
 * =================================================================== */
import { supabase } from "../client.js";
import { clearShippingCache } from "../shipping.js";

/** Every method with its zones, in display order — the same shape the
 *  admin Shipping screen edits directly. */
export async function listShippingMethods() {
  const { data, error } = await supabase
    .from("shipping_methods")
    .select("id, name, description, is_active, sort_order, shipping_zones(id, method_id, zone_name, price_minor, matching_districts, sort_order)")
    .order("sort_order", { ascending: true });
  if (error) return { data: null, error };

  return {
    data: data.map((m) => ({
      ...m,
      zones: (m.shipping_zones ?? []).slice().sort((a, b) => a.sort_order - b.sort_order),
    })),
    error: null,
  };
}

export async function upsertShippingMethod({ id, name, description, is_active, sort_order }) {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return { data: null, error: { message: "Give the method a name." } };

  const payload = {
    name: trimmed,
    description: (description ?? "").trim() || null,
    is_active: is_active ?? true,
    ...(sort_order != null ? { sort_order } : {}),
    ...(id ? { id } : {}),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("shipping_methods").upsert(payload).select().single();
  clearShippingCache();
  return { data, error };
}

/** Blocked outright by orders.shipping_method_id's FK (ON DELETE SET
 *  NULL, so it never actually blocks) — a method can always be deleted;
 *  past orders keep their own shipping_minor/shipping_address regardless.
 *  Zones cascade automatically. */
export async function deleteShippingMethod(id) {
  const { error } = await supabase.from("shipping_methods").delete().eq("id", id);
  clearShippingCache();
  return { error };
}

/** Persist a reordered method list in one round trip — same shape as
 *  reorderCategories() in catalog.js. */
export async function reorderShippingMethods(ordered) {
  const rows = (ordered ?? []).map((m, i) => ({ id: m.id, name: m.name, sort_order: i }));
  const { data, error } = await supabase.from("shipping_methods").upsert(rows, { onConflict: "id" }).select("id");
  clearShippingCache();
  return { data, error };
}

export async function upsertShippingZone({ id, method_id, zone_name, price_minor, matching_districts, sort_order }) {
  const trimmed = (zone_name ?? "").trim();
  if (!trimmed) return { data: null, error: { message: "Give the zone a name." } };
  if (price_minor == null || price_minor < 0) return { data: null, error: { message: "Enter a valid price." } };

  const payload = {
    method_id,
    zone_name: trimmed,
    price_minor,
    matching_districts: (matching_districts ?? []).map((d) => d.trim()).filter(Boolean),
    ...(sort_order != null ? { sort_order } : {}),
    ...(id ? { id } : {}),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("shipping_zones").upsert(payload).select().single();
  clearShippingCache();
  return { data, error };
}

export async function deleteShippingZone(id) {
  const { error } = await supabase.from("shipping_zones").delete().eq("id", id);
  clearShippingCache();
  return { error };
}

export async function reorderShippingZones(methodId, ordered) {
  const rows = (ordered ?? []).map((z, i) => ({
    id: z.id, method_id: methodId, zone_name: z.zone_name,
    price_minor: z.price_minor, matching_districts: z.matching_districts ?? [], sort_order: i,
  }));
  const { data, error } = await supabase.from("shipping_zones").upsert(rows, { onConflict: "id" }).select("id");
  clearShippingCache();
  return { data, error };
}
