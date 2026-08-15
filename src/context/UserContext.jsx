import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { pointsForOrder } from "../data/reviews.js";
import { MILESTONES, couponForPoints } from "../lib/rewards-config.js";
import { getVerifiedEmail, onVerifiedEmailChange, getMyPoints } from "../lib/api/customerAuth.js";
import { useStoreSettings } from "../lib/api/settings.js";

const UserContext = createContext(null);
const SESSION_KEY = "skinscript-session";
const STORE_KEY = "skinscript_users_store";

function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStore(store) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {}
}

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function couponsFor(points) {
  return couponForPoints(points);
}
export function nextMilestoneFor(points) {
  return MILESTONES.find((m) => points < m.points) ?? null;
}

export function UserProvider({ children }) {
  // Live value from /admin/settings — points_per_review — so every
  // customer-facing "+N pts" line (loyalty header, review toast, mock-login
  // award) always matches what submit_review() actually credits.
  const { pointsPerReview } = useStoreSettings();

  const [initialUserState] = useState(() => {
    const session = loadSession();
    const savedEmail = session?.email?.toLowerCase();
    const savedAuthed = session?.authed ?? false;
    const savedUser = savedAuthed && savedEmail ? loadStore()[savedEmail] : null;

    return {
      profile: savedUser?.profile ?? {},
      points: savedUser?.points ?? 0,
      myReviews: savedUser?.myReviews ?? [],
      reviewedIds: savedUser?.reviewedIds ?? [],
      orders: savedUser?.orders ?? [],
      usedCoupons: savedUser?.usedCoupons ?? [],
      authed: savedAuthed,
    };
  });

  const [profile, setProfile] = useState(() => initialUserState.profile);
  const [points, setPoints] = useState(() => initialUserState.points);
  const [myReviews, setMyReviews] = useState(() => initialUserState.myReviews);
  const [reviewedIds, setReviewedIds] = useState(() => initialUserState.reviewedIds);
  const [orders, setOrders] = useState(() => initialUserState.orders);
  const [usedCoupons, setUsedCoupons] = useState(() => initialUserState.usedCoupons);
  const [authed, setAuthed] = useState(() => initialUserState.authed);
  const [auth, setAuth] = useState({ open: false, mode: "login", onSuccess: null });
  // Purchased-product ids confirmed by a REAL magic-link-verified session
  // (components/account/OrdersTab.jsx, backed by 0029's RLS policy) —
  // additive to, and independent of, the mock `orders` array below. A
  // shopper who verified their real email but never went through the mock
  // login has an empty mock `orders`, so hasPurchased() would otherwise
  // wrongly say "no" for something they genuinely bought, and addReview()
  // would silently refuse to save the review it just showed a button for.
  const [verifiedPurchasedIds, setVerifiedPurchasedIds] = useState([]);

  // Real loyalty balance for a magic-link-verified session (0032's
  // get_my_points(), reading the actual `customers.points` column that
  // place_order()/submit_review() write to) — null means "no verified
  // session, fall back to the mock `points` below", never "zero".
  const [verifiedPoints, setVerifiedPoints] = useState(null);

  const refreshVerifiedPoints = useCallback(async () => {
    const email = await getVerifiedEmail();
    if (!email) { setVerifiedPoints(null); return null; }
    const fresh = await getMyPoints();
    setVerifiedPoints(fresh);
    return fresh;
  }, []);

  useEffect(() => {
    let cancelled = false;
    refreshVerifiedPoints();
    const unsubscribe = onVerifiedEmailChange((_email, event) => {
      // TOKEN_REFRESHED fires on every tab refocus for the SAME identity
      // (autoRefreshToken) — refetching points then is just two wasted
      // network calls, never a correctness issue (the balance is a
      // primitive, so an unchanged refetch doesn't cause a re-render
      // either way). Skipping it here is hygiene, not a fix for a bug.
      if (!cancelled && event !== "TOKEN_REFRESHED") refreshVerifiedPoints();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [refreshVerifiedPoints]);

  const openAuth = useCallback((mode = "login", onSuccess = null) => {
    setAuth({ open: true, mode, onSuccess });
  }, []);
  const closeAuth = useCallback(() => {
    setAuth((a) => ({ ...a, open: false, onSuccess: null }));
  }, []);

  const handleAuth = useCallback((email, name) => {
    const emailKey = email.toLowerCase();
    const currentStore = loadStore();
    const existingUser = currentStore[emailKey];

    if (existingUser) {
      setProfile(existingUser.profile);
      setPoints(existingUser.points);
      setMyReviews(existingUser.myReviews || []);
      setReviewedIds(existingUser.reviewedIds || []);
      setOrders(existingUser.orders || []);
      setUsedCoupons(existingUser.usedCoupons || []);
    } else {
      const newProfile = { email, name: name || email.split("@")[0] };
      setProfile(newProfile);
      setPoints(0);
      setMyReviews([]);
      setReviewedIds([]);
      setOrders([]);
      setUsedCoupons([]);
    }
    
    setAuthed(true);
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ email: emailKey, authed: true }));
    } catch {
      /* non-fatal */
    }
    window.dispatchEvent(new CustomEvent("auth_login", { detail: { email: emailKey } }));
  }, []);

  const login = useCallback(({ email, name } = {}) => {
    handleAuth(email, name);
  }, [handleAuth]);

  const signup = useCallback(({ name, email } = {}) => {
    handleAuth(email, name);
  }, [handleAuth]);

  const logout = useCallback(() => {
    const currentEmail = profile.email?.toLowerCase();
    window.dispatchEvent(new CustomEvent("auth_logout", { detail: { email: currentEmail } }));

    setAuthed(false);
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* non-fatal */
    }
    setProfile({});
    setPoints(0);
    setMyReviews([]);
    setReviewedIds([]);
    setOrders([]);
    setUsedCoupons([]);
  }, [profile.email]);

  const purchasedIds = useMemo(
    () => new Set([...orders.flatMap((o) => o.items), ...verifiedPurchasedIds]),
    [orders, verifiedPurchasedIds]
  );

  useEffect(() => {
    if (!authed || !profile.email) return;
    const emailKey = profile.email.toLowerCase();
    const currentStore = loadStore();
    currentStore[emailKey] = { points, myReviews, reviewedIds, profile, orders, usedCoupons };
    saveStore(currentStore);
  }, [points, myReviews, reviewedIds, profile, authed, orders, usedCoupons]);

  // The verified, real DB balance wins whenever it's known — it's the
  // authoritative number place_order()/submit_review() actually write.
  // The mock stays as the fallback for a shopper who's only ever used
  // the old localStorage login and never verified a real email.
  const displayPoints = verifiedPoints ?? points;

  const value = useMemo(() => {
    const hasPurchased = (id) => purchasedIds.has(id);
    const hasReviewed = (id) => reviewedIds.includes(id);

    return {
      id: authed ? `usr_${profile.email}` : null,
      initial: authed && profile.name ? profile.name.charAt(0).toUpperCase() : "",
      ...profile,
      authed,
      auth,
      openAuth,
      closeAuth,
      login,
      signup,
      logout,
      points: displayPoints,
      pointsPerReview,
      orders,
      myReviews,
      setVerifiedPurchasedIds,
      refreshVerifiedPoints,
      coupons: couponsFor(displayPoints),
      nextMilestone: nextMilestoneFor(displayPoints),
      milestones: MILESTONES,
      hasPurchased,
      hasReviewed,
      myReviewsFor: (productId) => myReviews.filter((r) => r.productId === productId),
      addReview: ({ productId, stars, title, body }) => {
        if (!hasPurchased(productId) || hasReviewed(productId)) return false;
        const review = {
          id: `usr-${productId}-${Date.now()}`,
          productId,
          name: `${profile.name} (You)`,
          stars,
          title: title.trim() || "Verified review",
          body: body.trim(),
          daysAgo: 0,
          verified: true,
          helpful: 0,
          hasPhoto: false,
          mine: true,
        };
        setMyReviews((prev) => [review, ...prev]);
        setReviewedIds((prev) => [...prev, productId]);
        setPoints((p) => p + pointsPerReview);
        return true;
      },
      updateProfile: (updates) => {
        // `email` keys the user store / cart / wishlist. Changing it here would
        // orphan the record (the session still points at the old key), so it is
        // never writable through this path.
        const { email: _ignored, ...safe } = updates ?? {};
        setProfile((prev) => ({ ...prev, ...safe }));
      },
      usedCoupons,
      markCouponUsed: (code) => {
        const normalized = code?.trim().toUpperCase();
        if (!normalized) return;
        setUsedCoupons((prev) => (prev.includes(normalized) ? prev : [...prev, normalized]));
      },
      addOrder: (orderData) => {
        const earned = pointsForOrder(orderData.total);
        const newOrder = {
          orderId: orderData.number,
          date: new Date().toISOString().split('T')[0],
          // No stored `status` — it's derived from `timestamp` via
          // lib/order-status.js. A stored value goes stale as time passes.
          items: orderData.itemIds || [],
          total: orderData.total,
          email: orderData.email,
          payMethod: orderData.payMethod,
          pointsEarned: earned,
          timestamp: new Date().toISOString(),
        };
        setOrders((prev) => [newOrder, ...prev]);
        // Purchases are the primary earn path — see the loyalty economy note
        // in data/reviews.js. Without this the milestone tiers are unreachable.
        if (earned > 0) setPoints((p) => p + earned);
        return earned;
      },
    };
  }, [displayPoints, pointsPerReview, myReviews, reviewedIds, orders, purchasedIds, profile, authed, auth, openAuth, closeAuth, login, signup, logout, usedCoupons, refreshVerifiedPoints]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within a <UserProvider>");
  return ctx;
}
