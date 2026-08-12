/* =================================================================== *
 * skin.theory — storefront shipping methods
 * -------------------------------------------------------------------
 * Reads the admin-managed shipping_methods/shipping_zones tables
 * (0038_shipping_methods.sql) so Cart/Checkout show exactly what's
 * configured in /admin/shipping, never a hardcoded price. The DB row is
 * what place_order() actually charges — this module only picks which
 * method/zone to SHOW and PRE-SELECT; the server independently re-reads
 * the zone's price_minor, so nothing here needs to be trusted.
 * =================================================================== */
import { useEffect, useState } from "react";
import { supabase } from "./client.js";
import { fromMinor } from "../format.js";

let cache = null;
let inflight = null;

/** Fetch every active method with its zones, ordered for display. Never
 *  throws; an empty array on failure just means checkout shows nothing
 *  to pick — same "worst case, don't break the page" contract as
 *  lib/api/settings.js. */
export async function getShippingMethods() {
  if (cache) return cache;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const { data, error } = await supabase
        .from("shipping_methods")
        .select("id, name, description, sort_order, shipping_zones(id, zone_name, price_minor, matching_districts, sort_order)")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      cache = error || !data
        ? []
        : data
            .map((m) => ({
              id: m.id,
              name: m.name,
              description: m.description,
              // `price` is the legacy pseudo-dollar scale formatPrice()/the cart
              // total already run on (same bridge as settings.js's standardShipping
              // used to be) — `price_minor` is kept alongside for anything that
              // wants the raw BDT paisa figure directly.
              zones: (m.shipping_zones ?? [])
                .map((z) => ({ ...z, price: fromMinor(z.price_minor) }))
                .sort((a, b) => a.sort_order - b.sort_order),
            }))
            .filter((m) => m.zones.length > 0); // a method with no priced zone can't be charged — don't offer it
    } catch {
      cache = [];
    } finally {
      inflight = null;
    }
    return cache;
  })();

  return inflight;
}

export function useShippingMethods() {
  const [methods, setMethods] = useState(() => cache ?? []);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    let alive = true;
    getShippingMethods().then((m) => { if (alive) { setMethods(m); setLoading(false); } });
    return () => { alive = false; };
  }, []);

  return { methods, loading };
}

export function clearShippingCache() {
  cache = null;
  inflight = null;
}

/**
 * Pick the zone a method should charge for a given free-text city/address.
 * A zone with an empty `matching_districts` is the catch-all — it's
 * evaluated last so a specific district always wins when it matches. This
 * is what makes a single-zone method behave exactly like today's flat
 * price: with only one (empty-array) zone, `matched` is always that zone
 * and `ambiguous` is always false.
 *
 * Returns:
 *   { zone, matched: true, ambiguous: false }  — exactly one specific zone matched
 *   { zone: catchAll, matched: true, ambiguous: false } — nothing typed / no specific zones
 *   { zone: null, matched: false, ambiguous: true }     — 0 or 2+ specific zones matched;
 *                                                          caller should show a manual picker
 */
export function resolveShippingZone(method, cityText) {
  const zones = method?.zones ?? [];
  if (zones.length === 0) return { zone: null, matched: false, ambiguous: false };
  if (zones.length === 1) return { zone: zones[0], matched: true, ambiguous: false };

  const specific = zones.filter((z) => (z.matching_districts ?? []).length > 0);
  const catchAll = zones.find((z) => (z.matching_districts ?? []).length === 0) ?? null;

  const needle = (cityText ?? "").trim().toLowerCase();
  if (!needle) {
    return catchAll
      ? { zone: catchAll, matched: true, ambiguous: false }
      : { zone: null, matched: false, ambiguous: true };
  }

  const hits = specific.filter((z) =>
    (z.matching_districts ?? []).some((d) => needle.includes(d.toLowerCase()) || d.toLowerCase().includes(needle))
  );

  if (hits.length === 1) return { zone: hits[0], matched: true, ambiguous: false };
  if (hits.length === 0 && catchAll) return { zone: catchAll, matched: true, ambiguous: false };
  return { zone: null, matched: false, ambiguous: true }; // 0 hits & no catch-all, or 2+ hits
}

/** Cheapest zone on a method — used for pre-address estimates (Cart.jsx),
 *  before there's any city text to resolve a real zone from. */
export function cheapestZone(method) {
  const zones = method?.zones ?? [];
  if (zones.length === 0) return null;
  return zones.reduce((min, z) => (z.price_minor < min.price_minor ? z : min), zones[0]);
}
