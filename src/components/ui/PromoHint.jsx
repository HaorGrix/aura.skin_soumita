import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Gift, Sparkles } from "lucide-react";
import { listEligibleCoupons } from "../../lib/api/coupons.js";
import { MINOR_TO_LEGACY } from "../../lib/format.js";

/**
 * PromoHint — a real, live, pickable list of every coupon this cart
 * currently qualifies for, fetched from the same `coupons` table the
 * admin edits (list_eligible_coupons(), 0034) — not the old hardcoded
 * FIRST_ORDER_CODES / static loyalty-milestone list. An admin creating,
 * editing, or deactivating a coupon shows up here on the next fetch, no
 * rebuild needed, same guarantee validateCouponLive() already has.
 *
 * Tapping a code applies it through the exact same `onApply` (→
 * CartContext.applyPromo → validate_coupon_preview) path manual entry
 * uses — this is a shortcut to typing the code, not a second apply path.
 *
 * Loyalty coupons (required_points set) are filtered client-side against
 * the account's real points balance — the RPC doesn't gate on points
 * (mirrors validate_coupon_preview(); place_order() doesn't enforce it
 * yet either, see 0007_seed_coupons.sql), so a coupon the shopper hasn't
 * actually earned never appears here as pickable.
 *
 * A first-order-only code is gated on having an EMAIL, not on being
 * signed in — validate_coupon_preview()/place_order() both check
 * first_order_only against `orders.email`, with zero auth.uid() involved
 * (0030_validate_coupon_rpc.sql), so a guest who's typed their email at
 * checkout is checked exactly the same way a logged-in shopper is. Login
 * is never required to claim it.
 */
export default function PromoHint({ subtotal, email, points = 0, appliedCoupon, onApply }) {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (appliedCoupon) return; // nothing to show once one's already applied
    let alive = true;
    setLoading(true);
    listEligibleCoupons({ subtotalMinor: (subtotal ?? 0) * MINOR_TO_LEGACY, email })
      .then((rows) => { if (alive) setCoupons(rows); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [subtotal, email, appliedCoupon]);

  if (appliedCoupon) return null;

  // A first-order-only code needs an email to check eligibility against —
  // it's not account-bound, so a guest who's typed theirs qualifies exactly
  // like a signed-in shopper does. Only dangle it as pickable once there's
  // an email to actually check.
  const hasEmail = !!(email && email.trim());
  const pickable = coupons.filter((c) => (!c.firstOrderOnly || hasEmail) && points >= (c.requiredPoints ?? 0));
  const needsEmail = !hasEmail && coupons.some((c) => c.firstOrderOnly);

  function summary(c) {
    if (c.kind === "free_shipping") return "Free shipping";
    if (c.kind === "percent") {
      const cap = c.maxDiscountMinor != null ? ` (up to ৳${Math.round(c.maxDiscountMinor / 100)})` : "";
      return `${c.valuePercent}% off${cap}`;
    }
    const amount = `৳${Math.round((c.valueMinor ?? 0) / 100)} off`;
    return c.alsoFreeShipping ? `${amount} + free shipping` : amount;
  }

  if (!loading && pickable.length === 0 && !needsEmail) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pickable.length > 0 ? "list" : "guest-hint"}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 4 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="mt-3 space-y-2"
      >
        {pickable.length > 0 && (
          <div className="rounded-xl bg-petal/60 p-3 ring-1 ring-rose/25">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-ink">
              <Sparkles className="h-3.5 w-3.5 text-magenta" strokeWidth={2} />
              You qualify for {pickable.length === 1 ? "a coupon" : `${pickable.length} coupons`}
            </p>
            <div className="flex flex-col gap-1.5">
              {pickable.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => onApply(c.code)}
                  className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-left text-xs ring-1 ring-line transition-colors hover:ring-magenta/50"
                >
                  <span>
                    <span className="font-semibold text-magenta">{c.code}</span>
                    <span className="ml-1.5 text-ink-soft">{summary(c)}</span>
                  </span>
                  <Check className="h-3.5 w-3.5 shrink-0 text-ink-soft" strokeWidth={2} />
                </button>
              ))}
            </div>
          </div>
        )}
        {needsEmail && pickable.length === 0 && (
          <div className="flex items-start gap-2.5 rounded-xl bg-petal/60 p-3 ring-1 ring-rose/25">
            <Gift className="mt-0.5 h-3.5 w-3.5 shrink-0 text-magenta" strokeWidth={2} />
            <p className="text-xs leading-relaxed text-ink-soft">
              Add your email to see your exclusive welcome discount on this first order.
            </p>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
