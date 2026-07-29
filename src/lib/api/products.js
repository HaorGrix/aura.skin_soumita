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
 * mapProduct() deliberately outputs the SAME shape the static catalog
 * (data/products.js) already produces — verified field-by-field against
 * ProductCard, QuickViewModal, CartContext.addItem, and queryProducts — so
 * Shop.jsx can swap its data SOURCE without any downstream component
 * changing. Two shape decisions this requires, both intentional:
 *   1. `id` is the legacy slug string (== `legacy_id`/`slug`, identical for
 *      every migrated product), NOT the real UUID. Cart line items, the
 *      still-static PDP lookup (data/product-details.js), wishlist, and
 *      order history all key by this string today — feeding them a UUID
 *      would silently break every one of those until they're migrated too.
 *      The real UUID is still available as `dbId`, for that future work.
 *   2. `price`/`compareAt` are converted BACK from `price_minor` (integer
 *      BDT paisa) into the old "USD-ish" float scale (`price_minor / 12000`
 *      — the exact inverse of the migration's `price * 120 * 100`), because
 *      `formatPrice()`, `PRICE_RANGES`, and every price sort/filter in
 *      queryProducts still operate in that scale. This is a deliberate
 *      bridge, not the long-term shape — once PDP/cart/checkout migrate off
 *      the static catalog, this conversion (and formatPrice's ×120) should
 *      be retired in favour of `formatPriceMinor()` throughout.
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

// The old CONVERSION_RATE(120) × 100 minor-unit factor, inverted here to
// bridge back into the scale formatPrice()/PRICE_RANGES/cart math expect.
// See the file header for why this bridge exists.
const LEGACY_PRICE_SCALE = 120 * 100;

/** Map one `products_public` row (snake_case, DB-shaped) into the exact
 *  object shape the storefront already expects from a "product" (see file
 *  header — this is a deliberate compatibility bridge, not the DB's native
 *  shape). Every field here was verified against an actual consumer. */
function mapProduct(row) {
  const gallery = (row.gallery ?? []).map((g) => publicImageUrl(g.path));
  const compareAt = row.compare_at_minor != null ? row.compare_at_minor / LEGACY_PRICE_SCALE : undefined;

  return {
    id: row.slug, // legacy string id — see header note 1
    dbId: row.id, // real UUID, for future FK-based (cart/order) work
    slug: row.slug,
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
    price: row.price_minor / LEGACY_PRICE_SCALE, // see header note 2
    compareAt,
    originalPrice: compareAt ?? null,
    maxPerOrder: row.max_per_order,
    inStock: row.in_stock,
    isLowStock: row.is_low_stock,
    isOnSale: row.is_on_sale,
    discountPercent: row.discount_percent,
    salesCount: row.sales_count,
    rating: row.rating,
    reviews: row.review_count, // legacy field name
    // Decorative badges (barrier/exfoliation/dewy/…) aren't migrated yet —
    // only the one badge fully derivable from DB data today.
    badge: row.is_best_seller ? { variant: "bestseller", label: "Best Seller" } : undefined,
    image: gallery[0] ?? null,
    gallery, // plain URL strings, matching the static catalog's shape
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
