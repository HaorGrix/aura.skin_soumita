/* =================================================================== *
 * skin.theory — storefront flash sales (live, not bundled)
 * -------------------------------------------------------------------
 * Campaign metadata for the homepage "Glow deals" grid, via
 * list_active_sales() (0039_flash_sales_storefront.sql) — the same
 * is_active + date-window filter that gates best_sale_price_minor(), so a
 * card can never show here while its discount isn't actually being
 * applied on the products it covers.
 * =================================================================== */
import { supabase } from "./client.js";
import { publicImageUrl } from "./media.js";

export async function listActiveSales() {
  const { data, error } = await supabase.rpc("list_active_sales");
  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    valuePercent: row.value_percent,
    valueMinor: row.value_minor,
    scope: row.scope,
    bannerText: row.banner_text,
    badgeLabel: row.badge_label,
    imageUrl: row.image_path ? publicImageUrl(row.image_path) : null,
    showCountdown: row.show_countdown,
    priority: row.priority,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
  }));
}
