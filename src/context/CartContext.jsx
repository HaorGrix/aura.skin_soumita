import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import { validate } from "../lib/coupons.js";

/**
 * Cart store — line items with quantity, localStorage persistence, and the
 * mini-cart drawer open/close state. One hook (`useCart`) powers the navbar
 * badge, ProductCard quick-add, the drawer, the cart page, and checkout.
 *
 * VARIANTS: a cart line is keyed by `(id, variantId)`, not just `id` — two
 * different sizes of the same product are two separate lines, each with its
 * own price and quantity. `variantId` is `null` for a quick-add that never
 * saw a size picker (ProductCard, QuickView, Wishlist); place_order()
 * resolves a null variant to that product's default size server-side, so
 * these lines still check out correctly — see lib/api/orders.js.
 */
const CartContext = createContext(null);
const STORAGE_KEY = "skinscript-cart";

/** Default per-line quantity cap for lines that predate this field
 *  (a cart saved before the variants migration). MAX_PER_ORDER used to be
 *  a fixed constant here; the real, current limit is per-product
 *  (`maxPerOrder`) and is now carried on the line itself, captured at
 *  add-time — see `slim()`. */
const FALLBACK_MAX_QTY = 10;

/** Keep only what the cart UI needs (small + serializable). */
function slim(item) {
  const {
    id, brand, name, price, image, tone, category,
    variantId = null, sizeLabel = null,
    compareAt, isOnSale, discountPercent,
    maxPerOrder,
  } = item;
  return {
    id, brand, name, price, image, tone, category,
    variantId, sizeLabel, compareAt, isOnSale, discountPercent,
    maxPerOrder: maxPerOrder ?? FALLBACK_MAX_QTY,
  };
}

/** Two lines are the same line iff both the product AND the size match. */
const sameLine = (a, b) => a.id === b.id && (a.variantId ?? null) === (b.variantId ?? null);

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function reducer(state, action) {
  switch (action.type) {
    case "ADD": {
      const { item, qty } = action;
      const line = slim(item);
      const max = line.maxPerOrder;
      if (max === 0) return state;
      const existing = state.items.find((i) => sameLine(i, line));
      if (existing) {
        return {
          items: state.items.map((i) =>
            sameLine(i, line) ? { ...i, qty: Math.min(i.qty + qty, max) } : i
          ),
        };
      }
      return { items: [...state.items, { ...line, qty: Math.min(qty, max) }] };
    }
    case "SET_QTY": {
      const target = { id: action.id, variantId: action.variantId ?? null };
      const line = state.items.find((i) => sameLine(i, target));
      const max = line?.maxPerOrder ?? FALLBACK_MAX_QTY;
      const qty = Math.min(Math.max(0, action.qty), max);
      if (qty === 0) return { items: state.items.filter((i) => !sameLine(i, target)) };
      return {
        items: state.items.map((i) => (sameLine(i, target) ? { ...i, qty } : i)),
      };
    }
    case "REMOVE":
      return { items: state.items.filter((i) => !sameLine(i, { id: action.id, variantId: action.variantId ?? null })) };
    case "CLEAR":
      return { items: [] };
    case "LOAD":
      return { items: action.items };
    default:
      return state;
  }
}

export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({ items: load() }));
  const [isOpen, setOpen] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState(null);

  // Persist on every change.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
    } catch {
      /* storage full / unavailable — non-fatal */
    }
  }, [state.items]);

  // Auto-clear coupon when the cart is emptied (clear bag or last item removed).
  useEffect(() => {
    if (state.items.length === 0) setAppliedCoupon(null);
  }, [state.items]);

  useEffect(() => {
    const handleLogin = (e) => {
      try {
        const { email } = e.detail;
        const key = `cart_${email}`;
        const saved = JSON.parse(localStorage.getItem(key) || "[]");
        // Merge, don't overwrite. Checkout's AuthGate prompts login with a full
        // bag — clearing it here would empty the cart mid-purchase. Guest lines
        // win on quantity, and every line stays clamped to its own cap.
        const merged = [...saved];
        for (const guestLine of state.items) {
          const existing = merged.find((i) => sameLine(i, guestLine));
          if (existing) {
            existing.qty = Math.min(
              Math.max(existing.qty, guestLine.qty),
              guestLine.maxPerOrder ?? FALLBACK_MAX_QTY
            );
          } else {
            merged.push({ ...guestLine, qty: Math.min(guestLine.qty, guestLine.maxPerOrder ?? FALLBACK_MAX_QTY) });
          }
        }
        dispatch({ type: "LOAD", items: merged.filter((i) => i.qty > 0) });
      } catch {
        /* non-fatal — keep the current bag rather than destroying it */
      }
    };
    const handleLogout = (e) => {
      try {
        const { email } = e.detail;
        const key = `cart_${email}`;
        localStorage.setItem(key, JSON.stringify(state.items));
      } catch {
        /* non-fatal */
      }
      dispatch({ type: "CLEAR" });
    };
    window.addEventListener("auth_login", handleLogin);
    window.addEventListener("auth_logout", handleLogout);
    return () => {
      window.removeEventListener("auth_login", handleLogin);
      window.removeEventListener("auth_logout", handleLogout);
    };
  }, [state.items]);

  const value = useMemo(() => {
    const count = state.items.reduce((sum, i) => sum + i.qty, 0);
    const subtotal = state.items.reduce((sum, i) => sum + i.qty * (i.price ?? 0), 0);

    // discountAmount shares the same useMemo as subtotal — it recalculates
    // automatically whenever items (and therefore subtotal) change.
    const discountAmount = appliedCoupon
      ? appliedCoupon.type === "flat"
        ? Math.min(appliedCoupon.value, subtotal)
        : Math.round(((subtotal * appliedCoupon.value) / 100) * 100) / 100
      : 0;
    const promoCode = appliedCoupon?.code ?? null;
    const discountPercentage = appliedCoupon?.type === "percent" ? appliedCoupon.value : 0;

    return {
      items: state.items,
      count,
      subtotal,
      // --- Promo ---
      appliedCoupon,
      discountAmount,
      promoCode,
      discountPercentage,
      // Validate every coupon through the unified registry.
      applyPromo: (code, userOrCoupons = [], usedCoupons = [], orders = [], points = 0) => {
        const user = Array.isArray(userOrCoupons)
          ? { coupons: userOrCoupons, usedCoupons, orders, points }
          : userOrCoupons ?? {};
        const result = validate(code, user);
        if (!result?.success) return result;

        const coupon = result.coupon;
        setAppliedCoupon({
          code: result.code,
          type: coupon.type,
          value: coupon.value,
          label: coupon.label ?? coupon.reward ?? coupon.short ?? result.code,
          freeShipping: !!coupon.freeShipping,
        });
        return { success: true, label: result.label };
      },
      removeCoupon: () => setAppliedCoupon(null),
      // --- Cart actions. `variantId` is optional on every call — omit it
      // for a plain (non-variant) product, exactly like before. ---
      addItem: (item, qty = 1) => dispatch({ type: "ADD", item, qty }),
      setQty: (id, qty, variantId = null) => dispatch({ type: "SET_QTY", id, qty, variantId }),
      inc: (id, variantId = null) => {
        const it = state.items.find((i) => sameLine(i, { id, variantId }));
        dispatch({ type: "SET_QTY", id, qty: (it?.qty ?? 0) + 1, variantId });
      },
      dec: (id, variantId = null) => {
        const it = state.items.find((i) => sameLine(i, { id, variantId }));
        dispatch({ type: "SET_QTY", id, qty: (it?.qty ?? 0) - 1, variantId });
      },
      removeItem: (id, variantId = null) => dispatch({ type: "REMOVE", id, variantId }),
      clear: () => dispatch({ type: "CLEAR" }),
      // Units a line may hold — lets the stepper disable `+` at the cap.
      // Reads the cap off the LINE itself (captured at add-time), not a
      // global lookup — the previous version keyed off a bundled static
      // catalog that had no connection to the live product/variant data.
      maxQtyFor: (id, variantId = null) => {
        const it = state.items.find((i) => sameLine(i, { id, variantId }));
        return it?.maxPerOrder ?? FALLBACK_MAX_QTY;
      },
      atMaxQty: (id, variantId = null) => {
        const it = state.items.find((i) => sameLine(i, { id, variantId }));
        if (!it) return false;
        return it.qty >= (it.maxPerOrder ?? FALLBACK_MAX_QTY);
      },
      // --- Drawer ---
      isOpen,
      openCart: () => setOpen(true),
      closeCart: () => setOpen(false),
      toggleCart: () => setOpen((v) => !v),
    };
  }, [state.items, isOpen, appliedCoupon]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a <CartProvider>");
  return ctx;
}
