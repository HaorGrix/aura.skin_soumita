import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Search,
  Heart,
  ShoppingBag,
  User,
  Menu,
  X,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { useCart } from "../context/CartContext.jsx";
import { useUser } from "../context/UserContext.jsx";
import { useWishlist } from "../context/WishlistContext.jsx";
import { useFocusTrap } from "../lib/useFocusTrap.js";
import { useBodyScrollLock } from "../lib/scrollLock.js";
import { useStoreSettings } from "../lib/api/settings.js";
import logoWordmark from "../../assests/skinscript-logo-header.png";
import MegaMenu, { MobileCategoryNav } from "./nav/MegaMenu.jsx";

const LINKS = [
  { label: "Shop", href: "/shop" },
  { label: "Offers", href: "/offers" },
  { label: "Rewards", href: "/rewards" },
  { label: "Journal", href: "/journal" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

// Authorized brands — shown as a quiet marquee strip on desktop.
const BRANDS = [
  "Beauty of Joseon",
  "COSRX",
  "Anua",
  "The Ordinary",
  "The Body Shop",
  "Centella",
  "Simple",
];

const MOBILE_QUOTE = "Glass skin is a daily ritual — and you’re already glowing. 🌸";

export default function Navbar({ onOpenSearch }) {
  const reduce = useReducedMotion();
  const { count, openCart, isOpen: cartOpen } = useCart();
  const { points, authed, openAuth } = useUser();
  const { count: wishCount } = useWishlist();
  // Admin-editable (Store settings → Announcement bar); falls back to a
  // sensible default (same pattern as shipping/tax settings) if the row or
  // the migration adding these columns hasn't landed yet.
  const { announcementEnabled, announcementText } = useStoreSettings();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  
  const drawerRef = useRef(null);
  const headerRef = useRef(null);
  useFocusTrap(drawerRef, open);
  // Shared ref-counted lock — safe to overlap with a modal opened from the drawer.
  useBodyScrollLock(open);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Publish the header's real height as `--header-h` so page clearance tracks it
  // instead of a hardcoded pt-40/44 (which breaks if the marquee grows or the
  // type scale changes). Capture the EXPANDED height only — at scroll top the
  // bar is full-size; the scrolled/compact state is shorter and would pull
  // content up under the header. A ResizeObserver keeps it correct across
  // breakpoints and content changes; the CSS fallback covers first paint.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const measure = () => {
      if (window.scrollY > 24) return; // only trust the expanded layout
      document.documentElement.style.setProperty("--header-h", `${el.offsetHeight}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const iconBtn =
    "relative grid h-11 w-11 place-items-center rounded-full p-2 text-ink/75 " +
    "transition-colors hover:bg-petal hover:text-magenta";

  return (
    <>
      <motion.header
        ref={headerRef}
        initial={{ y: -90, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="fixed inset-x-0 top-0 z-50"
      >
        {/* Static announcement bar — a slim deep-navy strip of boutique
            signage, replacing the scrolling ticker. No animation, no loop:
            one considered line, then the glass nav floats below it. Text
            and visibility are admin-editable (Settings → Announcement bar). */}
        {announcementEnabled && (
          <div className="relative z-50 bg-magenta-deep py-2.5 text-center">
            <p className="px-4 text-[11px] font-medium uppercase tracking-[0.18em] text-white/90 sm:text-xs">
              {announcementText}
            </p>
          </div>
        )}

        <div
          className={`mx-auto flex max-w-7xl items-center justify-between px-6 transition-all duration-500 sm:px-9 ${
            scrolled ? "my-3 rounded-full glass shadow-soft py-3" : "py-5"
          }`}
        >
          {/* Logo — scales up on larger viewports where the header has room to
              breathe, and steps back down a notch once scrolled/compact so it
              never outgrows the glass pill. */}
          <a href="/" className="flex shrink-0 items-center" aria-label="skin.script — home">
            <img
              src={logoWordmark}
              alt="skin.script"
              className={`w-auto transition-[height] duration-500 ${
                scrolled
                  ? "h-9 sm:h-10 md:h-12 lg:h-14"
                  : "h-10 sm:h-11 md:h-16 lg:h-20"
              }`}
            />
          </a>

          {/* Desktop nav — "Shop" becomes the mega-menu trigger; the rest
              stay plain links. The menu falls back to a normal link if the
              category tree can't be loaded, so this can't break navigation. */}
          <nav className="hidden items-center gap-2 lg:flex">
            {LINKS.map((link) =>
              link.href === "/shop" ? (
                <MegaMenu key={link.label} label={link.label} href={link.href} />
              ) : (
                <a
                  key={link.label}
                  href={link.href}
                  className="group relative rounded-full px-4 py-2 text-sm font-medium text-ink/70 transition-colors hover:text-ink"
                >
                  {link.label}
                  <span className="absolute inset-x-4 -bottom-0.5 h-0.5 origin-left scale-x-0 rounded-full bg-magenta transition-transform duration-300 group-hover:scale-x-100" />
                </a>
              )
            )}
          </nav>

          {/* Right cluster */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            <button className={iconBtn} aria-label="Search" onClick={onOpenSearch}>
              <Search className="h-[18px] w-[18px]" strokeWidth={1.7} />
            </button>
            {/* Wishlist — navigates to the dedicated wishlist page */}
            <a
              href="/wishlist"
              className={`relative ${iconBtn} hidden sm:grid`}
              aria-label={`Wishlist (${wishCount} saved)`}
            >
              <Heart
                className="h-[18px] w-[18px] transition-all"
                strokeWidth={1.7}
                fill={wishCount > 0 ? "var(--color-magenta)" : "none"}
                stroke={wishCount > 0 ? "var(--color-magenta)" : "currentColor"}
              />
              {wishCount > 0 && (
                <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-magenta px-1 text-[10px] font-semibold leading-none text-white">
                  {wishCount}
                </span>
              )}
            </a>

            {/* Cart — hidden on phone (lives inside the mobile menu as a
                prominent CTA) so the right cluster doesn't crowd the menu
                toggle. Tablet+ has room, so it stays in the header there. */}
            <button
              className={`${iconBtn} hidden sm:grid`}
              aria-label={count > 0 ? `Open shopping bag, ${count} item${count > 1 ? "s" : ""}` : "Open shopping bag"}
              aria-expanded={cartOpen}
              onClick={openCart}
            >
              <ShoppingBag className="h-[18px] w-[18px]" strokeWidth={1.7} />
              <AnimatePresence>
                {count > 0 && (
                  <motion.span
                    key={count}
                    initial={{ scale: 0, y: -4 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                    className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-magenta px-1 text-[10px] font-semibold text-white"
                  >
                    {count}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>

            {/* Loyalty pill — a guest has no balance, so invite them to join
                instead of implying points they don't own. */}
            {authed ? (
              <a
                href="/rewards"
                aria-label={`You have ${points} loyalty points`}
                className="hidden items-center gap-1.5 rounded-full bg-petal px-3 py-1.5 text-xs font-semibold text-magenta transition-colors hover:bg-rose/30 sm:inline-flex"
              >
                <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
                {points} pts
              </a>
            ) : (
              <button
                onClick={() => openAuth("signup")}
                aria-label="Join Skin Script Rewards to start earning points"
                className="hidden items-center gap-1.5 rounded-full bg-petal px-3 py-1.5 text-xs font-semibold text-magenta transition-colors hover:bg-rose/30 sm:inline-flex"
              >
                <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
                Join &amp; earn
              </button>
            )}

            {/* Logged out → open the login modal; logged in → go to account.
                Browsing never forces auth, so this is just a friendly entry. */}
            <a
              href="/account"
              onClick={(e) => {
                if (!authed) {
                  e.preventDefault();
                  openAuth("login");
                }
              }}
              className={`${iconBtn} hidden sm:grid`}
              aria-label={authed ? "Account" : "Log in"}
            >
              <User className="h-[18px] w-[18px]" strokeWidth={1.7} />
            </a>

            <button
              className={`${iconBtn} lg:hidden`}
              aria-label="Open menu"
              aria-expanded={open}
              aria-controls="mobile-nav"
              onClick={() => setOpen(true)}
            >
              <Menu className="h-5 w-5" strokeWidth={1.7} />
            </button>
          </div>
        </div>
      </motion.header>

      {/* Mobile slide-in menu */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop + aside both ride the canonical --z-modal token (150),
                matching every other modal in the project (CartDrawer,
                QuickView, NotifyMe…) and sitting above the FloatingCart
                FAB at z-140 so it can't paint over the nav. */}
            <motion.div
              className="fixed inset-0 z-[var(--z-modal)] bg-ink/40 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.aside
              id="mobile-nav"
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
              className="fixed inset-y-0 right-0 z-[var(--z-modal)] flex w-[86%] max-w-sm flex-col bg-white px-7 pb-10 pt-6 shadow-lift lg:hidden"
              initial={{ x: reduce ? 0 : "100%" }}
              animate={{ x: 0 }}
              exit={{ x: reduce ? 0 : "100%" }}
              transition={{ type: "spring", stiffness: 260, damping: 30 }}
            >
              <div className="flex items-center justify-between">
                <img src={logoWordmark} alt="skin.script" className="h-9 w-auto" />
                <button
                  className={iconBtn}
                  aria-label="Close menu"
                  onClick={() => setOpen(false)}
                >
                  <X className="h-5 w-5" strokeWidth={1.7} />
                </button>
              </div>

              <nav className="mt-8 flex flex-col">
                {LINKS.map((link, i) => (
                  <motion.div
                    key={link.label}
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.06 * i + 0.1, ease: [0.22, 1, 0.36, 1] }}
                    className="border-b border-line"
                  >
                    <a
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className="group flex items-center justify-between py-4 font-serif text-[1.7rem] leading-none text-ink transition-all hover:pl-2 hover:text-magenta"
                    >
                      {link.label}
                      <ChevronRight
                        className="h-5 w-5 -translate-x-2 text-magenta opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
                        strokeWidth={2}
                      />
                    </a>

                    {/* The mega menu is a hover panel, which means nothing on a
                        phone — the same category tree renders here as a
                        thumb-operable disclosure instead. */}
                    {link.href === "/shop" && (
                      <div className="pb-3">
                        <MobileCategoryNav onNavigate={() => setOpen(false)} />
                      </div>
                    )}
                  </motion.div>
                ))}
              </nav>

              <div className="mt-auto space-y-3 pt-8">
                {/* Your Bag — primary CTA. Lives inside the menu so the header
                    right cluster stays uncrowded on phones. Gradient + the
                    `shadow-glow-pink` design-system token give the “glow”;
                    the badge animates on count change via AnimatePresence. */}
                <button
                  onClick={() => { setOpen(false); openCart(); }}
                  aria-label={count > 0 ? `Open shopping bag, ${count} item${count > 1 ? "s" : ""}` : "Open shopping bag"}
                  className="flex w-full items-center justify-between rounded-2xl bg-gradient-to-r from-magenta to-magenta-deep px-4 py-4 text-white shadow-glow-pink transition-transform active:scale-[0.98]"
                >
                  <span className="inline-flex items-center gap-2.5 text-sm font-semibold">
                    <ShoppingBag className="h-4 w-4" strokeWidth={2} />
                    Your Bag
                  </span>
                  <span className="inline-flex items-center gap-2 text-sm font-semibold">
                    <AnimatePresence mode="popLayout">
                      {count > 0 && (
                        <motion.span
                          key={count}
                          initial={{ scale: 0, y: -4 }}
                          animate={{ scale: 1, y: 0 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ type: "spring", stiffness: 500, damping: 22 }}
                          className="grid h-5 min-w-5 place-items-center rounded-full bg-white px-1.5 text-[11px] font-bold text-magenta"
                        >
                          {count}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    {count > 0 ? "View →" : "Empty"}
                  </span>
                </button>

                {/* Skin Script Rewards — full-width accent row. Guests get a join CTA
                    rather than a points balance they don't have. */}
                <a
                  href={authed ? "/rewards" : "/account"}
                  onClick={(e) => {
                    setOpen(false);
                    if (!authed) {
                      e.preventDefault();
                      openAuth("signup");
                    }
                  }}
                  className="flex items-center justify-between rounded-2xl bg-petal px-4 py-3.5 transition-colors hover:bg-rose/25"
                >
                  <span className="inline-flex items-center gap-3 text-sm font-semibold text-magenta-deep">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-magenta">
                      <Sparkles className="h-4 w-4" strokeWidth={2} />
                    </span>
                    Skin Script Rewards
                  </span>
                  <span className="text-sm font-semibold text-magenta-deep">
                    {authed ? `${points} pts →` : "Join & earn →"}
                  </span>
                </a>

                {/* Account + Wishlist — equal tiles, icon + label + hint */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {
                      icon: Heart,
                      label: "Wishlist",
                      hint: wishCount > 0 ? `${wishCount} saved` : "Save your faves",
                      href: "/wishlist",
                      active: wishCount > 0,
                    },
                    {
                      icon: User,
                      label: authed ? "Account" : "Log in",
                      hint: authed ? "Profile & orders" : "Sign in or sign up",
                      href: "/account",
                      active: false,
                      auth: true,
                    },
                  ].map((tile) => (
                    <a
                      key={tile.label}
                      href={tile.href}
                      onClick={(e) => {
                        setOpen(false);
                        if (tile.auth && !authed) {
                          e.preventDefault();
                          openAuth("login");
                        }
                      }}
                      className="flex flex-col gap-3 rounded-2xl bg-white px-4 py-4 ring-1 ring-line transition-all hover:-translate-y-0.5 hover:ring-magenta/40"
                    >
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-petal text-magenta">
                        <tile.icon
                          className="h-4 w-4"
                          strokeWidth={1.8}
                          fill={tile.active ? "currentColor" : "none"}
                        />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-ink">
                          {tile.label}
                        </span>
                        <span className="block text-[11px] text-ink-soft">
                          {tile.hint}
                        </span>
                      </span>
                    </a>
                  ))}
                </div>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6, duration: 0.8 }}
                  className="pt-1 font-serif text-lg italic leading-snug text-magenta-deep"
                >
                  “{MOBILE_QUOTE}”
                </motion.p>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
