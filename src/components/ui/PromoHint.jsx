import { AnimatePresence, motion } from "framer-motion";
import { Gift, Sparkles } from "lucide-react";
import { FIRST_ORDER_CODES } from "../../lib/rewards-config.js";

/**
 * PromoHint — contextual nudge beneath the coupon input.
 *
 * Shows one of three states (priority order):
 *   1. Nothing  — coupon already applied, or no relevant hint available.
 *   2. First-order  — shopper has zero orders AND at least one first-order
 *      code hasn't been used yet.  Shows GLOW10 / BLOOM5.
 *   3. Loyalty   — shopper has earned rewards codes and none have been used.
 *
 * SKIN SCRIPT loyalty codes are not mentioned here when a first-order hint applies,
 * keeping the message focused.  Loyalty codes are multi-use by design and
 * are unaffected by the firstOrderOnly check in CartContext.
 */
export default function PromoHint({ orders, coupons, usedCoupons, appliedCoupon, authed = false }) {
  if (appliedCoupon) return null;

  const normalizedUsed = usedCoupons.map((c) => c.toUpperCase());

  // First-order codes still available (not yet redeemed by this account).
  const availableFirstOrder = [...FIRST_ORDER_CODES].filter(
    (code) => !normalizedUsed.includes(code)
  );
  const isFirstOrder = orders.length === 0 && availableFirstOrder.length > 0;

  // Loyalty codes unlocked and not yet spent.
  const availableLoyalty = (coupons ?? []).filter(
    (c) => c.code && !normalizedUsed.includes(c.code.toUpperCase())
  );

  let hint = null;

  if (isFirstOrder && !authed) {
    // First-order codes are account-bound (see validate/requiresAuth), so
    // dangling the code at a guest would just dead-end at "Login required".
    hint = {
      key: "first-order-guest",
      Icon: Gift,
      iconClass: "text-magenta",
      wrapperClass: "bg-petal/60 ring-rose/25",
      body: <>Sign in to claim your exclusive welcome discount on this first order.</>,
    };
  } else if (isFirstOrder) {
    hint = {
      key: "first-order",
      Icon: Gift,
      iconClass: "text-magenta",
      wrapperClass: "bg-petal/60 ring-rose/25",
      body: (
        <>
          First order?{" "}
          {availableFirstOrder.map((code, i) => (
            <span key={code}>
              {i > 0 && <span className="text-ink-soft"> or </span>}
              <span className="font-semibold text-magenta">{code}</span>
            </span>
          ))}{" "}
          unlocks an exclusive welcome discount.
        </>
      ),
    };
  } else if (availableLoyalty.length > 0) {
    const top = availableLoyalty[availableLoyalty.length - 1]; // highest milestone first
    hint = {
      key: "loyalty",
      Icon: Sparkles,
      iconClass: "text-gold",
      wrapperClass: "bg-gold/10 ring-gold/25",
      body: (
        <>
          Rewards code available:{" "}
          <span className="font-semibold text-gold">{top.code}</span>
          {top.short ? ` — ${top.short}` : ""}.
        </>
      ),
    };
  }

  return (
    <AnimatePresence mode="wait">
      {hint && (
        <motion.div
          key={hint.key}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className={`mt-3 flex items-start gap-2.5 rounded-xl p-3 ring-1 ${hint.wrapperClass}`}
        >
          <hint.Icon
            className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${hint.iconClass}`}
            strokeWidth={2}
          />
          <p className="text-xs leading-relaxed text-ink-soft">
            {hint.body}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
