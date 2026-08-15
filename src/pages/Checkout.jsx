import { navigate } from "../lib/navigate.js";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  Check,
  Truck,
  Banknote,
  ChevronDown,
  Loader2,
  PartyPopper,
  Tag,
  Truck as TrackIcon,
} from "lucide-react";
import { stockFor, maxQtyFor } from "../data/products.js";
import { isValidEmail } from "../lib/email-validation.js";
import { useCart } from "../context/CartContext.jsx";
import { useUser } from "../context/UserContext.jsx";
import { useToast } from "../components/ui/Toast.jsx";
import Button from "../components/ui/Button.jsx";
import { Field, OptionCard, Input } from "../components/ui/index.js";
import { useStoreSettings } from "../lib/api/settings.js";
import { useShippingMethods, resolveShippingZone } from "../lib/api/shipping.js";
import { formatPrice, CONVERSION_RATE, CURRENCY } from "../lib/format.js";
import { trackEvent } from "../lib/analytics.js";
// Aliased: this module already has a local `placeOrder()` (the pre-flight
// stock guard). Importing under the same name would shadow it and make the
// guard call itself instead of the API.
import { placeOrder as placeOrderRpc, checkoutErrorMessage } from "../lib/api/orders.js";
import { smartNavigate } from "../lib/nav-history.js";
import { surface } from "../lib/design-system.js";
import LineItem from "../components/cart/LineItem.jsx";
import OrderSummary from "../components/cart/OrderSummary.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import TrackingModal from "../components/TrackingModal.jsx";
import PromoHint from "../components/ui/PromoHint.jsx";
import PhoneInput from "../components/ui/PhoneInput.jsx";

const STEPS = [
  { id: "info", label: "Information" },
  { id: "delivery", label: "Delivery & Payment" },
];

const postcodeOk = (v) => /^[0-9]{4}$/.test(v.trim());
const CHECKOUT_KEY = "skinscript_checkout_state";

function loadCheckoutState() {
  try {
    const raw = localStorage.getItem(CHECKOUT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveCheckoutState(state) {
  try {
    localStorage.setItem(CHECKOUT_KEY, JSON.stringify(state));
  } catch {
    /* non-fatal */
  }
}

export default function Checkout() {
  const { items, subtotal, count, clear, removeItem, setQty, discountAmount, appliedCoupon, applyPromo, removeCoupon: cartRemoveCoupon } = useCart();
  const { authed, openAuth, email: userEmail, name: userName, points, addOrder, usedCoupons, markCouponUsed, orders } = useUser();
  const { toast } = useToast();
  const savedCheckout = loadCheckoutState();

  // Checkout is guest-first — no login gate here. `guest` is kept only so
  // the rest of this file's authed/guest checks (resume snapshot, analytics)
  // stay true without touching every call site.
  const [guest] = useState(true);
  const [couponInput, setCouponInput] = useState("");

  const [step, setStep] = useState(() => savedCheckout?.step ?? 0);
  const [form, setForm] = useState(() => {
    const base = {
      email: authed ? userEmail || "" : "",
      firstName: authed ? userName || "" : "",
      lastName: "",
      address: "",
      city: "",
      postal: "",
      country: "Bangladesh",
      phone: "",
    };
    return { ...base, ...(savedCheckout?.form ?? {}) };
  });
  // Which method the shopper picked, and — for a zoned method — which zone
  // they explicitly picked (only set when auto-resolution from the typed
  // city is ambiguous; see zoneResolution below). Both are DB ids now, not
  // the old "standard"/"express" literal.
  const [shippingMethodId, setShippingMethodId] = useState(() => savedCheckout?.shippingMethodId ?? null);
  const [manualZoneId, setManualZoneId] = useState(() => savedCheckout?.manualZoneId ?? null);
  // Cash on Delivery is the only payment method offered right now — no
  // gateway (SSLCommerz/bKash/Nagad) is wired up yet, so it's fixed rather
  // than a user choice. Kept as state (not a literal) so payment_method
  // stays a real field on the order payload if a gateway is added later.
  const [payMethod] = useState("cod");
  const [isPhoneValid, setIsPhoneValid] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [order, setOrder] = useState(null); // success snapshot
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [errors, setErrors] = useState({});
  const [resumeAvailable, setResumeAvailable] = useState(Boolean(savedCheckout));
  const [resumeSnapshot, setResumeSnapshot] = useState(() => savedCheckout);

  // Prefill from the account when the shopper signs in via the gate.
  useEffect(() => {
    if (authed) {
      setForm((f) => ({
        ...f,
        email: f.email || userEmail || "",
        firstName: f.firstName || userName || "",
      }));
    }
  }, [authed, userEmail, userName]);
  useEffect(() => {
    const snapshot = {
      step,
      form,
      shippingMethodId,
      manualZoneId,
      guest,
    };
    saveCheckoutState(snapshot);
    setResumeSnapshot(snapshot);
  }, [step, form, shippingMethodId, manualZoneId, guest]);

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((err) => ({ ...err, [k]: undefined }));
  };

  // discountAmount comes from CartContext and auto-recalculates when subtotal changes.
  const newSubtotal = subtotal - discountAmount;
  // Read the coupon's own flag — matching on the code string would hand free
  // shipping to any future code that happens to contain "FS" (GIFTS, OFFSEASON…).
  const isFreeShippingCoupon = !!appliedCoupon?.freeShipping;

  // Threshold comes from /admin/settings; methods/zones from /admin/shipping.
  // Both are for DISPLAY only — place_order() re-reads the zone's price
  // server-side by shipping_zone_id, so a stale client can never change
  // what is actually charged.
  const { freeShippingThreshold } = useStoreSettings();
  const { methods: shippingMethods, loading: shippingLoading } = useShippingMethods();

  // Default to the first (lowest sort_order) active method once the list
  // loads, same fallback place_order() applies server-side if none is sent.
  useEffect(() => {
    if (!shippingMethodId && shippingMethods.length > 0) {
      setShippingMethodId(shippingMethods[0].id);
    }
  }, [shippingMethods, shippingMethodId]);

  const selectedMethod = shippingMethods.find((m) => m.id === shippingMethodId) ?? null;
  // Auto-resolve from the typed city; a manual pick (only offered when
  // resolution is ambiguous) always wins over it once the shopper makes one.
  const zoneResolution = resolveShippingZone(selectedMethod, form.city);
  const manualZone = selectedMethod?.zones.find((z) => z.id === manualZoneId) ?? null;
  const effectiveZone = manualZone ?? zoneResolution.zone;
  const needsManualZone = !!selectedMethod && !effectiveZone && zoneResolution.ambiguous;

  function chooseShippingMethod(id) {
    setShippingMethodId(id);
    setManualZoneId(null); // a different method's zones are a different set — don't carry a stale pick over
  }

  const shipping =
    newSubtotal >= freeShippingThreshold || isFreeShippingCoupon ? 0 : (effectiveZone?.price ?? 0);
  const total = newSubtotal + shipping;

  // Fires once, only once the shopper is actually looking at the checkout
  // wizard (cart non-empty, auth/guest gate already passed) — not on every
  // step change or form edit within it.
  const initiateFiredRef = useRef(false);
  useEffect(() => {
    if (initiateFiredRef.current) return;
    if (count === 0 || (!authed && !guest)) return;
    initiateFiredRef.current = true;
    trackEvent("InitiateCheckout", {
      content_ids: items.map((i) => i.id),
      contents: items.map((i) => ({ id: i.id, quantity: i.qty })),
      num_items: count,
      value: total * CONVERSION_RATE,
      currency: CURRENCY.code,
    });
  }, [count, authed, guest, items, total]);

  const applyCoupon = async (e, codeOverride) => {
    e?.preventDefault?.();
    const code = codeOverride ?? couponInput.trim().toUpperCase();
    if (!code) return;
    // applyPromo validates live against the DB now (see CartContext) — the
    // loyalty account fields are still passed through for the points-gate
    // check, and `email` lets it verify first-order/per-customer usage
    // server-side instead of skipping that check like the Cart page has to.
    const result = await applyPromo(code, { authed, points, usedCoupons, orders, email: form.email || userEmail });
    if (result?.requiresEmail) {
      toast.error("Add your email above so we can check this welcome code for you.", "Email needed");
    } else if (result?.alreadyUsed) {
      toast.error("This coupon has already been used on a previous order.", "Already redeemed");
    } else if (result?.firstOrderOnly) {
      toast.error("These codes are exclusive to your first order.", "First order only");
    } else if (result?.success) {
      setCouponInput("");
      toast.success(result.label, "Coupon applied");
    } else {
      toast.error("This coupon is invalid or not yet unlocked.", "Invalid code");
    }
  };

  const removeCoupon = () => {
    cartRemoveCoupon();
    toast.show({ title: "Coupon removed", message: "Your discount has been removed.", variant: "info" });
  };

  function validate() {
    if (step === 0) {
      const next = {};
      if (!isValidEmail(form.email)) next.email = "Please enter a valid email address.";
      if (!form.firstName.trim()) next.firstName = "First name is required.";
      if (!form.lastName.trim()) next.lastName = "Last name is required.";
      if (!form.address.trim()) next.address = "Address is required.";
      if (!form.city.trim()) next.city = "City is required.";
      if (!postcodeOk(form.postal)) next.postal = "Postal code must be exactly 4 digits.";
      if (!isPhoneValid) next.phone = "Enter a valid BD number.";
      if (Object.keys(next).length) {
        setErrors(next);
        toast.error("Please fix the highlighted fields.", "Check your details");
        return false;
      }
    }
    if (step === 1 && needsManualZone) {
      toast.error("Please select your delivery zone.", "Check your details");
      return false;
    }
    return true;
  }

  function next() {
    if (!validate()) return;
    setErrors({});
    if (step < STEPS.length - 1) setStep((s) => s + 1);
    else placeOrder();
  }

  function placeOrder() {
    // Re-validate inventory at the moment of purchase — units can drop while
    // the bag sits idle (the cart snapshot doesn't carry stock).
    const soldOut = items.filter((i) => stockFor(i.id) === 0);
    const overQty = items.filter((i) => stockFor(i.id) > 0 && i.qty > maxQtyFor(i.id));

    if (soldOut.length > 0) {
      soldOut.forEach((i) => removeItem(i.id, i.variantId));
      toast.error(
        `${soldOut.map((i) => i.name).join(", ")} just sold out and ${soldOut.length > 1 ? "were" : "was"} removed from your bag.`,
        "Out of stock"
      );
      return;
    }
    if (overQty.length > 0) {
      overQty.forEach((i) => setQty(i.id, maxQtyFor(i.id), i.variantId));
      toast.error(
        `We only have enough of ${overQty.map((i) => i.name).join(", ")} left — quantities updated.`,
        "Limited stock"
      );
      return;
    }

    submitOrder();
  }

  /**
   * The real checkout. Everything that matters happens inside the
   * place_order() RPC as one transaction: stock is re-checked under a row
   * lock, decremented, the order and its line items are written, the coupon
   * is validated and redeemed, and the inventory ledger is updated.
   *
   * The guards above are a courtesy — they catch the common case early with
   * a friendlier message. The server is what actually prevents overselling,
   * because only it can hold a lock while it checks and decrements.
   *
   * Money is NOT sent. `total` on this page is display arithmetic; the
   * amounts stored against the order come back computed from the database.
   */
  async function submitOrder() {
    setProcessing(true);

    const { data, error } = await placeOrderRpc({
      email: form.email,
      items,
      paymentMethod: payMethod,
      shippingMethodId: selectedMethod?.id ?? null,
      shippingZoneId: effectiveZone?.id ?? null,
      couponCode: appliedCoupon?.code ?? null,
      shippingAddress: {
        name: `${form.firstName ?? ""} ${form.lastName ?? ""}`.trim() || form.name || "",
        line1: form.address ?? "",
        line2: form.apartment ?? "",
        city: form.city ?? "",
        area: form.area ?? "",
        postcode: form.postcode ?? "",
        country: form.country ?? "Bangladesh",
        phone: form.phone ?? "",
      },
    });

    setProcessing(false);

    if (error) {
      // Named lookup so "Only 2 of X left" says the product's real name
      // rather than its slug.
      const slug = (error.message ?? "").split(":")[1];
      const line = items.find((i) => (i.slug ?? i.id) === slug);
      toast.error(checkoutErrorMessage(error, { productName: line?.name }), "Order not placed");
      return;
    }

    setOrder({ ...data, count });

    // Fired only here, after placeOrderRpc() has come back with no error —
    // never optimistically before the server confirms the order. `data`
    // is the server-computed order (real total), `items` is what was
    // actually submitted and stock-checked for it.
    trackEvent("Purchase", {
      content_ids: items.map((i) => i.id),
      contents: items.map((i) => ({ id: i.id, quantity: i.qty })),
      num_items: count,
      value: Number(data.total) * CONVERSION_RATE,
      currency: CURRENCY.code,
      order_id: data.number,
    });

    // Mirror into the local history the Account page still reads. Once
    // account pages read from the DB (roadmap), this line goes away.
    if (appliedCoupon) markCouponUsed(appliedCoupon.code);
    addOrder({
      number: data.number,
      total: data.total,
      email: data.email,
      payMethod: data.payMethod,
      itemIds: items.map((i) => i.id),
      couponCode: data.couponCode,
      timestamp: data.timestamp,
    });

    sessionStorage.removeItem("skinscript_checkout_form");
    clear();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // —— Success ——
  if (order) return <Success order={order} />;

  // —— Empty guard ——
  if (count === 0) {
    return (
      <div className="min-h-screen">
        <EmptyState
          emoji="🧾"
          title="Nothing to check out"
          message="Your bag is empty — let’s add a little glow first."
          actionLabel="Go to shop"
          onAction={() => (navigate("/shop"))}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <a
          href="/cart"
          onClick={(e) => {
            e.preventDefault();
            smartNavigate("/cart", "cart", "checkout");
          }}
          className="mt-12 inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft transition-colors hover:text-magenta"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.8} /> Back to bag
        </a>

        <h1 className="mt-4 font-serif text-[clamp(2rem,5vw,3rem)] leading-tight text-ink">
          Checkout
        </h1>

        {/* Mobile order summary toggle */}
        <div className="mt-6 lg:hidden">
          <button
            onClick={() => setSummaryOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-2xl bg-snow px-4 py-3 ring-1 ring-line"
          >
            <span className="inline-flex items-center gap-2 text-sm font-medium text-ink">
              <ChevronDown className={`h-4 w-4 transition-transform ${summaryOpen ? "rotate-180" : ""}`} strokeWidth={1.8} />
              {summaryOpen ? "Hide" : "Show"} order summary
            </span>
            <span className="font-sans font-semibold text-lg text-ink">{formatPrice(total)}</span>
          </button>
          <AnimatePresence>
            {summaryOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-4">
                  <SummaryPanel
                    items={items} subtotal={subtotal} shipping={shipping} total={total}
                    discountAmount={discountAmount} appliedCoupon={appliedCoupon}
                    couponInput={couponInput} setCouponInput={setCouponInput}
                    applyCoupon={applyCoupon} removeCoupon={removeCoupon}
                    authed={authed} openAuth={openAuth} points={points}
                    email={form.email || userEmail}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_400px]">
          {/* Left: stepper + forms */}
          <div>
            {/* Stepper */}
            <ol className="flex items-center">
              {STEPS.map((s, i) => {
                const done = i < step;
                const current = i === step;
                return (
                  <li key={s.id} className="flex flex-1 items-center last:flex-none">
                    <button
                      onClick={() => i < step && setStep(i)}
                      className="flex items-center gap-2"
                      disabled={i > step}
                    >
                      <span
                        className={`grid h-8 w-8 place-items-center rounded-full text-sm font-semibold transition-colors ${
                          done
                            ? "bg-magenta text-white"
                            : current
                            ? "bg-ink text-white"
                            : "bg-snow text-ink-soft ring-1 ring-line"
                        }`}
                      >
                        {done ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
                      </span>
                      <span className={`hidden text-sm font-medium sm:inline ${current || done ? "text-ink" : "text-ink-soft"}`}>
                        {s.label}
                      </span>
                    </button>
                    {i < STEPS.length - 1 && (
                      <span className={`mx-3 h-px flex-1 ${done ? "bg-magenta" : "bg-line"}`} />
                    )}
                  </li>
                );
              })}
            </ol>

            {/* Step content */}
            <div className="mt-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                >
                  {step === 0 && <InfoStep form={form} set={set} setForm={setForm} setIsPhoneValid={setIsPhoneValid} errors={errors} />}
                  {step === 1 && (
                    <DeliveryStep
                      methods={shippingMethods}
                      loading={shippingLoading}
                      selectedMethodId={shippingMethodId}
                      chooseMethod={chooseShippingMethod}
                      selectedMethod={selectedMethod}
                      zoneResolution={zoneResolution}
                      manualZoneId={manualZoneId}
                      setManualZoneId={setManualZoneId}
                      freeShippingThreshold={freeShippingThreshold}
                      newSubtotal={newSubtotal}
                      isFreeShippingCoupon={isFreeShippingCoupon}
                      total={total}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Nav */}
            <div className="mt-8 flex items-center justify-between gap-4">
              {step > 0 ? (
                <button
                  onClick={() => setStep((s) => s - 1)}
                  className="text-sm font-medium text-ink-soft hover:text-magenta"
                >
                  ← Back
                </button>
              ) : (
                <span />
              )}
              <button
                onClick={next}
                disabled={(step === 0 && !isPhoneValid) || processing}
                className={`inline-flex items-center justify-center gap-2 rounded-full px-8 py-3.5 font-display text-sm font-semibold tracking-wider text-white transition-all ${
                  processing
                    ? "cursor-not-allowed bg-ink/20"
                    : "bg-magenta hover:shadow-[var(--shadow-glow-pink)]"
                }`}
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Placing order…
                  </>
                ) : step === STEPS.length - 1 ? (
                  <>
                    <Banknote className="h-4 w-4" strokeWidth={2} /> Place order · {formatPrice(total)}
                  </>
                ) : (
                  "Continue"
                )}
              </button>
            </div>
          </div>

          {/* Right: order summary (desktop) */}
          <div className="hidden lg:sticky lg:top-32 lg:block lg:self-start">
            <SummaryPanel
              items={items} subtotal={subtotal} shipping={shipping} total={total}
              discountAmount={discountAmount} appliedCoupon={appliedCoupon}
              couponInput={couponInput} setCouponInput={setCouponInput}
              applyCoupon={applyCoupon} removeCoupon={removeCoupon}
              authed={authed} openAuth={openAuth} points={points}
              email={form.email || userEmail}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Steps ---------- */

function InfoStep({ form, set, setForm, setIsPhoneValid, errors }) {
  return (
    <div>
      <h2 className="font-serif text-2xl text-ink">Contact & shipping</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Email" full error={errors.email}>
          <Input type="email" value={form.email} onChange={set("email")} placeholder="you@email.com" />
        </Field>
        <Field label="First name" error={errors.firstName}>
          <Input value={form.firstName} onChange={set("firstName")} placeholder="Soumita" />
        </Field>
        <Field label="Last name" error={errors.lastName}>
          <Input value={form.lastName} onChange={set("lastName")} placeholder="Paul" />
        </Field>
        <Field label="Address" full error={errors.address}>
          <Input value={form.address} onChange={set("address")} placeholder="House, road, area" />
        </Field>
        <Field label="City" error={errors.city}>
          <Input value={form.city} onChange={set("city")} placeholder="Dhaka" />
        </Field>
        <Field label="Postal code" error={errors.postal}>
          <Input value={form.postal} onChange={set("postal")} placeholder="1207" inputMode="numeric" maxLength={4} />
        </Field>
        <Field label="Country">
          <Input value={form.country} onChange={set("country")} />
        </Field>
        <Field label="Phone">
          <PhoneInput
            value={form.phone}
            onChange={(val) => setForm((f) => ({ ...f, phone: val }))}
            onValidityChange={setIsPhoneValid}
            required
          />
        </Field>
      </div>
    </div>
  );
}

function DeliveryStep({
  methods, loading, selectedMethodId, chooseMethod, selectedMethod,
  zoneResolution, manualZoneId, setManualZoneId,
  freeShippingThreshold, newSubtotal, isFreeShippingCoupon, total,
}) {
  const freeStd = newSubtotal >= freeShippingThreshold || isFreeShippingCoupon;

  // A method's DISPLAYED price: the resolved zone for the SELECTED method
  // comes from the parent (it depends on the typed city), but an unselected
  // method just needs something reasonable to show in its row — the
  // cheapest of its zones, since the exact one isn't resolved until it's
  // actually chosen.
  function displayPrice(method) {
    if (freeStd) return 0;
    if (method.id === selectedMethodId) {
      const zone = manualZoneId ? method.zones.find((z) => z.id === manualZoneId) : zoneResolution.zone;
      if (zone) return zone.price;
    }
    return method.zones.reduce((min, z) => Math.min(min, z.price), method.zones[0]?.price ?? 0);
  }

  return (
    <div className="space-y-9">
      <div>
        <h2 className="font-serif text-2xl text-ink">Delivery method</h2>
        <div className="mt-5 space-y-3">
          {loading && <p className="text-sm text-ink-soft">Loading delivery options…</p>}
          {!loading && methods.length === 0 && (
            <p className="text-sm text-red-600">No delivery options are available right now — please check back shortly.</p>
          )}
          {methods.map((m) => (
            <OptionCard
              key={m.id}
              on={selectedMethodId === m.id}
              icon={Truck}
              title={m.name}
              desc={m.description}
              trailing={displayPrice(m) === 0 ? "Free" : formatPrice(displayPrice(m))}
              onClick={() => chooseMethod(m.id)}
            />
          ))}
        </div>

        {/* Zone couldn't be inferred from the typed city (multiple zones
            matched, or none did) — ask directly instead of guessing. */}
        {selectedMethod && !manualZoneId && zoneResolution.ambiguous && (
          <div className="mt-3">
            <SelectZoneField
              zones={selectedMethod.zones}
              value={manualZoneId ?? ""}
              onChange={setManualZoneId}
            />
          </div>
        )}
        {/* Auto-resolved but the shopper may still know better than a
            substring match on what they typed — let them override. */}
        {selectedMethod && selectedMethod.zones.length > 1 && !zoneResolution.ambiguous && (
          <div className="mt-3">
            <SelectZoneField
              zones={selectedMethod.zones}
              value={manualZoneId ?? zoneResolution.zone?.id ?? ""}
              onChange={setManualZoneId}
              hint={`Detected from your city — change it if this isn't right.`}
            />
          </div>
        )}
      </div>

      {/* Only one gateway-free option exists right now (no SSLCommerz/bKash/
          Nagad integration yet), so this is a confirmation, not a choice —
          no OptionCard list to click through. */}
      <div>
        <h2 className="font-serif text-2xl text-ink">Payment method</h2>
        <div className="mt-5 flex items-start gap-4 rounded-2xl bg-petal/50 p-5 ring-1 ring-line">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-magenta text-white">
            <Banknote className="h-5 w-5" strokeWidth={1.7} />
          </span>
          <div>
            <p className="font-medium text-ink">Cash on Delivery</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">
              Pay only when your order arrives — no card or advance payment
              needed. Please inspect the seal and packaging before accepting
              delivery, and let our courier know right away if anything looks
              tampered with.
            </p>
            <p className="mt-3 text-sm font-medium text-ink-soft">
              Amount due on delivery: <span className="font-sans font-semibold text-lg text-magenta">{formatPrice(total)}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SelectZoneField({ zones, value, onChange, hint }) {
  return (
    <Field label="Delivery zone">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-magenta"
      >
        <option value="" disabled>Choose your zone…</option>
        {zones.map((z) => (
          <option key={z.id} value={z.id}>
            {z.zone_name} — {z.price === 0 ? "Free" : formatPrice(z.price)}
          </option>
        ))}
      </select>
      {hint && <p className="text-xs text-ink-soft">{hint}</p>}
    </Field>
  );
}

/* ---------- Summary panel (items + totals) ---------- */
function SummaryPanel({ items, subtotal, shipping, total, discountAmount, appliedCoupon, couponInput, setCouponInput, applyCoupon, removeCoupon, authed, openAuth, points, email }) {
  return (
    <div className="space-y-4">
      <div className="max-h-72 space-y-4 overflow-y-auto rounded-[1.5rem] bg-snow p-5 ring-1 ring-line">
        {items.map((item) => (
          <LineItem key={`${item.id}:${item.variantId ?? ""}`} item={item} compact readOnly />
        ))}
      </div>

      <div className="rounded-[1.5rem] bg-white p-5 ring-1 ring-line">
        {appliedCoupon ? (
          <div className="flex items-center justify-between rounded-xl bg-petal/50 p-3 ring-1 ring-line">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-magenta" strokeWidth={2} />
              <span className="text-sm font-semibold text-ink">{appliedCoupon.code}</span>
            </div>
            <button onClick={removeCoupon} className="text-xs font-medium text-ink-soft hover:text-magenta">Remove</button>
          </div>
        ) : (
          <form onSubmit={applyCoupon} className="flex flex-col gap-3">
            <p className="text-sm font-medium text-ink">Discount Code</p>
            <div className="flex items-center gap-2">
              <Input
                type="text"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                placeholder="Enter coupon code"
                className="bg-snow uppercase"
              />
              <Button variant="secondary" onClick={applyCoupon} disabled={!couponInput.trim()} type="submit" className="shrink-0 h-11 px-5">Apply</Button>
            </div>
          </form>
        )}
        <PromoHint
          subtotal={subtotal}
          email={email}
          points={points}
          appliedCoupon={appliedCoupon}
          onApply={(code) => applyCoupon(null, code)}
        />
        {!authed && !appliedCoupon && (
          <p className="mt-3 text-center text-xs text-ink-soft">
            Have an account?{" "}
            <button
              type="button"
              onClick={() => openAuth("login")}
              className="font-semibold text-magenta underline-offset-2 hover:underline"
            >
              Log in
            </button>{" "}
            to use your Rewards codes.
          </p>
        )}
      </div>

      <OrderSummary subtotal={subtotal} shippingCost={shipping} total={total} discountAmount={discountAmount} promoCode={appliedCoupon?.code} />
    </div>
  );
}

/* ---------- Success ---------- */
function Success({ order }) {
  const [trackingOpen, setTrackingOpen] = useState(false);
  const SPARKLES = ["🌸", "✨", "💖", "🌟", "🌺", "💗"];

  // Add timestamp to order for tracking status calculation
  const orderWithTimestamp = {
    ...order,
    timestamp: order.timestamp || new Date().toISOString(),
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-5">
      {SPARKLES.map((s, i) => (
        <motion.span
          key={i}
          className="absolute text-2xl"
          style={{ left: `${10 + i * 15}%`, top: "20%" }}
          initial={{ y: 0, opacity: 0 }}
          animate={{ y: [0, -40, 200], opacity: [0, 1, 0] }}
          transition={{ duration: 2.4, delay: i * 0.15, repeat: Infinity, repeatDelay: 1.2 }}
        >
          {s}
        </motion.span>
      ))}

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-lg rounded-[1.75rem] bg-white p-8 text-center shadow-lift ring-1 ring-line sm:p-10"
      >
        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
          className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-success text-white"
        >
          <Check className="h-10 w-10" strokeWidth={3} />
        </motion.div>

        <h1 className="mt-6 font-serif text-3xl text-ink">
          Your ritual is on its way! <PartyPopper className="inline h-6 w-6 text-magenta" />
        </h1>
        <p className="mt-3 text-ink-soft">
          Thank you for glowing with us. A confirmation has been sent to{" "}
          <span className="font-medium text-ink">{order.email}</span>.
        </p>

        <div className="mt-6 rounded-2xl bg-snow p-4 text-left ring-1 ring-line">
          <div className="flex justify-between text-sm">
            <span className="text-ink-soft">Order number</span>
            <span className="font-semibold text-ink">{order.number}</span>
          </div>
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-ink-soft">Items</span>
            <span className="font-semibold text-ink">{order.count}</span>
          </div>
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-ink-soft">Payment</span>
            <span className="font-semibold text-ink">
              {order.payMethod === "cod" ? "Cash on Delivery" : "Card"}
            </span>
          </div>
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-ink-soft">
              {order.payMethod === "cod" ? "Amount due" : "Total paid"}
            </span>
            <span className="font-semibold text-ink">{formatPrice(order.total)}</span>
          </div>
        </div>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <button
            onClick={() => setTrackingOpen(true)}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-magenta py-3.5 text-sm font-semibold text-white shadow-soft transition-shadow hover:shadow-[var(--shadow-glow-pink)]"
          >
            <TrackIcon className="h-4 w-4" strokeWidth={2} />
            Track Order
          </button>
          <a
            href="/shop"
            className="flex-1 rounded-full border border-ink/15 py-3.5 text-sm font-semibold text-ink transition-colors hover:border-magenta/50"
          >
            Continue shopping
          </a>
          <a
            href="/"
            className="flex-1 rounded-full border border-ink/15 py-3.5 text-sm font-semibold text-ink transition-colors hover:border-magenta/50"
          >
            Back home
          </a>
        </div>

        {/* Tracking Modal */}
        <TrackingModal
          isOpen={trackingOpen}
          onClose={() => setTrackingOpen(false)}
          orderData={orderWithTimestamp}
        />
      </motion.div>
    </div>
  );
}
