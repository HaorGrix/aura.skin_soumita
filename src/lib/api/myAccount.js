/* =================================================================== *
 * skin.theory — the signed-in shopper's own orders, points and reviews
 * -------------------------------------------------------------------
 * Read from the server so the history follows the account to any device.
 * Row-level security returns only orders placed with the shopper's own
 * (confirmed) email — including guest orders placed before they had an
 * account. Points come from get_my_points(); reviews go through
 * submit_review(), which checks the order is theirs and delivered and
 * awards the review points on the server.
 * =================================================================== */
import { supabase } from "./client.js";
import { publicImageUrl } from "./media.js";
import { MINOR_TO_LEGACY, displaySize } from "../format.js";

const legacy = (minor) => (Number(minor) || 0) / MINOR_TO_LEGACY;

/** One server order → the shape the account pages and receipt already use. */
function mapOrder(o) {
  const lines = (o.order_items ?? []).map((it) => ({
    id: it.product_slug,
    orderItemId: it.id,
    name: it.product_name,
    brand: it.brand_name ?? "",
    size: displaySize(it.size_label),
    qty: it.quantity,
    price: legacy(it.unit_price_minor),
    image: it.image_path ? publicImageUrl(it.image_path) : null,
  }));
  return {
    orderId: o.number,
    date: o.placed_at?.slice(0, 10),
    timestamp: o.placed_at,
    status: o.status,
    items: lines.map((l) => l.id),
    total: legacy(o.total_minor),
    email: o.email,
    payMethod: o.payment_method,
    pointsEarned: o.points_earned ?? 0,
    lines,
    totals: {
      subtotal: legacy(o.subtotal_minor),
      discount: legacy(o.discount_minor),
      shipping: legacy(o.shipping_minor),
      tax: legacy(o.tax_minor),
      total: legacy(o.total_minor),
      couponCode: o.coupon_code ?? null,
    },
    address: o.shipping_address ?? null,
  };
}

/** @returns {Promise<{ data: object[]|null, error: object|null }>} newest first */
export async function listMyOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "number, status, placed_at, email, payment_method, points_earned, subtotal_minor, discount_minor, " +
      "shipping_minor, tax_minor, total_minor, coupon_code, shipping_address, " +
      "order_items(id, product_slug, product_name, brand_name, image_path, unit_price_minor, quantity, size_label)"
    )
    .order("placed_at", { ascending: false })
    .limit(100);
  if (error) return { data: null, error };
  return { data: data.map(mapOrder), error: null };
}

/** Order lines this shopper has already reviewed. */
export async function listMyReviewedItemIds() {
  const { data, error } = await supabase.from("reviews").select("order_item_id");
  if (error) return { data: null, error };
  return { data: data.map((r) => r.order_item_id).filter(Boolean), error: null };
}

/** @returns {Promise<{ data: number|null, error: object|null }>} */
export async function getMyPoints() {
  const { data, error } = await supabase.rpc("get_my_points");
  return { data: error ? null : Number(data) || 0, error };
}

const REVIEW_ERRORS = {
  NOT_DELIVERED: "You can review this once your order has been delivered.",
  ALREADY_REVIEWED: "You've already reviewed this item.",
  NOT_YOUR_ORDER: "This order belongs to a different account.",
  NOT_VERIFIED: "Please log in again to write a review.",
  INVALID_RATING: "Pick a star rating.",
  INVALID_BODY: "Write at least a few words (up to 3000 characters).",
  INVALID_TITLE: "The title is too long.",
  ORDER_ITEM_NOT_FOUND: "We couldn't find that order item.",
};

/** @returns {Promise<{ error: string|null }>} */
export async function submitMyReview({ orderItemId, stars, title, body }) {
  const { error } = await supabase.rpc("submit_review", {
    p_order_item_id: orderItemId,
    p_rating: stars,
    p_title: title?.trim() || null,
    p_body: body.trim(),
  });
  if (!error) return { error: null };
  const code = Object.keys(REVIEW_ERRORS).find((k) => String(error.message).includes(k));
  return { error: code ? REVIEW_ERRORS[code] : "Your review couldn't be sent. Please try again." };
}
