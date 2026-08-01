/* =================================================================== *
 * skin.script — category card re-tint + corner repair
 * -------------------------------------------------------------------
 * The supplied category cards ship with two problems baked into the
 * pixels (neither is fixable in CSS — the PNGs are drawn with
 * object-contain and no mask):
 *
 *   1. The label bar's rounded bottom corners have OPAQUE BLACK filling
 *      the area outside the radius, instead of transparency. That is the
 *      "black corner artifact" — it is at the BOTTOM of the bar, not the
 *      top of the arch, whose corners are already clean (alpha 0).
 *
 *   2. Brand colours are pink; they need dusty blue for the arch/rays and
 *      midnight navy for the label bar.
 *
 * Approach
 * --------
 * Pink is identified in HSL, not by exact RGB match. The graphic pinks sit
 * in a tight, highly-saturated band (H≈337°, S≈0.85) while photographic
 * skin tones sit near H≈20° at much lower saturation, so a hue+saturation
 * window separates artwork from photo cleanly AND catches the anti-aliased
 * blends between ray shades — an exact-match swap would leave pink fringes
 * along every ray edge.
 *
 * Per-pixel LIGHTNESS is preserved as an offset from the base pink. That is
 * what keeps the sunburst rays visible after recolouring; flattening every
 * pink to one blue would erase the ray pattern entirely.
 *
 * The bar's bottom corners are re-cut geometrically (anti-aliased rounded
 * rect) rather than by deleting black pixels, because deleting alone would
 * leave the muddy black→pink blend pixels along the arc.
 *
 * Run: node scripts/retint-category-art.mjs
 * ===================================================================*/
import { PNG } from "pngjs";
import fs from "fs";
import path from "path";

const DIR = "assests/cate";
const FILES = ["skin-care", "hair-care", "body-care", "offer", "combo"];

const ARCH = { h: 208.9, s: 0.255, l: 0.584 }; // #7A96B0 dusty blue
const BAR  = { h: 216.3, s: 0.414, l: 0.180 }; // #1B2A41 midnight navy

// The dominant source pink — the reference point lightness offsets are measured from.
const BASE_L = 0.596;

// Hue/saturation window for "this pixel is brand pink, not photography".
const PINK_H = [322, 352];
const PINK_S = 0.42;

const rgb2hsl = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  const l = (mx + mn) / 2;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (mx === r) h = 60 * (((g - b) / d) % 6);
  else if (mx === g) h = 60 * ((b - r) / d + 2);
  else h = 60 * ((r - g) / d + 4);
  return [(h + 360) % 360, s, l];
};

const hsl2rgb = (h, s, l) => {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r, g, b;
  if (h < 60)       [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else              [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
};

const isPink = (h, s) => h >= PINK_H[0] && h <= PINK_H[1] && s >= PINK_S;

for (const name of FILES) {
  const file = path.join(DIR, `${name}.png`);
  const png = PNG.sync.read(fs.readFileSync(file));
  const { width: W, height: H, data: d } = png;
  const at = (x, y) => (W * y + x) * 4;

  /* ---- 1. Find the label bar's top edge -------------------------------
   * Discriminator: opacity at the far-left column. The bar spans the full
   * card width, the arch never reaches the edge — so x=8 is opaque for
   * every bar row and transparent for every arch row.
   *
   * An earlier version scored rows by "mostly pink" instead. That misfired
   * on body-care, where the arch is wide enough low down that its rays
   * carried the row, so the bar's top was detected ~160px too high and a
   * band of arch got painted navy. Opacity at the edge has no such overlap. */
  let barTop = H;
  for (let y = H - 1; y >= 0; y--) {
    if (d[at(8, y) + 3] > 128) barTop = y;
    else break;
  }

  /* ---- 2. Corner radius: first bar-pink pixel on the bottom row ------- */
  let radius = 0;
  for (let x = 0; x < W / 2; x++) {
    const i = at(x, H - 1);
    const [h, s] = rgb2hsl(d[i], d[i + 1], d[i + 2]);
    if (d[i + 3] > 200 && isPink(h, s)) { radius = x; break; }
  }
  if (radius < 4) radius = 0;

  /* ---- 3a. Label bar → navy -------------------------------------------
   * The bar is its own flat colour (240,64,127), distinct from either ray,
   * and its extent is already known from barTop. White label text has ~0
   * saturation so the pink test skips it automatically. */
  let barPx = 0;
  for (let y = barTop; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = at(x, y);
      if (d[i + 3] === 0) continue;
      const [h, s, l] = rgb2hsl(d[i], d[i + 1], d[i + 2]);
      if (!isPink(h, s)) continue;
      const nl = Math.min(0.97, Math.max(0.03, BAR.l + (l - BASE_L)));
      const [r, g, b] = hsl2rgb(BAR.h, BAR.s, nl);
      d[i] = r; d[i + 1] = g; d[i + 2] = b;
      barPx++;
    }
  }

  /* ---- 3b. Background rays → dusty blue -------------------------------
   * CONNECTED region growth seeded from the two flat ray colours, bounded
   * by lightness. Both constraints are load-bearing:
   *
   *   • Connectivity stops isolated pink elsewhere in the photo (a bottle
   *     cap, a lip) from being recoloured just for being pink.
   *   • The lightness ceiling stops the growth climbing OUT of the rays and
   *     into the pedestal, which is equally saturated pink and physically
   *     touches the ray background. Rays sit at L≈0.59–0.71; the pedestal
   *     at L≈0.86–0.91, so RAY_MAX_L cleanly separates them.
   *
   * A plain hue+saturation sweep (the previous version) had neither guard,
   * which is exactly why the pedestal and product photos got tinted. */
  const RAY_FLATS = [[231, 69, 127], [245, 117, 167], [230, 69, 127], [245, 116, 166]];
  const RAY_MAX_L = 0.80;
  const RAY_BASE_L = 0.588;

  const seen = new Uint8Array(W * H);
  const stack = [];
  for (let y = 0; y < barTop; y++) {
    for (let x = 0; x < W; x++) {
      const i = at(x, y);
      if (d[i + 3] < 250) continue;
      if (RAY_FLATS.some((f) => Math.abs(d[i] - f[0]) <= 6 && Math.abs(d[i + 1] - f[1]) <= 6 && Math.abs(d[i + 2] - f[2]) <= 6)) {
        stack.push(x, y); seen[y * W + x] = 1;
      }
    }
  }

  let rayPx = 0;
  while (stack.length) {
    const y = stack.pop(), x = stack.pop();
    const i = at(x, y);
    const [, , l] = rgb2hsl(d[i], d[i + 1], d[i + 2]);
    const nl = Math.min(0.97, Math.max(0.03, ARCH.l + (l - RAY_BASE_L)));
    const [r, g, b] = hsl2rgb(ARCH.h, ARCH.s, nl);
    d[i] = r; d[i + 1] = g; d[i + 2] = b;
    rayPx++;

    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= barTop) continue;
      const k = ny * W + nx;
      if (seen[k]) continue;
      const j = at(nx, ny);
      if (d[j + 3] < 60) continue;
      const [nh, ns, nlz] = rgb2hsl(d[j], d[j + 1], d[j + 2]);
      if (!isPink(nh, ns) || nlz > RAY_MAX_L) continue;
      seen[k] = 1; stack.push(nx, ny);
    }
  }
  const retinted = barPx + rayPx;

  /* ---- 4. Re-cut the bar's bottom corners, anti-aliased ---------------
   * Everything outside the radius becomes transparent — which removes the
   * black wedge AND the black/pink blend along the arc in one pass. */
  let cleared = 0;
  if (radius > 0) {
    for (let y = H - radius - 1; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const inLeft = x < radius, inRight = x > W - 1 - radius;
        if (!inLeft && !inRight) continue;
        const cxx = inLeft ? radius : W - 1 - radius;
        const cyy = H - 1 - radius;
        if (y < cyy) continue;
        const dist = Math.hypot(x - cxx, y - cyy);
        const i = at(x, y);
        if (dist > radius) { if (d[i + 3]) cleared++; d[i + 3] = 0; }
        else if (dist > radius - 1.5) {
          d[i + 3] = Math.min(d[i + 3], Math.round(255 * (radius - dist) / 1.5));
        }
      }
    }
  }

  /* ---- 5. Sweep any remaining opaque near-black in the bar band -------- */
  let blackLeft = 0;
  for (let y = Math.max(0, barTop - 2); y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = at(x, y);
      if (d[i + 3] > 0 && d[i] < 26 && d[i + 1] < 26 && d[i + 2] < 26) { d[i + 3] = 0; blackLeft++; }
    }
  }

  fs.writeFileSync(file, PNG.sync.write(png));
  console.log(`${name.padEnd(10)} barTop=${barTop} radius=${radius} retinted=${retinted} cornerCleared=${cleared} blackSwept=${blackLeft}`);
}
console.log("\ndone");
