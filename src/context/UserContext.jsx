import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { pointsForPurchase, useRewards } from "../lib/api/rewards.js";
import { signInCustomer, signOutCustomer, signUpCustomer, watchSession } from "../lib/api/customerAuth.js";

const UserContext = createContext(null);
// Old browser-only "session" from before real accounts; removed on load.
const LEGACY_SESSION_KEY = "skinscript-session";
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

export function UserProvider({ children }) {
  // Live value from /admin/settings — points_per_review — so every
  // customer-facing "+N pts" line (loyalty header, review toast) matches the
  // store's configured award.
  // The rewards programme as set in Admin → Rewards (tiers, rates, on/off).
  const rewards = useRewards();
  const { pointsPerReview } = rewards;

  // Signed-in state comes only from a real Supabase session (watchSession
  // below); nothing in localStorage can make someone "logged in".
  const [profile, setProfile] = useState({});
  const [points, setPoints] = useState(0);
  const [myReviews, setMyReviews] = useState([]);
  const [reviewedIds, setReviewedIds] = useState([]);
  const [orders, setOrders] = useState([]);
  const [usedCoupons, setUsedCoupons] = useState([]);
  const [authed, setAuthed] = useState(false);
  const [reviewedItemIds, setReviewedItemIds] = useState([]);
  const signedInEmail = useRef(null);

  // Orders, points and reviewed lines from the server — the account's real
  // history on any device. The browser copy (loadStore) stays as the
  // fallback when the server can't be reached.
  const refreshAccount = useCallback(async () => {
    if (!signedInEmail.current) return;
    try {
      const api = await import("../lib/api/myAccount.js");
      const [o, pts, rev] = await Promise.all([api.listMyOrders(), api.getMyPoints(), api.listMyReviewedItemIds()]);
      if (!signedInEmail.current) return;
      if (o.data) setOrders(o.data);
      if (pts.data !== null) setPoints(pts.data);
      if (rev.data) setReviewedItemIds(rev.data);
      const failed = [o, pts, rev].find((r) => r.error);
      if (failed) console.error("[account] couldn't load part of the account from the server:", failed.error);
    } catch (err) {
      console.error("[account] couldn't load the account from the server:", err);
    }
  }, []);
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
    window.dispatchEvent(new CustomEvent("auth_login", { detail: { email: emailKey } }));
  }, []);

  const clearSignedIn = useCallback(() => {
    const currentEmail = signedInEmail.current;
    signedInEmail.current = null;
    if (currentEmail) window.dispatchEvent(new CustomEvent("auth_logout", { detail: { email: currentEmail } }));
    setAuthed(false);
    setProfile({});
    setPoints(0);
    setMyReviews([]);
    setReviewedIds([]);
    setOrders([]);
    setUsedCoupons([]);
    setReviewedItemIds([]);
  }, []);

  // Follow the real session: sign-in (password, confirmation link, reset
  // code), sign-out, and a session restored on reload. Token refreshes for
  // the same account are ignored so the cart/wishlist merge runs once.
  useEffect(() => {
    try { localStorage.removeItem(LEGACY_SESSION_KEY); } catch { /* storage unavailable */ }
    let unsubscribe = null;
    let alive = true;
    watchSession((session) => {
      const email = session?.user?.email?.toLowerCase() ?? null;
      if (email && email !== signedInEmail.current) {
        signedInEmail.current = email;
        handleAuth(email, session.user.user_metadata?.full_name);
        refreshAccount();
      } else if (!email && signedInEmail.current) {
        clearSignedIn();
      }
    }).then((unsub) => { if (alive) unsubscribe = unsub; else unsub(); })
      .catch((err) => console.error("[auth] couldn't restore the session:", err));
    return () => { alive = false; unsubscribe?.(); };
  }, [handleAuth, clearSignedIn, refreshAccount]);

  /** @returns {Promise<{ error: string|null }>} */
  const login = useCallback(({ email, password }) => signInCustomer({ email, password }), []);

  /** @returns {Promise<{ error: string|null, needsConfirmation: boolean }>} */
  const signup = useCallback(({ name, email, password }) => signUpCustomer({ name, email, password }), []);

  const logout = useCallback(async () => {
    await signOutCustomer();
    clearSignedIn();
  }, [clearSignedIn]);

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
      refreshAccount,
      hasReviewedItem: (orderItemId) => reviewedItemIds.includes(orderItemId),
      openAuth,
      closeAuth,
      login,
      signup,
      logout,
      points,
      pointsPerReview,
      rewards,
      orders,
      myReviews,
      // Reward tiers from the database: those unlocked, the next one, all.
      coupons: rewards.tiers.filter((t) => points >= t.points),
      nextMilestone: rewards.tiers.find((t) => points < t.points) ?? null,
      milestones: rewards.tiers,
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
        if (rewards.earnsOnReview) setPoints((p) => p + pointsPerReview);
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
        const earned = pointsForPurchase(orderData.total, rewards);
        const newOrder = {
          orderId: orderData.number,
          date: new Date().toISOString().split('T')[0],
          // No stored `status`: the real one lives on the server and is shown
          // on /track (track_order(), 0061), so a local copy would go stale.
          items: orderData.itemIds || [],
          total: orderData.total,
          email: orderData.email,
          payMethod: orderData.payMethod,
          pointsEarned: earned,
          timestamp: new Date().toISOString(),
          // Receipt snapshot (lib/order-receipt.js) so order details show
          // the lines and totals as bought, not today's catalog.
          lines: orderData.lines ?? null,
          totals: orderData.totals ?? null,
          address: orderData.address ?? null,
        };
        setOrders((prev) => [newOrder, ...prev.filter((o) => o.orderId !== newOrder.orderId)]);
        // Purchases are the primary earn path — see the loyalty economy note
        // in data/reviews.js. Without this the milestone tiers are unreachable.
        if (earned > 0) setPoints((p) => p + earned);
        // Signed in: replace the local guess with the server's own record.
        refreshAccount();
        return earned;
      },
    };
  }, [points, pointsPerReview, myReviews, reviewedIds, orders, purchasedIds, profile, authed, auth, openAuth, closeAuth, login, signup, logout, usedCoupons, refreshAccount, reviewedItemIds, rewards]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within a <UserProvider>");
  return ctx;
}
