import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Star, ShoppingBag, Check } from "lucide-react";
import Badge from "../ui/Badge.jsx";
import Button from "../ui/Button.jsx";
import { useCart } from "../../context/CartContext.jsx";
import { useToast } from "../ui/Toast.jsx";
import { formatPrice } from "../../lib/format.js";
import { useBodyScrollLock } from "../../lib/scrollLock.js";

/** QuickViewModal — lightweight peek at a product without leaving the grid. */
export default function QuickViewModal({ product, onClose }) {
  const { addItem, openCart } = useCart();
  const { toast } = useToast();

  // Only lock while a product is actually open — this component is always
  // mounted on Shop, so an unconditional lock would freeze the page itself.
  useBodyScrollLock(!!product);

  useEffect(() => {
    if (!product) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [product, onClose]);

  return (
    <AnimatePresence>
      {product && (
        <div className="fixed inset-0 z-[var(--z-modal)] flex items-end justify-center p-0 sm:items-center sm:p-6">
          <motion.div
            className="absolute inset-0 bg-ink/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`${product.brand} ${product.name}`}
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 280, damping: 30 }}
            className="relative z-10 grid w-full max-w-3xl grid-cols-1 overflow-hidden rounded-t-[1.75rem] bg-white shadow-lift ring-1 ring-line sm:grid-cols-2 sm:rounded-[1.75rem]"
          >
            {/* Media */}
            <div className="relative aspect-square sm:aspect-auto">
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  background: `radial-gradient(120% 100% at 50% 0%, var(--color-white) 0%, ${product.tone} 70%, var(--color-petal-deep) 100%)`,
                }}
              />
              {product.image && (
                <img
                  src={product.image}
                  alt={`${product.brand} ${product.name}`}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}
              {/* Discount ribbon + benefit badge (stacked, matches the card) */}
              <div className="absolute left-4 top-4 flex flex-col items-start gap-1.5">
                {product.isOnSale && product.discountPercent > 0 && (
                  <span className="rounded-md bg-magenta px-2 py-1 text-[11px] font-bold leading-none text-white shadow-[var(--shadow-glow-pink)]">
                    -{product.discountPercent}%
                  </span>
                )}
                {product.badge && (
                  <Badge variant={product.badge.variant}>{product.badge.label}</Badge>
                )}
              </div>

              {/* Out-of-stock overlay */}
              {product.inStock === false && (
                <div className="absolute inset-0 z-[2] grid place-items-center bg-ink/45 backdrop-blur-[1px]">
                  <span className="rounded-full bg-white/90 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-ink">
                    Out of Stock
                  </span>
                </div>
              )}
            </div>

            {/* Details */}
            <div className="flex flex-col p-6 sm:p-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-magenta">
                {product.brand}
              </p>
              <h2 className="mt-1 font-serif text-2xl leading-snug text-ink">
                {product.name}
              </h2>

              <div className="mt-2 flex items-center gap-2 text-sm text-ink-soft">
                <Star className="h-4 w-4 text-gold" fill="var(--color-gold)" strokeWidth={0} />
                <span className="font-medium text-ink">
                  {product.rating.toFixed(1)}
                </span>
                <span>({product.reviews.toLocaleString()} reviews)</span>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-ink-soft">
                A {product.category.toLowerCase()} loved for{" "}
                {product.concern.slice(0, 2).join(" & ").toLowerCase()}. Formulated with{" "}
                {product.ingredients.join(", ")} for that lit-from-within glow. ✨
              </p>

              {/* Meta chips */}
              <div className="mt-5 flex flex-wrap gap-2">
                {product.concern.map((c) => (
                  <span
                    key={c}
                    className="rounded-full bg-petal px-2.5 py-1 text-[11px] font-medium text-magenta"
                  >
                    {c}
                  </span>
                ))}
                {product.skinType.map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-cyan/10 px-2.5 py-1 text-[11px] font-medium text-cyan"
                  >
                    {s}
                  </span>
                ))}
              </div>

              <div className="mt-auto flex items-center justify-between gap-4 pt-6">
                <div className="flex items-baseline gap-2">
                  <span
                    className={`text-2xl font-semibold tabular-nums ${
                      product.isOnSale ? "text-magenta" : "text-ink"
                    }`}
                  >
                    {formatPrice(product.price)}
                  </span>
                  {product.isOnSale && product.originalPrice && (
                    <span className="text-sm text-ink-soft line-through">
                      {formatPrice(product.originalPrice)}
                    </span>
                  )}
                </div>
                {product.inStock === false ? (
                  <button
                    disabled
                    className="inline-flex cursor-not-allowed items-center gap-2 rounded-full bg-ink/10 px-5 py-2.5 text-sm font-semibold text-ink-soft"
                  >
                    Out of Stock
                  </button>
                ) : (
                  <Button
                    variant="primary"
                    size="md"
                    magnetic={false}
                    onClick={() => {
                      addItem(product);
                      toast.cart(`${product.brand} — ${product.name}`);
                      onClose();
                      openCart();
                    }}
                  >
                    <ShoppingBag className="h-4 w-4" strokeWidth={2} /> Add to Bag
                  </Button>
                )}
              </div>

              <a
                href={`/product/${product.id}`}
                onClick={onClose}
                className="mt-3 inline-block text-center text-sm font-medium text-magenta hover:underline"
              >
                View full details →
              </a>
            </div>

            {/* Close */}
            <button
              onClick={onClose}
              aria-label="Close quick view"
              className="absolute right-4 top-4 z-20 grid h-9 w-9 place-items-center rounded-full bg-white/85 text-ink/70 backdrop-blur transition-colors hover:text-magenta"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
