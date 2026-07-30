import { motion } from "framer-motion";
import { Truck, PartyPopper } from "lucide-react";
import { useStoreSettings } from "../../lib/api/settings.js";
import { formatPrice } from "../../lib/format.js";

/** Animated progress toward free shipping.
 *  `couponFreeShipping` — a coupon already covers shipping, so the threshold is
 *  moot; nagging for more spend would contradict the ৳0 shipping line. */
export default function FreeShippingBar({ subtotal, couponFreeShipping = false }) {
  // Threshold comes from /admin/settings; falls back to the previous
  // hardcoded value until the fetch lands or if it fails.
  const { freeShippingThreshold } = useStoreSettings();
  const remaining = Math.max(0, freeShippingThreshold - subtotal);
  const unlocked = couponFreeShipping || remaining === 0;
  const pct = unlocked ? 100 : Math.min(100, (subtotal / freeShippingThreshold) * 100);

  return (
    <div className="rounded-2xl bg-snow p-3.5 ring-1 ring-line">
      <p className="flex items-center gap-2 text-sm text-ink">
        {unlocked ? (
          <>
            <PartyPopper className="h-4 w-4 text-magenta" strokeWidth={1.8} />
            <span>You’ve unlocked <strong>free shipping</strong>! 🌸</span>
          </>
        ) : (
          <>
            <Truck className="h-4 w-4 text-cyan" strokeWidth={1.8} />
            <span>
              You’re <strong>{formatPrice(remaining)}</strong> away from free shipping
            </span>
          </>
        )}
      </p>
      <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-line">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-cyan via-rose to-magenta"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}
