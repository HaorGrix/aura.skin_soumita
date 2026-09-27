/* =================================================================== *
 * skin.theory — client-side image compression for every admin upload
 * -------------------------------------------------------------------
 * Phone photos and exported product shots arrive at 2–10 MB and 3000–
 * 6000 px, while the storefront never renders an image wider than
 * ~1200 CSS px (2× that on retina). Uploading them as-is is what made
 * product and banner images the heaviest part of every page.
 *
 * compressImage() downsizes to `maxDimension` on the longest side and
 * re-encodes to WebP (both Storage buckets allow image/webp). It returns
 * the ORIGINAL file untouched whenever compressing wouldn't help: formats
 * a canvas can't faithfully re-encode (GIF/SVG), a browser that can't
 * encode WebP (it silently hands back PNG instead), or a result that
 * isn't actually smaller. So callers can run it unconditionally.
 * =================================================================== */

export const DEFAULT_MAX_DIMENSION = 2000;
// Banners are shown up to 1202 CSS px wide (see MediaField's size guide),
// so 2400 px keeps them sharp at 2× pixel density.
export const BANNER_MAX_DIMENSION = 2400;
const QUALITY = 0.82;
const COMPRESSIBLE = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

async function decode(file) {
  // `from-image` applies EXIF orientation, so portrait phone shots don't
  // come out sideways once the EXIF block is dropped by re-encoding.
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file, { imageOrientation: "from-image" });
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function encode(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Image encoding failed."))),
      type,
      quality,
    );
  });
}

/**
 * @param {File} file
 * @param {{ maxDimension?: number }} [opts]
 * @returns {Promise<File>} a smaller .webp File, or `file` itself.
 */
export async function compressImage(file, { maxDimension = DEFAULT_MAX_DIMENSION } = {}) {
  if (!COMPRESSIBLE.has(file.type)) return file;

  const source = await decode(file);
  const width = source.width;
  const height = source.height;
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  if (typeof source.close === "function") source.close();

  const blob = await encode(canvas, "image/webp", QUALITY);
  if (blob.type !== "image/webp" || blob.size >= file.size) return file;

  const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
  return new File([blob], name, { type: "image/webp", lastModified: Date.now() });
}

/** compressImage() for callers that must never fail an upload because of
 *  compression: a file the browser can't decode is uploaded as-is and the
 *  server-side bucket rules still decide whether it's accepted. */
export async function compressImageSafe(file, opts) {
  try {
    return await compressImage(file, opts);
  } catch (err) {
    console.warn("[image-compress] uploading original, compression failed:", err);
    return file;
  }
}
