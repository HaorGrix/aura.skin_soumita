/* Store-wide commerce config — single source for shipping/tax/promos. */
export const FREE_SHIPPING_THRESHOLD = 50; // USD -> BDT via formatter
export const STANDARD_SHIPPING = 100 / 120;
export const TAX_RATE = 0; // mock store — taxes shown as included

/* Coupon validation + discount math live in CartContext.applyPromo (backed by
   lib/coupons.js). A second implementation here was unused and drifting — one
   source of truth only. */
