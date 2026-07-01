import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { MILESTONES, POINTS_PER_REVIEW, SEED_ORDERS } from "../data/reviews.js";

const UserContext = createContext(null);
const SESSION_KEY = "aura-session";
const STORE_KEY = "aura_users_store";

const MOCK_USER = { id: "usr_bd_8842", initial: "T" };
const DEFAULT_PROFILE = { name: "Tahsin", email: "tahsin@example.com", phone: "+1 (555) 123-4567", address: "123 Aura Street, Seoul, South Korea" };
const SEED_POINTS = 87;

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
  return MILESTONES.filter((m) => points >= m.points);
}
export function nextMilestoneFor(points) {
  return MILESTONES.find((m) => points < m.points) ?? null;
}

export function UserProvider({ children }) {
  const session = loadSession();
  const savedEmail = session?.email?.toLowerCase();
  const savedAuthed = session?.authed ?? false;
  
  const store = loadStore();
  const savedUserData = savedAuthed && savedEmail ? store[savedEmail] : null;

  const [profile, setProfile] = useState(savedUserData?.profile ?? DEFAULT_PROFILE);
  const [points, setPoints] = useState(savedUserData ? savedUserData.points : SEED_POINTS);
  const [myReviews, setMyReviews] = useState(savedUserData?.myReviews ?? []);
  const [reviewedIds, setReviewedIds] = useState(savedUserData?.reviewedIds ?? []);
  const [orders, setOrders] = useState(savedUserData ? savedUserData.orders : SEED_ORDERS);
  const [usedCoupons, setUsedCoupons] = useState(savedUserData?.usedCoupons ?? []);

  const [authed, setAuthed] = useState(savedAuthed);
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
      const newProfile = { ...DEFAULT_PROFILE, email, name: name || email.split("@")[0] };
      setProfile(newProfile);
      setPoints(0);
      setMyReviews([]);
      setReviewedIds([]);
      setOrders([]);
      setUsedCoupons([]);
    }
    
    setAuthed(true);
    localStorage.setItem(SESSION_KEY, JSON.stringify({ email: emailKey, authed: true }));
  }, []);

  const login = useCallback(({ email, name } = {}) => {
    handleAuth(email, name);
  }, [handleAuth]);

  const signup = useCallback(({ name, email } = {}) => {
    handleAuth(email, name);
  }, [handleAuth]);

  const logout = useCallback(() => {
    setAuthed(false);
    localStorage.removeItem(SESSION_KEY);
    setProfile(DEFAULT_PROFILE);
    setPoints(SEED_POINTS);
    setMyReviews([]);
    setReviewedIds([]);
    setOrders(SEED_ORDERS);
    setUsedCoupons([]);
  }, []);

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
      ...MOCK_USER,
      id: authed ? `usr_${profile.email}` : MOCK_USER.id,
      initial: authed ? profile.name.charAt(0).toUpperCase() : MOCK_USER.initial,
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
