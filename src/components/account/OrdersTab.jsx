import { navigate } from "../../lib/navigate.js";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, Clock, PenLine, Truck, XCircle } from "lucide-react";
import { useUser } from "../../context/UserContext.jsx";
import { productById } from "../../data/reviews.js";
import { formatPrice } from "../../lib/format.js";
import { getProductsByIds } from "../../lib/api/products.js";
import EmptyState from "../../components/ui/EmptyState.jsx";
import Button from "../../components/ui/Button.jsx";
import WriteReviewModal from "../../components/reviews/WriteReviewModal.jsx";
import OrderDetailsModal from "./OrderDetailsModal.jsx";

const STATUS = {
  pending: { label: "Order placed", icon: Clock, tone: "bg-snow text-ink ring-1 ring-line" },
  processing: { label: "Processing", icon: Clock, tone: "bg-snow text-ink ring-1 ring-line" },
  shipped: { label: "Shipped", icon: Truck, tone: "bg-magenta/10 text-magenta" },
  delivered: { label: "Delivered", icon: Check, tone: "bg-success/10 text-success" },
  cancelled: { label: "Cancelled", icon: XCircle, tone: "bg-ink/5 text-ink-soft" },
  refunded: { label: "Refunded", icon: XCircle, tone: "bg-ink/5 text-ink-soft" },
};

export default function OrdersTab() {
  // The signed-in account's orders, loaded from the server (UserContext →
  // lib/api/myAccount.js): every order placed with this email, on any device.
  const { orders, email, hasReviewedItem, rewards } = useUser();
  const { pointsPerReview } = rewards;
  const [review, setReview] = useState(null); // { product, orderItemId }
  const [activeOrder, setActiveOrder] = useState(null);
  const [liveProducts, setLiveProducts] = useState({});

  // Current catalog details (photo, tone) for the products in these orders;
  // the order lines themselves keep the name and price as bought.
  const slugs = useMemo(() => [...new Set(orders.flatMap((o) => o.items))], [orders]);
  useEffect(() => {
    let cancelled = false;
    getProductsByIds(slugs).then(({ data }) => {
      if (!cancelled && data) setLiveProducts(Object.fromEntries(data.map((p) => [p.id, p])));
    });
    return () => { cancelled = true; };
  }, [slugs]);

  // Lines as bought (server orders); older browser-only orders only had slugs.
  const linesOf = (order) =>
    order.lines?.length
      ? order.lines
      : order.items.map((slug) => {
          const p = liveProducts[slug] ?? productById[slug];
          return p ? { id: slug, name: p.name, brand: p.brand, price: p.price, qty: 1, image: p.image } : null;
        }).filter(Boolean);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="mb-6">
        <h2 className="font-serif text-2xl text-ink">Order History</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Every order placed with {email || "your email"}.{rewards.earnsOnReview ? " Review delivered items to earn points." : ""}
        </p>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          emoji="🛍️"
          title="No orders yet"
          message={rewards.earnsOnReview ? "Your purchases will appear here, ready to review for points." : "Your purchases will appear here."}
          actionLabel="Start shopping"
          onAction={() => navigate("/shop")}
        />
      ) : (
        <div className="space-y-5">
          {orders.map((order) => {
            const status = STATUS[order.status] ?? STATUS.pending;
            const delivered = order.status === "delivered";
            return (
              <div key={order.orderId} className="overflow-hidden rounded-[1.25rem] bg-snow ring-1 ring-line">
                {/* Order header */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <span className="font-semibold text-ink">#{order.orderId}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.tone}`}>
                        <status.icon className="h-3 w-3" strokeWidth={2.6} /> {status.label}
                      </span>
                    </div>
                    <span className="mt-1 block text-xs text-ink-soft">
                      Ordered{" "}
                      {new Date(order.timestamp ?? order.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      {" · "}{formatPrice(order.totals?.total ?? order.total)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      className="inline-flex items-center gap-1.5 text-xs"
                      onClick={() => navigate(`/track?order=${encodeURIComponent(order.orderId)}`)}
                    >
                      <Truck className="h-3.5 w-3.5" strokeWidth={2} />
                      <span className="hidden sm:inline">Track</span>
                    </Button>
                    <Button variant="ghost" className="text-xs" onClick={() => setActiveOrder(order)}>
                      Details
                    </Button>
                  </div>
                </div>

                {/* Lines */}
                <ul className="divide-y divide-line">
                  {linesOf(order).map((line) => {
                    const live = liveProducts[line.id];
                    const image = live?.image ?? line.image;
                    const reviewed = line.orderItemId ? hasReviewedItem(line.orderItemId) : false;
                    return (
                      <li key={line.orderItemId ?? line.id} className="flex items-center gap-4 px-5 py-4">
                        <a href={`/product/${line.id}`} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-line">
                          {image && <img src={image} alt={line.name} loading="lazy" className="absolute inset-0 h-full w-full object-contain" />}
                        </a>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-magenta">{line.brand}</p>
                          <a href={`/product/${line.id}`} className="line-clamp-1 font-medium text-ink transition-colors hover:text-magenta">
                            {line.name}
                          </a>
                          <p className="mt-0.5 text-sm text-ink-soft">
                            {line.size ? `${line.size} · ` : ""}{line.qty > 1 ? `${line.qty} × ` : ""}{formatPrice(line.price)}
                          </p>
                        </div>

                        {!line.orderItemId ? null : reviewed ? (
                          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success/10 px-3.5 py-2 text-xs font-semibold text-success">
                            <Check className="h-3.5 w-3.5" strokeWidth={2.6} /> Reviewed
                          </span>
                        ) : delivered ? (
                          <button
                            onClick={() => setReview({ product: live ?? { id: line.id, name: line.name, brand: line.brand }, orderItemId: line.orderItemId })}
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-magenta px-3.5 py-2 text-xs font-semibold text-white transition-shadow hover:shadow-[var(--shadow-glow-pink)]"
                          >
                            <PenLine className="h-3.5 w-3.5" strokeWidth={2} />
                            <span className="hidden sm:inline">Review{rewards.earnsOnReview ? ` · +${pointsPerReview} pts` : ""}</span>
                            <span className="sm:hidden">Review</span>
                          </button>
                        ) : (
                          <span className="shrink-0 text-right text-[11px] leading-tight text-ink-soft">
                            Review after
                            <br />
                            delivery
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      <WriteReviewModal
        product={review?.product ?? null}
        orderItemId={review?.orderItemId ?? null}
        open={!!review}
        onClose={() => setReview(null)}
      />
      {activeOrder && <OrderDetailsModal order={activeOrder} onClose={() => setActiveOrder(null)} />}
    </motion.div>
  );
}
