/* Centralized money formatting — change CURRENCY in ONE place to re-denominate
 * the entire store (e.g. switch to BDT ৳). Keeps every price consistent. */
export const CURRENCY = { code: "BDT", symbol: "৳", locale: "en-BD", fractionDigits: 0 };
export const CONVERSION_RATE = 120; // 1 USD = 120 BDT

export function formatPrice(amount) {
  const n = Number(amount) || 0;
  const bdt = n * CONVERSION_RATE;
  return `${CURRENCY.symbol}${bdt.toFixed(CURRENCY.fractionDigits)}`;
}

export function discountPct(price, compareAt) {
  if (!compareAt || compareAt <= price) return 0;
  return Math.round((1 - price / compareAt) * 100);
}
