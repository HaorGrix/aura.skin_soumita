/* =================================================================== *
 * skin.theory — storefront store settings
 * -------------------------------------------------------------------
 * Reads the single `store_settings` row so the shipping thresholds, rates
 * and tax the shopper sees are the ones the client set in /admin/settings,
 * not constants compiled into the bundle.
 *
 * Same contract as the CMS reader: NEVER break the storefront. A missing
 * row, an un-run migration or an offline Supabase falls back to the values
 * that were hardcoded in lib/shop-config.js, so the worst case is "prices
 * behave exactly as they did before" — never a broken cart.
 *
 * Values are returned in the legacy float scale the cart still uses, so
 * call sites swap a constant for a field and nothing else changes. When the
 * cart moves to integer paisa, this converter is the only thing to delete.
 * =================================================================== */
import { useEffect, useState } from "react";
import { fromMinor } from "../format.js";
import {
  FREE_SHIPPING_THRESHOLD, STANDARD_SHIPPING, TAX_RATE,
} from "../shop-config.js";
import { POINTS_PER_REVIEW } from "../../data/reviews.js";

/** Exactly the previous hardcoded behaviour. */
export const DEFAULT_SETTINGS = {
  freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
  standardShipping: STANDARD_SHIPPING,
  taxRate: TAX_RATE,
  pointsPerReview: POINTS_PER_REVIEW,
  storeName: "skin.theory",
  supportEmail: null,
  supportPhone: null,
  maintenanceMode: false,
  announcementEnabled: true,
  announcementText: "Script Your Skin. Reveal Your Confidence.",
  metaPixelId: null,
  metaPixelEnabled: false,
};

let cache = null;
let inflight = null;

function mapRow(row) {
  if (!row) return DEFAULT_SETTINGS;
  return {
    freeShippingThreshold: fromMinor(row.free_shipping_threshold_minor),
    standardShipping: fromMinor(row.standard_shipping_minor),
    taxRate: Number(row.tax_rate) || 0,
    // Falls back to the compiled-in constant if the column is missing
    // (migration 0002 not yet applied) or left blank.
    pointsPerReview: row.points_per_review ?? DEFAULT_SETTINGS.pointsPerReview,
    storeName: row.store_name ?? DEFAULT_SETTINGS.storeName,
    supportEmail: row.support_email ?? null,
    supportPhone: row.support_phone ?? null,
    maintenanceMode: !!row.maintenance_mode,
    // Falls back to the previous hardcoded copy if the column is missing
    // (e.g. migration 0009 not yet applied) or left blank in /admin.
    announcementEnabled: row.announcement_enabled ?? DEFAULT_SETTINGS.announcementEnabled,
    announcementText: row.announcement_text || DEFAULT_SETTINGS.announcementText,
    // Falls back to "not configured" if the column is missing (migration
    // 0035 not yet applied) — never inject a broken/empty pixel script.
    metaPixelId: row.meta_pixel_id || null,
    metaPixelEnabled: !!row.meta_pixel_enabled,
  };
}

/** Fetch once per page view. Never throws; never returns null. */
export async function getStoreSettings() {
  if (cache) return cache;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      // Dynamic import keeps the Supabase SDK out of any eager bundle that
      // only needs the fallback numbers (same reasoning as the CMS reader).
      const { supabase } = await import("./client.js");
      const { data, error } = await supabase
        .from("store_settings")
        .select("*")
        .eq("id", true)
        .maybeSingle();
      cache = error ? DEFAULT_SETTINGS : mapRow(data);
    } catch {
      cache = DEFAULT_SETTINGS;
    } finally {
      inflight = null;
    }
    return cache;
  })();

  return inflight;
}

/**
 * Read store settings in a component.
 *
 * Returns the previous hardcoded values on first render and swaps in the
 * saved ones when the fetch lands — so there's no spinner on the cart and
 * no flash of a wrong shipping price.
 */
export function useStoreSettings() {
  const [settings, setSettings] = useState(() => cache ?? DEFAULT_SETTINGS);

  useEffect(() => {
    let alive = true;
    getStoreSettings().then((s) => { if (alive) setSettings(s); });
    return () => { alive = false; };
  }, []);

  return settings;
}

/** Test seam / post-save invalidation. */
export function clearSettingsCache() {
  cache = null;
  inflight = null;
}
