/* =================================================================== *
 * skin.theory — public order tracking
 * -------------------------------------------------------------------
 * track_order() (0061_track_order_lookup.sql) returns an order's real
 * status only when BOTH the order number and the checkout phone match,
 * and never exposes the address, email or prices. A miss is null.
 * =================================================================== */
import { supabase } from "./client.js";
import { fromMinor } from "../format.js";

/**
 * @param {string} number  order number, e.g. "AUR-000084"
 * @param {string} phone   phone used at checkout, any common BD format
 * @returns {Promise<{ data: object|null, error: Error|null }>}
 */
export async function trackOrder(number, phone) {
  const { data, error } = await supabase.rpc("track_order", {
    p_number: number.trim(),
    p_phone: phone.trim(),
  });
  if (error) return { data: null, error };
  if (!data) return { data: null, error: null };
  return {
    data: {
      number: data.number,
      status: data.status,
      placedAt: data.placed_at,
      cancelledAt: data.cancelled_at,
      courier: data.courier,
      trackingNumber: data.tracking_number,
      total: fromMinor(data.total_minor),
      items: data.items ?? [],
      events: data.events ?? [],
    },
    error: null,
  };
}
