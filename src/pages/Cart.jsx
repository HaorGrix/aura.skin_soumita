import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ChevronLeft, Tag, ArrowRight, Lock, ShieldCheck, Truck } from "lucide-react";
import { useCart } from "../context/CartContext.jsx";
import { PRODUCTS } from "../data/products.js";
import { FREE_SHIPPING_THRESHOLD, STANDARD_SHIPPING } from "../lib/shop-config.js";
import LineItem from "../components/cart/LineItem.jsx";
import FreeShippingBar from "../components/cart/FreeShippingBar.jsx";
import OrderSummary from "../components/cart/OrderSummary.jsx";
import RelatedProducts from "../components/pdp/RelatedProducts.jsx";
import QuickViewModal from "../components/shop/QuickViewModal.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import Button from "../components/ui/Button.jsx";
import { useToast } from "../components/ui/Toast.jsx";
import { Input } from "../components/ui/index.js";

export default function Cart() {
  const { items, subtotal, count, clear, discountAmount, appliedCoupon, applyPromo } = useCart();
  const { toast } = useToast();
  const [promoInput, setPromoInput] = useState("");
  const [quickView, setQuickView] = useState(null);

  const discounted = Math.max(0, subtotal - discountAmount);
  const shipping = discounted >= FREE_SHIPPING_THRESHOLD || discounted === 0 ? 0 : STANDARD_SHIPPING;
  const total = discounted + shipping;

  const recommended = useMemo(() => {
    const inCart = new Set(items.map((i) => i.id));
    return [...PRODUCTS]
      .filter((p) => !inCart.has(p.id))
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, 8);
  }, [items]);

  function handlePromo(e) {
    e.preventDefault();
    const res = applyPromo(promoInput);
    if (res) {
      setPromoInput("");
      toast.success(res.label, "Promo applied");
    } else {
      toast.error("That code isn’t valid. Check your welcome email for a promo code.", "Hmm");
    }
  }

  if (count === 0) {
    return (
      <div className="min-h-screen pt-28 sm:pt-32">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <EmptyState
            emoji="🛍️"
            title="Your bag is feeling light"
            message="Fill it with rituals that make you glow. Your perfect shelf is one click away. ✨"
            actionLabel="Explore the shop"
            onAction={() => (window.location.hash = "#/shop")}
          />
          <RelatedProducts
            products={recommended}
            onQuickView={setQuickView}
            title="Most-loved right now"
          />
        </div>
        <QuickViewModal product={quickView} onClose={() => setQuickView(null)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 pt-28 sm:pt-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <a
          href="#/shop"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft transition-colors hover:text-magenta dark:text-white/60"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.8} /> Continue shopping
        </a>

        <div className="mt-4 flex items-end justify-between gap-4">
          <h1 className="font-serif text-[clamp(2rem,5vw,3.25rem)] leading-tight text-ink dark:text-white">
            Your Bag{" "}
            <span className="text-ink-soft dark:text-white/45">({count})</span>
          </h1>
          <button
            onClick={() => { if (window.confirm('Are you sure you want to clear your bag?')) clear(); }}
            className="text-sm font-medium text-ink-soft underline-offset-2 hover:text-error hover:underline dark:text-white/55"
          >
            Clear bag
          </button>
        </div>

        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px]">
          {/* Items */}
          <div>
            <div className="mb-5">
              <FreeShippingBar subtotal={discounted} />
            </div>
            <div className="flex flex-col divide-y divide-line dark:divide-white/10">
              <AnimatePresence initial={false}>
                {items.map((item) => (
                  <div key={item.id} className="py-5 first:pt-0">
                    <LineItem item={item} />
                  </div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Summary */}
          <div className="lg:sticky lg:top-32 lg:self-start">
            <OrderSummary
              subtotal={subtotal}
              discountAmount={discountAmount}
              promoCode={appliedCoupon?.code}
              shippingCost={shipping}
              total={total}
            >
              {/* Promo */}
              <form onSubmit={handlePromo} className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft dark:text-white/45" strokeWidth={1.7} />
                  <Input
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value)}
                    placeholder="Promo code"
                    className="pl-10 rounded-full py-2.5"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-full bg-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-magenta dark:bg-white dark:text-ink dark:hover:bg-rose"
                >
                  Apply
                </button>
              </form>

              <Button
                variant="primary"
                magnetic={false}
                className="mt-4 w-full"
                as="a"
                href="#/checkout"
              >
                Proceed to Checkout <ArrowRight className="h-4 w-4" strokeWidth={2} />
              </Button>

              {/* Trust */}
              <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs text-ink-soft dark:text-white/50">
                <span className="inline-flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" strokeWidth={1.8} /> Secure</span>
                <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.8} /> Authentic</span>
                <span className="inline-flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" strokeWidth={1.8} /> Fast shipping</span>
              </div>
            </OrderSummary>

          </div>
        </div>

        {/* Recommended */}
        <RelatedProducts
          products={recommended}
          onQuickView={setQuickView}
          title="You may also love"
        />
      </div>

      <QuickViewModal product={quickView} onClose={() => setQuickView(null)} />
    </div>
  );
}
