import { useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Star,
  Heart,
  Minus,
  Plus,
  ShoppingBag,
  Check,
  Loader2,
  Truck,
  ShieldCheck,
  Leaf,
  Sparkles,
  Bell,
} from "lucide-react";
import Badge from "../ui/Badge.jsx";
import NotifyMeModal from "../ui/NotifyMeModal.jsx";
import { useCart } from "../../context/CartContext.jsx";
import { useWishlist } from "../../context/WishlistContext.jsx";
import { useToast } from "../ui/Toast.jsx";
import { formatPrice } from "../../lib/format.js";
import { useStoreSettings } from "../../lib/api/settings.js";

function Stars({ value, className = "h-4 w-4" }) {
  return (
    <span className="inline-flex">
      {[0, 1, 2, 3, 4].map((i) => (
        <Star
          key={i}
          className={className}
          fill={i < Math.round(value) ? "var(--color-gold)" : "transparent"}
          stroke={i < Math.round(value) ? "var(--color-gold)" : "currentColor"}
          strokeWidth={1.5}
        />
      ))}
    </span>
  );
}

const TRUST = [
  { icon: Leaf, label: "Cruelty-Free" },
  { icon: ShieldCheck, label: "Authentic Guaranteed" },
  { icon: Sparkles, label: "Dermatologist-Tested" },
];

export default function ProductInfo({ product, onWriteReview }) {
  const reduce = useReducedMotion();
  const { addItem } = useCart();
  const { has: wishHas, toggle: wishToggle } = useWishlist();
  const { toast } = useToast();
  const { freeShippingThreshold } = useStoreSettings();

  // One flat list of size options (real product_variants rows), not the old
  // "variant groups with price deltas" model — a product only ever varies
  // by size here. Pick the DB's own default (matches what the card/Shop
  // grid already show), falling back to the first option if something odd
  // happened to the data (e.g. every row's is_default came back false).
  const variants = product.variants ?? [];
  const [variantId, setVariantId] = useState(
    () => variants.find((v) => v.isDefault)?.id ?? variants[0]?.id ?? null
  );
  const selectedVariant = variants.find((v) => v.id === variantId) ?? variants[0] ?? null;

  const [qty, setQty] = useState(1);
  // Order-size cap is public (products_public.max_per_order); exact stock
  // counts deliberately are NOT (see 0005/0016's privacy rule) — in-stock
  // state is a boolean per variant, which is all the stepper needs to gate
  // on. maxPerOrder is a per-PRODUCT policy, same limit across every size.
  const maxQty = product.maxPerOrder ?? 10;
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const wished = wishHas(product.id);
  const [notify, setNotify] = useState(false); // back-in-stock modal
  const [flights, setFlights] = useState([]);

  function handleWishlist() {
    const nowWished = wishToggle(product.id);
    nowWished
      ? toast.success(`${product.brand} — ${product.name}`, "Saved to wishlist 💖")
      : toast.show({ title: "Removed from wishlist", message: product.name, variant: "info" });
  }
  const addBtnRef = useRef(null);

  // The selected size's own price/sale state — no delta math.
  //
  // Falls back to the product's (mirrored default-variant) figures ONLY
  // when there's no selected variant at all — variants came back empty and
  // getProductBySlug's synthetic single-entry fallback didn't apply either.
  // Falling back FIELD BY FIELD (the previous version) was a real bug: a
  // variant with no compare-at price has `compareAt: undefined`, and `??`
  // can't tell that apart from "no variant selected" — so switching to a
  // size with no sale would silently inherit the PRODUCT's (i.e. some
  // OTHER variant's) compare-at price instead of correctly showing none.
  // Caught live: the 150ml size (no sale) picked up 30ml's ৳2500 compare-at
  // in the cart line data. Harmless in the UI (gated behind isOnSale, which
  // itself doesn't leak this way — it's a real boolean either way), but it
  // was still wrong data sitting in the cart line.
  const unitPrice = selectedVariant ? selectedVariant.price : product.price;
  const unitCompareAt = selectedVariant ? selectedVariant.compareAt : (product.compareAt ?? product.originalPrice);
  const unitIsOnSale = selectedVariant ? selectedVariant.isOnSale : product.isOnSale;
  const unitDiscountPercent = selectedVariant ? selectedVariant.discountPercent : product.discountPercent;
  const unitInStock = selectedVariant ? selectedVariant.inStock : product.inStock;
  const unitIsLowStock = selectedVariant ? selectedVariant.isLowStock : product.isLowStock;

  function flyToCart() {
    if (reduce || !addBtnRef.current) return;
    const r = addBtnRef.current.getBoundingClientRect();
    const id = Date.now();
    setFlights((f) => [...f, { id, x: r.left + r.width / 2, y: r.top, tone: product.tone }]);
    setTimeout(() => setFlights((f) => f.filter((fl) => fl.id !== id)), 850);
  }

  function handleAdd() {
    if (!unitInStock || adding) return;
    setAdding(true);
    flyToCart();
    setTimeout(() => {
      // The specific SIZE goes into the bag, not the base product — variantId
      // is what checkout sends to place_order(), which prices, locks stock
      // and writes the order line against that exact variant.
      addItem(
        {
          ...product,
          price: unitPrice,
          compareAt: unitCompareAt,
          isOnSale: unitIsOnSale,
          discountPercent: unitDiscountPercent,
          variantId: selectedVariant?.id ?? null,
          sizeLabel: variants.length > 1 ? selectedVariant?.sizeLabel : null,
        },
        qty
      );
      setAdding(false);
      setAdded(true);
      toast.cart(`${product.brand} — ${product.name} ×${qty}`);
      setTimeout(() => setAdded(false), 1600);
    }, 700);
  }

  return (
    // min-w-0: same grid-item shrink fix as Gallery.jsx's root — belt and
    // braces here, since this is the other direct child of the same grid row.
    <div className="min-w-0 lg:sticky lg:top-32 lg:self-start">
      {/* Brand + name */}
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-magenta">
        {product.brand}
      </p>
      <h1 className="mt-2 font-display text-[clamp(1.9rem,4vw,2.75rem)] leading-tight text-ink">
        {product.name}
      </h1>

      {/* Badges — the same set ProductCard shows on the Shop grid (New,
          Bestseller, Staff Pick, Limited Edition). Sale isn't repeated here:
          the price section below already shows the "-X%" pill + struck-
          through compare-at, which is this page's equivalent of the Shop
          card's discount ribbon — a second Sale badge here would just say
          the same thing twice. */}
      {(product.isNew || product.badge || product.isStaffPick || product.isLimitedEdition) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {product.isNew && <Badge variant="new">New</Badge>}
          {product.badge && product.badge.variant !== "new" && (
            <Badge variant={product.badge.variant}>{product.badge.label}</Badge>
          )}
          {product.isStaffPick && <Badge variant="staffPick">Staff Pick</Badge>}
          {product.isLimitedEdition && <Badge variant="limited">Limited Edition</Badge>}
        </div>
      )}

      {/* Rating */}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <span className="inline-flex items-center gap-1.5 text-ink-soft">
          <Stars value={product.rating} />
          <span className="font-semibold text-ink">{product.rating.toFixed(1)}</span>
          <span>({product.reviewCount.toLocaleString()} reviews)</span>
        </span>
        <button
          onClick={onWriteReview}
          className="text-sm font-medium text-magenta hover:underline"
        >
          Write a review
        </button>
      </div>

      {/* Price — reflects whichever size is selected below */}
      <div className="mt-5 flex items-center gap-3">
        <span
          className={`font-sans font-semibold text-3xl ${
            unitIsOnSale ? "text-magenta" : "text-ink"
          }`}
        >
          {formatPrice(unitPrice)}
        </span>
        {unitIsOnSale && unitCompareAt > unitPrice && (
          <>
            <span className="font-sans text-lg text-ink-soft line-through">
              {formatPrice(unitCompareAt)}
            </span>
            <span className="rounded-full bg-magenta px-2.5 py-1 text-xs font-bold text-white">
              -{unitDiscountPercent}%
            </span>
          </>
        )}
      </div>

      {/* Benefit badges */}
      {product.benefits.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {product.benefits.map((b) => (
            <span
              key={b.label}
              className="inline-flex items-center gap-1.5 rounded-full bg-petal px-3 py-1.5 text-xs font-medium text-ink ring-1 ring-rose/30"
            >
              <span>{b.emoji}</span> {b.label}
            </span>
          ))}
        </div>
      )}

      {/* Short description */}
      <p className="mt-5 text-pretty leading-relaxed text-ink-soft">
        {product.longDescription}
      </p>

      {/* Size — hidden entirely for a single-size product, so it looks
          exactly like it always did. Only shows once there's an actual
          choice to make. */}
      {variants.length > 1 && (
        <div className="mt-6">
          <p className="mb-2 text-sm font-semibold text-ink">
            Size:{" "}
            <span className="font-normal text-ink-soft">
              {selectedVariant?.sizeLabel}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => {
              const on = v.id === variantId;
              return (
                <button
                  key={v.id}
                  onClick={() => { setVariantId(v.id); setQty(1); }}
                  disabled={!v.inStock}
                  title={!v.inStock ? `${v.sizeLabel} is out of stock` : undefined}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                    on
                      ? "border-magenta bg-magenta text-white"
                      : !v.inStock
                      ? "cursor-not-allowed border-ink/10 text-ink-soft/50 line-through"
                      : "border-ink/15 text-ink hover:border-magenta/50"
                  }`}
                >
                  {v.sizeLabel}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Quantity + Add to Bag */}
      <div className="mt-7 flex items-stretch gap-3">
        <div className="flex items-center rounded-full border border-ink/15">
          <button
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            aria-label="Decrease quantity"
            className="grid h-12 w-12 place-items-center rounded-full text-ink-soft transition-colors hover:text-magenta disabled:opacity-40"
            disabled={qty <= 1}
          >
            <Minus className="h-4 w-4" strokeWidth={2} />
          </button>
          <span className="w-8 text-center font-semibold tabular-nums text-ink">
            {qty}
          </span>
          <button
            onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
            aria-label="Increase quantity"
            disabled={qty >= maxQty}
            className="grid h-12 w-12 place-items-center rounded-full text-ink-soft transition-colors hover:text-magenta disabled:pointer-events-none disabled:opacity-40"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <button
          ref={addBtnRef}
          onClick={unitInStock ? handleAdd : () => setNotify(true)}
          className={`group relative flex flex-1 items-center justify-center gap-2 overflow-hidden rounded-full px-6 text-sm font-semibold transition-all duration-500 ${
            !unitInStock
              ? "border border-magenta/50 bg-magenta/10 text-magenta hover:bg-magenta hover:text-white hover:shadow-[var(--shadow-glow-pink)]"
              : added
              ? "bg-success text-white"
              : "bg-magenta text-white hover:shadow-[var(--shadow-glow-pink)]"
          }`}
        >
          {!unitInStock ? (
            <span className="inline-flex items-center gap-2">
              <Bell className="h-4 w-4" strokeWidth={2} /> Out of Stock — Notify Me
            </span>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              {adding ? (
                <motion.span key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Adding…
                </motion.span>
              ) : added ? (
                <motion.span key="added" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} className="inline-flex items-center gap-2">
                  <Check className="h-5 w-5" strokeWidth={2.6} /> Added to Bag
                </motion.span>
              ) : (
                <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="inline-flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4" strokeWidth={2} /> Add to Bag
                  {/* Price is always visible on the mobile sticky bar — keep CTA short on small screens */}
                  <span className="hidden sm:inline">· {formatPrice(unitPrice * qty)}</span>
                </motion.span>
              )}
            </AnimatePresence>
          )}
        </button>

        <button
          onClick={handleWishlist}
          aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
          aria-pressed={wished}
          /* Matches the +/- and Add-to-Bag heights so the row never overflows on mobile */
          className={`grid h-12 w-12 shrink-0 place-items-center rounded-full border transition-colors ${
            wished
              ? "border-magenta bg-magenta/5 text-magenta"
              : "border-ink/15 hover:border-magenta/50"
          }`}
        >
          <motion.span
            key={String(wished)}
            initial={wished ? { scale: 0.6 } : false}
            animate={wished ? { scale: [0.6, 1.3, 1] } : { scale: 1 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <Heart
              className="h-5 w-5"
              fill={wished ? "var(--color-magenta)" : "none"}
              stroke={wished ? "var(--color-magenta)" : "currentColor"}
              strokeWidth={1.8}
            />
          </motion.span>
        </button>
      </div>

      {/* Stock + shipping hint. Exact counts are never exposed to shoppers
          (same privacy rule as the Shop grid) — "Only a few left" is the
          boolean urgency cue, not a real number. */}
      <div className="mt-4 flex items-center gap-2 text-sm text-ink-soft">
        {unitIsLowStock ? (
          <>
            <span className="inline-block h-2 w-2 rounded-full bg-error animate-pulse" />
            <span className="font-semibold text-magenta">
              Only a few left
            </span>
            · <Truck className="h-4 w-4" strokeWidth={1.7} /> Free shipping over {formatPrice(freeShippingThreshold)}
          </>
        ) : unitInStock ? (
          <>
            <span className="inline-block h-2 w-2 rounded-full bg-success" />
            In stock · <Truck className="h-4 w-4" strokeWidth={1.7} /> Free shipping over {formatPrice(freeShippingThreshold)}
          </>
        ) : (
          <>
            <span className="inline-block h-2 w-2 rounded-full bg-error" /> Currently unavailable — get notified when it’s back.
          </>
        )}
      </div>

      {/* Trust signals */}
      <div className="mt-6 flex flex-wrap gap-4 border-t border-line pt-5">
        {TRUST.map((t) => (
          <span key={t.label} className="inline-flex items-center gap-2 text-xs font-medium text-ink-soft">
            <t.icon className="h-4 w-4 text-cyan" strokeWidth={1.7} /> {t.label}
          </span>
        ))}
      </div>

      {/* Fly-to-cart flights */}
      <AnimatePresence>
        {flights.map((f) => (
          <motion.div
            key={f.id}
            className="pointer-events-none fixed z-[180] h-10 w-10 rounded-full ring-2 ring-white"
            style={{ left: f.x - 20, top: f.y - 20, background: `radial-gradient(circle at 30% 30%, #fff, ${f.tone})` }}
            initial={{ scale: 1, opacity: 1 }}
            animate={{
              x: window.innerWidth - f.x - 24,
              y: -(f.y - 46),
              scale: 0.2,
              opacity: 0.2,
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: [0.5, 0, 0.4, 1] }}
          />
        ))}
      </AnimatePresence>

      {/* Mobile sticky add bar */}
      <MobileAddBar
        product={product}
        inStock={unitInStock}
        price={unitPrice * qty}
        adding={adding}
        added={added}
        onAdd={handleAdd}
        onNotify={() => setNotify(true)}
      />

      {/* Back-in-stock modal (shared component) */}
      <NotifyMeModal product={product} open={notify} onClose={() => setNotify(false)} />
    </div>
  );
}

/* Fixed bottom bar on mobile only */
function MobileAddBar({ product, inStock, price, adding, added, onAdd, onNotify }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-[90] border-t border-line bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
      <div className="flex items-center gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs text-ink-soft">{product.brand}</p>
          <p className="font-sans font-semibold text-lg leading-none text-ink">
            {formatPrice(price)}
          </p>
        </div>
        <button
          onClick={inStock ? onAdd : onNotify}
          className={`flex flex-1 items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold transition-colors ${
            !inStock
              ? "border border-magenta/50 bg-magenta/10 text-magenta"
              : added
              ? "bg-success text-white"
              : "bg-magenta text-white"
          }`}
        >
          {!inStock ? (
            <>
              <Bell className="h-4 w-4" strokeWidth={2} /> Notify Me
            </>
          ) : adding ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Adding…
            </>
          ) : added ? (
            <>
              <Check className="h-5 w-5" strokeWidth={2.6} /> Added
            </>
          ) : (
            <>
              <ShoppingBag className="h-4 w-4" strokeWidth={2} /> Add to Bag
            </>
          )}
        </button>
      </div>
    </div>
  );
}
