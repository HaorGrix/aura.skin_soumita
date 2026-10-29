/* =================================================================== *
 * skin.theory — resized photos
 * -------------------------------------------------------------------
 * Product photos are uploaded at full size (avg ~350 KB, some 3 MB+). A
 * card shows them a few hundred pixels wide, so sending the original wastes
 * most of the bytes — and the shop is served from Finland to Bangladesh.
 * Supabase Storage resizes on the fly (imgproxy) at /render/image/, and the
 * server caches every resized copy, so this is cheap after the first view.
 *
 * Only our own Storage URLs are rewritten; anything else (bundled assets,
 * data: URLs, external images) is returned unchanged.
 * =================================================================== */

const MARK = "/storage/v1/object/public/";

/** URL of `url` resized to `width` px wide (aspect kept, never enlarged). */
export function sizedImage(url, width, quality = 75) {
  if (!url || typeof url !== "string" || !url.includes(MARK)) return url;
  const resized = url.replace(MARK, "/storage/v1/render/image/public/");
  return `${resized}${resized.includes("?") ? "&" : "?"}width=${width}&quality=${quality}`;
}

/** srcset for responsive <img>: the browser picks the size it needs. */
export function imageSrcSet(url, widths) {
  if (!url || typeof url !== "string" || !url.includes(MARK)) return undefined;
  return widths.map((w) => `${sizedImage(url, w)} ${w}w`).join(", ");
}
