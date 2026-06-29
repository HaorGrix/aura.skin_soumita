/* Centralized money formatting — change CURRENCY in ONE place to re-denominate
 * the entire store (e.g. switch to BDT ৳). Keeps every price consistent. */
export const CURRENCY = { code: "USD", symbol: "$", locale: "en-US", fractionDigits: 2 };

export function formatPrice(amount) {
  const n = Number(amount) || 0;
  return `${CURRENCY.symbol}${n.toFixed(CURRENCY.fractionDigits)}`;
}

export function discountPct(price, compareAt) {
  if (!compareAt || compareAt <= price) return 0;
  return Math.round((1 - price / compareAt) * 100);
}
