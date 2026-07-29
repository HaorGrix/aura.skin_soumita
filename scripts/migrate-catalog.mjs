/* =================================================================== *
 * One-shot: migrate the static catalog (src/data/products.js, 139 active
 * products) into the Supabase `categories`/`products`/`product_images`
 * tables, linking each product to the files already uploaded to Storage
 * by scripts/migrate-images-to-storage.mjs.
 *
 * WHY TEXT-PARSED, NOT IMPORTED: data/products.js transitively imports
 * data/product-images.js, which uses Vite's `import.meta.glob` — that only
 * resolves under Vite's bundler, not plain Node. So this script reads the
 * source file AS TEXT and extracts each `p("Brand", "Name", { …opts… })`
 * call's literal opts object (safe: every opts literal in the catalog is
 * plain data — strings/numbers/arrays/booleans, no function calls or
 * external references — so `new Function("return (" + text + ")")()` is a
 * safe, robust way to turn that source text into a real JS object without
 * hand-rolling a parser).
 *
 * It independently replicates:
 *   - the PROMO / OUT_OF_STOCK / LOW_STOCK / CURATED_SALES maps and the
 *     stock/compareAt/salesCount derivation formulas (products.js:472-500)
 *   - the image-matching algorithm in data/product-images.js (imageFor /
 *     galleryFor: exact-basename match, substring-match sorted
 *     alphabetically, `front` pinned first, MAX_GALLERY = 6)
 * against the files this script finds locally under /assests — the same
 * files already uploaded to the `product-images` Storage bucket, so the
 * relative path used here is exactly the storage_path that already exists.
 *
 * NOT replicated (documented, deliberate scope cuts):
 *   - `rating`/`review_count`: the source generates these with a seeded
 *     PRNG sequence shared across all 139 products (three rng() draws per
 *     product, in file order) — replicating that exactly is fragile and
 *     these are cosmetic placeholder numbers, not real reviews. This script
 *     instead derives a stable per-product value from a hash of the
 *     product's own id, in the same [4.4-5.0] / [180-14180] range. Numbers
 *     will look similar but won't match the old static site pixel-for-pixel.
 *   - the `badge` field (best/dewy/barrier/exfoliation/new/sale labels):
 *     "new" and "sale" and "best seller" are already reconstructed by the
 *     products_public view (is_new, is_on_sale, is_best_seller). The
 *     decorative "Barrier Repair"/"Gentle Exfoliation" labels have no DB
 *     column yet — a small, clearly-scoped follow-up if you want them back.
 *
 * Idempotent: safe to re-run. Upserts products on `legacy_id`, and replaces
 * (delete + reinsert) each product's image rows every run.
 *
 * Run (after applying the rating/review_count + view SQL given alongside
 * this script):
 *   node --env-file=.env.local scripts/migrate-catalog.mjs
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (bypasses the staff-only
 * write RLS — appropriate for a trusted local one-shot script, never the
 * browser).
 * =================================================================== */
import { createClient } from "@supabase/supabase-js";
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, relative, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");
const ASSETS_DIR = join(ROOT, "assests");
const CATALOG_FILE = join(ROOT, "src/data/products.js");

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error(
    "Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
    "Run: node --env-file=.env.local scripts/migrate-catalog.mjs"
  );
  process.exit(1);
}
const supabase = createClient(url, serviceKey);

/* ------------------------------------------------------------------ *
 * 1. Local image index — mirrors data/product-images.js's byFile map,
 *    built from the actual filesystem instead of Vite's glob. Storage
 *    already has every file under /assests (migrate-images-to-storage.mjs
 *    uploaded them all); this just needs to know the RELATIVE PATH for
 *    each basename so it matches what's already in the bucket.
 * ------------------------------------------------------------------ */
const VALID_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);
const EXCLUDE_BASENAME = [
  /^Gemini_/, /logo/i, /_menu/, /Main_Page/, /bundle/, /-set-/, /-duo/, /flyout/,
  /KakaoTalk/, /FLAGSHIP/, /SKIN_TEST/, /Untouched_Nature/, /^SKINCARE/, /^nav-/,
  /^Img4/, /^track\.png$/, /1213591265/, /EssentialKit/, /Routine/,
];
const isExcluded = (name) => EXCLUDE_BASENAME.some((re) => re.test(name));

function walk(dir) {
  let files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files = files.concat(walk(full));
    else files.push(full);
  }
  return files;
}

function buildByFile() {
  const files = walk(ASSETS_DIR).filter(
    (f) => VALID_EXT.has(extname(f).toLowerCase()) && !isExcluded(basename(f))
  );
  const byFile = {};
  for (const f of files) {
    byFile[basename(f)] = relative(ASSETS_DIR, f).replace(/\\/g, "/");
  }
  return byFile;
}

const byFile = buildByFile();
const imageFor = (file) => byFile[file];
const galleryFor = (...keys) => {
  if (!keys.length) return [];
  return Object.keys(byFile)
    .filter((f) => keys.some((k) => f.includes(k)))
    .sort()
    .map((f) => byFile[f]);
};

const MAX_GALLERY = 6;
function resolveGallery(opts) {
  const keys = opts.img ? (Array.isArray(opts.img) ? opts.img : [opts.img]) : [];
  let gallery = galleryFor(...keys).slice(0, MAX_GALLERY);
  if (opts.front) {
    const f = imageFor(opts.front) ?? galleryFor(opts.front)[0];
    if (f) gallery = [f, ...gallery.filter((u) => u !== f)].slice(0, MAX_GALLERY);
  }
  if (gallery.length === 0 && opts.image) {
    const u = imageFor(opts.image);
    if (u) gallery = [u];
  }
  return gallery; // relative paths, already == the uploaded storage_paths
}

/* ------------------------------------------------------------------ *
 * 2. Parse src/data/products.js as text.
 * ------------------------------------------------------------------ */
const src = readFileSync(CATALOG_FILE, "utf8");

/** Safely evaluate a plain-data JS object/array literal (no function calls
 *  or external references appear in this file's literals — verified by
 *  inspection — so this is equivalent to, but more robust than, hand-rolled
 *  regex field extraction for nested arrays). */
function evalLiteral(text) {
  return new Function(`"use strict"; return (${text});`)();
}

function extractBlock(varName) {
  const start = src.indexOf(`const ${varName} = `);
  if (start === -1) return {};
  const braceStart = src.indexOf("{", start);
  let depth = 0, i = braceStart;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) break; }
  }
  return evalLiteral(src.slice(braceStart, i + 1));
}
function extractSet(varName) {
  const start = src.indexOf(`const ${varName} = new Set(`);
  if (start === -1) return new Set();
  const bracketStart = src.indexOf("[", start);
  const bracketEnd = src.indexOf("]", bracketStart);
  return new Set(evalLiteral(src.slice(bracketStart, bracketEnd + 1)));
}

const PROMO = extractBlock("PROMO");
const OUT_OF_STOCK = extractSet("OUT_OF_STOCK");
const LOW_STOCK = extractBlock("LOW_STOCK");
const CURATED_SALES = extractBlock("CURATED_SALES");

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// One active `p("Brand","Name",{ ...opts })` call per line — matches every
// row in the file (skips commented-out `//p(...)` rows automatically).
const ROW_RE = /^\s*p\(\s*"((?:[^"\\]|\\.)*)"\s*,\s*"((?:[^"\\]|\\.)*)"\s*,\s*(\{.*\})\s*\)\s*,?\s*$/;

const rows = [];
for (const line of src.split("\n")) {
  if (!/^\s{2}p\(/.test(line)) continue;
  const m = line.match(ROW_RE);
  if (!m) {
    console.warn(`  SKIP (couldn't parse): ${line.slice(0, 80)}...`);
    continue;
  }
  const [, brand, name, optsText] = m;
  rows.push({ brand, name, opts: evalLiteral(optsText) });
}
console.log(`Parsed ${rows.length} active products from ${CATALOG_FILE}\n`);

/* ------------------------------------------------------------------ *
 * 3. Placeholder rating/reviews — deterministic per product id, NOT an
 *    attempt to reproduce the old seeded-RNG sequence (see file header).
 * ------------------------------------------------------------------ */
function hash01(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967295;
}

/* ------------------------------------------------------------------ *
 * 4. Derive every row's DB-ready fields (mirrors products.js:472-500).
 * ------------------------------------------------------------------ */
const CENTS_PER_BDT_FROM_USD = 120 * 100; // old CONVERSION_RATE(120) × 100 minor units

const built = rows.map(({ brand, name, opts }) => {
  const legacyId = `${slug(brand)}-${slug(name)}`;
  const pct = PROMO[legacyId];
  const priceMinor = Math.round(opts.price * CENTS_PER_BDT_FROM_USD);
  const compareAtMinor = pct
    ? Math.round(Math.round((opts.price / (1 - pct / 100)) * 100) / 100 * CENTS_PER_BDT_FROM_USD)
    : null;

  const isOOS = OUT_OF_STOCK.has(legacyId) || opts.inStock === false;
  const stock = isOOS ? 0 : LOW_STOCK[legacyId] ?? 12 + Math.round(((opts.popularity ?? 50) / 100) * 48);
  const inStock = stock > 0;

  const reviewCount = 180 + Math.floor(hash01(legacyId + "r") * 14000);
  const rating = +(4.4 + hash01(legacyId) * 0.6).toFixed(1);
  const salesCount = !inStock ? 0 : CURATED_SALES[legacyId] ?? Math.round((opts.popularity ?? 50) * 15 + reviewCount / 20);

  return {
    legacy_id: legacyId,
    slug: legacyId, // human-readable id becomes the initial URL slug
    brand,
    name,
    category: opts.category,
    price_minor: priceMinor,
    compare_at_minor: compareAtMinor,
    sku: null,
    stock,
    low_stock_at: 5,
    max_per_order: 10, // matches the current global MAX_PER_ORDER constant
    backorder_ok: false,
    status: "active",
    is_new: !!opts.isNew,
    popularity: opts.popularity ?? 50,
    sales_count: salesCount,
    tone: opts.tone ?? "pink",
    concern: opts.concern ?? [],
    skin_type: opts.skinType ?? ["Normal"],
    ingredients: opts.ingredients ?? [],
    rating,
    review_count: reviewCount,
    gallery: resolveGallery(opts), // relative storage paths, front-pinned first
  };
});

/* ------------------------------------------------------------------ *
 * 5. Upsert categories, then products, then replace each product's images.
 * ------------------------------------------------------------------ */
async function run() {
  const categoryNames = [...new Set(built.map((p) => p.category))];
  console.log(`Upserting ${categoryNames.length} categories...`);
  const categoryRows = categoryNames.map((name, i) => ({ name, slug: slug(name), sort_order: i }));
  const { data: cats, error: catErr } = await supabase
    .from("categories")
    .upsert(categoryRows, { onConflict: "slug", ignoreDuplicates: true })
    .select("id, name");
  if (catErr) { console.error("Category upsert failed:", catErr.message); process.exit(1); }

  // ignoreDuplicates means pre-existing categories aren't returned — fetch the full set.
  const { data: allCats, error: allCatErr } = await supabase.from("categories").select("id, name");
  if (allCatErr) { console.error("Category read-back failed:", allCatErr.message); process.exit(1); }
  const categoryIdByName = Object.fromEntries(allCats.map((c) => [c.name, c.id]));

  let upserted = 0, imagesLinked = 0, failed = 0;
  for (const p of built) {
    const categoryId = categoryIdByName[p.category];
    if (!categoryId) {
      console.error(`  FAIL  ${p.legacy_id}: unknown category "${p.category}"`);
      failed++;
      continue;
    }

    const { data: productRow, error: prodErr } = await supabase
      .from("products")
      .upsert(
        {
          legacy_id: p.legacy_id,
          slug: p.slug,
          category_id: categoryId,
          brand: p.brand,
          name: p.name,
          price_minor: p.price_minor,
          compare_at_minor: p.compare_at_minor,
          sku: p.sku,
          stock: p.stock,
          low_stock_at: p.low_stock_at,
          max_per_order: p.max_per_order,
          backorder_ok: p.backorder_ok,
          status: p.status,
          is_new: p.is_new,
          popularity: p.popularity,
          sales_count: p.sales_count,
          tone: p.tone,
          concern: p.concern,
          skin_type: p.skin_type,
          ingredients: p.ingredients,
          rating: p.rating,
          review_count: p.review_count,
          published_at: new Date().toISOString(),
        },
        { onConflict: "legacy_id" }
      )
      .select("id")
      .single();

    if (prodErr) {
      console.error(`  FAIL  ${p.legacy_id}: ${prodErr.message}`);
      failed++;
      continue;
    }
    upserted++;

    // Replace this product's images (idempotent re-run).
    await supabase.from("product_images").delete().eq("product_id", productRow.id);
    if (p.gallery.length > 0) {
      const imageRows = p.gallery.map((storagePath, position) => ({
        product_id: productRow.id,
        storage_path: storagePath,
        alt: p.name,
        position,
      }));
      const { error: imgErr } = await supabase.from("product_images").insert(imageRows);
      if (imgErr) console.error(`  WARN  ${p.legacy_id}: image link failed — ${imgErr.message}`);
      else imagesLinked += imageRows.length;
    }

    if (upserted % 25 === 0) console.log(`  ...${upserted}/${built.length} products upserted`);
  }

  console.log(`\nDone.`);
  console.log(`  Categories: ${allCats.length}`);
  console.log(`  Products upserted: ${upserted}/${built.length}   Failed: ${failed}`);
  console.log(`  Image rows linked: ${imagesLinked}`);
  const withNoImage = built.filter((p) => p.gallery.length === 0).length;
  if (withNoImage) console.log(`  Products with NO matched image (will show the SVG fallback): ${withNoImage}`);
}

run();
