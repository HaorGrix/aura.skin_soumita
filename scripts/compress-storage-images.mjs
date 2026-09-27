/* =================================================================== *
 * One-shot: compress every product photo already in Supabase Storage.
 * -------------------------------------------------------------------
 * New uploads are compressed in the browser (src/lib/image-compress.js);
 * this catches up the photos uploaded before that existed.
 *
 * For each `product_images` row whose file would shrink by MIN_SAVING:
 *   1. download the original from the `product-images` bucket and save a
 *      byte-for-byte copy under backups/storage-originals/ (gitignored),
 *   2. resize to MAX_DIMENSION (longest side) and encode as WebP,
 *   3. upload it beside the original as `<same name>.webp`,
 *   4. point the `product_images` row AND any `order_items.image_path`
 *      snapshot at the new file,
 *   5. with --delete-originals, remove the original object — unless some
 *      other table (CMS content, sales) still references that path.
 * Every change is appended to a JSON map under backups/; together with the
 * saved originals that is enough to restore both rows and files.
 *
 * Dry run by default: it reads Storage metadata only (no downloads, so no
 * egress) and reports what it would do.
 *
 * Run (from the repo root):
 *   node --env-file=.env.local scripts/compress-storage-images.mjs
 *   node --env-file=.env.local scripts/compress-storage-images.mjs --write --delete-originals [--limit=N]
 *
 * Requires in .env.local:
 *   VITE_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...   (never VITE_-prefixed)
 * =================================================================== */
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BUCKET = "product-images";
const MAX_DIMENSION = 2000;
const MIN_SAVING = 0.1;
const WRITE = process.argv.includes("--write");
const DELETE_ORIGINALS = process.argv.includes("--delete-originals");
const LIMIT = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1]) || Infinity;

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
const ORIGINALS_DIR = join(BACKUP_DIR, "storage-originals");
const MAP_FILE = join(BACKUP_DIR, `storage-webp-map-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
const moved = [];

function saveMap() {
  mkdirSync(BACKUP_DIR, { recursive: true });
  writeFileSync(MAP_FILE, JSON.stringify(moved, null, 2));
}

/** Storage paths mentioned anywhere outside product_images/order_items —
 *  CMS blocks and their revisions, sale banners. Originals referenced there
 *  must survive even when --delete-originals is on. */
async function pathsReferencedElsewhere() {
  const sources = [
    ["content_blocks", "payload"],
    ["content_revisions", "payload"],
    ["sales", "image_path"],
  ];
  let text = "";
  for (const [table, column] of sources) {
    const { data, error } = await supabase.from(table).select(column);
    if (error) throw new Error(`read ${table}: ${error.message}`);
    text += JSON.stringify(data);
  }
  return text;
}

/** Sizes of every object under a prefix, from Storage metadata (no download). */
async function listSizes(prefix, out = new Map()) {
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000, offset });
    if (error) throw new Error(`list ${prefix}: ${error.message}`);
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) await listSizes(path, out);
      else out.set(path, item.metadata?.size ?? 0);
    }
    if (data.length < 1000) break;
  }
  return out;
}

async function convert(row, referencedElsewhere) {
  const { data: blob, error: dlError } = await supabase.storage.from(BUCKET).download(row.storage_path);
  if (dlError) throw new Error(`download: ${dlError.message}`);
  const input = Buffer.from(await blob.arrayBuffer());

  const output = await sharp(input, { failOn: "none" })
    .rotate()
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80, effort: 6 })
    .toBuffer();
  if (output.length > input.length * (1 - MIN_SAVING)) return { before: input.length, after: input.length };

  const backupPath = join(ORIGINALS_DIR, row.storage_path);
  mkdirSync(dirname(backupPath), { recursive: true });
  writeFileSync(backupPath, input);

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
  const entry = { id: row.id, from: row.storage_path, to: newPath, backup: backupPath, originalDeleted: false };
  moved.push(entry);
  saveMap();

  const { error: orderError } = await supabase
    .from("order_items").update({ image_path: newPath }).eq("image_path", row.storage_path);
  if (orderError) throw new Error(`order_items update (row already moved, see ${MAP_FILE}): ${orderError.message}`);

  if (DELETE_ORIGINALS && !referencedElsewhere.includes(row.storage_path)) {
    const { error: rmError } = await supabase.storage.from(BUCKET).remove([row.storage_path]);
    if (rmError) throw new Error(`remove original (converted fine, original kept): ${rmError.message}`);
    entry.originalDeleted = true;
    saveMap();
  }
  return { before: input.length, after: output.length };
}

const { data: rows, error } = await supabase
  .from("product_images").select("id, storage_path").order("storage_path");
if (error) {
  console.error(`Could not read product_images: ${error.message}`);
  process.exit(1);
}
const todo = rows.filter((r) => !r.storage_path.toLowerCase().endsWith(".webp"));
const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;

if (!WRITE) {
  const sizes = await listSizes("");
  const bucketTotal = [...sizes.values()].reduce((s, n) => s + n, 0);
  const todoTotal = todo.reduce((s, r) => s + (sizes.get(r.storage_path) ?? 0), 0);
  const missing = todo.filter((r) => !sizes.has(r.storage_path)).length;
  const referenced = new Set(rows.map((r) => r.storage_path));
  const unreferenced = [...sizes.keys()].filter((p) => !referenced.has(p));
  console.log(
    `Bucket "${BUCKET}": ${sizes.size} files, ${mb(bucketTotal)}\n` +
    `Product photos to convert: ${todo.length} (${mb(todoTotal)} to download once)` +
    (missing ? `, ${missing} rows point at files that don't exist` : "") + "\n" +
    `Files not used by any product photo (left untouched): ${unreferenced.length}\n` +
    "Dry run only — nothing downloaded or changed. Re-run with --write [--delete-originals] [--limit=N]."
  );
  process.exit(0);
}

const referencedElsewhere = DELETE_ORIGINALS ? await pathsReferencedElsewhere() : "";
let before = 0, after = 0, changed = 0, failed = 0;

for (const row of todo.slice(0, LIMIT)) {
  try {
    const r = await convert(row, referencedElsewhere);
    before += r.before;
    after += r.after;
    if (r.after < r.before) changed++;
  } catch (err) {
    failed++;
    console.error(`  FAIL  ${row.storage_path}: ${err.message}`);
  }
}

console.log(
  `Converted ${changed} of ${Math.min(todo.length, LIMIT)} product photos (${failed} failed): ` +
  `${mb(before)} -> ${mb(after)}; originals deleted: ${moved.filter((m) => m.originalDeleted).length}\n` +
  `Old -> new path map: ${MAP_FILE}`,
);
if (failed) process.exitCode = 1;
