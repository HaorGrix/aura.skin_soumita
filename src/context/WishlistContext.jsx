import { createContext, useContext, useEffect, useMemo, useState } from "react";

/**
 * Wishlist — minimal global store: a Set of product ids, persisted to
 * localStorage. One hook (`useWishlist`) powers the navbar heart badge,
 * the ProductCard heart, and the PDP heart.
 *
 * Kept intentionally tiny: we only need `has(id)`, `toggle(id)`, and `count`.
 * Full ids are stored (not snapshots) so prices/images stay live with the
 * catalog as the source of truth.
 */
const WishlistContext = createContext(null);
const STORAGE_KEY = "aura-wishlist";

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function WishlistProvider({ children }) {
  const [ids, setIds] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {
      /* non-fatal */
    }
  }, [ids]);

  useEffect(() => {
    const handleLogin = (e) => {
      const { email } = e.detail;
      const key = `wishlist_${email}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        setIds(JSON.parse(saved));
      } else {
        setIds([]);
      }
    };
    const handleLogout = (e) => {
      const { email } = e.detail;
      const key = `wishlist_${email}`;
      // Read current ids from storage key at logout time, not from stale closure.
      setIds((current) => {
        try { localStorage.setItem(key, JSON.stringify(current)); } catch { /* non-fatal */ }
        return [];
      });
    };
    window.addEventListener("auth_login", handleLogin);
    window.addEventListener("auth_logout", handleLogout);
    return () => {
      window.removeEventListener("auth_login", handleLogin);
      window.removeEventListener("auth_logout", handleLogout);
    };
  }, []);

  const value = useMemo(
    () => ({
      items: ids,
      count: ids.length,
      has: (id) => ids.includes(id),
      toggle: (id) => {
        setIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
      },
      clear: () => setIds([]),
    }),
    [ids]
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within a <WishlistProvider>");
  return ctx;
}
