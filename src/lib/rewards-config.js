// Only the Rewards page's tier-progress display still needs these — actual
// coupon apply/validate is live now (lib/api/coupons.js, backed by
// validate_coupon_preview()/list_eligible_coupons() RPCs). The rest of
// this module's old exports (FIRST_ORDER_CODES, LOYALTY_BY_CODE, PROMOS,
// findCoupon, validate) had zero remaining consumers once PromoHint and
// CartContext.applyPromo moved to live data, and were removed rather than
// left running in parallel with it.
export { MILESTONES, couponForPoints } from "./coupons.js";
