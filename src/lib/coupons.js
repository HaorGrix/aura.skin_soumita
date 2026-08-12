const COUPONS = {
  BLOOM5: {
    code: "BLOOM5",
    type: "flat",
    value: 5,
    label: "৳600 off your ritual",
    firstOrderOnly: true,
  },
  /* Milestone tiers. Tuned against the earn rates in data/reviews.js
     (1pt per ৳TAKA_PER_POINT spent + POINTS_PER_REVIEW per verified review),
     so every tier is reachable on both the spend and the review path.
     The old 50/100/200 tiers were NOT: points came only from reviews at 1pt
     each — one review per purchased product — so the top tier needed more
     distinct products than the catalog even holds. Keep them reachable. */
  SKN3: {
    code: "SKN3",
    type: "percent",
    value: 3,
    points: 25,
    reward: "3% discount coupon",
    short: "3% off",
  },
  SKN5: {
    code: "SKN5",
    type: "percent",
    value: 5,
    points: 60,
    reward: "5% discount coupon",
    short: "5% off",
  },
  SKN8FS: {
    code: "SKN8FS",
    type: "percent",
    value: 8,
    points: 120,
    freeShipping: true,
    reward: "Free shipping + 8% discount",
    short: "8% off + free shipping",
  },
};

// `MILESTONES` still drives the Rewards page's tier-progress display
// (PointsCard/TiersGrid in pages/Rewards.jsx, via UserContext) — that's a
// standalone "here's what you've earned" showcase, unrelated to checkout.
// Everything else that used to live here (validate(), findCoupon(),
// FIRST_ORDER_CODES, LOYALTY_BY_CODE, PROMOS) was the actual coupon
// apply/validate logic — fully replaced by the live RPCs in
// lib/api/coupons.js (validateCouponLive/listEligibleCoupons, backed by
// validate_coupon_preview()/list_eligible_coupons()) and removed here
// rather than left running in parallel showing whatever this hardcoded
// object happened to say, which is the exact bug that was just fixed.
export const MILESTONES = Object.values(COUPONS).filter((coupon) => coupon.points);

export function couponForPoints(points = 0) {
  return MILESTONES.filter((coupon) => points >= coupon.points);
}
