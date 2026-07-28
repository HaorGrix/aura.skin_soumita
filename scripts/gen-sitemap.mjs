/* Generate public/sitemap.xml from the catalog + static routes.
 *
 * Reads product slugs straight from src/data/products.js as TEXT (so we don't
 * import Vite-only helpers like import.meta.glob), then emits every indexable
 * URL. Re-run after adding/removing products:  node scripts/gen-sitemap.mjs
 *
 * IMPORTANT: set SITE_ORIGIN to your real production domain (also update the
 * Sitemap: line in public/robots.txt to match).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SITE_ORIGIN = "https://auraskin.example.com"; // ← replace with your domain

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const today = new Date().toISOString().slice(0, 10);

// Public, indexable static routes (cart/checkout/account/wishlist are excluded).
const STATIC = [
  { path: "/", priority: "1.0", changefreq: "weekly" },
  { path: "/shop", priority: "0.9", changefreq: "daily" },
  { path: "/offers", priority: "0.8", changefreq: "daily" },
  { path: "/journal", priority: "0.6", changefreq: "weekly" },
  { path: "/rewards", priority: "0.5", changefreq: "monthly" },
  { path: "/about", priority: "0.5", changefreq: "monthly" },
  { path: "/contact", priority: "0.4", changefreq: "monthly" },
];

// Extract active product slugs from the catalog source (skip //-commented rows).
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const src = readFileSync(join(ROOT, "src/data/products.js"), "utf8");
const productPaths = src
  .split("\n")
  .filter((l) => /^\s{2}p\(/.test(l) && !l.trimStart().startsWith("//"))
  .map((l) => l.match(/^\s*p\(\s*"([^"]+)"\s*,\s*"([^"]+)"/))
  .filter(Boolean)
  .map((m) => `/product/${slug(m[1] + "-" + m[2])}`);

const urls = [
  ...STATIC.map((r) => ({ ...r })),
  ...productPaths.map((p) => ({ path: p, priority: "0.7", changefreq: "weekly" })),
];

const body = urls
  .map(
    (u) =>
      `  <url>\n    <loc>${SITE_ORIGIN}${u.path}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
  )
  .join("\n");

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;

writeFileSync(join(ROOT, "public/sitemap.xml"), xml, "utf8");
console.log(`sitemap.xml written: ${urls.length} URLs (${STATIC.length} static + ${productPaths.length} products) @ ${SITE_ORIGIN}`);
