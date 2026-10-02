import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag } from "lucide-react";
import { useCart } from "../context/CartContext.jsx";

/**
 * FloatingCart — persistent, draggable cart button, above all pages.
 *
 *  - Hidden when the cart is empty or the cart drawer is open.
 *  - Drag it anywhere on screen (mouse or finger); a tap opens the cart.
 *  - It stays exactly where it was put. The position is kept in pixels and
 *    is only changed by the shopper's own drag, or pulled back inside the
 *    screen when the screen really gets smaller (rotation, window resize).
 *    It used to sit at `45vh` inside a drag-constraint layer: on phones the
 *    viewport height changes every time the address bar shows or hides
 *    while scrolling, so the button slid up/down and the drag library
 *    re-fitted it sideways on its own.
 *  - The position lives at module level, so it survives the button hiding
 *    (drawer open, cart/checkout pages) and coming back.
 */
const SIZE = 56; // h-14 / w-14
const MARGIN = 12; // keep at least this far from the screen edges
const DRAG_THRESHOLD = 6; // px moved before a press counts as a drag, not a tap

let savedPos = null; // { x, y } top-left in px, shared across mounts

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const fitToScreen = ({ x, y }) => ({
  x: clamp(x, MARGIN, window.innerWidth - SIZE - MARGIN),
  y: clamp(y, MARGIN, window.innerHeight - SIZE - MARGIN),
});
const defaultPos = () =>
  fitToScreen({ x: window.innerWidth - SIZE - (window.innerWidth >= 640 ? 24 : 16), y: Math.round(window.innerHeight * 0.45) });

export default function FloatingCart() {
  const { count, isOpen, openCart } = useCart();
  const visible = count > 0 && !isOpen;

  const [pos, setPos] = useState(() => savedPos ?? defaultPos());
  const drag = useRef(null); // { startX, startY, originX, originY, moved }

  const place = useCallback((next) => {
    savedPos = next;
    setPos(next);
  }, []);

  // Only a real size change can push it off-screen; nudge it back inside
  // then, and leave it alone otherwise (scrolling never moves it).
  useEffect(() => {
    let lastW = window.innerWidth;
    let lastH = window.innerHeight;
    const onResize = () => {
      if (window.innerWidth === lastW && Math.abs(window.innerHeight - lastH) < 120) return; // address bar
      lastW = window.innerWidth;
      lastH = window.innerHeight;
      setPos((p) => {
        const fitted = fitToScreen(p);
        if (fitted.x === p.x && fitted.y === p.y) return p;
        savedPos = fitted;
        return fitted;
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { startX: e.clientX, startY: e.clientY, originX: pos.x, originY: pos.y, moved: false };
  }

  function onPointerMove(e) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    d.moved = true;
    place(fitToScreen({ x: d.originX + dx, y: d.originY + dy }));
  }

  function onPointerUp(e) {
    const d = drag.current;
    drag.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    if (d && !d.moved) openCart();
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="floating-cart"
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.7 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
          className="fixed z-[140]"
          style={{ left: pos.x, top: pos.y, width: SIZE, height: SIZE }}
        >
          <button
            type="button"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => { drag.current = null; }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openCart(); } }}
            aria-label={`Open cart — ${count} item${count !== 1 ? "s" : ""}`}
            className="relative flex h-14 w-14 cursor-grab touch-none select-none items-center justify-center rounded-full bg-gradient-to-br from-magenta to-magenta-deep shadow-[0_0_28px_4px_rgba(225,48,108,0.5)] transition-transform active:scale-95 active:cursor-grabbing [@media(hover:hover)]:hover:scale-110"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
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
              className="pointer-events-none absolute inset-0 rounded-full bg-magenta"
            />

            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-t from-transparent to-white/20"
            />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
