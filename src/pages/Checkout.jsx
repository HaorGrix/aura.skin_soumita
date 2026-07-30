import { navigate } from "../lib/navigate.js";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  Check,
  Lock,
  CreditCard,
  Truck,
  Zap,
  Banknote,
  ChevronDown,
  Loader2,
  PartyPopper,
  LogIn,
  UserPlus,
  Tag,
  Truck as TrackIcon,
} from "lucide-react";
import { stockFor, maxQtyFor } from "../data/products.js";
import { useCart } from "../context/CartContext.jsx";
import { useUser } from "../context/UserContext.jsx";
import { useToast } from "../components/ui/Toast.jsx";
import Button from "../components/ui/Button.jsx";
import { Field, OptionCard, Input } from "../components/ui/index.js";
import { FREE_SHIPPING_THRESHOLD, STANDARD_SHIPPING, EXPRESS_SHIPPING } from "../lib/shop-config.js";
import { formatPrice } from "../lib/format.js";
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
  { id: "delivery", label: "Delivery" },
  { id: "payment", label: "Payment" },
];

const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const postcodeOk = (v) => /^[0-9]{4}$/.test(v.trim());
const CHECKOUT_KEY = "aura_checkout_state";

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
  const { authed, openAuth, email: userEmail, name: userName, points, coupons, addOrder, usedCoupons, markCouponUsed, orders } = useUser();
  const { toast } = useToast();
  const savedCheckout = loadCheckoutState();

  // Login is only required here. Signed-in shoppers skip the gate; everyone
  // else can sign in/up or breeze through as a guest.
  const [guest, setGuest] = useState(() => savedCheckout?.guest ?? false);
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
  const [delivery, setDelivery] = useState(() => savedCheckout?.delivery ?? "standard");
  const [payMethod, setPayMethod] = useState(() => savedCheckout?.payMethod ?? "card");
  const [isPhoneValid, setIsPhoneValid] = useState(false); // "card" | "cod"
  const [pay, setPay] = useState(() => savedCheckout?.pay ?? { name: "", number: "", expiry: "", cvc: "" });
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
      delivery,
      payMethod,
      pay,
      guest,
    };
    saveCheckoutState(snapshot);
    setResumeSnapshot(snapshot);
  }, [step, form, delivery, payMethod, pay, guest]);

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((err) => ({ ...err, [k]: undefined }));
  };

  // discountAmount comes from CartContext and auto-recalculates when subtotal changes.
  const newSubtotal = subtotal - discountAmount;
  // Read the coupon's own flag — matching on the code string would hand free
  // shipping to any future code that happens to contain "FS" (GIFTS, OFFSEASON…).
  const isFreeShippingCoupon = !!appliedCoupon?.freeShipping;

  const shipping =
    delivery === "express"
      ? EXPRESS_SHIPPING
      : (newSubtotal >= FREE_SHIPPING_THRESHOLD || isFreeShippingCoupon)
      ? 0
      : STANDARD_SHIPPING;
  const total = newSubtotal + shipping;

  const applyCoupon = (e) => {
    e.preventDefault();
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    // applyPromo checks general PROMOS; the loyalty account is passed through
    // so context can verify both types without importing UserContext itself.
    const result = applyPromo(code, { authed, points, coupons, usedCoupons, orders });
    if (result?.requiresAuth) {
      toast.error("Sign in to use your welcome code — it's tied to your account.", "Login required");
      openAuth("login");
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
      if (!emailOk(form.email)) next.email = "Please enter a valid email address.";
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
    if (step === 2 && payMethod === "card") {
      const next = {};
      if (!pay.name.trim()) next.payName = "Name on card is required.";
      if (pay.number.replace(/\s/g, "").length < 16) next.payNumber = "Enter a valid 16-digit card number.";
      if (pay.expiry.length < 4) next.payExpiry = "Enter a valid expiry date (MM/YY).";
      if (pay.cvc.length < 3) next.payCvc = "CVC must be 3–4 digits.";
      if (Object.keys(next).length) {
        setErrors(next);
        toast.error("Please complete your payment details.", "Check your details");
        return false;
      }
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
      soldOut.forEach((i) => removeItem(i.id));
      toast.error(
        `${soldOut.map((i) => i.name).join(", ")} just sold out and ${soldOut.length > 1 ? "were" : "was"} removed from your bag.`,
        "Out of stock"
      );
      return;
    }
    if (overQty.length > 0) {
      overQty.forEach((i) => setQty(i.id, maxQtyFor(i.id)));
      toast.error(
        `We only have enough of ${overQty.map((i) => i.name).join(", ")} left — quantities updated.`,
        "Limited stock"
      );
      return;
    }

    setProcessing(true);
    setTimeout(() => {
      const orderNumber = "AUR-" + Math.floor(100000 + Math.random() * 900000);
      const itemIds = items.map((item) => item.id); // Extract product IDs from cart

      const orderData = {
        number: orderNumber,
        email: form.email,
        total,
        count,
        payMethod,
        itemIds, // Product IDs for order history
        timestamp: new Date().toISOString(), // For tracking status
      };

      setOrder(orderData);

      // Lock the coupon so it cannot be reused on future orders.
      if (appliedCoupon) markCouponUsed(appliedCoupon.code);

      // Persist to global order history (UserContext)
      addOrder({
        number: orderNumber,
        total,
        email: form.email,
        payMethod,
        itemIds,
        couponCode: appliedCoupon?.code || null,
      });

      setProcessing(false);
      sessionStorage.removeItem("aura_checkout_form");
      clear();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 1700);
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

  // —— Auth gate —— the only place login is required (or skip as a guest).
  if (!authed && !guest) {
    return <AuthGate onGuest={() => setGuest(true)} openAuth={openAuth} />;
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
            <span className="font-serif text-lg text-ink">{formatPrice(total)}</span>
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
                    authed={authed} openAuth={openAuth}
                    orders={orders} coupons={coupons} usedCoupons={usedCoupons}
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
                      delivery={delivery}
                      setDelivery={setDelivery}
                      payMethod={payMethod}
                      setPayMethod={setPayMethod}
                      subtotal={subtotal}
                    />
                  )}
                  {step === 2 && <PaymentStep pay={pay} setPay={setPay} payMethod={payMethod} total={total} errors={errors} setErrors={setErrors} />}
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
                className={`inline-flex items-center justify-center gap-2 rounded-full px-8 py-3.5 text-sm font-semibold text-white transition-all ${
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
                  payMethod === "cod" ? (
                    <>
                      <Banknote className="h-4 w-4" strokeWidth={2} /> Place order · {formatPrice(total)}
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" strokeWidth={2} /> Pay {formatPrice(total)}
                    </>
                  )
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
              authed={authed} openAuth={openAuth}
              orders={orders} coupons={coupons} usedCoupons={usedCoupons}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Auth gate (checkout-only) ---------- */
function AuthGate({ onGuest, openAuth }) {
  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-md px-5 sm:px-8">
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

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mt-6 rounded-[1.75rem] bg-white p-7 text-center shadow-soft ring-1 ring-line sm:p-9"
        >
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-petal text-magenta">
            <Lock className="h-6 w-6" strokeWidth={1.7} />
          </span>
          <h1 className="mt-5 font-serif text-[clamp(1.8rem,5vw,2.4rem)] leading-tight text-ink">
            Almost there
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Sign in to check out faster, save your details, and track your order
            — or breeze through as a guest.
          </p>

          <div className="mt-6 space-y-3">
            <Button variant="primary" magnetic={false} className="w-full" onClick={() => openAuth("login")}>
              <LogIn className="h-4 w-4" strokeWidth={2} /> Log in
            </Button>
            <Button variant="secondary" magnetic={false} className="w-full" onClick={() => openAuth("signup")}>
              <UserPlus className="h-4 w-4" strokeWidth={2} /> Create account
            </Button>
          </div>

          <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wide text-ink-soft">
            <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
          </div>

          <button
            onClick={onGuest}
            className="text-sm font-semibold text-ink-soft underline-offset-4 transition-colors hover:text-magenta hover:underline"
          >
            Continue as guest →
          </button>
        </motion.div>
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

function DeliveryStep({ delivery, setDelivery, payMethod, setPayMethod, subtotal }) {
  const freeStd = subtotal >= FREE_SHIPPING_THRESHOLD;
  const deliveryOptions = [
    {
      id: "standard",
      icon: Truck,
      title: "Home Delivery",
      desc: "3–5 business days · to your door",
      price: freeStd ? 0 : STANDARD_SHIPPING,
    },
    {
      id: "express",
      icon: Zap,
      title: "Express Delivery",
      desc: "1–2 business days",
      price: EXPRESS_SHIPPING,
    },
  ];
  const payOptions = [
    {
      id: "card",
      icon: CreditCard,
      title: "Pay Online",
      desc: "Card · secure encrypted checkout",
    },
    {
      id: "cod",
      icon: Banknote,
      title: "Cash on Delivery",
      desc: "Pay in cash when your order arrives",
    },
  ];
  return (
    <div className="space-y-9">
      <div>
        <h2 className="font-serif text-2xl text-ink">Delivery method</h2>
        <div className="mt-5 space-y-3">
          {deliveryOptions.map((o) => (
            <OptionCard
              key={o.id}
              on={delivery === o.id}
              icon={o.icon}
              title={o.title}
              desc={o.desc}
              trailing={o.price === 0 ? "Free" : formatPrice(o.price)}
              onClick={() => setDelivery(o.id)}
            />
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-serif text-2xl text-ink">Payment method</h2>
        <div className="mt-5 space-y-3">
          {payOptions.map((o) => (
            <OptionCard
              key={o.id}
              on={payMethod === o.id}
              icon={o.icon}
              title={o.title}
              desc={o.desc}
              onClick={() => setPayMethod(o.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function PaymentStep({ pay, setPay, payMethod, total, errors, setErrors }) {
  // Cash on Delivery — nothing to collect here; reassure & confirm the amount.
  if (payMethod === "cod") {
    return (
      <div>
        <h2 className="font-serif text-2xl text-ink">Cash on Delivery</h2>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-soft">
          <Banknote className="h-3.5 w-3.5" strokeWidth={2} /> No card needed — pay at your doorstep.
        </p>

        <div className="mt-5 flex items-start gap-4 rounded-2xl bg-petal/50 p-5 ring-1 ring-line">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-magenta text-white">
            <Banknote className="h-5 w-5" strokeWidth={1.7} />
          </span>
          <div>
            <p className="text-sm font-medium text-ink-soft">Amount due on delivery</p>
            <p className="font-serif text-3xl text-magenta">{formatPrice(total)}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
              Please keep the exact amount ready. Our courier will collect it when
              your order arrives.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const PAY_ERR_KEY = { name: "payName", number: "payNumber", expiry: "payExpiry", cvc: "payCvc" };
  const update = (k, fmt) => (e) => {
    const v = fmt ? fmt(e.target.value) : e.target.value;
    setPay((p) => ({ ...p, [k]: v }));
    setErrors((err) => ({ ...err, [PAY_ERR_KEY[k]]: undefined }));
  };
  const fmtCard = (v) =>
    v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
  const fmtExp = (v) => {
    const d = v.replace(/\D/g, "").slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };
  const fmtCvc = (v) => v.replace(/\D/g, "").slice(0, 4);

  return (
    <div>
      <h2 className="font-serif text-2xl text-ink">Payment</h2>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-soft">
        <Lock className="h-3.5 w-3.5" strokeWidth={2} /> Encrypted & secure · this is a demo, no real charge
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Name on card" full error={errors.payName}>
          <Input value={pay.name} onChange={update("name")} placeholder="SOUMITA PAUL" />
        </Field>
        <Field label="Card number" full error={errors.payNumber}>
          <div className="relative">
            <CreditCard className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" strokeWidth={1.7} />
            <Input
              value={pay.number}
              onChange={update("number", fmtCard)}
              placeholder="4242 4242 4242 4242"
              inputMode="numeric"
              className="pl-11"
            />
          </div>
        </Field>
        <Field label="Expiry" error={errors.payExpiry}>
          <Input value={pay.expiry} onChange={update("expiry", fmtExp)} placeholder="MM/YY" inputMode="numeric" />
        </Field>
        <Field label="CVC" error={errors.payCvc}>
          <Input value={pay.cvc} onChange={update("cvc", fmtCvc)} placeholder="123" inputMode="numeric" />
        </Field>
      </div>
    </div>
  );
}

/* ---------- Summary panel (items + totals) ---------- */
function SummaryPanel({ items, subtotal, shipping, total, discountAmount, appliedCoupon, couponInput, setCouponInput, applyCoupon, removeCoupon, authed, openAuth, orders, coupons, usedCoupons }) {
  return (
    <div className="space-y-4">
      <div className="max-h-72 space-y-4 overflow-y-auto rounded-[1.5rem] bg-snow p-5 ring-1 ring-line">
        {items.map((item) => (
          <LineItem key={item.id} item={item} compact readOnly />
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
          orders={orders}
          coupons={coupons}
          usedCoupons={usedCoupons}
          appliedCoupon={appliedCoupon}
          authed={authed}
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
