/* =================================================================== *
 * skin.script — storefront checkout
 * -------------------------------------------------------------------
 * Wraps the place_order() RPC, which is the ONLY way an order is created.
 * Direct inserts into `orders` are denied by RLS, so there is no second
 * path that could skip the stock check or recompute money differently.
 *
 * The client sends product references and quantities — nothing else about
 * money. Prices, discount, shipping, tax and the total all come back
 * computed from the database, so a tampered cart cannot change what is
 * charged or what is stored.
 * =================================================================== */
import { supabase } from "./client.js";
// Single definition of the paisa → legacy-float bridge (see its note there).
import { fromMinor as toLegacyAmount } from "../format.js";

export { toLegacyAmount };

/**
 * Turn a Postgres exception from place_order() into something a shopper can
 * act on. The RPC raises `CODE:arg1:arg2`; anything unrecognised falls back
 * to a neutral message rather than leaking SQL at the customer.
 */
export function checkoutErrorMessage(error, { productName } = {}) {
  const raw = error?.message ?? "";
  const [code, ...args] = raw.split(":");
  const name = productName ?? args[0] ?? "An item";

  switch (code) {
    case "EMPTY_CART":
      return "Your bag is empty.";
    case "EMAIL_REQUIRED":
      return "We need an email address to send your confirmation.";
    case "PRODUCT_NOT_FOUND":
    case "VARIANT_NOT_FOUND":
      return "Something in your bag is no longer available. Please remove it and try again.";
    case "PRODUCT_UNAVAILABLE":
      return `${name} is no longer on sale. Please remove it from your bag.`;
    case "INSUFFICIENT_STOCK":
      return args[1] === "0"
        ? `${name} just sold out.`
        : `Only ${args[1]} of ${name} left — please reduce the quantity.`;
    case "MAX_PER_ORDER":
      return `You can order at most ${args[1]} of ${name} at a time.`;
    case "COUPON_INVALID":
      return {
        unknown: "That coupon code doesn't exist.",
        inactive: "That coupon is no longer active.",
        not_started: "That coupon isn't valid yet.",
        expired: "That coupon has expired.",
        min_subtotal: "Your order isn't large enough for that coupon.",
        exhausted: "That coupon has been fully claimed.",
        first_order_only: "That coupon is only valid on a first order.",
        already_used: "You've already used that coupon.",
      }[args[0]] ?? "That coupon can't be used on this order.";
    default:
      if (/duplicate key/i.test(raw)) return "That order was already placed.";
      if (/fetch|network/i.test(raw)) return "We couldn't reach the server. Check your connection and try again.";
      return "We couldn't complete your order. Please try again.";
  }
}

/**
 * Place an order.
 *
 * @param {object}   input
 * @param {string}   input.email
 * @param {Array}    input.items            cart lines — `{ id, qty }`
 * @param {object}   input.shippingAddress
 * @param {string}   input.paymentMethod    'cod' | 'card' | 'bkash'
 * @param {string}   [input.shippingMethod] 'standard' | 'express'
 * @param {string}   [input.couponCode]
 * @returns {{ data: object|null, error: Error|null }}
 */
export async function placeOrder({
  email, items, shippingAddress, paymentMethod,
  shippingMethod = "standard", couponCode = null,
}) {
  // A line with a variantId (picked on the PDP's size selector) sends that
  // exact variant — place_order() locks, prices and decrements THAT row.
  // A line without one (quick-add from a grid/wishlist, which never shows a
  // size picker) sends the product reference alone; place_order() resolves
  // it to that product's default variant server-side. Either way, cart,
  // checkout and the order record all end up referencing a real variant —
  // never just "the product" with an ambiguous price.
  const payloadItems = (items ?? []).map((i) =>
    i.variantId
      ? { variant_id: i.variantId, quantity: Math.max(1, Number(i.qty) || 1) }
      : { slug: i.slug ?? i.id, quantity: Math.max(1, Number(i.qty) || 1) }
  );

  const { data, error } = await supabase.rpc("place_order", {
    payload: {
      email: (email ?? "").trim().toLowerCase(),
      items: payloadItems,
      shipping_address: shippingAddress ?? {},
      payment_method: paymentMethod ?? "cod",
      shipping_method: shippingMethod,
      coupon_code: couponCode || null,
    },
  });

  if (error) return { data: null, error };

  // The RPC returns the orders row (PostgREST may wrap it in an array).
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { data: null, error: new Error("NO_ORDER_RETURNED") };

  return {
    data: {
      id: row.id,
      number: row.number,
      email: row.email,
      status: row.status,
      payMethod: row.payment_method,
      couponCode: row.coupon_code,
      timestamp: row.placed_at,
      // Authoritative server figures, bridged to the cart's display scale.
      subtotal: toLegacyAmount(row.subtotal_minor),
      discount: toLegacyAmount(row.discount_minor),
      shipping: toLegacyAmount(row.shipping_minor),
      tax: toLegacyAmount(row.tax_minor),
      total: toLegacyAmount(row.total_minor),
      totalMinor: row.total_minor,
      raw: row,
    },
    error: null,
  };
}
