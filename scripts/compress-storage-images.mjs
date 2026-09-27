/* =================================================================== *
 * One-shot: compress every product photo already in Supabase Storage.
 * -------------------------------------------------------------------
 * New uploads are compressed in the browser (src/lib/image-compress.js);
 * this catches up the photos uploaded before that existed.
 *
 * For each `product_images` row whose file would shrink by MIN_SAVING:
 *   1. download the original from the `product-images` bucket,
 *   2. resize to MAX_DIMENSION (longest side) and encode as WebP,
 *   3. upload it beside the original as `<same name>.webp`,
 *   4. point the `product_images` row AND any `order_items.image_path`
 *      snapshot at the new file.
 * The original object is NOT deleted, so anything still holding the old
 * path keeps working. Every change is appended to a JSON map under
 * backups/ (gitignored) that is enough to point the rows back.
 *
 * Dry run by default — it downloads and measures, and changes nothing.
 *
 * Run (from the repo root):
 *   node --env-file=.env.local scripts/compress-storage-images.mjs
 *   node --env-file=.env.local scripts/compress-storage-images.mjs --write
 *
 * Requires in .env.local:
 *   VITE_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...   (never VITE_-prefixed)
 * =================================================================== */
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const BUCKET = "product-images";
const MAX_DIMENSION = 2000;
const MIN_SAVING = 0.1;
const WRITE = process.argv.includes("--write");

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error(
    "Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.\n" +
    "Run: node --env-file=.env.local scripts/compress-storage-images.mjs"
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BACKUP_DIR = join(fileURLToPath(new URL("..", import.meta.url)), "backups");
const MAP_FILE = join(BACKUP_DIR, `storage-webp-map-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
const moved = [];

function saveMap() {
  mkdirSync(BACKUP_DIR, { recursive: true });
  writeFileSync(MAP_FILE, JSON.stringify(moved, null, 2));
}

async function convert(row) {
  const { data: blob, error: dlError } = await supabase.storage.from(BUCKET).download(row.storage_path);
  if (dlError) throw new Error(`download: ${dlError.message}`);
  const input = Buffer.from(await blob.arrayBuffer());

  const output = await sharp(input, { failOn: "none" })
    .rotate()
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80, effort: 6 })
    .toBuffer();

  if (output.length > input.length * (1 - MIN_SAVING)) return { before: input.length, after: input.length };
  if (!WRITE) return { before: input.length, after: output.length };

  const newPath = row.storage_path.replace(/\.[^./]+$/, "") + ".webp";
  const { error: upError } = await supabase.storage.from(BUCKET).upload(newPath, output, {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert: false,
  });
  if (upError) throw new Error(`upload ${newPath}: ${upError.message}`);

  const { error: rowError } = await supabase
    .from("product_images").update({ storage_path: newPath }).eq("id", row.id);
  if (rowError) {
    await supabase.storage.from(BUCKET).remove([newPath]);
    throw new Error(`product_images update: ${rowError.message}`);
  }
  moved.push({ id: row.id, from: row.storage_path, to: newPath });
  saveMap();

  const { error: orderError } = await supabase
    .from("order_items").update({ image_path: newPath }).eq("image_path", row.storage_path);
  if (orderError) throw new Error(`order_items update (row already moved, see ${MAP_FILE}): ${orderError.message}`);

  return { before: input.length, after: output.length };
}

const { data: rows, error } = await supabase
  .from("product_images").select("id, storage_path").order("storage_path");
if (error) {
  console.error(`Could not read product_images: ${error.message}`);
  process.exit(1);
}

const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;
let before = 0, after = 0, changed = 0, failed = 0;

for (const row of rows) {
  if (row.storage_path.toLowerCase().endsWith(".webp")) continue;
  try {
    const r = await convert(row);
    before += r.before;
    after += r.after;
    if (r.after < r.before) changed++;
  } catch (err) {
    failed++;
    console.error(`  FAIL  ${row.storage_path}: ${err.message}`);
  }
}

console.log(
  `${WRITE ? "Converted" : "Would convert"} ${changed} of ${rows.length} product photos ` +
  `(${failed} failed): ${mb(before)} -> ${mb(after)}` +
  (WRITE ? `\nOld -> new path map: ${MAP_FILE}` : "\nDry run only. Re-run with --write to apply."),
);
if (failed) process.exitCode = 1;
