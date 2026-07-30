/* =================================================================== *
 * skin.script — Supabase Storage public URL builder (SDK-free)
 * -------------------------------------------------------------------
 * Deliberately does NOT import @supabase/supabase-js. A public object URL is
 * a deterministic string, so resolving one shouldn't drag a ~200 kB SDK into
 * whatever bundle the caller lives in — which is exactly what happened when
 * the homepage hero started reading its image path from the CMS.
 *
 * Kept byte-identical to what `supabase.storage.from(b).getPublicUrl(p)`
 * produces, including the encoding: paths in this project contain spaces
 * (e.g. "beautyof josen/…"), and the space must become %20. encodeURI is the
 * right tool — it escapes spaces while leaving the "/" separators alone,
 * which encodeURIComponent would destroy.
 * =================================================================== */

const BASE = import.meta.env.VITE_SUPABASE_URL;
export const DEFAULT_BUCKET = "product-images";

export function publicUrl(storagePath, bucket = DEFAULT_BUCKET) {
  if (!storagePath || !BASE) return null;
  return `${BASE}/storage/v1/object/public/${bucket}/${encodeURI(storagePath)}`;
}
