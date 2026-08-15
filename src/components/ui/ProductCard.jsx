import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Heart, Eye, ShoppingBag, Check, Star, Bell } from "lucide-react";
import Badge from "./Badge.jsx";
import NotifyMeModal from "./NotifyMeModal.jsx";
import { useCart } from "../../context/CartContext.jsx";
import { useWishlist } from "../../context/WishlistContext.jsx";
import { useToast } from "./Toast.jsx";
import { surface } from "../../lib/design-system.js";
import { formatPrice } from "../../lib/format.js";

/**
 * ProductCard — the reusable product tile.
 *
 * product = {
 *   id, brand, name, price, compareAt?, rating?, reviews?, image?,
 *   badge?: { variant, label }, tone?  // tone = gradient fallback hue
 * }
 *
 * Features: hover lift + glow ring, image zoom, benefit badge, wishlist toggle,
 * quick-view trigger, and an "Add to Bag" button that morphs to ✓ with a spring.
 */
export default function ProductCard({ product, onQuickView }) {
  const reduce = useReducedMotion();
  const { addItem, openCart } = useCart();
  const { has: wishHas, toggle: wishToggle } = useWishlist();
  const { toast } = useToast();
  const [added, setAdded] = useState(false);
  const [notify, setNotify] = useState(false); // back-in-stock modal
  const wished = wishHas(product.id);

  const {
    brand,
    name,
    price,
    compareAt,
    originalPrice,
    isOnSale,
    discountPercent = 0,
    inStock = true,
    rating = 4.8,
    reviews = 0,
    image,
    badge,
    tone = "var(--color-petal)",
  } = product;

  const wasPrice = originalPrice ?? compareAt; // struck-through "before" price
  const onSale = isOnSale ?? (wasPrice && wasPrice > price);

  function handleAdd() {
    if (!inStock) return;
    addItem(product);
    setAdded(true);
    toast.cart(`${brand} — ${name}`);
    openCart();
    setTimeout(() => setAdded(false), 1400);
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      whileHover={reduce ? {} : { y: -8 }}
      className={`group relative flex flex-col overflow-hidden rounded-[1.25rem] ${surface.card} transition-shadow duration-500 hover:shadow-[var(--shadow-glow-pink)]`}
    >
      {/* Media */}
      <div className="relative aspect-[4/5] overflow-hidden">
        {/* Gradient fallback (always present behind image) */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background: `radial-gradient(120% 100% at 50% 0%, #ffffff 0%, ${tone} 70%, #ffe1ec 100%)`,
          }}
        />
        {image && (
          <img
            src={image}
            alt={`${brand} ${name}`}
            width="400"
            height="500"
            loading="lazy"
            decoding="async"
            className={`absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105 ${
              !inStock ? "grayscale" : ""
            }`}
          />
        )}

        {/* Stretched link to the PDP (sits beneath the action buttons) */}
        <a
          href={`/product/${product.id}`}
          aria-label={`View ${brand} ${name}`}
          className="absolute inset-0 z-[1]"
        />

        {/* Top-left stack: discount ribbon + benefit badge */}
        <div className="absolute left-3 top-3 z-10 flex flex-col items-start gap-1.5">
          {onSale && discountPercent > 0 && (
            <span className="rounded-md bg-magenta px-2 py-1 text-[11px] font-bold leading-none text-white shadow-[var(--shadow-glow-pink)]">
              -{discountPercent}%
            </span>
          )}
          {product.isNew && <Badge variant="new">New</Badge>}
          {badge && badge.variant !== "new" && <Badge variant={badge.variant}>{badge.label}</Badge>}
          {product.isStaffPick && <Badge variant="staffPick">Staff Pick</Badge>}
          {product.isLimitedEdition && <Badge variant="limited">Limited Edition</Badge>}
        </div>

        {/* Out-of-stock overlay */}
        {!inStock && (
          <div className="absolute inset-0 z-[2] grid place-items-center bg-ink/45 backdrop-blur-[1px]">
            <span className="rounded-full bg-white/90 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-ink">
              Out of Stock
            </span>
          </div>
        )}

        {/* Wishlist — global persistent state via WishlistContext */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const nowWished = wishToggle(product.id);
            nowWished
              ? toast.success(`${brand} — ${name}`, "Saved to wishlist 💖")
              : toast.show({ title: "Removed", message: name, variant: "info" });
          }}
          aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
          aria-pressed={wished}
          className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/80 text-ink/70 backdrop-blur transition-colors hover:text-magenta"
        >
          <motion.span
            key={String(wished)}
            initial={wished ? { scale: 0.6 } : false}
            animate={wished ? { scale: [0.6, 1.25, 1] } : { scale: 1 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <Heart
              className="h-[18px] w-[18px] transition-all"
              strokeWidth={1.8}
              fill={wished ? "var(--color-magenta)" : "none"}
              stroke={wished ? "var(--color-magenta)" : "currentColor"}
            />
          </motion.span>
        </button>

        {/* Quick view (reveals on hover) */}
        {onQuickView && (
          <div className="absolute inset-x-3 bottom-3 z-10 translate-y-3 opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
            <button
              onClick={() => onQuickView(product)}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-white/90 py-2.5 text-xs font-semibold text-ink backdrop-blur transition-colors hover:bg-white"
            >
              <Eye className="h-4 w-4" strokeWidth={1.8} /> Quick View
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-magenta">
          {brand}
        </p>
        <h3 className="mt-1 line-clamp-2 font-display uppercase text-lg leading-snug text-ink">
          <a href={`/product/${product.id}`} className="transition-colors hover:text-magenta">
            {name}
          </a>
        </h3>

        {/* Rating */}
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-soft">
          <Star className="h-3.5 w-3.5 text-gold" fill="var(--color-gold)" strokeWidth={0} />
          <span className="font-medium text-ink">{rating.toFixed(1)}</span>
          {reviews > 0 && <span>({reviews.toLocaleString()})</span>}
        </div>

        {/* Price + Add — locked to the bottom via mt-auto so it aligns across
            every card regardless of title length or rating presence.
            flex-wrap: the "Notify Me" pill (icon + text) is wider than the
            in-stock quick-add circle, and on a narrow 2-col mobile card
            there isn't always room for it beside the price on one line —
            without wrap that overflowed the card's right edge instead of
            dropping to its own line underneath. */}
        <div className="mt-auto flex flex-wrap items-end justify-between gap-x-3 gap-y-2 pt-4">
          <div className="flex items-baseline gap-2">
            <span
              className={`font-display uppercase text-base tabular-nums ${
                onSale ? "text-magenta" : "text-ink"
              }`}
            >
              {formatPrice(price)}
            </span>
            {onSale && wasPrice && (
              <span className="font-display uppercase text-xs text-ink-soft line-through">
                {formatPrice(wasPrice)}
              </span>
            )}
          </div>

          {/* In stock → quick-add circle. Out of stock → Notify Me pill. */}
          {inStock ? (
            <button
              onClick={handleAdd}
              aria-label={`Add ${name} to bag`}
              className={`relative grid h-10 w-10 place-items-center overflow-hidden rounded-full border transition-all duration-500 ${
                added
                  ? "border-success bg-success text-white"
                  : "border-cyan/50 bg-cyan/5 text-cyan hover:border-magenta hover:bg-magenta hover:text-white hover:shadow-[var(--shadow-glow-pink)]"
              }`}
            >
              <AnimatePresence mode="wait" initial={false}>
                {added ? (
                  <motion.span
                    key="check"
                    initial={{ scale: 0, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  >
                    <Check className="h-[18px] w-[18px]" strokeWidth={2.4} />
                  </motion.span>
                ) : (
                  /* Shopping-bag icon = unambiguous "adds to cart" affordance
                     (was a `+` which read like quantity-increment). */
                  <motion.span
                    key="bag"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ShoppingBag className="h-[18px] w-[18px]" strokeWidth={1.9} />
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          ) : (
            <button
              onClick={() => setNotify(true)}
              aria-label={`Notify me when ${name} is back in stock`}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-magenta/40 bg-magenta/5 px-3 py-2 text-xs font-semibold text-magenta transition-colors hover:bg-magenta hover:text-white"
            >
              <Bell className="h-3.5 w-3.5" strokeWidth={2} /> Notify Me
            </button>
          )}
        </div>
      </div>

      <NotifyMeModal product={product} open={notify} onClose={() => setNotify(false)} />
    </motion.article>
  );
}
