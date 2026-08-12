/* =================================================================== *
 * skin.theory — products & categories data access (Supabase)
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
import { publicImageUrl, publicVideoUrl } from "./media.js";

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
  // Each DB image carries its own admin-entered `alt` — that's the real,
  // per-image label (see ImageManager.jsx), not a positional guess. Kept as
  // {url, label} rather than a plain string so product-details.js can show
  // exactly what the admin typed, instead of reassigning a fixed label by
  // array index.
  const gallery = (row.gallery ?? []).map((g) => ({ url: publicImageUrl(g.path), label: g.alt || null }));

  // A running flash sale (products_public.sale_price_minor, computed live
  // by best_sale_price_minor() — see 0039_flash_sales_storefront.sql) is
  // folded straight into the price the storefront already treats as "the"
  // price, exactly like a manual compare_at_minor markdown does. This is
  // deliberate: ProductCard, the PDP, and CartContext.addItem all read
  // `price`/`compareAt`/`isOnSale` already and need zero changes to pick up
  // a campaign discount — the alternative (a parallel "sale price" field
  // every consumer has to remember to check) is exactly the kind of drift
  // this view already avoids for is_on_sale/discount_percent.
  const hasFlashSale = row.sale_price_minor != null && row.sale_price_minor < row.price_minor;
  const effectivePriceMinor = hasFlashSale ? row.sale_price_minor : row.price_minor;
  // Whichever "before" price is actually higher wins the strike-through —
  // a manual markdown's compare_at_minor if it's still above the flash-sale
  // price, else the pre-flash-sale price itself.
  const compareAtMinor = row.compare_at_minor != null && row.compare_at_minor > effectivePriceMinor
    ? row.compare_at_minor
    : hasFlashSale ? row.price_minor : null;
  const compareAt = compareAtMinor != null ? compareAtMinor / LEGACY_PRICE_SCALE : undefined;
  const discountPercent = compareAtMinor != null
    ? Math.round((1 - effectivePriceMinor / compareAtMinor) * 100)
    : row.discount_percent;

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
    price: effectivePriceMinor / LEGACY_PRICE_SCALE, // see header note 2
    compareAt,
    originalPrice: compareAt ?? null,
    maxPerOrder: row.max_per_order,
    inStock: row.in_stock,
    isLowStock: row.is_low_stock,
    isOnSale: row.is_on_sale || hasFlashSale,
    discountPercent,
    // Which flash-sale campaign (0039_flash_sales_storefront.sql) this
    // product's price came from, if any — powers the homepage "Glow deals"
    // card's "Shop the deal" filter (Shop.jsx's ?sale= param) and nothing
    // else; unrelated to the manual isOnSale/discountPercent markdown.
    activeSaleId: row.active_sale_id ?? null,
    salesCount: row.sales_count,
    rating: row.rating,
    reviews: row.review_count, // legacy field name
    // Decorative badges (barrier/exfoliation/dewy/…) aren't migrated yet.
    // `is_best_seller` already folds in the manual admin override (see
    // 0021_manual_badges.sql + the products_public view update) — the
    // storefront never has to know whether it's real sales or a manual
    // flag, just like `is_new`.
    badge: row.is_best_seller ? { variant: "bestseller", label: "Best Seller" } : undefined,
    isStaffPick: row.is_staff_pick ?? false,
    isLimitedEdition: row.is_limited_edition ?? false,
    videoUrl: row.video_url ? publicVideoUrl(row.video_url) : null,
    image: gallery[0]?.url ?? null,
    gallery, // {url, label}[], one entry per real uploaded image, in order
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

/**
 * Map one `product_variants_public` row into the storefront's variant
 * shape. Price fields go through the same LEGACY_PRICE_SCALE bridge as
 * mapProduct(), for the same reason: formatPrice()/cart math still run on
 * the old "USD-ish" float scale, not raw paisa.
 */
function mapVariant(row) {
  const compareAt = row.compare_at_price_minor != null ? row.compare_at_price_minor / LEGACY_PRICE_SCALE : undefined;
  return {
    id: row.id,
    productId: row.product_id,
    sizeLabel: row.size_label,
    sortOrder: row.sort_order,
    isDefault: row.is_default,
    price: row.price_minor / LEGACY_PRICE_SCALE,
    compareAt,
    isOnSale: row.is_on_sale,
    discountPercent: row.discount_percent,
    inStock: row.in_stock,
    isLowStock: row.is_low_stock,
  };
}

/**
 * Every size option for one product, ordered for display. Public view only
 * — no raw stock_quantity, matching product_variants_public's privacy rule
 * (same reason products_public never exposes an exact stock count either).
 *
 * A product with exactly one size still returns a 1-element array — callers
 * (the PDP) decide whether that's worth showing a picker for, not this.
 */
export async function getVariantsForProduct(productId) {
  const { data, error } = await supabase
    .from("product_variants_public")
    .select("*")
    .eq("product_id", productId)
    .order("sort_order", { ascending: true });

  if (error) return { data: null, error };
  return { data: data.map(mapVariant), error: null };
}

/**
 * Fetch a single product by its URL slug (for the PDP route), together with
 * its full variant list. Two queries rather than one: `products_public`
 * can't safely be modified to embed variants (its definition predates these
 * migrations and isn't tracked — see 0016's header), so this follows the
 * same "small parallel query" pattern already used for categories.
 */
export async function getProductBySlug(slug) {
  const { data, error } = await supabase
    .from("products_public")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) return { data: null, error };
  if (!data) return { data: null, error: null };

  const product = mapProduct(data);

  const { data: variants, error: variantsError } = await getVariantsForProduct(product.dbId);
  // A failed variants fetch shouldn't take down the whole PDP — fall back to
  // a single synthetic entry built from the product's own (mirrored) price,
  // so the page still renders with no picker rather than a blank price.
  product.variants = !variantsError && variants?.length
    ? variants
    : [{
        id: null, productId: product.dbId, sizeLabel: "Standard", sortOrder: 0, isDefault: true,
        price: product.price, compareAt: product.compareAt, isOnSale: product.isOnSale,
        discountPercent: product.discountPercent, inStock: product.inStock, isLowStock: product.isLowStock,
      }];

  return { data: product, error: null };
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
