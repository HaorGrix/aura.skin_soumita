/* =================================================================== *
 * skin.theory — Shipping & Returns
 * -------------------------------------------------------------------
 * The delivery methods/zones table is admin-managed (0038_shipping_
 * methods.sql) and already has a storefront reader (useShippingMethods,
 * lib/api/shipping.js) — this page reuses it so the rates shown here can
 * never drift from what checkout actually charges. Same "read live, never
 * hardcode" contract as the rest of the storefront.
 * =================================================================== */
import { Home, Truck, Banknote, PackageCheck, RotateCcw } from "lucide-react";
import BackButton from "../components/ui/BackButton.jsx";
import Footer from "../components/Footer.jsx";
import { useShippingMethods } from "../lib/api/shipping.js";
import { useStoreSettings } from "../lib/api/settings.js";
import { formatPrice } from "../lib/format.js";

export default function ShippingReturns() {
  const { methods, loading } = useShippingMethods();
  const { storeName, freeShippingThreshold, supportEmail } = useStoreSettings();
  const email = supportEmail || "care@skinscript.com";

  return (
    <div className="min-h-screen pb-4">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <BackButton route="shipping" />

        <nav className="flex items-center gap-2 text-sm text-ink-soft" aria-label="Breadcrumb">
          <a href="/" className="inline-flex items-center gap-1 hover:text-magenta">
            <Home className="h-3.5 w-3.5" strokeWidth={1.8} /> Home
          </a>
          <span>/</span>
          <span className="text-ink">Shipping &amp; Returns</span>
        </nav>

        <div className="mt-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-magenta">
            Delivery &amp; returns
          </p>
          <h1 className="mt-2 font-serif text-[clamp(2rem,5vw,3.25rem)] leading-tight text-ink">
            Shipping &amp; Returns
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-soft">
            How we get your order to your door across Bangladesh, and what to
            do if something isn't right when it arrives.
          </p>
        </div>

        {/* Delivery methods — live from /admin/shipping */}
        <section className="mt-10">
          <h2 className="flex items-center gap-2 font-serif text-xl leading-snug text-ink sm:text-2xl">
            <Truck className="h-5 w-5 text-magenta" strokeWidth={1.8} /> Delivery options &amp; rates
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft sm:text-[15px]">
            The exact delivery method and price are confirmed at checkout
            based on your address. Current options:
          </p>

          {loading ? (
            <p className="mt-4 text-sm text-ink-soft">Loading current rates…</p>
          ) : methods.length === 0 ? (
            <p className="mt-4 text-sm text-ink-soft">
              Delivery rates are shown at checkout once you enter your address.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {methods.map((m) => (
                <div key={m.id} className="rounded-2xl bg-white p-5 ring-1 ring-line">
                  <p className="font-semibold text-ink">{m.name}</p>
                  {m.description && (
                    <p className="mt-0.5 text-sm text-ink-soft">{m.description}</p>
                  )}
                  <ul className="mt-3 space-y-1.5">
                    {m.zones.map((z) => (
                      <li key={z.id} className="flex items-center justify-between text-sm">
                        <span className="text-ink-soft">
                          {z.zone_name}
                          {(z.matching_districts ?? []).length > 0 && (
                            <span className="text-ink-soft/70"> ({z.matching_districts.join(", ")})</span>
                          )}
                        </span>
                        <span className="font-semibold text-ink">{formatPrice(z.price)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {freeShippingThreshold > 0 && (
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              Orders over <strong className="text-ink">{formatPrice(freeShippingThreshold)}</strong> ship free, automatically applied at checkout.
            </p>
          )}
        </section>

        {/* Payment */}
        <section className="mt-9">
          <h2 className="flex items-center gap-2 font-serif text-xl leading-snug text-ink sm:text-2xl">
            <Banknote className="h-5 w-5 text-magenta" strokeWidth={1.8} /> Payment
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft sm:text-[15px]">
            We currently accept <strong className="text-ink">Cash on Delivery (COD) only</strong> — you pay our courier
            in cash when your order arrives. No card, mobile wallet, or advance payment is required to place an order.
            Please have the exact amount ready where possible, and inspect the seal and packaging before accepting delivery.
          </p>
        </section>

        {/* Dispatch & tracking */}
        <section className="mt-9">
          <h2 className="flex items-center gap-2 font-serif text-xl leading-snug text-ink sm:text-2xl">
            <PackageCheck className="h-5 w-5 text-magenta" strokeWidth={1.8} /> Dispatch &amp; tracking
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft sm:text-[15px]">
            In-stock orders are dispatched within 48 hours. Once your order ships, you can follow its progress any time
            from <a href="/account?tab=orders" className="font-semibold text-magenta hover:underline">My Orders</a> —
            guest checkouts can access the same tracking by verifying their email with a one-time magic link, no
            password needed.
          </p>
        </section>

        {/* Returns & refunds */}
        <section className="mt-9 pb-24">
          <h2 className="flex items-center gap-2 font-serif text-xl leading-snug text-ink sm:text-2xl">
            <RotateCcw className="h-5 w-5 text-magenta" strokeWidth={1.8} /> Returns &amp; refunds
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft sm:text-[15px]">
            Not the right fit? Let us know within <strong className="text-ink">7 days of delivery</strong> and we'll help
            you return it, as long as the product is unused, unopened, and in its original packaging — for hygiene
            reasons, we can't accept a return on an opened skincare item unless it arrived damaged, faulty, or incorrect.
          </p>
          <ul className="mt-3 space-y-2">
            {[
              `Email us at ${email} with your order number and the reason for the return.`,
              "We'll confirm the return and arrange pickup or drop-off, depending on your area.",
              "Once we've received and checked the item, we'll process your refund within 5–7 business days.",
              "Since orders are paid on delivery, refunds are issued via mobile wallet transfer or bank transfer — we'll confirm the details with you directly.",
            ].map((item) => (
              <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-ink-soft sm:text-[15px]">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-magenta" />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm leading-relaxed text-ink-soft sm:text-[15px]">
            If an item arrives damaged, faulty, or different from what you ordered, contact us right away — those
            returns don't need to be unopened, and we'll make it right at no extra cost.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-ink-soft sm:text-[15px]">
            Questions before you order, or about an order already placed? Reach the {storeName} care desk any time via{" "}
            <a href="/contact" className="font-semibold text-magenta hover:underline">Contact</a>.
          </p>
        </section>
      </div>

      <Footer />
    </div>
  );
}
