import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Search,
  Heart,
  ShoppingBag,
  User,
  Menu,
  X,
  Sun,
  Moon,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { useCart } from "../context/CartContext.jsx";
import { useUser } from "../context/UserContext.jsx";
import { useWishlist } from "../context/WishlistContext.jsx";

const LINKS = [
  { label: "Shop", href: "#/shop" },
  { label: "Rewards", href: "#/account" },
  { label: "Rituals", href: "#rituals" },
  { label: "Journal", href: "#journal" },
  { label: "About", href: "#/about" },
  { label: "Contact", href: "#/contact" },
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

const PILLS = [
  "You are beautiful 🌸",
  "Your glow is yours alone ✨",
  "Soft skin, softer heart 💗",
  "Radiance from within 🌟",
  "You are enough, always 💖",
  "Bloom at your own pace 🌺",
  "Glass skin, glowing soul 🫧",
  "Self-care is sacred 🕊️",
];

const MOBILE_QUOTE = "Glass skin is a daily ritual — and you’re already glowing. 🌸";

export default function Navbar({ onToggleTheme, isDark }) {
  const reduce = useReducedMotion();
  const { count, openCart } = useCart();
  const { points } = useUser();
  const { count: wishCount } = useWishlist();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const iconBtn =
    "relative grid h-10 w-10 place-items-center rounded-full text-ink/75 " +
    "transition-colors hover:bg-petal hover:text-magenta " +
    "dark:text-white/80 dark:hover:bg-white/10 dark:hover:text-rose";

  return (
    <>
      <motion.header
        initial={{ y: -90, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="fixed inset-x-0 top-0 z-50"
      >
        {/* Brand announcement marquee (replacing the old black announcement bar) */}
        <div className="marquee-pause relative flex overflow-hidden border-y border-line py-5 dark:border-white/10">
          <div className="animate-marquee flex shrink-0 items-center gap-4 pr-4">
            {[...PILLS, ...PILLS].map((p, i) => (
              <span
                key={i}
                className="whitespace-nowrap font-serif text-2xl text-ink-soft dark:text-white/55 sm:text-3xl"
              >
                {p}
                <span className="mx-4 text-magenta">·</span>
              </span>
            ))}
          </div>
        </div>

        <div
          className={`mx-auto flex max-w-7xl items-center justify-between px-5 transition-all duration-500 sm:px-8 ${
            scrolled ? "my-2 rounded-full glass shadow-soft py-2.5" : "py-4"
          }`}
        >
          {/* Logo */}
          <a
            href="#/"
            className="font-serif text-2xl tracking-tight text-ink dark:text-white"
          >
            aura<span className="text-magenta">.</span>skin
          </a>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 lg:flex">
            {LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="group relative rounded-full px-4 py-2 text-sm font-medium text-ink/70 transition-colors hover:text-ink dark:text-white/70 dark:hover:text-white"
              >
                {link.label}
                <span className="absolute inset-x-4 -bottom-0.5 h-0.5 origin-left scale-x-0 rounded-full bg-magenta transition-transform duration-300 group-hover:scale-x-100" />
              </a>
            ))}
          </nav>

          {/* Right cluster */}
          <div className="flex items-center gap-0.5 sm:gap-1">
            <button className={iconBtn} aria-label="Search">
              <Search className="h-[18px] w-[18px]" strokeWidth={1.7} />
            </button>
            {/* Wishlist — navigates to the dedicated wishlist page */}
            <a
              href="#/wishlist"
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
              aria-label="Cart"
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

            {/* Loyalty points pill — global, links to the Rewards/Account page */}
            <a
              href="#/account"
              aria-label={`You have ${points} loyalty points`}
              className="hidden items-center gap-1.5 rounded-full bg-petal px-3 py-1.5 text-xs font-semibold text-magenta transition-colors hover:bg-rose/30 sm:inline-flex dark:bg-white/10 dark:text-rose dark:hover:bg-white/15"
            >
              <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
              {points} pts
            </a>

            <a href="#/account" className={`${iconBtn} hidden sm:grid`} aria-label="Account">
              <User className="h-[18px] w-[18px]" strokeWidth={1.7} />
            </a>

            <button className={iconBtn} aria-label="Toggle theme" onClick={onToggleTheme}>
              {isDark ? (
                <Sun className="h-[18px] w-[18px]" strokeWidth={1.7} />
              ) : (
                <Moon className="h-[18px] w-[18px]" strokeWidth={1.7} />
              )}
            </button>

            <button
              className={`${iconBtn} lg:hidden`}
              aria-label="Open menu"
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
              className="fixed inset-y-0 right-0 z-[var(--z-modal)] flex w-[86%] max-w-sm flex-col bg-white px-7 pb-10 pt-6 shadow-lift dark:bg-[#0a0a0b] lg:hidden"
              initial={{ x: reduce ? 0 : "100%" }}
              animate={{ x: 0 }}
              exit={{ x: reduce ? 0 : "100%" }}
              transition={{ type: "spring", stiffness: 260, damping: 30 }}
            >
              <div className="flex items-center justify-between">
                <span className="font-serif text-2xl text-ink dark:text-white">
                  aura<span className="text-magenta">.</span>skin
                </span>
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
                  <motion.a
                    key={link.label}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.06 * i + 0.1, ease: [0.22, 1, 0.36, 1] }}
                    className="group flex items-center justify-between border-b border-line py-4 font-serif text-[1.7rem] leading-none text-ink transition-all hover:pl-2 hover:text-magenta dark:border-white/10 dark:text-white/90 dark:hover:text-rose"
                  >
                    {link.label}
                    <ChevronRight
                      className="h-5 w-5 -translate-x-2 text-magenta opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 dark:text-rose"
                      strokeWidth={2}
                    />
                  </motion.a>
                ))}
              </nav>

              <div className="mt-auto space-y-3 pt-8">
                {/* Your Bag — primary CTA. Lives inside the menu so the header
                    right cluster stays uncrowded on phones. Gradient + the
                    `shadow-glow-pink` design-system token give the “glow”;
                    the badge animates on count change via AnimatePresence. */}
                <button
                  onClick={() => { setOpen(false); openCart(); }}
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

                {/* Aura Rewards — full-width accent row */}
                <a
                  href="#/account"
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between rounded-2xl bg-petal px-4 py-3.5 transition-colors hover:bg-rose/25 dark:bg-white/10 dark:hover:bg-white/15"
                >
                  <span className="inline-flex items-center gap-3 text-sm font-semibold text-magenta-deep dark:text-rose">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-magenta dark:bg-white/10 dark:text-rose">
                      <Sparkles className="h-4 w-4" strokeWidth={2} />
                    </span>
                    Aura Rewards
                  </span>
                  <span className="text-sm font-semibold text-magenta-deep dark:text-rose">
                    {points} pts →
                  </span>
                </a>

                {/* Account + Wishlist — equal tiles, icon + label + hint */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {
                      icon: Heart,
                      label: "Wishlist",
                      hint: wishCount > 0 ? `${wishCount} saved` : "Save your faves",
                      href: "#/wishlist",
                      active: wishCount > 0,
                    },
                    {
                      icon: User,
                      label: "Account",
                      hint: "Profile & orders",
                      href: "#/account",
                      active: false,
                    },
                  ].map((tile) => (
                    <a
                      key={tile.label}
                      href={tile.href}
                      onClick={() => setOpen(false)}
                      className="flex flex-col gap-3 rounded-2xl bg-white px-4 py-4 ring-1 ring-line transition-all hover:-translate-y-0.5 hover:ring-magenta/40 dark:bg-white/5 dark:ring-white/10"
                    >
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-petal text-magenta dark:bg-white/10 dark:text-rose">
                        <tile.icon
                          className="h-4 w-4"
                          strokeWidth={1.8}
                          fill={tile.active ? "currentColor" : "none"}
                        />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-ink dark:text-white">
                          {tile.label}
                        </span>
                        <span className="block text-[11px] text-ink-soft dark:text-white/55">
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
                  className="pt-1 font-serif text-lg italic leading-snug text-magenta-deep dark:text-rose"
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
