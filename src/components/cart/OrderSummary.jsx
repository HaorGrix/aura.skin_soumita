import { formatPrice } from "../../lib/format.js";

/** Order summary rows — reused on the cart page and in checkout. */
export default function OrderSummary({
  subtotal,
  discountAmount = 0,
  promoCode,
  shippingCost, // number | null (null = "calculated at checkout")
  total,
  children, // optional footer (promo input / CTA)
}) {
  return (
    <div className="rounded-[1.5rem] bg-snow p-5 ring-1 ring-line dark:bg-white/[0.03] dark:ring-white/10 sm:p-6">
      <h2 className="font-serif text-xl text-ink dark:text-white">Order summary</h2>

      <dl className="mt-5 space-y-3 text-sm">
        <Row label="Subtotal" value={formatPrice(subtotal)} />

        {discountAmount > 0 && (
          <Row
            label={
              <span className="inline-flex items-center gap-1.5">
                Discount
                {promoCode && (
                  <span className="rounded-full bg-magenta/10 px-2 py-0.5 text-[11px] font-semibold text-magenta">
                    {promoCode}
                  </span>
                )}
              </span>
            }
            value={`− ${formatPrice(discountAmount)}`}
            accent
          />
        )}

        <Row
          label="Shipping"
          value={
            shippingCost === null
              ? "Calculated at checkout"
              : shippingCost === 0
              ? "Free"
              : formatPrice(shippingCost)
          }
          muted={shippingCost === null}
        />
      </dl>

      <div className="mt-4 flex items-center justify-between border-t border-line pt-4 dark:border-white/10">
        <span className="font-serif text-lg text-ink dark:text-white">Total</span>
        <span className="font-serif text-2xl text-ink dark:text-white">{formatPrice(total)}</span>
      </div>

      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}

function Row({ label, value, accent, muted }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-ink-soft dark:text-white/60">{label}</dt>
      <dd
        className={`font-medium tabular-nums ${
          accent ? "text-magenta" : muted ? "text-ink-soft dark:text-white/50" : "text-ink dark:text-white"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
