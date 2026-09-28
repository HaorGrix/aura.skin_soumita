import { motion, AnimatePresence } from "framer-motion";
import { X, Check } from "lucide-react";
import { productById } from "../../data/reviews.js";
import { formatPrice } from "../../lib/format.js";

/* Lines and totals come from the receipt snapshot saved at checkout
 * (lib/order-receipt.js). Orders placed before snapshots existed fall back
 * to the bundled catalog for their items and to the order's saved total. */
function legacyLines(order) {
  return (order.items ?? []).flatMap((id) => {
    const p = productById[id];
    return p ? [{ id, name: p.name, brand: p.brand, size: null, qty: 1, price: p.price, image: p.image }] : [];
  });
}

export default function OrderDetailsModal({ order, onClose }) {
  if (!order) return null;
  const lines = order.lines ?? legacyLines(order);
  const itemsTotal = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
  const totals = order.totals ?? { subtotal: itemsTotal, discount: 0, shipping: 0, tax: 0, total: order.total ?? itemsTotal };

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
          className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-[1.75rem] bg-white shadow-lift"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-line px-6 py-5">
            <div>
              <h2 className="font-serif text-xl text-ink">Order #{order.orderId}</h2>
              <div className="mt-1 flex items-center gap-2 text-sm text-ink-soft">
                <span>{new Date(order.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                <span>•</span>
                <span className="inline-flex items-center gap-1 font-semibold text-success">
                  <Check className="h-3.5 w-3.5" /> Order placed
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-snow text-ink-soft transition-colors hover:bg-line hover:text-ink"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="overflow-y-auto px-6 py-5 scrollbar-thin">
            <h3 className="mb-4 font-display text-sm text-ink">Items in your order</h3>
            <ul className="space-y-4">
              {lines.map((l, index) => (
                <li key={`${l.id}-${index}`} className="flex items-center gap-4">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-snow ring-1 ring-line">
                    {l.image && <img src={l.image} alt={l.name} className="absolute inset-0 h-full w-full object-contain" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    {l.brand && <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-magenta">{l.brand}</p>}
                    <p className="line-clamp-1 text-sm font-medium text-ink">{l.name}</p>
                    <p className="text-sm text-ink-soft">{l.size ? `${l.size} · ` : ""}Qty: {l.qty}</p>
                  </div>
                  <p className="font-medium text-ink">{formatPrice(l.price * l.qty)}</p>
                </li>
              ))}
            </ul>

            <div className="my-6 border-t border-line" />

            {/* Summary */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-ink-soft">
                <span>Subtotal</span>
                <span>{formatPrice(totals.subtotal)}</span>
              </div>
              {totals.discount > 0 && (
                <div className="flex justify-between text-success">
                  <span>Discount{totals.couponCode ? ` (${totals.couponCode})` : ""}</span>
                  <span>−{formatPrice(totals.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-ink-soft">
                <span>Delivery</span>
                <span>{totals.shipping > 0 ? formatPrice(totals.shipping) : "Free"}</span>
              </div>
              <div className="flex justify-between pt-2 font-medium text-ink">
                <span>Total</span>
                <span>{formatPrice(totals.total)}</span>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
