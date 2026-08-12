/* =================================================================== *
 * skin.theory — category tile artwork generator
 * -------------------------------------------------------------------
 * Authors the five category visuals as vector compositions and rasterises
 * each to a transparent PNG via headless Chromium.
 *
 * Vector-first (rather than hand-painted raster) is deliberate: the set has
 * to stay visually consistent — identical optical weight, identical palette,
 * identical margins — and that consistency is far easier to guarantee from
 * shared geometry constants than by eye. Re-running this script reproduces
 * the set exactly, so a palette tweak is a one-line change, not a redraw.
 *
 * Run:  node scripts/gen-category-art.mjs
 * Out:  src/assets/categories/<slug>.png   (1024×1024, transparent)
 * =================================================================== */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const OUT_DIR = "src/assets/categories";
const SIZE = 512;      // authoring canvas
const SCALE = 2;       // → 1024px exports

/* "Coral Blue" — corals and muted blues carry the set, warm beige and blush
 * soften it. The blues are the storefront's own tokens (rose #5c8b9c /
 * navy #0d3a4f), so the tiles read as part of the site rather than clip-art
 * dropped on top of it. */
const C = {
  coral:     "#F08A6C",
  coralDeep: "#E0674A",
  blush:     "#F5C4CB",
  blue:      "#6E9BAE",
  blueDeep:  "#12455C",
  aqua:      "#CFE3E8",
  beige:     "#EBD6BE",
  beigeDeep: "#D9BE9C",
  cream:     "#FDF7F0",
};

const cx = SIZE / 2, cy = SIZE / 2;
const rad = (d) => (d * Math.PI) / 180;

/** Petals arranged on a ring — overlapping circles of one fill read as a
 *  single organic blossom without any boolean path maths. */
function petalRing({ n, ringR, petalR, fill, rotate = -90, cxx = cx, cyy = cy }) {
  return Array.from({ length: n }, (_, i) => {
    const a = rad(rotate + (360 / n) * i);
    return `<circle cx="${(cxx + ringR * Math.cos(a)).toFixed(2)}" cy="${(cyy + ringR * Math.sin(a)).toFixed(2)}" r="${petalR}" fill="${fill}"/>`;
  }).join("");
}

/* ── 1. SKIN CARE — dew blossom ────────────────────────────────────────
 * A soft bloom with a single droplet resting on it: petal = botanical /
 * gentle, droplet = hydration. Reads instantly as skincare. */
const skinCare = `
  <g>
    ${petalRing({ n: 5, ringR: 96, petalR: 92, fill: C.blue })}
    <circle cx="${cx}" cy="${cy}" r="104" fill="${C.blue}"/>
    <circle cx="${cx}" cy="${cy}" r="78" fill="${C.aqua}"/>
    <path d="M ${cx} ${cy - 62}
             C ${cx + 46} ${cy - 8}, ${cx + 40} ${cy + 46}, ${cx} ${cy + 46}
             C ${cx - 40} ${cy + 46}, ${cx - 46} ${cy - 8}, ${cx} ${cy - 62} Z"
          fill="${C.coral}"/>
    <ellipse cx="${cx - 15}" cy="${cy + 8}" rx="9" ry="14" fill="${C.cream}" opacity="0.75"/>
    <circle cx="${cx + 118}" cy="${cy - 128}" r="20" fill="${C.blush}"/>
  </g>`;

/* ── 2. HAIR CARE — flow ───────────────────────────────────────────────
 * Three ribbons on the same S-curve, offset and weighted differently:
 * strands with movement. Round caps keep it soft rather than graphic. */
const wave = (dy, stroke, w) =>
  `<path d="M 74 ${232 + dy} C 168 ${142 + dy}, 250 ${318 + dy}, 342 ${228 + dy} S 430 ${150 + dy}, 452 ${196 + dy}"
      fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round"/>`;
const hairCare = `
  <g>
    <circle cx="${cx}" cy="${cy}" r="196" fill="${C.beige}"/>
    ${wave(58, C.blue, 40)}
    ${wave(6, C.coral, 46)}
    ${wave(-48, C.blueDeep, 30)}
    <circle cx="${cx - 128}" cy="${cy + 132}" r="18" fill="${C.blush}"/>
  </g>`;

/* ── 3. BODY CARE — vessel & leaf ──────────────────────────────────────
 * An abstracted bottle (arched body, coral cap) with a botanical leaf:
 * lotion + natural, without drawing a literal product. */
const bodyCare = `
  <g>
    <circle cx="${cx}" cy="${cy}" r="186" fill="${C.aqua}"/>
    <path d="M 352 214 C 410 190, 432 132, 420 84
             C 360 96, 326 152, 340 214 Z" fill="${C.blue}"/>
    <path d="M 350 206 C 374 172, 396 140, 414 100"
          fill="none" stroke="${C.cream}" stroke-width="9" stroke-linecap="round" opacity="0.7"/>
    <rect x="216" y="128" width="80" height="74" rx="30" fill="${C.coral}"/>
    <rect x="196" y="188" width="120" height="40" rx="20" fill="${C.coralDeep}"/>
    <rect x="150" y="216" width="212" height="196" rx="68" fill="${C.beige}"/>
    <path d="M 150 322 C 208 296, 304 356, 362 324 L 362 344
             A 68 68 0 0 1 294 412 L 218 412 A 68 68 0 0 1 150 344 Z"
          fill="${C.beigeDeep}"/>
    <circle cx="140" cy="150" r="20" fill="${C.blush}"/>
  </g>`;

/* ── 4. OFFER — burst seal ─────────────────────────────────────────────
 * A scalloped starburst: the universal "deal sticker" silhouette, kept
 * abstract by dropping any % symbol and letting the form carry it. */
const offer = `
  <g>
    ${petalRing({ n: 14, ringR: 150, petalR: 46, fill: C.coral })}
    <circle cx="${cx}" cy="${cy}" r="158" fill="${C.coral}"/>
    <circle cx="${cx}" cy="${cy}" r="118" fill="${C.cream}"/>
    <circle cx="${cx}" cy="${cy}" r="92" fill="${C.coralDeep}"/>
    <path d="M ${cx - 40} ${cy + 34} L ${cx + 40} ${cy - 38}"
          stroke="${C.cream}" stroke-width="16" stroke-linecap="round"/>
    <circle cx="${cx - 28}" cy="${cy - 30}" r="19" fill="${C.cream}"/>
    <circle cx="${cx + 30}" cy="${cy + 28}" r="19" fill="${C.cream}"/>
  </g>`;

/* ── 5. COMBO — the set ────────────────────────────────────────────────
 * Three different silhouettes overlapping as one cluster: distinct pieces
 * bundled together, which is exactly what a combo is. */
/* Three different silhouettes standing on ONE shared baseline — the visual
 * grammar of a product line-up, which is what a combo is. Earlier drafts
 * scattered the forms and it read as debris; a common baseline is what makes
 * it parse as a deliberate set. */
const combo = `
  <g>
    <circle cx="${cx}" cy="${cy}" r="186" fill="${C.aqua}"/>
    <path d="M 110 333 L 110 247 A 44 44 0 0 1 198 247 L 198 333 Z" fill="${C.blue}"/>
    <rect x="206" y="197" width="116" height="136" rx="42" fill="${C.beige}"/>
    <rect x="330" y="179" width="72" height="154" rx="36" fill="${C.coral}"/>
    <circle cx="366" cy="222" r="20" fill="${C.cream}"/>
    <rect x="228" y="232" width="72" height="14" rx="7" fill="${C.beigeDeep}"/>
    <rect x="228" y="262" width="46" height="14" rx="7" fill="${C.beigeDeep}"/>
    <rect x="96" y="341" width="320" height="18" rx="9" fill="${C.blueDeep}" opacity="0.18"/>
    <circle cx="138" cy="162" r="20" fill="${C.blush}"/>
  </g>`;

const TILES = [
  { slug: "skin-care", art: skinCare },
  { slug: "hair-care", art: hairCare },
  { slug: "body-care", art: bodyCare },
  { slug: "offer",     art: offer },
  { slug: "combo",     art: combo },
];

const svg = (art) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">${art}</svg>`;

fs.mkdirSync(OUT_DIR, { recursive: true });

const html = `<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;background:transparent}
  .tile{width:${SIZE}px;height:${SIZE}px;display:block}
</style>
${TILES.map((t) => `<div class="tile" id="${t.slug}">${svg(t.art)}</div>`).join("\n")}`;

const tmp = path.join(OUT_DIR, "_render.html");
fs.writeFileSync(tmp, html);

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: SIZE, height: SIZE * TILES.length },
  deviceScaleFactor: SCALE,
});
await page.goto("file://" + path.resolve(tmp).replace(/\\/g, "/"));
await page.waitForTimeout(300);

for (const t of TILES) {
  const file = path.join(OUT_DIR, `${t.slug}.png`);
  // omitBackground is what actually yields alpha=0 outside the artwork.
  await page.locator(`#${t.slug}`).screenshot({ path: file, omitBackground: true });
  console.log(`${file}  ${(fs.statSync(file).size / 1024).toFixed(1)} KB`);
}

await browser.close();
fs.unlinkSync(tmp);
console.log(`\n${TILES.length} tiles → ${SIZE * SCALE}×${SIZE * SCALE} transparent PNG`);
