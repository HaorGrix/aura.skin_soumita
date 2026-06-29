import { motion } from "framer-motion";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useCart } from "../../context/CartContext.jsx";
import { formatPrice } from "../../lib/format.js";

/**
 * LineItem — a single cart row. `compact` = drawer styling; default = cart page.
 * `readOnly` hides the steppers (used in checkout summary).
 */
export default function LineItem({ item, compact = false, readOnly = false }) {
  const { inc, dec, removeItem } = useCart();
  const thumb = compact ? "h-16 w-16" : "h-24 w-24";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="flex gap-3.5"
    >
      <a
        href={`#/product/${item.id}`}
        className={`${thumb} shrink-0 overflow-hidden rounded-xl ring-1 ring-line dark:ring-white/10`}
        style={{
          background: `radial-gradient(120% 100% at 50% 0%, #fff 0%, ${item.tone} 75%, #ffe1ec 100%)`,
        }}
        aria-label={item.name}
      >
        {item.image && (
          <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
        )}
      </a>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-magenta">
              {item.brand}
            </p>
            <a
              href={`#/product/${item.id}`}
              className={`block truncate font-serif text-ink hover:text-magenta dark:text-white ${
                compact ? "text-sm" : "text-base sm:text-lg"
              }`}
            >
              {item.name}
            </a>
            {!compact && (
              <p className="mt-0.5 text-xs text-ink-soft dark:text-white/50">{item.category}</p>
            )}
          </div>
          {!readOnly && (
            <button
              onClick={() => removeItem(item.id)}
              aria-label={`Remove ${item.name}`}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-soft transition-colors hover:bg-error/10 hover:text-error dark:text-white/50"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.7} />
            </button>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between pt-2">
          {readOnly ? (
            <span className="text-sm text-ink-soft dark:text-white/60">Qty {item.qty}</span>
          ) : (
            <div className="flex items-center rounded-full border border-ink/15 dark:border-white/15">
              <button
                onClick={() => dec(item.id)}
                aria-label="Decrease quantity"
                className="grid h-8 w-8 place-items-center rounded-full text-ink-soft transition-colors hover:text-magenta dark:text-white/60"
              >
                <Minus className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
              <span className="w-7 text-center text-sm font-semibold tabular-nums text-ink dark:text-white">
                {item.qty}
              </span>
              <button
                onClick={() => inc(item.id)}
                aria-label="Increase quantity"
                className="grid h-8 w-8 place-items-center rounded-full text-ink-soft transition-colors hover:text-magenta dark:text-white/60"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </div>
          )}

          <span className="font-semibold tabular-nums text-ink dark:text-white">
            {formatPrice(item.price * item.qty)}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
