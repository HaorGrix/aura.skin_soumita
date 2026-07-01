import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { POINTS_PER_REVIEW, SEED_ORDERS } from "../data/reviews.js";
import { MILESTONES, couponForPoints } from "../lib/rewards-config.js";

const UserContext = createContext(null);
const SESSION_KEY = "aura-session";
const STORE_KEY = "aura_users_store";

const MOCK_USER = { id: null, initial: "" };
const DEFAULT_PROFILE = {};
const SEED_POINTS = 0;

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
    () => new Set(orders.flatMap((o) => o.items)),
    [orders]
  );

  useEffect(() => {
    if (!authed || !profile.email) return;
    const emailKey = profile.email.toLowerCase();
    const currentStore = loadStore();
    currentStore[emailKey] = { points, myReviews, reviewedIds, profile, orders, usedCoupons };
    saveStore(currentStore);
  }, [points, myReviews, reviewedIds, profile, authed, orders, usedCoupons]);

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
      points,
      orders,
      myReviews,
      coupons: couponsFor(points),
      nextMilestone: nextMilestoneFor(points),
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
        setPoints((p) => p + POINTS_PER_REVIEW);
        return true;
      },
      updateProfile: (updates) => {
        setProfile((prev) => ({ ...prev, ...updates }));
      },
      usedCoupons,
      markCouponUsed: (code) => {
        const normalized = code?.trim().toUpperCase();
        if (!normalized) return;
        setUsedCoupons((prev) => (prev.includes(normalized) ? prev : [...prev, normalized]));
      },
      addOrder: (orderData) => {
        const newOrder = {
          orderId: orderData.number,
          date: new Date().toISOString().split('T')[0],
          status: "Confirmed",
          items: orderData.itemIds || [],
          total: orderData.total,
          email: orderData.email,
          payMethod: orderData.payMethod,
          timestamp: new Date().toISOString(),
        };
        setOrders((prev) => [newOrder, ...prev]);
      },
    };
  }, [points, myReviews, reviewedIds, orders, purchasedIds, profile, authed, auth, openAuth, closeAuth, login, signup, logout, usedCoupons]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within a <UserProvider>");
  return ctx;
}
