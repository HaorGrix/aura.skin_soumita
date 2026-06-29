/* =================================================================== *
 * Local product image registry
 * -------------------------------------------------------------------
 * Bundles every image under /assests via Vite's import.meta.glob (eager),
 * so we can attach real photos to catalog products by filename. Vite
 * fingerprints them for long-term caching; missing keys simply return
 * undefined and the ProductCard falls back to its gradient.
 * =================================================================== */
const modules = import.meta.glob(
  [
    "../../assests/**/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP}",
    // Skip non-product assets (lookbooks, store photos, marketing) from bundling.
    "!../../assests/**/Gemini_*",
    "!../../assests/**/*logo*",
    "!../../assests/**/*LOGO*",
    "!../../assests/**/*_menu*",
    "!../../assests/**/*Main_Page*",
    "!../../assests/**/*bundle*",
    "!../../assests/**/*-set-*",
    "!../../assests/**/*-duo*",
    "!../../assests/**/*flyout*",
    "!../../assests/**/*KakaoTalk*",
    "!../../assests/**/*FLAGSHIP*",
    "!../../assests/**/*SKIN_TEST*",
    "!../../assests/**/*Untouched_Nature*",
    "!../../assests/**/SKINCARE*",
    "!../../assests/**/nav-*",
    "!../../assests/**/Img4*",
    "!../../assests/**/track.png",
    // Corrupt/truncated source file — would render broken in galleries.
    "!../../assests/**/*1213591265*",
    "!../../assests/**/*EssentialKit*",
    "!../../assests/**/*Routine*",
  ],
  { eager: true, import: "default" }
);

const byFile = {};
for (const [path, url] of Object.entries(modules)) {
  const file = path.split("/").pop();
  byFile[file] = url;
}

/** Resolve a bundled image URL by its (exact) file name. */
export function imageFor(file) {
  return byFile[file];
}

/**
 * Collect a product gallery by filename substring(s). All files whose name
 * contains any of the given keys are returned (sorted by filename so the
 * primary front shot comes first, followed by texture/ingredient/angle shots).
 * Keys should be specific enough not to collide between products.
 */
export function galleryFor(...keys) {
  if (!keys.length) return [];
  const files = Object.keys(byFile)
    .filter((f) => keys.some((k) => f.includes(k)))
    .sort();
  return files.map((f) => byFile[f]);
}

export const ALL_IMAGES = byFile;
