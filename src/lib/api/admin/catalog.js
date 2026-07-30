/* =================================================================== *
 * skin.script admin — catalog CRUD (products, categories, images)
 * -------------------------------------------------------------------
 * Reads go against the BASE `products` table here, not `products_public`:
 * the admin needs drafts, archived rows, stock depth and cost price, all
 * of which the public view deliberately hides.
 *
 * The admin never writes a derived field. `is_on_sale`, `discount_percent`,
 * `in_stock`, `is_low_stock` and `is_best_seller` are computed by the
 * products_public view from the base facts written here — that's what keeps
 * the storefront and the admin from ever disagreeing.
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
  if (status) q = q.eq("status", status);
  if (categoryId) q = q.eq("category_id", categoryId);
  if (stockFilter === "out") q = q.eq("stock", 0);
  if (stockFilter === "low") q = q.gt("stock", 0).lte("stock", 5);

  const from = page * pageSize;
  q = q.order(sort, { ascending }).range(from, from + pageSize - 1);

  const { data, error, count } = await q;
  return { data, error, count: count ?? 0 };
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
  "slug", "name", "brand", "category_id", "subtitle", "description", "how_to_use",
  "price_minor", "compare_at_minor", "cost_minor", "sku", "low_stock_at",
  "max_per_order", "backorder_ok", "status", "is_new", "popularity", "tone",
  "concern", "skin_type", "ingredients", "seo_title", "seo_description",
  "rating", "review_count",
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
    .select("id, delta, reason, note, created_at, order_id")
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

/** Categories plus how many products sit in each — the client needs to see
 *  the blast radius before renaming or hiding one. */
export async function listCategoriesWithCounts() {
  const [cats, prods] = await Promise.all([
    supabase.from("categories").select("id, name, slug, sort_order, is_active").order("sort_order"),
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
 * Hide a category instead of deleting it. `products.category_id` is a real FK
 * with ON DELETE RESTRICT, so deleting a category that still has products
 * would fail at the database anyway — and deleting an empty one would break
 * any old link pointing at it. Hiding is the honest operation.
 */
export async function setCategoryActive(id, isActive) {
  const { data, error } = await supabase
    .from("categories").update({ is_active: isActive }).eq("id", id).select().single();
  return { data, error };
}

/** Persist a whole reordered list in one round trip. */
export async function reorderCategories(ordered) {
  const rows = ordered.map((c, i) => ({ id: c.id, name: c.name, slug: c.slug, sort_order: i }));
  const { data, error } = await supabase
    .from("categories").upsert(rows, { onConflict: "id" }).select("id");
  return { data, error };
}

/** Distinct brand names — brand is a text column, not its own table, so the
 *  admin offers a datalist of existing values rather than a hard FK picker. */
export async function listBrands() {
  const { data, error } = await supabase
    .from("products").select("brand").not("brand", "is", null);
  if (error) return { data: null, error };
  const names = [...new Set(data.map((r) => r.brand))].sort();
  return { data: names, error: null };
}
