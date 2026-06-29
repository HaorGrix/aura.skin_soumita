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

  const value = useMemo(
    () => ({
      items: ids,
      count: ids.length,
      has: (id) => ids.includes(id),
      /** Returns the new state (`true` = now wished, `false` = removed) so
       *  callers can fire the right toast without a follow-up read. */
      toggle: (id) => {
        let nowWished = false;
        setIds((prev) => {
          if (prev.includes(id)) return prev.filter((x) => x !== id);
          nowWished = true;
          return [...prev, id];
        });
        return nowWished;
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
