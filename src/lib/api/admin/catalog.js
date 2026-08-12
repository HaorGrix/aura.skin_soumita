/* =================================================================== *
 * skin.theory admin — catalog CRUD (products, categories, images)
 * -------------------------------------------------------------------
 * Reads go against the BASE `products` table here, not `products_public`:
 * the admin needs drafts, archived rows, stock depth and cost price, all
 * of which the public view deliberately hides.
 *
 * The admin never writes a derived field. `is_on_sale`, `discount_percent`,
 * `in_stock`, `is_low_stock` and `is_best_seller` are computed by the
 * products_public view from the base facts written here — that's what keeps
 * the storefront and the admin from ever disagreeing. `is_best_seller_manual`
 * IS a base fact (0021_manual_badges.sql): the view OR's it into
 * `is_best_seller`, so checking it can only ever ADD the badge, never hide
 * one a product earned by actually selling well.
 *
 * Stock is the one exception to plain CRUD: it moves only through the
 * adjust_stock() RPC, which writes the ledger and the balance together.
 * =================================================================== */
import { supabase } from "../client.js";

const LIST_COLUMNS =
  "id, slug, name, brand, category_id, price_minor, compare_at_minor, stock, low_stock_at, status, is_new, popularity, sales_count, rating, review_count, updated_at";

/** Turn a product name into a URL slug — same rules as data/products.js. */
export function slugify(s = "") {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Paged, filtered product list for the admin table.
 * Server-side pagination from day one — the client catalog is a few hundred
 * rows today, but an admin grid is the one screen that must not degrade when
 * it becomes a few thousand.
 */
export async function listProducts({
  search = "",
  status = "",
  categoryId = "",
  stockFilter = "",
  sort = "updated_at",
  ascending = false,
  page = 0,
  pageSize = 25,
} = {}) {
  let q = supabase.from("products").select(LIST_COLUMNS, { count: "exact" });

  if (search.trim()) {
    const term = `%${search.trim()}%`;
    q = q.or(`name.ilike.${term},brand.ilike.${term},sku.ilike.${term},slug.ilike.${term}`);
  }
  // No status filter picked -> Active + Draft, NOT literally every status.
  // Archived is deliberately excluded from the default view so retired
  // products (old collections, discontinued lines) don't clutter the list
  // an admin sees day to day. `status: "all"` is the explicit escape hatch
  // when someone actually wants to see archived rows mixed in with the rest.
  if (status === "all") {
    // no filter — every status, archived included
  } else if (status) {
    q = q.eq("status", status);
  } else {
    q = q.neq("status", "archived");
  }
  if (categoryId) q = q.eq("category_id", categoryId);
  if (stockFilter === "out") q = q.eq("stock", 0);
  if (stockFilter === "low") q = q.gt("stock", 0).lte("stock", 5);

  const from = page * pageSize;
  q = q.order(sort, { ascending }).range(from, from + pageSize - 1);

  const { data, error, count } = await q;
  return { data, error, count: count ?? 0 };
}

/**
 * The Products list, expanded so a multi-variant product shows one row per
 * size instead of one ambiguous row — same idea as listInventoryRows, same
 * source table, but scoped to whatever page of PRODUCTS listProducts()
 * already fetched (pagination stays product-count-based, not row-count-
 * based, so page size doesn't balloon just because a few products happen to
 * have five sizes each).
 *
 * A single-variant product (the common case) contributes exactly one row,
 * shaped identically to what listProducts() alone would have produced —
 * this is purely additive for multi-variant products, never a behavior
 * change for anything else. Each row carries a `kind`:
 *   "single"       — one row, one product, exactly today's shape
 *   "variant-lead"  — first size of a multi-variant product; carries the
 *                     product's own id so bulk select/actions still target
 *                     the PRODUCT, not any one size
 *   "variant"       — every other size; not bulk-selectable (no checkbox),
 *                     its own unique row id (the variant id) for React/
 *                     DataTable identity only
 */
export async function listProductsWithVariants(opts) {
  const { data: products, error, count } = await listProducts(opts);
  if (error) return { data: null, error, count: 0 };
  if (!products.length) return { data: [], error: null, count };

  const { data: variants, error: vErr } = await supabase
    .from("product_variants")
    .select("id, product_id, size_label, price_minor, compare_at_price_minor, stock_quantity, is_default, sort_order")
    .in("product_id", products.map((p) => p.id))
    .order("sort_order", { ascending: true });
  if (vErr) return { data: null, error: vErr, count: 0 };

  const byProduct = new Map();
  for (const v of variants) {
    if (!byProduct.has(v.product_id)) byProduct.set(v.product_id, []);
    byProduct.get(v.product_id).push(v);
  }

  const rows = [];
  for (const p of products) {
    const vs = byProduct.get(p.id) ?? [];
    if (vs.length <= 1) {
      rows.push({ ...p, kind: "single", rowId: p.id, variantId: vs[0]?.id ?? null });
      continue;
    }
    vs.forEach((v, i) => {
      rows.push({
        ...p,
        kind: i === 0 ? "variant-lead" : "variant",
        rowId: i === 0 ? p.id : v.id,
        variantId: v.id,
        sizeLabel: v.size_label,
        price_minor: v.price_minor,
        compare_at_minor: v.compare_at_price_minor,
        variantStock: v.stock_quantity,
        variantCount: vs.length,
      });
    });
  }

  return { data: rows, error: null, count };
}

/** Full product row + its images, for the editor. */
export async function getProduct(id) {
  const { data, error } = await supabase
    .from("products")
    .select("*, product_images(id, storage_path, alt, position)")
    .eq("id", id)
    .maybeSingle();

  if (error) return { data: null, error };
  if (data?.product_images) {
    data.product_images.sort((a, b) => a.position - b.position);
  }
  return { data, error: null };
}

/** Fields the admin form is allowed to write. Anything not listed here is
 *  either derived, system-managed, or (stock) owned by the RPC. */
// `rating` and `review_count` are editable seed values, not derived data:
// reviews still live in localStorage on the storefront, so there is no
// reviews table for the DB to aggregate yet. When one exists these two become
// derived columns and must come OUT of this list.
const WRITABLE = [
  "slug", "name", "brand", "brand_id", "category_id", "subtitle", "description", "how_to_use",
  "price_minor", "compare_at_minor", "cost_minor", "sku", "low_stock_at",
  "max_per_order", "backorder_ok", "status", "is_new", "popularity", "tone",
  "concern", "skin_type", "ingredients", "seo_title", "seo_description",
  "rating", "review_count",
  "is_staff_pick", "is_limited_edition", "is_best_seller_manual",
];

function pickWritable(input) {
  const out = {};
  for (const k of WRITABLE) if (input[k] !== undefined) out[k] = input[k];
  return out;
}

export async function createProduct(input) {
  const row = pickWritable(input);
  row.slug = row.slug || slugify(`${input.brand ?? ""}-${input.name ?? ""}`);
  row.status = row.status ?? "draft";
  // Stock is set via adjust_stock() after creation so the very first units
  // land in the ledger like every later movement does.
  const { data, error } = await supabase.from("products").insert(row).select().single();
  return { data, error };
}

/**
 * Update a product. If the slug changed, the OLD slug is parked in
 * product_slug_history first — otherwise renaming a product silently 404s
 * every existing link to it.
 */
export async function updateProduct(id, input, { previousSlug } = {}) {
  const row = pickWritable(input);
  row.updated_at = new Date().toISOString();

  if (previousSlug && row.slug && row.slug !== previousSlug) {
    const { error: histError } = await supabase
      .from("product_slug_history")
      .upsert({ slug: previousSlug, product_id: id }, { onConflict: "slug" });
    if (histError) return { data: null, error: histError };
  }

  const { data, error } = await supabase
    .from("products").update(row).eq("id", id).select().single();
  return { data, error };
}

/** Name/brand for a specific set of product ids — used by pickers (Sales'
 *  "specific products" scope) that store only ids and need to redisplay
 *  what those ids actually are without loading the whole catalog. */
export async function listProductsByIds(ids) {
  if (!ids?.length) return { data: [], error: null };
  const { data, error } = await supabase
    .from("products").select("id, name, brand").in("id", ids);
  return { data, error };
}

/** Archive, never hard-delete. The client WILL do this by accident, and an
 *  archived product keeps past orders and their images intact. */
export async function archiveProduct(id) {
  const { data, error } = await supabase
    .from("products").update({ status: "archived" }).eq("id", id).select().single();
  return { data, error };
}

export async function setProductStatus(ids, status) {
  const { data, error } = await supabase
    .from("products").update({ status }).in("id", ids).select("id");
  return { data, error };
}

/** Bulk price change. mode: 'percent' | 'fixed' | 'set' */
export async function bulkPrice(ids, mode, amount) {
  const { data: rows, error: readError } = await supabase
    .from("products").select("id, price_minor").in("id", ids);
  if (readError) return { data: null, error: readError };

  const updates = rows.map((r) => {
    let next;
    if (mode === "percent") next = Math.round(r.price_minor * (1 + amount / 100));
    else if (mode === "fixed") next = r.price_minor + Math.round(amount * 100);
    else next = Math.round(amount * 100);
    return { id: r.id, price_minor: Math.max(0, next) };
  });

  const { data, error } = await supabase
    .from("products").upsert(updates, { onConflict: "id" }).select("id");
  return { data, error };
}

/* ---------------------------------------------------------------- *
 * Stock — ledger-backed. Never `update products set stock = …`.
 * ---------------------------------------------------------------- */

export async function adjustStock(productId, delta, reason = "adjust", note = null) {
  const { data, error } = await supabase.rpc("adjust_stock", {
    p_product_id: productId, p_delta: delta, p_reason: reason, p_note: note,
  });
  return { data, error };
}

/** Set stock to an absolute number by writing the difference as a movement. */
export async function setStock(productId, currentStock, nextStock, note = "manual recount") {
  const delta = nextStock - currentStock;
  if (delta === 0) return { data: currentStock, error: null };
  return adjustStock(productId, delta, "recount", note);
}

export async function listStockMovements(productId, limit = 50) {
  const { data, error } = await supabase
    .from("inventory_movements")
    .select("id, delta, reason, note, created_at, order_id, variant_id")
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return { data, error };
}

/**
 * Products needing attention — powers the dashboard and Inventory screen.
 *
 * "Low" means `stock <= low_stock_at`, which is PER PRODUCT: a ৳60 pimple
 * patch and a ৳2,600 eye serum don't share a reorder point. PostgREST can't
 * compare two columns in a filter, so this fetches the plausibly-low tail
 * with a generous server-side bound and applies the real per-product rule
 * here. The catalog is a few hundred rows, so the bound is never the
 * limiting factor.
 *
 * This previously hardcoded `stock <= 5`, which silently ignored
 * `low_stock_at` and under-reported anything with a higher reorder point.
 */
export async function listLowStock(limit = 50) {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, brand, slug, stock, low_stock_at, price_minor")
    .eq("status", "active")
    .lte("stock", 100) // bound: no sane reorder point exceeds this
    .order("stock", { ascending: true });

  if (error) return { data: null, error };

  const low = data
    .filter((p) => p.stock <= (p.low_stock_at ?? 5))
    .slice(0, limit);

  return { data: low, error: null };
}

/* ---------------------------------------------------------------- *
 * Variants — multiple sizes per product, each with its own price/stock.
 *
 * A product always has >=1 variant (the database enforces this — see
 * 0016_product_variants.sql — a delete that would leave zero is rejected).
 * For a plain single-size product, that one row is exactly the price/stock
 * shown everywhere else: `products.price_minor`/`stock` mirror the DEFAULT
 * variant automatically (a DB trigger keeps them in sync both ways), so
 * editing via the existing Pricing/Inventory tabs still works completely
 * unchanged for that common case.
 * ---------------------------------------------------------------- */

export async function listVariants(productId) {
  const { data, error } = await supabase
    .from("product_variants")
    .select("*")
    .eq("product_id", productId)
    .order("sort_order", { ascending: true });
  return { data, error };
}

/** Insert or update one variant row. `id` present -> update; absent -> insert. */
export async function upsertVariant(row) {
  const payload = {
    product_id: row.product_id,
    size_label: row.size_label,
    sku: row.sku || null,
    price_minor: row.price_minor,
    compare_at_price_minor: row.compare_at_price_minor ?? null,
    is_default: !!row.is_default,
    sort_order: row.sort_order ?? 0,
    ...(row.id ? { id: row.id } : {}),
  };
  const { data, error } = await supabase
    .from("product_variants").upsert(payload).select().single();
  return { data, error };
}

/**
 * Price-only patch for one variant row — the write behind the Products
 * list's inline quick-edit (listProductsWithVariants below). Deliberately a
 * plain partial UPDATE on the exact same `product_variants` row/columns
 * `upsertVariant` writes, not a parallel path: same table, same triggers
 * (mirror_variant_to_product keeps `products.price_minor` in step when this
 * is the default variant), same everything — just narrower, since the list
 * view only ever needs to change one field without re-sending the whole row.
 */
export async function updateVariantPrice(variantId, priceMinor) {
  const { data, error } = await supabase
    .from("product_variants")
    .update({ price_minor: priceMinor, updated_at: new Date().toISOString() })
    .eq("id", variantId)
    .select()
    .single();
  if (!error) return { data, error: null };
  // product_variants_compare_at_price_minor_check: compare-at must stay
  // above price. Raising price past an existing compare-at from this quick
  // field hits that constraint — plain English instead of a raw DB error.
  if (/compare_at_price_minor_check/.test(error.message)) {
    return { data: null, error: { message: "This price would be at or above the size's “compare at” price. Lower the compare-at first in the Variants tab, or pick a lower price." } };
  }
  return { data: null, error };
}

/**
 * Delete a variant. The database refuses this outright if it would leave
 * the product with zero variants (a real trigger, not just a UI check —
 * see variant_prevent_last_delete in the migration), so the error is
 * translated to plain English rather than shown as a raw exception.
 */
export async function deleteVariant(id) {
  const { error } = await supabase.from("product_variants").delete().eq("id", id);
  if (!error) return { error: null };
  if (/LAST_VARIANT/.test(error.message)) {
    return { error: { message: "A product needs at least one size — add another before removing this one." } };
  }
  return { error };
}

/**
 * One row per VARIANT, joined with its parent product — the Inventory
 * screen's real source. A single-variant product still shows one row (its
 * one size), so this looks pixel-identical to the old per-product list for
 * every product that has never needed sizes; a multi-variant product shows
 * one row per size instead of a single number that can no longer mean
 * anything ("stock: 12" of WHICH size?).
 */
export async function listInventoryRows({
  search = "", stockFilter = "", page = 0, pageSize = 50,
} = {}) {
  let q = supabase
    .from("product_variants")
    .select(
      "id, product_id, size_label, sku, price_minor, stock_quantity, is_default, " +
      "products!inner(id, name, brand, slug, status, low_stock_at)",
      { count: "exact" }
    )
    .eq("products.status", "active");

  if (search.trim()) {
    const term = `%${search.trim()}%`;
    q = q.or(`size_label.ilike.${term},sku.ilike.${term}`);
    // Note: this only matches the variant's own fields — matching by
    // product name/brand would need an .or() across the joined table,
    // which PostgREST doesn't support in one call. Good enough for a
    // "find this SKU/size" search; product-name search still works from
    // the Products screen.
  }
  if (stockFilter === "out") q = q.eq("stock_quantity", 0);

  // "low" can't be a single-table filter — low_stock_at lives on the parent
  // product, and PostgREST can't compare two different tables' columns in
  // one filter (the same constraint listLowStock() already works around).
  // Trade real pagination for a generous bound in that one case: fetch every
  // plausibly-low row and filter here, same shape as listLowStock(). "Low
  // stock" lists are short in practice, so this doesn't cost much.
  const isLowFilter = stockFilter === "low";
  if (isLowFilter) {
    q = q.lte("stock_quantity", 100).order("stock_quantity", { ascending: true }).limit(500);
  } else {
    const from = page * pageSize;
    q = q.order("stock_quantity", { ascending: true }).range(from, from + pageSize - 1);
  }

  const { data, error, count } = await q;
  if (error) return { data: null, error, count: 0 };

  let rows = data.map((r) => ({
    id: r.id,
    productId: r.product_id,
    productName: r.products.name,
    brand: r.products.brand,
    slug: r.products.slug,
    sizeLabel: r.size_label,
    sku: r.sku,
    priceMinor: r.price_minor,
    stock: r.stock_quantity,
    lowStockAt: r.products.low_stock_at ?? 5,
    isDefault: r.is_default,
  }));

  if (isLowFilter) {
    const filtered = rows.filter((r) => r.stock > 0 && r.stock <= r.lowStockAt);
    const pageRows = filtered.slice(page * pageSize, page * pageSize + pageSize);
    return { data: pageRows, error: null, count: filtered.length };
  }

  return { data: rows, error: null, count: count ?? 0 };
}

/** Stock — ledger-backed, same convention as adjustStock() but variant-scoped. */
export async function adjustVariantStock(variantId, delta, reason = "adjust", note = null) {
  const { data, error } = await supabase.rpc("adjust_stock_variant", {
    p_variant_id: variantId, p_delta: delta, p_reason: reason, p_note: note,
  });
  return { data, error };
}

export async function setVariantStock(variantId, currentStock, nextStock, note = "manual recount") {
  const delta = nextStock - currentStock;
  if (delta === 0) return { data: currentStock, error: null };
  return adjustVariantStock(variantId, delta, "recount", note);
}

/* ---------------------------------------------------------------- *
 * Categories
 * ---------------------------------------------------------------- */

export async function listCategories({ includeInactive = false } = {}) {
  let q = supabase
    .from("categories")
    .select("id, name, slug, parent_id, sort_order, is_active")
    .order("sort_order", { ascending: true });
  if (!includeInactive) q = q.eq("is_active", true);
  const { data, error } = await q;
  return { data, error };
}

/**
 * Categories as a two-level tree: `[{ ...parent, children: [...] }]`.
 *
 * Used by the product form's grouped <optgroup> select and by the Categories
 * screen. Includes inactive rows by default because the admin must be able to
 * see and re-activate what it has hidden — unlike the storefront reader,
 * which only ever shows active ones.
 */
export async function listCategoryTree({ includeInactive = true } = {}) {
  let q = supabase
    .from("categories")
    .select("id, name, slug, parent_id, sort_order, is_active")
    .order("sort_order", { ascending: true });
  if (!includeInactive) q = q.eq("is_active", true);

  const { data, error } = await q;
  if (error) return { data: null, error };

  const byId = new Map(data.map((c) => [c.id, { ...c, children: [] }]));
  const roots = [];
  for (const cat of byId.values()) {
    const parent = cat.parent_id ? byId.get(cat.parent_id) : null;
    if (parent) parent.children.push(cat);
    else roots.push(cat);
  }
  const bySort = (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0);
  roots.sort(bySort);
  roots.forEach((r) => r.children.sort(bySort));

  return { data: roots, error: null };
}

/**
 * The tree shaped for <SelectField>: one <optgroup> per top-level category.
 *
 * A parent that holds products directly (Eye Care) is listed inside its own
 * group as well, so it stays selectable — otherwise its existing products
 * would have a category the form couldn't represent, and saving would
 * silently move them.
 */
export function categoryOptions(tree) {
  return (tree ?? []).map((parent) => ({
    id: parent.id,
    label: parent.name,
    options: [
      { id: parent.id, name: `${parent.name} (top level)` },
      ...(parent.children ?? []).map((c) => ({
        id: c.id,
        name: c.is_active ? c.name : `${c.name} — hidden`,
      })),
    ],
  }));
}

/** Categories plus how many products sit in each — the client needs to see
 *  the blast radius before renaming or hiding one. */
export async function listCategoriesWithCounts() {
  const [cats, prods] = await Promise.all([
    supabase.from("categories")
      .select("id, name, slug, parent_id, sort_order, is_active").order("sort_order"),
    supabase.from("products").select("category_id, status"),
  ]);
  if (cats.error) return { data: null, error: cats.error };
  if (prods.error) return { data: null, error: prods.error };

  const counts = {};
  for (const p of prods.data ?? []) {
    counts[p.category_id] ??= { total: 0, active: 0 };
    counts[p.category_id].total += 1;
    if (p.status === "active") counts[p.category_id].active += 1;
  }

  return {
    data: cats.data.map((c) => ({
      ...c,
      productCount: counts[c.id]?.total ?? 0,
      activeCount: counts[c.id]?.active ?? 0,
    })),
    error: null,
  };
}

export async function upsertCategory(row) {
  const payload = { ...row, slug: row.slug || slugify(row.name) };
  const { data, error } = await supabase
    .from("categories").upsert(payload).select().single();
  return { data, error };
}

/**
 * Hide a category instead of deleting it, for the common case: a category
 * with products in it. Hiding pulls it out of the storefront filters while
 * leaving those products' category_id (and any old links to it) intact.
 */
export async function setCategoryActive(id, isActive) {
  const { data, error } = await supabase
    .from("categories").update({ is_active: isActive }).eq("id", id).select().single();
  return { data, error };
}

/**
 * Delete a category outright — for the case hiding doesn't cover: a category
 * that should stop existing, not just stop showing (e.g. a whole taxonomy
 * branch that was never populated).
 *
 * Deliberately NOT reassigning products or child categories anywhere as a
 * side effect. Two real foreign keys already protect against orphaning:
 *   - products.category_id       → ON DELETE RESTRICT
 *   - categories.parent_id       → ON DELETE RESTRICT
 * So the database refuses this delete outright if the category still has
 * products or child categories — verified against a throwaway row before
 * this was written, not assumed. Callers should prefer checking
 * productCount/child count up front (see Categories.jsx) to give the client
 * a plain-English reason instead of a raw constraint-violation message; this
 * function's own error-translation is the fallback for the race where
 * something changed between that check and the click.
 */
export async function deleteCategory(id) {
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (!error) return { error: null };

  if (/categories_parent_id_fkey/.test(error.message)) {
    return { error: { message: "This category still has sub-categories under it. Delete or move those first." } };
  }
  if (/products_category_id_fkey/.test(error.message)) {
    return { error: { message: "This category still has products in it. Move or remove those first." } };
  }
  return { error };
}

/**
 * Persist a reordered list in one round trip.
 *
 * `sort_order` is numbered WITHIN each parent, not across the whole list —
 * top-level columns are ordered against each other, and each parent's
 * children against their siblings. A single global sequence would make a
 * child's position depend on how many items happened to sit above it in an
 * unrelated column.
 */
export async function reorderCategories(ordered) {
  const seen = new Map(); // parent_id (or "root") → next index
  const rows = (ordered ?? []).map((c) => {
    const key = c.parent_id ?? "root";
    const next = (seen.get(key) ?? 0) + 1;
    seen.set(key, next);
    return {
      id: c.id, name: c.name, slug: c.slug,
      parent_id: c.parent_id ?? null, sort_order: next,
    };
  });

  const { data, error } = await supabase
    .from("categories").upsert(rows, { onConflict: "id" }).select("id");
  return { data, error };
}

/** Distinct brand names actually IN USE on products right now — kept for
 *  Sales.jsx's brand filter, which wants "what can I filter sales by",
 *  not "what brands exist to assign" (a brand with zero products has
 *  nothing to filter, so it correctly doesn't show up here). The product
 *  editor's own brand picker uses listBrandRows() below instead — the
 *  real, managed list from `brands` (0028_brands_table.sql). */
export async function listBrands() {
  const { data, error } = await supabase
    .from("products").select("brand").not("brand", "is", null);
  if (error) return { data: null, error };
  const names = [...new Set(data.map((r) => r.brand))].sort();
  return { data: names, error: null };
}

/* ---------------------------------------------------------------- *
 * Brands (0028_brands_table.sql) — a real, managed table. Renaming one
 * cascades to every product's `brand` text via a DB trigger
 * (cascade_brand_rename), so this file never has to touch products
 * itself to keep them in sync.
 * ---------------------------------------------------------------- */

export async function listBrandRows() {
  const { data, error } = await supabase
    .from("brands").select("id, name, slug, created_at").order("name", { ascending: true });
  return { data, error };
}

/** Brands plus how many products use each — same "see the blast radius
 *  before you act" reasoning as listCategoriesWithCounts(). */
export async function listBrandsWithCounts() {
  const [brands, prods] = await Promise.all([
    supabase.from("brands").select("id, name, slug, created_at").order("name", { ascending: true }),
    supabase.from("products").select("brand_id").not("brand_id", "is", null),
  ]);
  if (brands.error) return { data: null, error: brands.error };
  if (prods.error) return { data: null, error: prods.error };

  const counts = {};
  for (const p of prods.data ?? []) counts[p.brand_id] = (counts[p.brand_id] ?? 0) + 1;

  return {
    data: brands.data.map((b) => ({ ...b, productCount: counts[b.id] ?? 0 })),
    error: null,
  };
}

/** Insert or rename a brand. `id` present -> rename; absent -> create.
 *  The slug is always derived from the name — same rule as slugify()
 *  everywhere else in this file, never hand-edited. */
export async function upsertBrand({ id, name }) {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return { data: null, error: { message: "Brand name can't be empty." } };

  const payload = { name: trimmed, slug: slugify(trimmed), ...(id ? { id } : {}) };
  const { data, error } = await supabase.from("brands").upsert(payload).select().single();
  if (!error) return { data, error: null };
  if (/brands_name_key/.test(error.message)) {
    return { data: null, error: { message: "A brand with this name already exists." } };
  }
  return { data: null, error };
}

/**
 * Delete a brand. The database refuses this outright if any product still
 * references it via brand_id (a real FK, `on delete` defaults to NO
 * ACTION) — translated to plain English rather than shown as a raw
 * constraint-violation message, same pattern as deleteCategory().
 */
export async function deleteBrand(id) {
  const { error } = await supabase.from("brands").delete().eq("id", id);
  if (!error) return { error: null };
  if (/products_brand_id_fkey/.test(error.message)) {
    return { error: { message: "This brand is still assigned to one or more products. Reassign those first." } };
  }
  return { error };
}
