import { navigate } from "../../lib/navigate.js";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Package, Check, PenLine, Truck, ShieldCheck } from "lucide-react";
import { useUser } from "../../context/UserContext.jsx";
import { productById } from "../../data/reviews.js";
import { useStoreSettings } from "../../lib/api/settings.js";
import { orderStatusLabel } from "../../lib/order-status.js";
import { statusMeta } from "../../lib/api/admin/orders.js";
import { formatPrice } from "../../lib/format.js";
import { getVerifiedEmail, onVerifiedEmailChange } from "../../lib/api/customerAuth.js";
import { listMyOrders } from "../../lib/api/orders.js";
import { listMyReviewedOrderItemIds } from "../../lib/api/reviews.js";
import EmptyState from "../../components/ui/EmptyState.jsx";
import Button from "../../components/ui/Button.jsx";
import WriteReviewModal from "../../components/reviews/WriteReviewModal.jsx";
import OrderDetailsModal from "./OrderDetailsModal.jsx";
import TrackingModal from "../TrackingModal.jsx";
import MagicLinkModal from "./MagicLinkModal.jsx";

// statusMeta() is the admin panel's own status vocabulary (pending /
// processing / shipped / delivered / cancelled / refunded) — reused here
// rather than inventing a second label set, since it already mirrors the
// real `order_status` enum set_order_status() writes.
function realStatusBadge(status) {
  const meta = statusMeta(status);
  const toneClass = {
    amber: "bg-amber-500/10 text-amber-600",
    sky: "bg-sky-500/10 text-sky-600",
    violet: "bg-violet-500/10 text-violet-600",
    green: "bg-success/10 text-success",
    grey: "bg-ink-soft/10 text-ink-soft",
    red: "bg-error/10 text-error",
  }[meta.tone] ?? "bg-success/10 text-success";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${toneClass}`}>
      <Check className="h-3 w-3" strokeWidth={3} /> {meta.label}
    </span>
  );
}

export default function OrdersTab() {
  const { orders: mockOrders, hasReviewed, setVerifiedPurchasedIds } = useUser();
  const { pointsPerReview } = useStoreSettings();
  const [review, setReview] = useState(null); // { product, orderItemId } being reviewed
  const [activeOrder, setActiveOrder] = useState(null); // order details modal
  const [trackingOrder, setTrackingOrder] = useState(null); // order for tracking modal

  // Real, magic-link-verified session state — independent of the mock
  // login. `verifiedEmail === undefined` means "still checking"; null means
  // "checked, not verified"; a string means "verified as this address".
  const [verifiedEmail, setVerifiedEmail] = useState(undefined);
  const [realOrders, setRealOrders] = useState([]);
  const [loadingRealOrders, setLoadingRealOrders] = useState(false);
  const [magicLinkOpen, setMagicLinkOpen] = useState(false);
  const [reviewedOrderItemIds, setReviewedOrderItemIds] = useState(new Set());

  useEffect(() => {
    let cancelled = false;
    getVerifiedEmail().then((email) => {
      if (!cancelled) setVerifiedEmail(email);
    });
    const unsubscribe = onVerifiedEmailChange((email) => {
      if (!cancelled) setVerifiedEmail(email);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!verifiedEmail) {
      setRealOrders([]);
      return;
    }
    let cancelled = false;
    setLoadingRealOrders(true);
    Promise.all([listMyOrders(), listMyReviewedOrderItemIds()]).then(([orderRes, reviewedRes]) => {
      if (cancelled) return;
      setLoadingRealOrders(false);
      const list = orderRes.data ?? [];
      setRealOrders(list);
      setVerifiedPurchasedIds(list.flatMap((o) => o.items));
      setReviewedOrderItemIds(new Set(reviewedRes.data ?? []));
    });
    return () => {
      cancelled = true;
    };
  }, [verifiedEmail, setVerifiedPurchasedIds]);

  // Combine: mock orders (from the general localStorage login, if any) plus
  // real verified orders, newest first, deduped by orderId in case the same
  // order somehow appears in both sources.
  const seen = new Set();
  const orders = [...realOrders, ...mockOrders].filter((o) => {
    if (seen.has(o.orderId)) return false;
    seen.add(o.orderId);
    return true;
  });
  const realOrderIds = new Set(realOrders.map((o) => o.orderId));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl text-ink">Order History</h2>
          <p className="mt-1 text-sm text-ink-soft">
            View your past purchases and leave reviews to earn points.
          </p>
        </div>
        {!verifiedEmail && (
          <Button
            variant="secondary"
            className="inline-flex items-center gap-1.5 text-xs"
            onClick={() => setMagicLinkOpen(true)}
          >
            <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
            Verify your email
          </Button>
        )}
      </div>

      {!verifiedEmail && (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-[1.25rem] bg-petal/40 px-5 py-4 ring-1 ring-line">
          <p className="text-sm text-ink-soft">
            Ordered as a guest? Verify your email to see those orders here too.
          </p>
          <Button className="shrink-0 text-xs" onClick={() => setMagicLinkOpen(true)}>
            Verify
          </Button>
        </div>
      )}

      {loadingRealOrders && (
        <p className="mb-4 text-xs text-ink-soft">Loading your verified orders…</p>
      )}

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
                    {realOrderIds.has(order.orderId)
                      ? realStatusBadge(order.status)
                      : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
                          <Check className="h-3 w-3" strokeWidth={3} /> {orderStatusLabel(order.timestamp)}
                        </span>
                      )}
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
                {(order.itemDetails ?? order.items.map((slug) => ({ slug, orderItemId: null }))).map((line) => {
                  const p = productById[line.slug];
                  if (!p) return null;
                  const reviewed = line.orderItemId
                    ? reviewedOrderItemIds.has(line.orderItemId)
                    : hasReviewed(line.slug);
                  // A real order_item can only be reviewed once the order is
                  // delivered — submit_review() enforces this server-side too,
                  // but hiding the CTA earlier avoids a confusing round-trip.
                  const canReview = line.orderItemId ? order.status === "delivered" : true;
                  return (
                    <li key={line.orderItemId ?? line.slug} className="flex items-center gap-4 px-5 py-4">
                      <a
                        href={`/product/${line.slug}`}
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
                        <a href={`/product/${line.slug}`} className="line-clamp-1 font-medium text-ink transition-colors hover:text-magenta">
                          {p.name}
                        </a>
                        <p className="mt-0.5 text-sm text-ink-soft">{formatPrice(p.price)}</p>
                      </div>

                      {reviewed ? (
                        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success/10 px-3.5 py-2 text-xs font-semibold text-success">
                          <Check className="h-3.5 w-3.5" strokeWidth={2.6} /> Reviewed
                        </span>
                      ) : canReview ? (
                        <button
                          onClick={() => setReview({ product: p, orderItemId: line.orderItemId })}
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-magenta px-3.5 py-2 text-xs font-semibold text-white transition-shadow hover:shadow-[var(--shadow-glow-pink)]"
                        >
                          <PenLine className="h-3.5 w-3.5" strokeWidth={2} />
                          <span className="hidden sm:inline">Review · +{pointsPerReview} pts</span>
                          <span className="sm:hidden">Review</span>
                        </button>
                      ) : (
                        <span className="shrink-0 text-xs text-ink-soft">Review once delivered</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      <MagicLinkModal open={magicLinkOpen} onClose={() => setMagicLinkOpen(false)} />
      <WriteReviewModal
        product={review?.product}
        orderItemId={review?.orderItemId}
        open={!!review}
        onClose={() => setReview(null)}
        onReviewed={(id) => id && setReviewedOrderItemIds((prev) => new Set(prev).add(id))}
      />
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
