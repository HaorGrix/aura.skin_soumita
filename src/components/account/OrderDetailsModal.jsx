import { motion, AnimatePresence } from "framer-motion";
import { X, Check } from "lucide-react";
import { productById } from "../../data/reviews.js";
import { formatPrice } from "../../lib/format.js";

export default function OrderDetailsModal({ order, onClose }) {
  if (!order) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
          className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-[1.75rem] bg-white shadow-lift dark:bg-[#0f0f12] dark:ring-1 dark:ring-white/10"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-line px-6 py-5 dark:border-white/10">
            <div>
              <h2 className="font-serif text-xl text-ink dark:text-white">Order #{order.orderId}</h2>
              <div className="mt-1 flex items-center gap-2 text-sm text-ink-soft dark:text-white/60">
                <span>{new Date(order.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                <span>•</span>
                <span className="inline-flex items-center gap-1 font-semibold text-success">
                  <Check className="h-3.5 w-3.5" /> {order.status}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-snow text-ink-soft transition-colors hover:bg-line hover:text-ink dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="overflow-y-auto px-6 py-5 scrollbar-thin">
            <h3 className="mb-4 text-sm font-semibold text-ink dark:text-white">Items in your order</h3>
            <ul className="space-y-4">
              {order.items.map((id, index) => {
                const p = productById[id];
                if (!p) return null;
                // Assuming qty is 1 for seed orders as they don't specify qty
                return (
                  <li key={`${id}-${index}`} className="flex items-center gap-4">
                    <div
                      className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl ring-1 ring-line dark:ring-white/10"
                      style={{ background: `radial-gradient(120% 100% at 50% 0%, #fff 0%, ${p.tone} 75%, #ffe1ec 100%)` }}
                    >
                      {p.image && <img src={p.image} alt={p.name} className="absolute inset-0 h-full w-full object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-magenta">{p.brand}</p>
                      <p className="line-clamp-1 text-sm font-medium text-ink dark:text-white">{p.name}</p>
                      <p className="text-sm text-ink-soft dark:text-white/60">Qty: 1</p>
                    </div>
                    <p className="font-medium text-ink dark:text-white">{formatPrice(p.price)}</p>
                  </li>
                );
              })}
            </ul>

            <div className="my-6 border-t border-line dark:border-white/10" />

            {/* Summary */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-ink-soft dark:text-white/60">
                <span>Subtotal</span>
                <span>
                  {formatPrice(order.items.reduce((sum, id) => sum + (productById[id]?.price || 0), 0))}
                </span>
              </div>
              <div className="flex justify-between text-ink-soft dark:text-white/60">
                <span>Shipping</span>
                <span>Free</span>
              </div>
              <div className="flex justify-between pt-2 font-medium text-ink dark:text-white">
                <span>Total</span>
                <span>
                  {formatPrice(order.items.reduce((sum, id) => sum + (productById[id]?.price || 0), 0))}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
