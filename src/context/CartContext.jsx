import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import { validate } from "../lib/coupons.js";
import { maxQtyFor } from "../data/products.js";

/**
 * Cart store — line items with quantity, localStorage persistence, and the
 * mini-cart drawer open/close state. One hook (`useCart`) powers the navbar
 * badge, ProductCard quick-add, the drawer, the cart page, and checkout.
 */
const CartContext = createContext(null);
const STORAGE_KEY = "skinscript-cart";

/* Keep only what the cart UI needs (small + serializable). */
function slim(item) {
  const { id, brand, name, price, image, tone, category } = item;
  return { id, brand, name, price, image, tone, category };
}

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
      // Never let a line exceed the units actually on hand.
      const max = maxQtyFor(item.id);
      if (max === 0) return state;
      const existing = state.items.find((i) => i.id === item.id);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.id === item.id ? { ...i, qty: Math.min(i.qty + qty, max) } : i
          ),
        };
      }
      return { items: [...state.items, { ...slim(item), qty: Math.min(qty, max) }] };
    }
    case "SET_QTY": {
      const max = maxQtyFor(action.id);
      const qty = Math.min(Math.max(0, action.qty), max);
      if (qty === 0) return { items: state.items.filter((i) => i.id !== action.id) };
      return {
        items: state.items.map((i) => (i.id === action.id ? { ...i, qty } : i)),
      };
    }
    case "REMOVE":
      return { items: state.items.filter((i) => i.id !== action.id) };
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
        // win on quantity, and every line stays clamped to available stock.
        const merged = [...saved];
        for (const guestLine of state.items) {
          const existing = merged.find((i) => i.id === guestLine.id);
          if (existing) {
            existing.qty = Math.min(
              Math.max(existing.qty, guestLine.qty),
              maxQtyFor(guestLine.id)
            );
          } else {
            merged.push({ ...guestLine, qty: Math.min(guestLine.qty, maxQtyFor(guestLine.id)) });
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
      // --- Cart actions ---
      addItem: (item, qty = 1) => dispatch({ type: "ADD", item, qty }),
      setQty: (id, qty) => dispatch({ type: "SET_QTY", id, qty }),
      inc: (id) => {
        const it = state.items.find((i) => i.id === id);
        dispatch({ type: "SET_QTY", id, qty: (it?.qty ?? 0) + 1 });
      },
      dec: (id) => {
        const it = state.items.find((i) => i.id === id);
        dispatch({ type: "SET_QTY", id, qty: (it?.qty ?? 0) - 1 });
      },
      removeItem: (id) => dispatch({ type: "REMOVE", id }),
      clear: () => dispatch({ type: "CLEAR" }),
      // Units a line may hold — lets the stepper disable `+` at the cap.
      maxQtyFor,
      atMaxQty: (id) => {
        const it = state.items.find((i) => i.id === id);
        return (it?.qty ?? 0) >= maxQtyFor(id);
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
