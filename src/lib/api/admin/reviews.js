/* =================================================================== *
 * skin.theory admin — product reviews (Admin → Reviews)
 * -------------------------------------------------------------------
 * Reviews come from verified buyers through submit_review() and publish
 * immediately. Staff can list them and hide (rejected) or re-publish
 * (approved) one — 0069_reviews_staff_moderation.sql. The product's star
 * rating is recounted by the review-stats trigger on every change.
 * =================================================================== */
import { supabase } from "../client.js";

/** Newest first, with the product each review is about. */
export async function listReviews({ status = "", page = 0, pageSize = 25 } = {}) {
  let q = supabase
    .from("reviews")
    .select("id, rating, title, body, display_name, email, status, created_at, product:products(name, brand, slug)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1);
  if (status) q = q.eq("status", status);
  const { data, error, count } = await q;
  return { data, error, count };
}

/** status: 'approved' (shown) | 'rejected' (hidden) */
export async function setReviewStatus(id, status) {
  const { error } = await supabase.from("reviews").update({ status }).eq("id", id);
  return { error };
}
