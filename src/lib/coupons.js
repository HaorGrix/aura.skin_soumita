const COUPONS = {
  BLOOM5: {
    code: "BLOOM5",
    type: "flat",
    value: 5,
    label: "৳600 off your ritual",
    firstOrderOnly: true,
  },
  AURA3: {
    code: "AURA3",
    type: "percent",
    value: 3,
    points: 50,
    reward: "3% discount coupon",
    short: "3% off",
  },
  AURA5: {
    code: "AURA5",
    type: "percent",
    value: 5,
    points: 100,
    reward: "5% discount coupon",
    short: "5% off",
  },
  AURA8FS: {
    code: "AURA8FS",
    type: "percent",
    value: 8,
    points: 200,
    freeShipping: true,
    reward: "Free shipping + 8% discount",
    short: "8% off + free shipping",
  },
};

export const PROMOS = COUPONS;

export const MILESTONES = Object.values(COUPONS).filter((coupon) => coupon.points);

export const FIRST_ORDER_CODES = new Set(
  Object.values(COUPONS)
    .filter((coupon) => coupon.firstOrderOnly)
    .map((coupon) => coupon.code)
);

export const LOYALTY_BY_CODE = Object.fromEntries(
  MILESTONES.map((coupon) => [coupon.code, coupon])
);

export function couponForPoints(points = 0) {
  return MILESTONES.filter((coupon) => points >= coupon.points);
}

export function findCoupon(code) {
  const normalized = code?.trim().toUpperCase();
  if (!normalized) return null;
  return COUPONS[normalized] ?? null;
}

function normalizeUser(user) {
  return {
    points: Number(user?.points ?? 0),
    orders: Array.isArray(user?.orders) ? user.orders : [],
    usedCoupons: Array.isArray(user?.usedCoupons)
      ? user.usedCoupons.map((c) => c?.trim().toUpperCase()).filter(Boolean)
      : [],
    coupons: Array.isArray(user?.coupons) ? user.coupons : [],
  };
}

export function validate(code, user = {}) {
  const normalized = code?.trim().toUpperCase();
  if (!normalized) return null;

  const coupon = findCoupon(normalized);
  if (!coupon) return null;

  const account = normalizeUser(user);
  if (account.usedCoupons.includes(normalized)) {
    return { success: false, alreadyUsed: true, coupon };
  }

  if (coupon.firstOrderOnly && account.orders.length > 0) {
    return { success: false, firstOrderOnly: true, coupon };
  }

  const unlockedByPoints = coupon.points ? account.points >= coupon.points : true;
  const unlockedByList = account.coupons.some((item) => item?.code?.trim().toUpperCase() === normalized);

  if (coupon.points && !unlockedByPoints && !unlockedByList) {
    return { success: false, notUnlocked: true, coupon };
  }

  return {
    success: true,
    code: normalized,
    label: coupon.label ?? coupon.reward ?? coupon.short ?? normalized,
    coupon,
  };
}
