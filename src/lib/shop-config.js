/* Store-wide commerce config — single source for shipping/tax/promos. */
export const FREE_SHIPPING_THRESHOLD = 50; // USD
export const STANDARD_SHIPPING = 4.99;
export const EXPRESS_SHIPPING = 12.0;
export const TAX_RATE = 0; // mock store — taxes shown as included

/* Mock promo codes */
export const PROMOS = {
  GLOW10: { type: "percent", value: 10, label: "10% off — welcome glow ✨" },
  BLOOM5: { type: "flat", value: 5, label: "$5 off your ritual 🌸" },
};

export function applyPromo(code, subtotal) {
  const promo = PROMOS[code?.trim().toUpperCase()];
  if (!promo) return null;
  const amount =
    promo.type === "percent" ? (subtotal * promo.value) / 100 : Math.min(promo.value, subtotal);
  return { code: code.trim().toUpperCase(), ...promo, amount: Math.round(amount * 100) / 100 };
}
