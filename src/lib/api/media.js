/* =================================================================== *
 * aura.skin — product image uploads (Supabase Storage)
 * -------------------------------------------------------------------
 * The single path for getting a product photo into Storage AND correctly
 * linked in the database. Whether it's called from the future admin panel
 * or anywhere else, every upload goes through here — so there is exactly
 * one place that can get the storage_path ↔ product_images mapping wrong.
 *
 * Security: this uses the regular (anon-key) client, so an upload/delete
 * only succeeds if the signed-in user's JWT satisfies the storage.objects
 * RLS policy (is_staff('admin')) AND the product_images table policy —
 * both enforced server-side. A non-staff session gets a rejected request,
 * not a client-side-only check.
 * =================================================================== */
import { supabase } from "./client.js";

const BUCKET = "product-images";

/** Resolve a stored path to its public URL. Shared by products.js so there
 *  is one place that knows how bucket → URL resolution works. */
export function publicImageUrl(storagePath) {
  if (!storagePath) return null;
  return supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

/**
 * Upload one image file for a product and record it in `product_images`.
 * Rolls back the uploaded file if the DB insert fails, so a partial failure
 * never leaves an orphaned file with no matching row.
 *
 * @param {string} productId - UUID of the product row.
 * @param {File}   file      - the image file (from an <input type="file">).
 * @param {{position?: number, alt?: string}} [opts]
 */
export async function uploadProductImage(productId, file, { position = 0, alt = "" } = {}) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `products/${productId}/${position}-${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "31536000", // 1 year — each path is unique/content-addressed, safe to cache hard
    upsert: false,
  });
  if (uploadError) return { data: null, error: uploadError };

  const { data, error } = await supabase
    .from("product_images")
    .insert({ product_id: productId, storage_path: path, alt, position })
    .select()
    .single();

  if (error) {
    // DB write failed after the file landed — remove it so Storage never
    // silently accumulates orphans with no corresponding row.
    await supabase.storage.from(BUCKET).remove([path]);
    return { data: null, error };
  }
  return { data, error: null };
}

/** Delete an image: removes the DB row first (so a dangling row can never
 *  point at a file that's already gone), then the Storage object. */
export async function deleteProductImage(imageRow) {
  const { error: dbError } = await supabase.from("product_images").delete().eq("id", imageRow.id);
  if (dbError) return { error: dbError };

  const { error: storageError } = await supabase.storage.from(BUCKET).remove([imageRow.storage_path]);
  return { error: storageError ?? null };
}
