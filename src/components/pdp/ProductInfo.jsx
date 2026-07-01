import { useMemo, useRef, useState } from "react";
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
import Button from "../ui/Button.jsx";
import NotifyMeModal from "../ui/NotifyMeModal.jsx";
import { useCart } from "../../context/CartContext.jsx";
import { useWishlist } from "../../context/WishlistContext.jsx";
import { useToast } from "../ui/Toast.jsx";
import { formatPrice } from "../../lib/format.js";

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

export default function ProductInfo({ product, related = [], onWriteReview }) {
  const reduce = useReducedMotion();
  const { addItem } = useCart();
  const { has: wishHas, toggle: wishToggle } = useWishlist();
  const { toast } = useToast();

  const [variant, setVariant] = useState(() =>
    Object.fromEntries(product.variants.map((g) => [g.name, g.options[0].id]))
  );
  const [qty, setQty] = useState(1);
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

  // Live price reflects selected variant deltas.
  const unitPrice = useMemo(() => {
    let delta = 0;
    for (const g of product.variants) {
      const opt = g.options.find((o) => o.id === variant[g.name]);
      if (opt) delta += opt.priceDelta;
    }
    return product.price + delta;
  }, [product, variant]);

  function flyToCart() {
    if (reduce || !addBtnRef.current) return;
    const r = addBtnRef.current.getBoundingClientRect();
    const id = Date.now();
    setFlights((f) => [...f, { id, x: r.left + r.width / 2, y: r.top, tone: product.tone }]);
    setTimeout(() => setFlights((f) => f.filter((fl) => fl.id !== id)), 850);
  }

  function handleAdd() {
    if (!product.inStock || adding) return;
    setAdding(true);
    flyToCart();
    setTimeout(() => {
      for (let i = 0; i < qty; i++) addItem({ ...product, price: unitPrice });
      setAdding(false);
      setAdded(true);
      toast.cart(`${product.brand} — ${product.name} ×${qty}`);
      setTimeout(() => setAdded(false), 1600);
    }, 700);
  }

  const bundle = useMemo(() => [product, ...related.slice(0, 2)], [product, related]);
  const bundleTotal = bundle.reduce((s, p) => s + p.price, 0);

  function addBundle() {
    bundle.forEach((p) => addItem(p));
    toast.cart(`Ritual bundle · ${bundle.length} items added`);
  }

  return (
    <div className="lg:sticky lg:top-32 lg:self-start">
      {/* Brand + name */}
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-magenta">
        {product.brand}
      </p>
      <h1 className="mt-2 font-serif text-[clamp(1.9rem,4vw,2.75rem)] leading-tight text-ink dark:text-white">
        {product.name}
      </h1>

      {/* Rating */}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <span className="inline-flex items-center gap-1.5 text-ink-soft dark:text-white/60">
          <Stars value={product.rating} />
          <span className="font-semibold text-ink dark:text-white">{product.rating.toFixed(1)}</span>
          <span>({product.reviewCount.toLocaleString()} reviews)</span>
        </span>
        <button
          onClick={onWriteReview}
          className="text-sm font-medium text-magenta hover:underline"
        >
          Write a review
        </button>
      </div>

      {/* Price */}
      <div className="mt-5 flex items-center gap-3">
        <span
          className={`font-serif text-3xl ${
            product.isOnSale ? "text-magenta" : "text-ink dark:text-white"
          }`}
        >
          {formatPrice(unitPrice)}
        </span>
        {product.isOnSale && product.originalPrice > unitPrice && (
          <>
            <span className="text-lg text-ink-soft line-through dark:text-white/45">
              {formatPrice(product.originalPrice)}
            </span>
            <span className="rounded-full bg-magenta px-2.5 py-1 text-xs font-bold text-white">
              -{product.discountPercent}%
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
              className="inline-flex items-center gap-1.5 rounded-full bg-petal px-3 py-1.5 text-xs font-medium text-ink ring-1 ring-rose/30 dark:bg-white/5 dark:text-white/85 dark:ring-white/10"
            >
              <span>{b.emoji}</span> {b.label}
            </span>
          ))}
        </div>
      )}

      {/* Short description */}
      <p className="mt-5 text-pretty leading-relaxed text-ink-soft dark:text-white/70">
        {product.longDescription}
      </p>

      {/* Variants */}
      {product.variants.map((g) => (
        <div key={g.name} className="mt-6">
          <p className="mb-2 text-sm font-semibold text-ink dark:text-white">
            {g.name}:{" "}
            <span className="font-normal text-ink-soft dark:text-white/60">
              {variant[g.name]}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            {g.options.map((o) => {
              const on = variant[g.name] === o.id;
              return (
                <button
                  key={o.id}
                  onClick={() => setVariant((v) => ({ ...v, [g.name]: o.id }))}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                    on
                      ? "border-magenta bg-magenta text-white"
                      : "border-ink/15 text-ink hover:border-magenta/50 dark:border-white/15 dark:text-white/80"
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Quantity + Add to Bag */}
      <div className="mt-7 flex items-stretch gap-3">
        <div className="flex items-center rounded-full border border-ink/15 dark:border-white/15">
          <button
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            aria-label="Decrease quantity"
            className="grid h-12 w-12 place-items-center rounded-full text-ink-soft transition-colors hover:text-magenta disabled:opacity-40 dark:text-white/60"
            disabled={qty <= 1}
          >
            <Minus className="h-4 w-4" strokeWidth={2} />
          </button>
          <span className="w-8 text-center font-semibold tabular-nums text-ink dark:text-white">
            {qty}
          </span>
          <button
            onClick={() => setQty((q) => Math.min(10, q + 1))}
            aria-label="Increase quantity"
            className="grid h-12 w-12 place-items-center rounded-full text-ink-soft transition-colors hover:text-magenta dark:text-white/60"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <button
          ref={addBtnRef}
          onClick={product.inStock ? handleAdd : () => setNotify(true)}
          className={`group relative flex flex-1 items-center justify-center gap-2 overflow-hidden rounded-full px-6 text-sm font-semibold transition-all duration-500 ${
            !product.inStock
              ? "border border-magenta/50 bg-magenta/10 text-magenta hover:bg-magenta hover:text-white hover:shadow-[var(--shadow-glow-pink)] dark:bg-magenta/15"
              : added
              ? "bg-success text-white"
              : "bg-magenta text-white hover:shadow-[var(--shadow-glow-pink)]"
          }`}
        >
          {!product.inStock ? (
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
              : "border-ink/15 hover:border-magenta/50 dark:border-white/15"
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

      {/* Stock + shipping hint */}
      <div className="mt-4 flex items-center gap-2 text-sm text-ink-soft dark:text-white/60">
        {product.inStock ? (
          <>
            <span className="inline-block h-2 w-2 rounded-full bg-success" />
            In stock · <Truck className="h-4 w-4" strokeWidth={1.7} /> Free shipping over ৳6000
          </>
        ) : (
          <>
            <span className="inline-block h-2 w-2 rounded-full bg-error" /> Currently unavailable — get notified when it’s back.
          </>
        )}
      </div>

      {/* Frequently bought together / Add to Ritual */}
      {bundle.length === 3 && (
        <div className="mt-7 rounded-[1.25rem] bg-snow p-4 ring-1 ring-line dark:bg-white/[0.03] dark:ring-white/10">
          <p className="mb-3 text-sm font-semibold text-ink dark:text-white">
            ✨ Complete the ritual — frequently bought together
          </p>
          <div className="flex items-center gap-2">
            {bundle.map((p, i) => (
              <div key={p.id} className="flex items-center gap-2">
                <div
                  className="h-14 w-14 shrink-0 rounded-xl ring-1 ring-line dark:ring-white/10"
                  style={{ background: `radial-gradient(120% 100% at 50% 0%, #fff 0%, ${p.tone} 75%, #ffe1ec 100%)` }}
                  title={`${p.brand} ${p.name}`}
                />
                {i < bundle.length - 1 && <Plus className="h-4 w-4 text-ink-soft" />}
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm text-ink-soft dark:text-white/60">
              Bundle total{" "}
              <span className="font-semibold text-ink dark:text-white">
                {formatPrice(bundleTotal)}
              </span>
            </span>
            <Button variant="secondary" size="sm" magnetic={false} onClick={addBundle}>
              Add all 3
            </Button>
          </div>
        </div>
      )}

      {/* Trust signals */}
      <div className="mt-6 flex flex-wrap gap-4 border-t border-line pt-5 dark:border-white/10">
        {TRUST.map((t) => (
          <span key={t.label} className="inline-flex items-center gap-2 text-xs font-medium text-ink-soft dark:text-white/60">
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
function MobileAddBar({ product, price, adding, added, onAdd, onNotify }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-[90] border-t border-line bg-white/90 px-4 py-3 backdrop-blur lg:hidden dark:border-white/10 dark:bg-[var(--color-ink)]/90">
      <div className="flex items-center gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs text-ink-soft dark:text-white/55">{product.brand}</p>
          <p className="font-serif text-lg leading-none text-ink dark:text-white">
            {formatPrice(price)}
          </p>
        </div>
        <button
          onClick={product.inStock ? onAdd : onNotify}
          className={`flex flex-1 items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold transition-colors ${
            !product.inStock
              ? "border border-magenta/50 bg-magenta/10 text-magenta dark:bg-magenta/15"
              : added
              ? "bg-success text-white"
              : "bg-magenta text-white"
          }`}
        >
          {!product.inStock ? (
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
