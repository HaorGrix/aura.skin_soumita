/* Store-wide commerce config — single source for shipping/tax/promos. */
export const FREE_SHIPPING_THRESHOLD = 50; // USD
export const STANDARD_SHIPPING = 4.99;
export const EXPRESS_SHIPPING = 12.0;
export const TAX_RATE = 0; // mock store — taxes shown as included

/* Mock promo codes */
export const PROMOS = {
  BLOOM5: { type: "flat", value: 5,   label: "$5 off your ritual 🌸",       firstOrderOnly: true },
};

/* Codes restricted to shoppers with zero completed orders.
 * Derived from PROMOS so adding a future first-order code is a one-line change. */
export const FIRST_ORDER_CODES = new Set(
  Object.entries(PROMOS)
    .filter(([, p]) => p.firstOrderOnly)
    .map(([code]) => code)
);

// Loyalty codes are defined in src/data/reviews.js

export function applyPromo(code, subtotal) {
  const promo = PROMOS[code?.trim().toUpperCase()];
  if (!promo) return null;
  const amount =
    promo.type === "percent" ? (subtotal * promo.value) / 100 : Math.min(promo.value, subtotal);
  return { code: code.trim().toUpperCase(), ...promo, amount: Math.round(amount * 100) / 100 };
}
