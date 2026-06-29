import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag } from "lucide-react";
import { useCart } from "../context/CartContext.jsx";

/**
 * FloatingCart — persistent FAB, lives above all pages.
 *
 * Behaviour:
 *  - Hidden when cart is empty (clean baseline).
 *  - Hides automatically when the cart drawer is open (no overlap).
 *  - Badge springs in/out on every count change.
 *  - Pulse ring fires on each add so the icon "breathes" acknowledgement.
 *  - Vertically centered (50 vh) so it's always in the peripheral view
 *    without covering page content at the bottom.
 */
export default function FloatingCart() {
  const { count, isOpen, openCart } = useCart();

  // Show only when there's something in the cart AND the drawer is closed.
  const visible = count > 0 && !isOpen;

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          key="floating-cart"
          onClick={openCart}
          aria-label={`Open cart — ${count} item${count !== 1 ? "s" : ""}`}
          // Enter from right, exit to right — drawer slides in from the same side
          // so the motion reads as a single continuous gesture.
          initial={{ x: 80, opacity: 0, scale: 0.85 }}
          animate={{ x: 0, opacity: 1, scale: 1 }}
          exit={{ x: 80, opacity: 0, scale: 0.85 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
          whileHover={{ scale: 1.1, boxShadow: "0 0 32px 8px rgba(225,48,108,0.55)" }}
          whileTap={{ scale: 0.92 }}
          // Fixed at vertical center-ish (45 vh) so it floats in the middle of
          // the viewport rather than clashing with bottom UI chrome on mobile.
          className="fixed right-4 top-[45vh] z-[140] flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full bg-gradient-to-br from-magenta to-magenta-deep shadow-[0_0_28px_4px_rgba(225,48,108,0.5)] sm:right-6"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          {/* Bag icon */}
          <ShoppingBag className="h-6 w-6 text-white drop-shadow-sm" strokeWidth={1.9} />

          {/* Count badge — springs between values */}
          <AnimatePresence mode="popLayout">
            <motion.span
              key={count}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 540, damping: 22 }}
              className="absolute -right-1.5 -top-1.5 grid h-[1.35rem] min-w-[1.35rem] place-items-center rounded-full bg-white px-[3px] font-sans text-[11px] font-black leading-none text-magenta shadow ring-1 ring-magenta/20"
            >
              {count > 99 ? "99+" : count}
            </motion.span>
          </AnimatePresence>

          {/* Pulse ring — fires every time count changes (affirms the add) */}
          <motion.span
            key={`pulse-${count}`}
            aria-hidden
            initial={{ opacity: 0.55, scale: 1 }}
            animate={{ opacity: 0, scale: 1.75 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 rounded-full bg-magenta"
          />

          {/* Subtle inner glow shimmer — always present */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-t from-transparent to-white/20"
          />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
