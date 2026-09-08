/* =================================================================== *
 * skin.theory — the concerns list
 * -------------------------------------------------------------------
 * ONE source for four consumers:
 *   • the shop's concern filter          (Filters.jsx, Shop.jsx)
 *   • the Shop-by-Concern tile editor's  "Links to concern" dropdown
 *     (ContentEdit.jsx)
 *   • the admin product form's           "Skin concerns" multi-select
 *     (ProductEdit.jsx)
 *   • the Shop-by-Concern tiles          (ShopByConcern.jsx, dev guard)
 *
 * Mirrors lib/api/categories.js's shape on purpose: a module-level cache
 * + useConcerns() hook, and slug-based lookup helpers. Concerns are flat
 * (no hierarchy), so this is the simpler cousin of that file.
 *
 * Every consumer stores a concern's SLUG (stable, never changes) and
 * looks its current NAME up live through this module — so renaming a
 * concern in /admin/concerns updates every display site on next load,
 * with nothing else to keep in sync (see 0059_concerns_table.sql).
 *
 * Same resilience contract as the CMS and category readers: never break
 * the storefront. If the fetch fails, callers get an empty list rather
 * than a thrown error — filters/dropdowns just show nothing extra.
 * =================================================================== */
import { useEffect, useState } from "react";

let cache = null;
let inflight = null;

export async function getConcerns() {
  if (cache) return cache;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const { supabase } = await import("./client.js");
      const { data, error } = await supabase
        .from("concerns")
        .select("id, name, slug, image_path")
        .order("name", { ascending: true });

      cache = error || !data ? [] : data;
    } catch {
      cache = [];
    } finally {
      inflight = null;
    }
    return cache;
  })();

  return inflight;
}

/** Read the list in a component. Renders nothing until it lands. */
export function useConcerns() {
  const [concerns, setConcerns] = useState(() => cache ?? []);

  useEffect(() => {
    let alive = true;
    getConcerns().then((c) => { if (alive) setConcerns(c); });
    return () => { alive = false; };
  }, []);

  return concerns;
}

/** Find a concern by its stable slug. */
export function findConcernBySlug(concerns, slug) {
  if (!slug) return null;
  return (concerns ?? []).find((c) => c.slug === slug) ?? null;
}

/** The current display name for a slug — falls back to the slug itself
 *  so a stale/unknown reference still shows *something* rather than
 *  going blank. */
export function concernNameFor(concerns, slug) {
  return findConcernBySlug(concerns, slug)?.name ?? slug ?? "";
}

/** Test seam / post-save invalidation — called by the admin screen after
 *  a rename so its own next read isn't served the stale cached list. */
export function clearConcernCache() {
  cache = null;
  inflight = null;
}
