/* =================================================================== *
 * skin.theory — the category tree
 * -------------------------------------------------------------------
 * ONE source for three consumers:
 *   • the navbar mega menu        (columns = top level, links = children)
 *   • the shop's category filter  (a parent expands to its children)
 *   • the admin product form      (grouped <optgroup> select)
 *
 * All of them read this module, so adding or re-nesting a category in
 * /admin/categories changes the menu, the filters and the product form at
 * once — which is the point of a "unified" category system.
 *
 * Same resilience contract as the CMS and settings readers: never break the
 * storefront. If the fetch fails the menu simply renders nothing extra and
 * the plain "Shop" link keeps working.
 * =================================================================== */
import { useEffect, useState } from "react";

let cache = null;
let inflight = null;

/**
 * Fetch all active categories and assemble them into `[{...parent, children}]`.
 *
 * Built from a single flat query rather than a recursive one: the taxonomy is
 * a few dozen rows and exactly two levels deep, so one round trip plus an
 * in-memory group is cheaper and simpler than a recursive CTE or N queries.
 */
export async function getCategoryTree() {
  if (cache) return cache;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const { supabase } = await import("./client.js");
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, slug, parent_id, sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (error || !data) { cache = []; return cache; }

      const byId = new Map(data.map((c) => [c.id, { ...c, children: [] }]));
      const roots = [];

      for (const cat of byId.values()) {
        // A child whose parent is inactive (and therefore absent) would
        // otherwise vanish entirely; promote it to top level so its products
        // stay reachable rather than silently disappearing from the menu.
        const parent = cat.parent_id ? byId.get(cat.parent_id) : null;
        if (parent) parent.children.push(cat);
        else roots.push(cat);
      }

      const bySort = (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0);
      roots.sort(bySort);
      roots.forEach((r) => r.children.sort(bySort));

      cache = roots;
    } catch {
      cache = [];
    } finally {
      inflight = null;
    }
    return cache;
  })();

  return inflight;
}

/** Read the tree in a component. Renders nothing until it lands. */
export function useCategoryTree() {
  const [tree, setTree] = useState(() => cache ?? []);

  useEffect(() => {
    let alive = true;
    getCategoryTree().then((t) => { if (alive) setTree(t); });
    return () => { alive = false; };
  }, []);

  return tree;
}

/* ---------------------------------------------------------------- *
 * Helpers shared by the menu, the shop and the admin form
 * ---------------------------------------------------------------- */

/** Flatten to `[{ id, name, slug, parentName|null, depth }]` — for selects. */
export function flattenTree(tree) {
  const out = [];
  for (const root of tree ?? []) {
    out.push({ ...root, parentName: null, depth: 0 });
    for (const child of root.children ?? []) {
      out.push({ ...child, parentName: root.name, depth: 1 });
    }
  }
  return out;
}

/** Find a node by slug, anywhere in the tree. */
export function findBySlug(tree, slug) {
  if (!slug) return null;
  for (const root of tree ?? []) {
    if (root.slug === slug) return root;
    for (const child of root.children ?? []) if (child.slug === slug) return child;
  }
  return null;
}

/**
 * Every category NAME a filter selection should match.
 *
 * Products carry a single category (their leaf), so selecting a parent like
 * "Skin Care" must expand to its children's names or it would match nothing —
 * no product is literally categorised "Skin Care". A leaf returns just itself.
 * A parent that also holds products directly (Eye Care) returns itself AND
 * its children.
 */
export function categoryNamesFor(tree, slug) {
  const node = findBySlug(tree, slug);
  if (!node) return [];
  const names = [node.name];
  for (const child of node.children ?? []) names.push(child.name);
  return names;
}

/**
 * Every category SLUG a selection covers — the node itself plus its children.
 *
 * Slugs, not names, are what the shop filters on. After the hierarchy landed,
 * names repeat across columns (Skin Care ▸ Serum and K-Beauty ▸ Serum), so
 * matching a product by its category name puts it in the wrong column.
 * Slugs are globally unique, so they identify exactly one category.
 */
export function categorySlugsFor(tree, slug) {
  const node = findBySlug(tree, slug);
  if (!node) return [];
  return [node.slug, ...(node.children ?? []).map((c) => c.slug)];
}

let mapCache = null;
let mapInflight = null;

/**
 * product → category-slug lookup, keyed by BOTH the UUID and the legacy id,
 * because the storefront still keys carts and URLs by the legacy slug while
 * the database keys everything by UUID.
 *
 * Returns an empty Map on any failure, which degrades to "no category
 * filtering" rather than an empty shop.
 */
export async function getProductCategoryMap() {
  if (mapCache) return mapCache;
  if (mapInflight) return mapInflight;

  mapInflight = (async () => {
    try {
      const { supabase } = await import("./client.js");
      const { data, error } = await supabase
        .from("product_category_map")
        .select("product_id, legacy_id, category_slug");

      const map = new Map();
      if (!error && data) {
        for (const row of data) {
          if (row.product_id) map.set(row.product_id, row.category_slug);
          if (row.legacy_id) map.set(row.legacy_id, row.category_slug);
        }
      }
      mapCache = map;
    } catch {
      mapCache = new Map();
    } finally {
      mapInflight = null;
    }
    return mapCache;
  })();

  return mapInflight;
}

export function useProductCategoryMap() {
  const [map, setMap] = useState(() => mapCache ?? new Map());
  useEffect(() => {
    let alive = true;
    getProductCategoryMap().then((m) => { if (alive) setMap(m); });
    return () => { alive = false; };
  }, []);
  return map;
}

/** Test seam / post-save invalidation. */
export function clearCategoryCache() {
  cache = null;
  inflight = null;
  mapCache = null;
  mapInflight = null;
}
