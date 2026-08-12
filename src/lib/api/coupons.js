/* =================================================================== *
 * skin.theory — storefront coupon validation (live, not bundled)
 * -------------------------------------------------------------------
 * The single call that replaced lib/coupons.js's hardcoded `validate()`
 * as the actual apply-time check (see 0030_validate_coupon_rpc.sql for
 * why this is an RPC and not a direct table read — coupons is
 * deliberately locked down, 0015_lock_down_coupons_table.sql).
 *
 * Mirrors what place_order() itself checks, so the cart/checkout preview
 * agrees with what will actually be charged — but place_order() remains
 * the sole authority; this is a preview, not a second source of truth.
 * =================================================================== */
import { supabase } from "./client.js";

/**
 * @param {string} code
 * @param {{subtotalMinor?: number, email?: string}} [ctx]
 * @returns {Promise<{valid:boolean, reason:string|null, code:string,
 *   kind:string, valuePercent:number|null, valueMinor:number|null,
 *   maxDiscountMinor:number|null, alsoFreeShipping:boolean,
 *   minSubtotalMinor:number, firstOrderOnly:boolean,
 *   requiredPoints:number|null} | null>} null only on a real request
 *   failure (network/RPC error) — an unknown/invalid code still resolves
 *   normally with `valid: false`.
 */
export async function validateCouponLive(code, { subtotalMinor = 0, email = null } = {}) {
  const { data, error } = await supabase.rpc("validate_coupon_preview", {
    p_code: code,
    p_subtotal_minor: Math.round(subtotalMinor),
    p_email: email || null,
  });
  if (error || !data?.length) return null;

  const row = data[0];
  return {
    valid: row.valid,
    reason: row.reason,
    code: row.code,
    kind: row.kind,
    valuePercent: row.value_percent,
    valueMinor: row.value_minor,
    maxDiscountMinor: row.max_discount_minor,
    alsoFreeShipping: !!row.also_free_shipping,
    minSubtotalMinor: row.min_subtotal_minor ?? 0,
    firstOrderOnly: !!row.first_order_only,
    requiredPoints: row.required_points,
  };
}

/**
 * Every currently active, eligible coupon for this cart — the live
 * replacement for the old static FIRST_ORDER_CODES/loyalty-list hint
 * (0034_list_eligible_coupons_rpc.sql). Same live-data guarantee as
 * validateCouponLive: an admin edit shows up here immediately.
 *
 * @param {{subtotalMinor?: number, email?: string}} [ctx]
 * @returns {Promise<Array<{code, kind, valuePercent, valueMinor,
 *   maxDiscountMinor, alsoFreeShipping, minSubtotalMinor,
 *   firstOrderOnly, requiredPoints}>>} empty array on a request failure —
 *   this is a nice-to-have list, never something worth breaking the page
 *   over, so callers don't need to special-case null vs [].
 */
export async function listEligibleCoupons({ subtotalMinor = 0, email = null } = {}) {
  const { data, error } = await supabase.rpc("list_eligible_coupons", {
    p_subtotal_minor: Math.round(subtotalMinor),
    p_email: email || null,
  });
  if (error || !data) return [];

  return data.map((row) => ({
    code: row.code,
    kind: row.kind,
    valuePercent: row.value_percent,
    valueMinor: row.value_minor,
    maxDiscountMinor: row.max_discount_minor,
    alsoFreeShipping: !!row.also_free_shipping,
    minSubtotalMinor: row.min_subtotal_minor ?? 0,
    firstOrderOnly: !!row.first_order_only,
    requiredPoints: row.required_points,
  }));
}
