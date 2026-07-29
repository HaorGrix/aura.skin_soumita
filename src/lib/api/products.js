/* =================================================================== *
 * aura.skin — products & categories data access (Supabase)
 * -------------------------------------------------------------------
 * Reads from `products_public` — the view that already computes inStock,
 * isLowStock, isOnSale, discountPercent, isBestSeller (see the DB migration,
 * Part 4). This file's ONLY job is: fetch + shape rows into camelCase
 * objects. No business logic is re-derived here — that would risk drifting
 * from the view, which is the single source of truth.
 *
 * Every function returns `{ data, error }` and never throws, so callers can
 * lean on the existing <ErrorBoundary>/<Toast> to surface failures instead
 * of wrapping every call site in try/catch.
 *
 * NOT WIRED INTO THE STOREFRONT YET. `data/products.js` (the static catalog)
 * is still what every page renders from. This file is the first piece of the
 * eventual swap — see ADMIN-PANEL-PLAN.md §3.1/§3.3 for the cutover plan.
 * Two shape differences to know about before wiring it in:
 *   1. `id` is now a real UUID (was the human-readable slug). Routing must
 *      switch from `product.id` to `product.slug` for URLs at cutover time.
 *   2. Price is `priceMinor`/`compareAtMinor` (integer BDT paisa) — display
 *      with `formatPriceMinor()` from lib/format.js, NOT the existing
 *      `formatPrice()` (which still multiplies by the old CONVERSION_RATE
 *      for the static catalog's placeholder USD-ish numbers).
 * =================================================================== */
import { supabase } from "./client.js";
import { publicImageUrl } from "./media.js";

// Mirrors the TONE map in data/products.js — the DB stores the short key
// ('pink', 'sage', …); the frontend wants the resolved hex for gradients.
const TONE = {
  pink: "#ffeef4",
  rose: "#ffd9e4",
  cyan: "#d6f5ec",
  sky: "#dbeffb",
  gold: "#f6eccf",
  peach: "#ffe6d6",
  lilac: "#ece4fb",
  sage: "#e3efe0",
};

/** Map one `products_public` row (snake_case, DB-shaped) into the camelCase
 *  object shape the rest of the app expects from a "product". */
function mapProduct(row) {
  const gallery = (row.gallery ?? []).map((g) => ({
    url: publicImageUrl(g.path),
    alt: g.alt || row.name,
  }));

  return {
    id: row.id, // real UUID — needed for cart/order product_id FKs later
    slug: row.slug, // URL-facing id; routing switches to this at cutover
    brand: row.brand,
    name: row.name,
    subtitle: row.subtitle,
    description: row.description,
    howToUse: row.how_to_use,
    category: row.category, // already the category NAME (view joins it)
    tone: TONE[row.tone] ?? TONE.pink,
    concern: row.concern ?? [],
    skinType: row.skin_type ?? [],
    ingredients: row.ingredients ?? [],
    isNew: row.is_new,
    popularity: row.popularity,
    priceMinor: row.price_minor,
    compareAtMinor: row.compare_at_minor,
    maxPerOrder: row.max_per_order,
    inStock: row.in_stock,
    isLowStock: row.is_low_stock,
    isOnSale: row.is_on_sale,
    discountPercent: row.discount_percent,
    salesCount: row.sales_count,
    isBestSeller: row.is_best_seller,
    image: gallery[0]?.url ?? null,
    gallery,
  };
}

/**
 * Fetch every active product (the whole catalog is a few hundred rows at
 * most, so — like the current static array — the client keeps doing its own
 * search/filter/sort over one in-memory list; no server-side pagination
 * needed yet). Pass `limit` for a capped/admin-style fetch later.
 */
export async function listProducts({ limit } = {}) {
  let query = supabase
    .from("products_public")
    .select("*")
    .order("popularity", { ascending: false });

  if (limit) query = query.limit(limit);

  const { data, error } = await query;
  if (error) return { data: null, error };
  return { data: data.map(mapProduct), error: null };
}

/** Fetch a single product by its URL slug (for the PDP route). */
export async function getProductBySlug(slug) {
  const { data, error } = await supabase
    .from("products_public")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) return { data: null, error };
  return { data: data ? mapProduct(data) : null, error: null };
}

/** Fetch active categories, sorted for display (facet lists, nav, etc). */
export async function listCategories() {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  return { data, error };
}
