import { navigate } from "../../lib/navigate.js";
import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ShoppingBag, ArrowRight, Lock, Tag } from "lucide-react";
import { useCart } from "../../context/CartContext.jsx";
import { formatPrice } from "../../lib/format.js";
import LineItem from "./LineItem.jsx";
import FreeShippingBar from "./FreeShippingBar.jsx";
import Button from "../ui/Button.jsx";
import { useFocusTrap } from "../../lib/useFocusTrap.js";

export default function CartDrawer() {
  const { isOpen, closeCart, items, count, subtotal, discountAmount, appliedCoupon } = useCart();
  const drawerRef = useRef(null);
  useFocusTrap(drawerRef, isOpen);

  const discounted = Math.max(0, subtotal - discountAmount);

  // Esc closes — but we deliberately DON'T lock body scroll (boss wants the
  // shopper to keep browsing the grid while the drawer is open, ASOS-style).
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => e.key === "Escape" && closeCart();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, closeCart]);

  const goCheckout = () => {
    closeCart();
    navigate("/checkout");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        /* No scrim, no backdrop-blur — main page stays fully interactive so
           the shopper can keep adding more items without the drawer closing.
           Only the drawer surface itself catches pointer events; everywhere
           else stays clickable for browse/quick-add. */
        <motion.aside
          ref={drawerRef}
          /* Mobile: takes most of the screen but leaves a thin strip on the
             left for swipe-out / orientation. Desktop: capped at max-w-md so
             the product grid stays visible and shoppable. */
          role="dialog"
          aria-modal="true"
          aria-label="Shopping bag"
          className="fixed inset-y-0 right-0 z-[var(--z-modal)] flex w-[88vw] max-w-md flex-col bg-white shadow-[var(--shadow-lift)] ring-1 ring-line"
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", stiffness: 300, damping: 34 }}
        >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="flex items-center gap-2 font-serif text-xl text-ink">
                <ShoppingBag className="h-5 w-5 text-magenta" strokeWidth={1.7} />
                Your Bag
                {count > 0 && (
                  <span className="rounded-full bg-petal px-2 py-0.5 text-xs font-semibold text-magenta">
                    {count}
                  </span>
                )}
              </h2>
              <button
                onClick={closeCart}
                aria-label="Close bag"
                className="grid h-9 w-9 place-items-center rounded-full text-ink-soft transition-colors hover:bg-snow hover:text-magenta"
              >
                <X className="h-5 w-5" strokeWidth={1.8} />
              </button>
            </div>

            {items.length === 0 ? (
              <EmptyBag onClose={closeCart} />
            ) : (
              <>
                {/* Free shipping */}
                <div className="px-5 pt-4">
                  <FreeShippingBar subtotal={discounted} couponFreeShipping={!!appliedCoupon?.freeShipping} />
                </div>

                {/* Items */}
                <div className="flex-1 overflow-y-auto px-5 py-4">
                  <AnimatePresence initial={false}>
                    <div className="flex flex-col gap-5">
                      {items.map((item) => (
                        <LineItem key={item.id} item={item} compact />
                      ))}
                    </div>
                  </AnimatePresence>
                </div>

                {/* Footer */}
                <div className="border-t border-line px-5 py-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-ink-soft">Subtotal</span>
                    <span className="font-serif text-xl text-ink">
                      {formatPrice(subtotal)}
                    </span>
                  </div>

                  {appliedCoupon && (
                    <div className="mt-3 flex items-center justify-between rounded-xl bg-petal/50 p-2.5 ring-1 ring-line">
                      <span className="flex items-center gap-2">
                        <Tag className="h-3.5 w-3.5 text-magenta" strokeWidth={2} />
                        <span className="text-xs font-semibold text-ink">{appliedCoupon.code}</span>
                      </span>
                      <span className="text-xs font-semibold text-magenta">
                        −{formatPrice(discountAmount)}
                      </span>
                    </div>
                  )}

                  <p className="mt-2 text-xs text-ink-soft">
                    Shipping & taxes calculated at checkout.
                  </p>

                  <Button
                    variant="primary"
                    magnetic={false}
                    className="mt-4 w-full"
                    onClick={goCheckout}
                  >
                    Checkout <ArrowRight className="h-4 w-4" strokeWidth={2} />
                  </Button>

                  <a
                    href="/cart"
                    onClick={closeCart}
                    className="mt-2.5 block text-center text-sm font-medium text-ink-soft underline-offset-2 hover:text-magenta hover:underline"
                  >
                    View full bag
                  </a>

                  <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-ink-soft">
                    <Lock className="h-3 w-3" strokeWidth={2} /> Secure checkout
                  </p>
                </div>
              </>
            )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function EmptyBag({ onClose }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="grid h-20 w-20 place-items-center rounded-full bg-petal text-4xl ring-1 ring-rose/30"
      >
        🛍️
      </motion.div>
      <h3 className="mt-6 font-serif text-2xl text-ink">Your bag is empty</h3>
      <p className="mt-2 text-sm text-ink-soft">
        Let’s find your next glass-skin staple. Your glow awaits. ✨
      </p>
      <a
        href="/shop"
        onClick={onClose}
        className="mt-7 inline-flex items-center gap-2 rounded-full bg-magenta px-7 py-3.5 text-sm font-semibold text-white shadow-soft transition-shadow hover:shadow-[var(--shadow-glow-pink)]"
      >
        Start shopping
      </a>
    </div>
  );
}
