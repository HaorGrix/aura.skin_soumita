/* =================================================================== *
 * One-shot: upload every file under /assests to the Supabase Storage
 * `product-images` bucket, preserving the folder structure as the path.
 *
 * This does NOT touch the `products` or `product_images` tables — it only
 * stages the raw files in Storage. Attaching them to specific products
 * happens in the full catalog migration (which reuses data/products.js's
 * existing img/front/image mapping logic to know exactly which file belongs
 * to which product). This script's only job is: get every file safely off
 * disk and into Storage first.
 *
 * It does NOT delete or modify anything in /assests. Re-running it is safe
 * (upsert: true) if it's interrupted partway.
 *
 * Uses the SERVICE ROLE key, which bypasses the staff-only Storage RLS —
 * appropriate for a one-shot script run locally by the developer. NEVER put
 * this key in a VITE_-prefixed var or any browser-reachable code.
 *
 * Run (from the repo root, Node 20.6+, no extra install needed):
 *   node --env-file=.env.local scripts/migrate-images-to-storage.mjs
 *
 * Requires in .env.local:
 *   VITE_SUPABASE_URL=...              (already there from the data-layer setup)
 *   SUPABASE_SERVICE_ROLE_KEY=...      (NOT VITE_-prefixed — add this one)
 * =================================================================== */
import { createClient } from "@supabase/supabase-js";
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ASSETS_DIR = join(__dirname, "..", "assests"); // repo's actual (misspelled) folder name
const BUCKET = "product-images";

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
    "Add SUPABASE_SERVICE_ROLE_KEY to .env.local (Dashboard → Settings → API → service_role),\n" +
    "then run: node --env-file=.env.local scripts/migrate-images-to-storage.mjs"
  );
  process.exit(1);
}

// Disabled for the same reason as migrate-catalog.mjs: a one-shot script has
// no use for session persistence or a background token-refresh timer, and a
// lingering handle from either can interfere with clean process shutdown.
const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const MIME = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".webp": "image/webp", ".jfif": "image/jpeg", ".avif": "image/avif",
};

function walk(dir) {
  let files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files = files.concat(walk(full));
    else files.push(full);
  }
  return files;
}

const files = walk(ASSETS_DIR).filter((f) => MIME[extname(f).toLowerCase()]);
console.log(`Found ${files.length} image files under /assests\n`);

let uploaded = 0, failed = 0;
for (const filePath of files) {
  const relPath = relative(ASSETS_DIR, filePath).replace(/\\/g, "/");
  const buffer = readFileSync(filePath);
  const contentType = MIME[extname(filePath).toLowerCase()];

  const { error } = await supabase.storage.from(BUCKET).upload(relPath, buffer, {
    contentType,
    upsert: true, // safe to re-run after an interruption
  });

  if (error) {
    console.error(`  FAIL  ${relPath}: ${error.message}`);
    failed++;
  } else {
    uploaded++;
    if (uploaded % 25 === 0) console.log(`  ...${uploaded}/${files.length} uploaded`);
  }
}

console.log(`\nDone. Uploaded: ${uploaded}   Failed: ${failed}   Total found: ${files.length}`);
if (failed === 0 && uploaded === files.length) {
  console.log(
    `\nAll ${uploaded} files are now in Supabase Storage ("${BUCKET}" bucket).\n` +
    `Local /assests is now backed up off-repo. Do NOT delete it yet — the live\n` +
    `site still builds every product photo from /assests until the storefront\n` +
    `is cut over to read from Supabase and that's verified in production.`
  );
} else if (failed > 0) {
  console.log(`\n${failed} file(s) failed — re-run this script to retry (upsert makes it safe).`);
}
