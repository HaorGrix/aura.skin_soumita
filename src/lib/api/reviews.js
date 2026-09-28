/* =================================================================== *
 * skin.theory — published product reviews (read-only)
 * -------------------------------------------------------------------
 * listApprovedReviews() reads the public-safe `reviews_public` view,
 * which never exposes a reviewer's email.
 * =================================================================== */
import { supabase } from "./client.js";

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
