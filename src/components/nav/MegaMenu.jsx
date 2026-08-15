/* =================================================================== *
 * skin.theory — Shop mega menu
 * -------------------------------------------------------------------
 * Columns come straight from the category tree in the database, so the menu
 * reshapes itself when the client edits /admin/categories. Nothing here is
 * hardcoded except the layout.
 *
 * INTERACTION
 *   • Mouse: opens on hover, with a short close delay so a diagonal sweep
 *     from the trigger into the panel doesn't snap it shut mid-move.
 *   • Touch: hover doesn't exist, and a tap that both opens a menu AND
 *     follows the link is the classic mobile trap — the first tap opens the
 *     panel and nothing navigates. "View everything" is the way to /shop.
 *   • Keyboard: focus opens it, Escape closes and returns focus to the
 *     trigger, and the panel is ordinary links so Tab walks it naturally.
 *
 * The panel is deliberately NOT a modal: it doesn't trap focus or lock
 * scroll, because it is a navigation aid, not a task.
 * =================================================================== */
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronDown, ArrowRight } from "lucide-react";
import { useCategoryTree } from "../../lib/api/categories.js";

const CLOSE_DELAY = 140; // ms of grace when the pointer leaves

export default function MegaMenu({ label = "Shop", href = "/shop" }) {
  const tree = useCategoryTree();
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  const closeTimer = useRef(null);
  const panelRef = useRef(null);
  const panelId = useId();
  const [shift, setShift] = useState(0);

  /* Keep the panel inside the viewport.
   *
   * It is centred on the trigger, which sits left of centre in the header, so
   * at full width it hangs off the left edge. Measure once it's mounted and
   * nudge it back by however much it overhangs, leaving a gutter. Runs in a
   * layout effect so the correction paints in the same frame — no visible jump.
   */
  useLayoutEffect(() => {
    if (!open) { setShift(0); return; }

    const GUTTER = 16;
    const reposition = () => {
      const el = panelRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setShift((prev) => {
        // r already includes the current shift, so correct relative to it.
        if (r.left < GUTTER) return prev + (GUTTER - r.left);
        if (r.right > window.innerWidth - GUTTER) {
          return prev - (r.right - (window.innerWidth - GUTTER));
        }
        return prev;
      });
    };

    reposition();
    window.addEventListener("resize", reposition);
    return () => window.removeEventListener("resize", reposition);
  }, [open]);

  const cancelClose = () => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY);
  };

  useEffect(() => cancelClose, []);

  // Escape closes and hands focus back, so a keyboard user isn't stranded.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") { setOpen(false); triggerRef.current?.focus(); }
    };
    const onPointerDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  // Nothing to show (fetch failed, or no categories yet) → behave as a link.
  if (!tree.length) {
    return (
      <a href={href} className={TRIGGER_CLS}>
        {label}
        <span className={UNDERLINE_CLS} />
      </a>
    );
  }

  return (
    <div
      ref={wrapRef}
      className="relative"
      onMouseEnter={() => { cancelClose(); setOpen(true); }}
      onMouseLeave={scheduleClose}
      /* Deliberately NO onFocus-to-open here. Focus bubbles in React, so
         Escape → close → refocus the trigger fired this handler and reopened
         the panel instantly, making Escape look broken. The trigger is a real
         <button>, so Enter/Space opens it — which is the expected keyboard
         behaviour for a menu anyway. */
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
        className={`${TRIGGER_CLS} inline-flex items-center gap-1`}
      >
        {label}
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
          strokeWidth={2}
        />
        <span className={UNDERLINE_CLS} />
      </button>

      <AnimatePresence>
        {open && (
          /* Two elements on purpose. The OUTER one owns horizontal position
             and is clamped to the viewport; the INNER one owns the entrance
             animation. They can't be merged: framer-motion drives `transform`,
             so a clamping translateX set via style would be overwritten by it.
             Centring on the trigger alone put a 1152px panel partly off-screen,
             because "Shop" sits left of centre in the header. */
          <div
            style={{ transform: `translateX(calc(-50% + ${shift}px))` }}
            className="absolute left-1/2 top-full z-[var(--z-dropdown)] mt-3 w-[min(72rem,calc(100vw-2rem))]"
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
          >
          <motion.div
            ref={panelRef}
            id={panelId}
            role="menu"
            aria-label={`${label} categories`}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.985 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden rounded-2xl bg-white shadow-lift ring-1 ring-line"
          >
            {/* Five columns, matching the reference layout. Columns align to
                the top so an uneven tree (Skin Care has 14 items, Eye Care 2)
                reads as a tidy grid rather than five centred blocks. */}
            <div className="grid max-h-[70vh] items-start gap-x-8 gap-y-7 overflow-y-auto p-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {tree.map((parent) => (
                <div key={parent.id}>
                  {/* The parent is itself shoppable — clicking it shows
                      everything beneath it, not an empty page. */}
                  <a
                    href={`/shop?category=${parent.slug}`}
                    onClick={() => setOpen(false)}
                    className="group/head font-serif text-sm uppercase tracking-[0.14em] text-ink transition-colors hover:text-magenta"
                  >
                    {parent.name}
                    <span className="ml-1 inline-block translate-x-0 opacity-0 transition-all duration-300 group-hover/head:translate-x-0.5 group-hover/head:opacity-100">
                      →
                    </span>
                  </a>

                  {parent.children.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {parent.children.map((child) => (
                        <li key={child.id}>
                          <a
                            href={`/shop?category=${child.slug}`}
                            onClick={() => setOpen(false)}
                            className="block rounded-lg px-2 py-1 -mx-2 text-sm text-ink-soft transition-colors hover:bg-petal hover:text-magenta"
                          >
                            {child.name}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-line bg-snow px-7 py-3.5">
              <p className="text-xs text-ink-soft">
                Authentic K &amp; J-Beauty, straight from authorised distributors.
              </p>
              <a
                href={href}
                onClick={() => setOpen(false)}
                className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-magenta hover:text-magenta-deep"
              >
                View everything <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
              </a>
            </div>
          </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* Matched to the other desktop nav links so the trigger is visually
   indistinguishable from them apart from the chevron. */
const TRIGGER_CLS =
  "group relative rounded-full px-4 py-2 font-display text-sm font-medium text-ink/70 transition-colors hover:text-ink";
const UNDERLINE_CLS =
  "absolute inset-x-4 -bottom-0.5 h-0.5 origin-left scale-x-0 rounded-full bg-magenta transition-transform duration-300 group-hover:scale-x-100";

/* =================================================================== *
 * Mobile: an expandable Shop section for the slide-in menu.
 * A hover panel is meaningless on a phone, so the same tree renders as a
 * disclosure the thumb can operate.
 * =================================================================== */
export function MobileCategoryNav({ onNavigate }) {
  const tree = useCategoryTree();
  const [expanded, setExpanded] = useState(null);
  const reduce = useReducedMotion();

  if (!tree.length) return null;

  return (
    <ul className="mt-1 space-y-0.5 border-l border-line pl-3">
      {tree.map((parent) => {
        const isOpen = expanded === parent.id;
        const hasChildren = parent.children.length > 0;

        return (
          <li key={parent.id}>
            <div className="flex items-center justify-between gap-2">
              <a
                href={`/shop?category=${parent.slug}`}
                onClick={onNavigate}
                className="flex-1 py-2 text-sm text-ink transition-colors hover:text-magenta"
              >
                {parent.name}
              </a>
              {hasChildren && (
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : parent.id)}
                  aria-expanded={isOpen}
                  aria-label={`${isOpen ? "Collapse" : "Expand"} ${parent.name}`}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-soft transition-colors hover:bg-petal hover:text-magenta"
                >
                  <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
                </button>
              )}
            </div>

            <AnimatePresence initial={false}>
              {isOpen && hasChildren && (
                <motion.ul
                  initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                  animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
                  exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden pl-3"
                >
                  {parent.children.map((child) => (
                    <li key={child.id}>
                      <a
                        href={`/shop?category=${child.slug}`}
                        onClick={onNavigate}
                        className="block py-1.5 text-sm text-ink-soft transition-colors hover:text-magenta"
                      >
                        {child.name}
                      </a>
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </li>
        );
      })}
    </ul>
  );
}
