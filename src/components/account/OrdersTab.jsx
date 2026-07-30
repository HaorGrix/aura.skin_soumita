import { navigate } from "../../lib/navigate.js";
import { useState } from "react";
import { motion } from "framer-motion";
import { Package, Check, PenLine, Truck } from "lucide-react";
import { useUser } from "../../context/UserContext.jsx";
import { productById, POINTS_PER_REVIEW } from "../../data/reviews.js";
import { orderStatusLabel } from "../../lib/order-status.js";
import { formatPrice } from "../../lib/format.js";
import EmptyState from "../../components/ui/EmptyState.jsx";
import Button from "../../components/ui/Button.jsx";
import WriteReviewModal from "../../components/reviews/WriteReviewModal.jsx";
import OrderDetailsModal from "./OrderDetailsModal.jsx";
import TrackingModal from "../TrackingModal.jsx";

export default function OrdersTab() {
  const { orders, hasReviewed } = useUser();
  const [review, setReview] = useState(null); // product being reviewed
  const [activeOrder, setActiveOrder] = useState(null); // order details modal
  const [trackingOrder, setTrackingOrder] = useState(null); // order for tracking modal

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-6">
        <h2 className="font-serif text-2xl text-ink">Order History</h2>
        <p className="mt-1 text-sm text-ink-soft">
          View your past purchases and leave reviews to earn points.
        </p>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          emoji="🛍️"
          title="No orders yet"
          message="Your purchases will appear here, ready to review for points."
          actionLabel="Start shopping"
          onAction={() => (navigate("/shop"))}
        />
      ) : (
        <div className="space-y-5">
          {orders.map((order, oi) => (
            <div
              key={order.orderId}
              className="overflow-hidden rounded-[1.25rem] bg-snow ring-1 ring-line"
            >
              {/* Order header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:gap-4">
                <div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="font-semibold text-ink">#{order.orderId}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
                      <Check className="h-3 w-3" strokeWidth={3} /> {orderStatusLabel(order.timestamp)}
                    </span>
                  </div>
                  <span className="mt-1 block text-xs text-ink-soft">
                    Ordered{" "}
                    {new Date(order.date).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    className="text-xs inline-flex items-center gap-1.5"
                    onClick={() => setTrackingOrder(order)}
                  >
                    <Truck className="h-3.5 w-3.5" strokeWidth={2} />
                    <span className="hidden sm:inline">Track</span>
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-xs"
                    onClick={() => setActiveOrder(order)}
                  >
                    Details
                  </Button>
                </div>
              </div>

              {/* Items preview */}
              <ul className="divide-y divide-line">
                {order.items.map((id) => {
                  const p = productById[id];
                  if (!p) return null;
                  const reviewed = hasReviewed(id);
                  return (
                    <li key={id} className="flex items-center gap-4 px-5 py-4">
                      <a
                        href={`/product/${id}`}
                        className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl ring-1 ring-line"
                        style={{
                          background: `radial-gradient(120% 100% at 50% 0%, var(--color-white) 0%, ${p.tone} 75%, var(--color-petal-deep) 100%)`,
                        }}
                      >
                        {p.image && (
                          <img src={p.image} alt={p.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                        )}
                      </a>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-magenta">{p.brand}</p>
                        <a href={`/product/${id}`} className="line-clamp-1 font-medium text-ink transition-colors hover:text-magenta">
                          {p.name}
                        </a>
                        <p className="mt-0.5 text-sm text-ink-soft">{formatPrice(p.price)}</p>
                      </div>

                      {reviewed ? (
                        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success/10 px-3.5 py-2 text-xs font-semibold text-success">
                          <Check className="h-3.5 w-3.5" strokeWidth={2.6} /> Reviewed
                        </span>
                      ) : (
                        <button
                          onClick={() => setReview(p)}
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-magenta px-3.5 py-2 text-xs font-semibold text-white transition-shadow hover:shadow-[var(--shadow-glow-pink)]"
                        >
                          <PenLine className="h-3.5 w-3.5" strokeWidth={2} />
                          <span className="hidden sm:inline">Review · +{POINTS_PER_REVIEW} pts</span>
                          <span className="sm:hidden">Review</span>
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      <WriteReviewModal product={review} open={!!review} onClose={() => setReview(null)} />
      {activeOrder && <OrderDetailsModal order={activeOrder} onClose={() => setActiveOrder(null)} />}
      {trackingOrder && (
        <TrackingModal
          isOpen={!!trackingOrder}
          onClose={() => setTrackingOrder(null)}
          orderData={{
            number: trackingOrder.orderId,
            count: trackingOrder.items.length,
            total: trackingOrder.total,
            date: trackingOrder.date,
            timestamp: trackingOrder.timestamp,
            trackingNumber: trackingOrder.trackingNumber,
          }}
        />
      )}
    </motion.div>
  );
}
