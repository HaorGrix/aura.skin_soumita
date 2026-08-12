/* =================================================================== *
 * skin.theory — real, verified-purchase reviews
 * -------------------------------------------------------------------
 * submitVerifiedReview() is the ONLY write path (calls submit_review(),
 * a SECURITY DEFINER RPC — see 0031_reviews_table.sql for why the
 * ownership/delivery/points logic can't live in a plain client insert).
 * listApprovedReviews() reads the public-safe `reviews_public` view,
 * which never exposes a reviewer's email.
 * =================================================================== */
import { supabase } from "./client.js";

/** Turn submit_review()'s raised exceptions into shopper-facing copy. */
export function reviewErrorMessage(error) {
  const code = (error?.message ?? "").split(":")[0].trim();
  switch (code) {
    case "NOT_VERIFIED":
      return "Please verify your email first.";
    case "NOT_YOUR_ORDER":
      return "That order doesn't belong to this verified email.";
    case "NOT_DELIVERED":
      return "You can review this once your order is marked delivered.";
    case "ALREADY_REVIEWED":
      return "You've already reviewed this purchase.";
    case "INVALID_RATING":
      return "Please choose a star rating.";
    case "INVALID_BODY":
      return "Please write a few more words.";
    default:
      return "Couldn't publish your review. Please try again.";
  }
}

/**
 * @param {string} orderItemId
 * @param {{ rating: number, title?: string, body: string }} input
 */
export async function submitVerifiedReview(orderItemId, { rating, title, body }) {
  const { data, error } = await supabase.rpc("submit_review", {
    p_order_item_id: orderItemId,
    p_rating: rating,
    p_title: title || null,
    p_body: body,
  });
  if (error) return { data: null, error };
  const row = Array.isArray(data) ? data[0] : data;
  return { data: row, error: null };
}

/** Which of the CURRENT verified session's own order_items already have a
 *  review — powers the "Reviewed" vs "Review" button in OrdersTab.
 *  Reads the reviews_own_read RLS policy (0031); never sees another
 *  identity's rows. */
export async function listMyReviewedOrderItemIds() {
  const { data, error } = await supabase.from("reviews").select("order_item_id");
  if (error) return { data: [], error };
  return { data: (data ?? []).map((r) => r.order_item_id), error: null };
}

/** Public, approved reviews for one product (by its storefront slug). */
export async function listApprovedReviews(productSlug) {
  const { data, error } = await supabase
    .from("reviews_public")
    .select("id, rating, title, body, display_name, created_at")
    .eq("product_slug", productSlug)
    .order("created_at", { ascending: false });

  if (error) return { data: [], error };

  const now = Date.now();
  return {
    data: (data ?? []).map((r) => ({
      id: r.id,
      name: r.display_name,
      title: r.title ?? "",
      body: r.body,
      stars: r.rating,
      daysAgo: Math.max(0, Math.floor((now - new Date(r.created_at).getTime()) / 86_400_000)),
      verified: true,
      helpful: 0,
      hasPhoto: false,
    })),
    error: null,
  };
}
