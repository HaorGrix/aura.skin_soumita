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
  // While a flash sale is running, the badge/strike-through must show THAT
  // sale's own discount off the product's current price — never compounded
  // against an unrelated pre-existing compare_at_minor markdown. Compounding
  // is what let a 15% flash sale show a "-49%" badge on a product that
  // already had its own separate 40%-ish markdown: mathematically the true
  // total-off-original-list, but wrong for a page whose entire point is
  // "here's what THIS sale does" — every card there must match the sale's
  // own stated percentage, not a stale/different number. Without an active
  // flash sale, the product's own manual compare_at_minor still applies.
  const compareAtMinor = hasFlashSale
    ? row.price_minor
    : row.compare_at_minor != null && row.compare_at_minor > row.price_minor
      ? row.compare_at_minor
      : null;
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
    philosophy: row.philosophy,
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
 * Fetch a specific set of products by slug (== `id` in this file's
 * shape) — for resolving a saved id list (wishlist) into real product
 * cards without pulling the whole catalog. Missing ids (a slug that no
 * longer exists) are just absent from the result, same "callers filter
 * what came back" contract as everywhere else here.
 */
export async function getProductsByIds(slugs) {
  if (!slugs?.length) return { data: [], error: null };
  const { data, error } = await supabase
    .from("products_public")
    .select("*")
    .in("slug", slugs);
  if (error) return { data: null, error };
  return { data: data.map(mapProduct), error: null };
}

/**
 * Map one `product_variants_public` row into the storefront's variant
 * shape. Price fields go through the same LEGACY_PRICE_SCALE bridge as
 * mapProduct(), for the same reason: formatPrice()/cart math still run on
 * the old "USD-ish" float scale, not raw paisa.
 *
 * Flash-sale folding mirrors mapProduct() exactly (see its comment for the
 * full reasoning) — 0052_variant_flash_sale_price.sql added `sale_price_
 * minor`/`active_sale_id` to product_variants_public so a running flash
 * sale is priced into `price`/`compareAt`/`isOnSale` here the same way a
 * manual compare_at_price_minor markdown already was. Before that
 * migration, this was the actual live bug: place_order() applied the sale
 * price server-side, but every variant the PDP/cart/checkout displayed
 * still showed the full undiscounted price right up until the order was
 * placed.
 */
function mapVariant(row) {
  const hasFlashSale = row.sale_price_minor != null && row.sale_price_minor < row.price_minor;
  const effectivePriceMinor = hasFlashSale ? row.sale_price_minor : row.price_minor;
  // Same "never compound a flash sale against a separate manual markdown"
  // rule as mapProduct() — the strike-through must match THIS sale's own
  // stated discount, not a stale/different pre-existing compare-at.
  const compareAtMinor = hasFlashSale
    ? row.price_minor
    : row.compare_at_price_minor != null && row.compare_at_price_minor > row.price_minor
      ? row.compare_at_price_minor
      : null;
  const compareAt = compareAtMinor != null ? compareAtMinor / LEGACY_PRICE_SCALE : undefined;
  const discountPercent = compareAtMinor != null
    ? Math.round((1 - effectivePriceMinor / compareAtMinor) * 100)
    : row.discount_percent;

  return {
    id: row.id,
    productId: row.product_id,
    sizeLabel: row.size_label,
    sortOrder: row.sort_order,
    isDefault: row.is_default,
    price: effectivePriceMinor / LEGACY_PRICE_SCALE,
    compareAt,
    isOnSale: row.is_on_sale || hasFlashSale,
    discountPercent,
    activeSaleId: row.active_sale_id ?? null,
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

/**
 * Live re-check of whether each cart line is still purchasable, called
 * right before checkout submits. A cart line only ever carries what was
 * true at add-time (price, stock) — see CartContext.jsx's header — so it
 * can silently go stale while the bag sits idle.
 *
 * This is a courtesy UX check only, same as CartContext's own maxQtyFor
 * fix: place_order() is what actually enforces stock, under a row lock,
 * server-side. It used to be src/data/products.js's stockFor()/maxQtyFor(),
 * which looked a cart item's id up in the bundled MOCK catalog array —
 * real (Supabase-backed) products almost never share an id with that
 * array, so stockFor() silently returned 0 for nearly every real product,
 * and Checkout.jsx's pre-flight then wrongly stripped it from the bag as
 * "sold out" right before submitting. Live here instead, same pattern as
 * every other real-catalog read in this file.
 *
 * `product_variants_public`/`products_public` deliberately expose only the
 * `in_stock` boolean, never the raw count (see getVariantsForProduct's
 * header) — that's all a pre-flight check needs anyway.
 *
 * Returns the SAME item objects passed in (not copies), filtered to just
 * the ones now out of stock, so callers can removeItem()/toast directly
 * off the result without a second lookup.
 */
export async function findSoldOutItems(items) {
  if (!items?.length) return { data: [], error: null };

  const slugs = [...new Set(items.map((i) => i.id))];
  const variantIds = [...new Set(items.filter((i) => i.variantId).map((i) => i.variantId))];

  const [productsRes, variantsRes] = await Promise.all([
    supabase.from("products_public").select("slug, in_stock").in("slug", slugs),
    variantIds.length
      ? supabase.from("product_variants_public").select("id, in_stock").in("id", variantIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (productsRes.error) return { data: null, error: productsRes.error };
  if (variantsRes.error) return { data: null, error: variantsRes.error };

  const productInStock = new Map(productsRes.data.map((r) => [r.slug, r.in_stock]));
  // A variant id that no longer resolves (deleted/renamed since add-time)
  // reads as sold out too — `!== true` catches both "false" and "missing".
  const variantInStock = new Map((variantsRes.data ?? []).map((r) => [r.id, r.in_stock]));

  const soldOut = items.filter((i) =>
    i.variantId ? variantInStock.get(i.variantId) !== true : productInStock.get(i.id) !== true
  );

  return { data: soldOut, error: null };
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
