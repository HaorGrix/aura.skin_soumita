/* =================================================================== *
 * skin.script — product image uploads (Supabase Storage)
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
import { DEFAULT_BUCKET, publicUrl } from "./storage-url.js";

const BUCKET = DEFAULT_BUCKET;

/** Resolve a stored path to its public URL. Shared by products.js so there
 *  is one place that knows how bucket → URL resolution works.
 *
 *  Delegates to the SDK-free builder in storage-url.js: read-only callers
 *  (the CMS on the homepage hero) can import that directly and skip pulling
 *  @supabase/supabase-js into the initial bundle. Same output either way. */
export function publicImageUrl(storagePath) {
  return publicUrl(storagePath, BUCKET);
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

/**
 * Persist a full drag-to-reorder: `orderedIds` is every image id for a
 * product, in its new display order.
 *
 * `position` is unique per product, so writing final positions directly can
 * collide mid-transaction (row A wants row B's current position before B has
 * moved off it). Two passes avoid that: park every row at a negative,
 * definitely-unused position first, then assign the real final positions —
 * the same trick the adjacent-swap `move()` in ImageManager already used,
 * just generalised from 2 rows to N.
 *
 * Not atomic (no multi-statement RPC exists for this), so a failure mid-way
 * can leave rows on temporary negative positions. That's self-healing on the
 * next reorder — callers additionally re-fetch after calling this, so a
 * failure surfaces as "order didn't change" rather than a broken UI state.
 */
export async function reorderProductImages(orderedIds) {
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase.from("product_images").update({ position: -(i + 1) }).eq("id", orderedIds[i]);
    if (error) return { error };
  }
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase.from("product_images").update({ position: i }).eq("id", orderedIds[i]);
    if (error) return { error };
  }
  return { error: null };
}

/* =================================================================== *
 * Product video — one optional video per product (0023_product_video.sql).
 * Stored in the existing `site-media` bucket (0011), not `product-images`:
 * that bucket already exists for exactly this kind of one-off admin-
 * uploaded media (hero carousel, testimonials), and its admin-only write
 * policy already matches what a product video needs.
 * =================================================================== */
const VIDEO_BUCKET = "site-media";

export function publicVideoUrl(storagePath) {
  return publicUrl(storagePath, VIDEO_BUCKET);
}

/** Upload a product's video and point `products.video_url` at it in one
 *  call. Same rollback discipline as uploadProductImage: if the DB write
 *  fails, the just-uploaded file is removed rather than left orphaned. A
 *  product has at most one video, so this always overwrites — the caller
 *  (VideoField) is responsible for deleting the OLD storage object first
 *  when replacing one that already exists. */
export async function uploadProductVideo(productId, file) {
  const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
  const path = `products/${productId}/video-${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from(VIDEO_BUCKET).upload(path, file, {
    cacheControl: "31536000",
    upsert: false,
  });
  if (uploadError) return { path: null, error: uploadError };

  const { error } = await supabase.from("products").update({ video_url: path }).eq("id", productId);
  if (error) {
    await supabase.storage.from(VIDEO_BUCKET).remove([path]);
    return { path: null, error };
  }
  return { path, error: null };
}

/** Remove a product's video: null the column first (so a dangling row can
 *  never point at a file that's already gone, same ordering rule as
 *  deleteProductImage), then the Storage object. */
export async function deleteProductVideo(productId, storagePath) {
  const { error: dbError } = await supabase.from("products").update({ video_url: null }).eq("id", productId);
  if (dbError) return { error: dbError };

  const { error: storageError } = await supabase.storage.from(VIDEO_BUCKET).remove([storagePath]);
  return { error: storageError ?? null };
}
