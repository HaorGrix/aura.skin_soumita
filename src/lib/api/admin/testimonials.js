/* =================================================================== *
 * skin.theory admin — testimonials (dual-mode: text quote or image)
 * -------------------------------------------------------------------
 * `testimonials` (0014_testimonials.sql) — RLS lets staff (editor+) see
 * every row; anon/authenticated only ever see is_featured = true rows
 * (enforced in Postgres, not just hidden by this UI).
 *
 * Images upload into the existing `site-media` bucket under a
 * testimonials/ prefix — no new bucket or storage policy needed; 0011
 * already allows JPEG/PNG up to 30MB for staff, comfortably covering this
 * feature's 2MB cap (enforced client-side, see MAX_IMAGE_BYTES).
 * =================================================================== */
import { supabase } from "../client.js";
import { publicUrl } from "../storage-url.js";

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB, per the admin's stated spec
export const RECOMMENDED_RATIO = 1300 / 500;     // ~2.6:1
export const IMAGE_ACCEPT = "image/jpeg,image/png";

export function testimonialImageUrl(path) {
  return publicUrl(path, "site-media");
}

export async function listTestimonials() {
  const { data, error } = await supabase
    .from("testimonials").select("*")
    .order("is_featured", { ascending: false })
    .order("type").order("rating", { ascending: false, nullsFirst: false })
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });
  return { data, error };
}

const FIELDS = [
  "type", "customer_name", "quote_text", "rating", "duration_label",
  "image_url", "is_featured", "priority",
];

/** Strip fields that don't belong to the chosen type before writing, so a
 *  leftover quote_text from switching type=image->text in the editor can
 *  never violate the testimonials_type_fields check constraint client-side
 *  — Postgres would reject it anyway, but this avoids that round trip. */
function pick(input) {
  const row = {};
  for (const k of FIELDS) if (input[k] !== undefined) row[k] = input[k];

  if (row.type === "text") {
    row.image_url = null;
  } else if (row.type === "image") {
    row.customer_name = null;
    row.quote_text = null;
    row.rating = null;
    row.duration_label = null;
  }
  return row;
}

export async function saveTestimonial(input) {
  const row = pick(input);
  const { data: userData } = await supabase.auth.getUser();
  row.updated_by = userData?.user?.id ?? null;

  if (input.id) {
    const { data, error } = await supabase
      .from("testimonials").update(row).eq("id", input.id).select().single();
    return { data, error };
  }
  const { data, error } = await supabase
    .from("testimonials").insert(row).select().single();
  return { data, error };
}

export async function deleteTestimonial(id, imagePath) {
  const { error } = await supabase.from("testimonials").delete().eq("id", id);
  if (error) return { error };
  // Best-effort: the row is already gone either way, so a storage failure
  // here shouldn't be reported as the delete having failed.
  if (imagePath) await supabase.storage.from("site-media").remove([imagePath]);
  return { error: null };
}

export async function uploadTestimonialImage(file) {
  if (file.size > MAX_IMAGE_BYTES) {
    return { path: null, error: { message: "Image must be under 2 MB." } };
  }
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `testimonials/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("site-media")
    .upload(path, file, { cacheControl: "31536000", upsert: false, contentType: file.type });
  if (error) return { path: null, error };
  return { path, error: null };
}
