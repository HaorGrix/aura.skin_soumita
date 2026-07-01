/* Store-wide commerce config — single source for shipping/tax/promos. */
export const FREE_SHIPPING_THRESHOLD = 50; // USD -> BDT via formatter
export const STANDARD_SHIPPING = 100 / 120;
export const EXPRESS_SHIPPING = 150 / 120;
export const TAX_RATE = 0; // mock store — taxes shown as included

import { findCoupon, validate } from "./coupons.js";

export function applyPromo(code, subtotal = 0, user = {}) {
  const result = validate(code, user);
  if (!result?.success) return null;
  const promo = findCoupon(result.code);
  const amount =
    promo.type === "percent" ? (subtotal * promo.value) / 100 : Math.min(promo.value, subtotal);
  return { code: result.code, ...promo, amount: Math.round(amount * 100) / 100 };
}
