/* Centralized money formatting — change CURRENCY in ONE place to re-denominate
 * the entire store (e.g. switch to BDT ৳). Keeps every price consistent. */
export const CURRENCY = { code: "BDT", symbol: "৳", locale: "en-BD", fractionDigits: 0 };
export const CONVERSION_RATE = 120; // 1 USD = 120 BDT

/**
 * Divisor that converts a database `*_minor` value (integer BDT paisa) into
 * the "USD-ish" float scale the cart, formatPrice() and PRICE_RANGES still
 * run on. The catalog migration stored `price_minor = usd_ish * 120 * 100`,
 * so 12000 is its exact inverse.
 *
 * This is a BRIDGE, not the destination. Every server figure must pass
 * through it before reaching formatPrice(), or the number renders 120×
 * wrong. Retiring it means moving the cart and every price display onto
 * integer paisa — a single deliberate refactor, not a drive-by change.
 * It lives here so there is exactly one definition of the conversion.
 */
export const MINOR_TO_LEGACY = CONVERSION_RATE * 100;
export const fromMinor = (minor) => (Number(minor) || 0) / MINOR_TO_LEGACY;

export function formatPrice(amount) {
  const n = Number(amount) || 0;
  const bdt = n * CONVERSION_RATE;
  return `${CURRENCY.symbol}${bdt.toFixed(CURRENCY.fractionDigits)}`;
}

export function discountPct(price, compareAt) {
  if (!compareAt || compareAt <= price) return 0;
  return Math.round((1 - price / compareAt) * 100);
}

/** Format a Supabase `*_minor` integer (BDT paisa) as a display price, e.g.
 *  199900 → "৳1999". This is the correct formatter for data coming from
 *  lib/api/products.js (priceMinor/compareAtMinor). `formatPrice` above is
 *  unrelated and stays untouched — it still serves the current static
 *  catalog (data/products.js) until that's migrated off. Do not mix the two:
 *  formatPrice(priceMinor) or formatPriceMinor(price) will both render a
 *  wrong number silently. */
export function formatPriceMinor(minor) {
  const n = Number(minor) || 0;
  return `${CURRENCY.symbol}${(n / 100).toFixed(CURRENCY.fractionDigits)}`;
}
