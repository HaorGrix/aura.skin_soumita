import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";

/**
 * Cart store — line items with quantity, localStorage persistence, and the
 * mini-cart drawer open/close state. One hook (`useCart`) powers the navbar
 * badge, ProductCard quick-add, the drawer, the cart page, and checkout.
 */
const CartContext = createContext(null);
const STORAGE_KEY = "aura-cart";

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
      const existing = state.items.find((i) => i.id === item.id);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.id === item.id ? { ...i, qty: i.qty + qty } : i
          ),
        };
      }
      return { items: [...state.items, { ...slim(item), qty }] };
    }
    case "SET_QTY": {
      const qty = Math.max(0, action.qty);
      if (qty === 0) return { items: state.items.filter((i) => i.id !== action.id) };
      return {
        items: state.items.map((i) => (i.id === action.id ? { ...i, qty } : i)),
      };
    }
    case "REMOVE":
      return { items: state.items.filter((i) => i.id !== action.id) };
    case "CLEAR":
      return { items: [] };
    default:
      return state;
  }
}

export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({ items: load() }));
  const [isOpen, setOpen] = useState(false);

  // Persist on every change.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
    } catch {
      /* storage full / unavailable — non-fatal */
    }
  }, [state.items]);

  const value = useMemo(() => {
    const count = state.items.reduce((sum, i) => sum + i.qty, 0);
    const subtotal = state.items.reduce((sum, i) => sum + i.qty * (i.price ?? 0), 0);
    return {
      items: state.items,
      count,
      subtotal,
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
      // drawer
      isOpen,
      openCart: () => setOpen(true),
      closeCart: () => setOpen(false),
      toggleCart: () => setOpen((v) => !v),
    };
  }, [state.items, isOpen]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a <CartProvider>");
  return ctx;
}
