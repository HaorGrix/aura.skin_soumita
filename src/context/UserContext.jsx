import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { MILESTONES, POINTS_PER_REVIEW, SEED_ORDERS } from "../data/reviews.js";

/**
 * UserContext — the mock signed-in shopper: loyalty points, order history,
 * and the reviews they've written. One hook (`useUser`) powers the navbar
 * points pill, the Account page, the PDP "verified review" gating, and the
 * public review list (their reviews appear instantly after submitting).
 *
 * Designed to scale: points/reviews are derived + persisted; swapping the
 * seed for a real API (per real user id) is a drop-in change.
 */
const UserContext = createContext(null);
const STORAGE_KEY = "aura-user";

const MOCK_USER = { id: "usr_bd_8842", initial: "T" };
const DEFAULT_PROFILE = { name: "Tahsin", email: "tahsin@example.com", phone: "+1 (555) 123-4567", address: "123 Aura Street, Seoul, South Korea" };
const SEED_POINTS = 87; // lifetime points already earned

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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
  const saved = load();
  const [points, setPoints] = useState(saved?.points ?? SEED_POINTS);
  const [myReviews, setMyReviews] = useState(saved?.myReviews ?? []);
  const [reviewedIds, setReviewedIds] = useState(saved?.reviewedIds ?? []);

  const [profile, setProfile] = useState(saved?.profile ?? DEFAULT_PROFILE);

  // —— Auth —— browsing is open to everyone; this only gates checkout.
  // `authed` persists so a returning shopper stays signed in. The modal
  // state (open/mode/onSuccess) is ephemeral UI, controlled from anywhere
  // via openAuth()/closeAuth() so the navbar and checkout can share one flow.
  const [authed, setAuthed] = useState(saved?.authed ?? false);
  const [auth, setAuth] = useState({ open: false, mode: "login", onSuccess: null });

  const openAuth = useCallback((mode = "login", onSuccess = null) => {
    setAuth({ open: true, mode, onSuccess });
  }, []);
  const closeAuth = useCallback(() => {
    setAuth((a) => ({ ...a, open: false, onSuccess: null }));
  }, []);

  const login = useCallback(({ email, name } = {}) => {
    setAuthed(true);
    setProfile((p) => ({ ...p, email: email || p.email, name: name || p.name }));
  }, []);
  const signup = useCallback(({ name, email } = {}) => {
    setAuthed(true);
    setProfile((p) => ({ ...p, name: name || p.name, email: email || p.email }));
  }, []);
  const logout = useCallback(() => setAuthed(false), []);

  // Order history is static seed data (a real app would fetch it per user).
  const orders = SEED_ORDERS;
  const purchasedIds = useMemo(
    () => new Set(orders.flatMap((o) => o.items)),
    [orders]
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ points, myReviews, reviewedIds, profile, authed }));
    } catch {
      /* non-fatal */
    }
  }, [points, myReviews, reviewedIds, profile, authed]);

  const value = useMemo(() => {
    const hasPurchased = (id) => purchasedIds.has(id);
    const hasReviewed = (id) => reviewedIds.includes(id);

    return {
      ...MOCK_USER,
      ...profile,
      // Auth surface
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
      // Reviews this user wrote for a given product (shown publicly on the PDP).
      myReviewsFor: (productId) => myReviews.filter((r) => r.productId === productId),
      // Verified review → publishes the review + awards a point. No double-dipping.
      addReview: ({ productId, stars, title, body }) => {
        if (!hasPurchased(productId) || hasReviewed(productId)) return false;
        const review = {
          id: `usr-${productId}-${Date.now()}`,
          productId,
          name: `${MOCK_USER.name} (You)`,
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
    };
  }, [points, myReviews, reviewedIds, orders, purchasedIds, profile, authed, auth, openAuth, closeAuth, login, signup, logout]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within a <UserProvider>");
  return ctx;
}
