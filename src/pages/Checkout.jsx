import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  Check,
  Lock,
  CreditCard,
  Truck,
  Zap,
  ChevronDown,
  Loader2,
  PartyPopper,
} from "lucide-react";
import { useCart } from "../context/CartContext.jsx";
import {
  FREE_SHIPPING_THRESHOLD,
  STANDARD_SHIPPING,
  EXPRESS_SHIPPING,
} from "../lib/shop-config.js";
import { formatPrice } from "../lib/format.js";
import LineItem from "../components/cart/LineItem.jsx";
import OrderSummary from "../components/cart/OrderSummary.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";

const STEPS = [
  { id: "info", label: "Information" },
  { id: "delivery", label: "Delivery" },
  { id: "payment", label: "Payment" },
];

const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export default function Checkout() {
  const { items, subtotal, count, clear } = useCart();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    address: "",
    city: "",
    postal: "",
    country: "Bangladesh",
    phone: "",
  });
  const [delivery, setDelivery] = useState("standard");
  const [pay, setPay] = useState({ name: "", number: "", expiry: "", cvc: "" });
  const [processing, setProcessing] = useState(false);
  const [order, setOrder] = useState(null); // success snapshot
  const [summaryOpen, setSummaryOpen] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const shipping =
    delivery === "express"
      ? EXPRESS_SHIPPING
      : subtotal >= FREE_SHIPPING_THRESHOLD
      ? 0
      : STANDARD_SHIPPING;
  const total = subtotal + shipping;

  const infoValid =
    emailOk(form.email) &&
    form.firstName &&
    form.lastName &&
    form.address &&
    form.city &&
    form.postal;
  const payValid =
    pay.name && pay.number.replace(/\s/g, "").length >= 16 && pay.expiry.length >= 4 && pay.cvc.length >= 3;

  const canContinue = step === 0 ? infoValid : step === 1 ? true : payValid;

  function next() {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
    else placeOrder();
  }

  function placeOrder() {
    setProcessing(true);
    setTimeout(() => {
      setOrder({
        number: "AUR-" + Math.floor(100000 + Math.random() * 900000),
        email: form.email,
        total,
        count,
      });
      setProcessing(false);
      clear();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 1700);
  }

  // —— Success ——
  if (order) return <Success order={order} />;

  // —— Empty guard ——
  if (count === 0) {
    return (
      <div className="min-h-screen pt-28 sm:pt-32">
        <EmptyState
          emoji="🧾"
          title="Nothing to check out"
          message="Your bag is empty — let’s add a little glow first."
          actionLabel="Go to shop"
          onAction={() => (window.location.hash = "#/shop")}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-28 sm:pt-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <a
          href="#/cart"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft transition-colors hover:text-magenta dark:text-white/60"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.8} /> Back to bag
        </a>

        <h1 className="mt-4 font-serif text-[clamp(2rem,5vw,3rem)] leading-tight text-ink dark:text-white">
          Checkout
        </h1>

        {/* Mobile order summary toggle */}
        <div className="mt-6 lg:hidden">
          <button
            onClick={() => setSummaryOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-2xl bg-snow px-4 py-3 ring-1 ring-line dark:bg-white/[0.04] dark:ring-white/10"
          >
            <span className="inline-flex items-center gap-2 text-sm font-medium text-ink dark:text-white">
              <ChevronDown className={`h-4 w-4 transition-transform ${summaryOpen ? "rotate-180" : ""}`} strokeWidth={1.8} />
              {summaryOpen ? "Hide" : "Show"} order summary
            </span>
            <span className="font-serif text-lg text-ink dark:text-white">{formatPrice(total)}</span>
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
                  <SummaryPanel items={items} subtotal={subtotal} shipping={shipping} total={total} />
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
                            ? "bg-ink text-white dark:bg-white dark:text-ink"
                            : "bg-snow text-ink-soft ring-1 ring-line dark:bg-white/5 dark:text-white/50 dark:ring-white/10"
                        }`}
                      >
                        {done ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
                      </span>
                      <span className={`hidden text-sm font-medium sm:inline ${current || done ? "text-ink dark:text-white" : "text-ink-soft dark:text-white/45"}`}>
                        {s.label}
                      </span>
                    </button>
                    {i < STEPS.length - 1 && (
                      <span className={`mx-3 h-px flex-1 ${done ? "bg-magenta" : "bg-line dark:bg-white/10"}`} />
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
                  {step === 0 && <InfoStep form={form} set={set} />}
                  {step === 1 && (
                    <DeliveryStep delivery={delivery} setDelivery={setDelivery} subtotal={subtotal} />
                  )}
                  {step === 2 && <PaymentStep pay={pay} setPay={setPay} />}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Nav */}
            <div className="mt-8 flex items-center justify-between gap-4">
              {step > 0 ? (
                <button
                  onClick={() => setStep((s) => s - 1)}
                  className="text-sm font-medium text-ink-soft hover:text-magenta dark:text-white/60"
                >
                  ← Back
                </button>
              ) : (
                <span />
              )}
              <button
                onClick={next}
                disabled={!canContinue || processing}
                className={`inline-flex items-center justify-center gap-2 rounded-full px-8 py-3.5 text-sm font-semibold text-white transition-all ${
                  canContinue && !processing
                    ? "bg-magenta hover:shadow-[var(--shadow-glow-pink)]"
                    : "cursor-not-allowed bg-ink/20 dark:bg-white/15"
                }`}
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Placing order…
                  </>
                ) : step === STEPS.length - 1 ? (
                  <>
                    <Lock className="h-4 w-4" strokeWidth={2} /> Pay {formatPrice(total)}
                  </>
                ) : (
                  "Continue"
                )}
              </button>
            </div>
          </div>

          {/* Right: order summary (desktop) */}
          <div className="hidden lg:sticky lg:top-32 lg:block lg:self-start">
            <SummaryPanel items={items} subtotal={subtotal} shipping={shipping} total={total} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Steps ---------- */
function Field({ label, children, full }) {
  return (
    <label className={`flex flex-col gap-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-sm font-medium text-ink dark:text-white/90">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-xl bg-white px-4 py-3 text-sm text-ink ring-1 ring-line outline-none transition-shadow placeholder:text-ink-soft/60 focus:ring-2 focus:ring-magenta/50 dark:bg-white/5 dark:text-white dark:ring-white/10 dark:placeholder:text-white/35";

function InfoStep({ form, set }) {
  return (
    <div>
      <h2 className="font-serif text-2xl text-ink dark:text-white">Contact & shipping</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Email" full>
          <input type="email" value={form.email} onChange={set("email")} placeholder="you@email.com" className={inputCls} />
        </Field>
        <Field label="First name">
          <input value={form.firstName} onChange={set("firstName")} placeholder="Soumita" className={inputCls} />
        </Field>
        <Field label="Last name">
          <input value={form.lastName} onChange={set("lastName")} placeholder="Paul" className={inputCls} />
        </Field>
        <Field label="Address" full>
          <input value={form.address} onChange={set("address")} placeholder="House, road, area" className={inputCls} />
        </Field>
        <Field label="City">
          <input value={form.city} onChange={set("city")} placeholder="Dhaka" className={inputCls} />
        </Field>
        <Field label="Postal code">
          <input value={form.postal} onChange={set("postal")} placeholder="1207" className={inputCls} />
        </Field>
        <Field label="Country">
          <input value={form.country} onChange={set("country")} className={inputCls} />
        </Field>
        <Field label="Phone (optional)">
          <input value={form.phone} onChange={set("phone")} placeholder="+880" className={inputCls} />
        </Field>
      </div>
    </div>
  );
}

function DeliveryStep({ delivery, setDelivery, subtotal }) {
  const freeStd = subtotal >= FREE_SHIPPING_THRESHOLD;
  const options = [
    {
      id: "standard",
      icon: Truck,
      title: "Standard delivery",
      desc: "3–5 business days",
      price: freeStd ? 0 : STANDARD_SHIPPING,
    },
    {
      id: "express",
      icon: Zap,
      title: "Express delivery",
      desc: "1–2 business days",
      price: EXPRESS_SHIPPING,
    },
  ];
  return (
    <div>
      <h2 className="font-serif text-2xl text-ink dark:text-white">Delivery method</h2>
      <div className="mt-5 space-y-3">
        {options.map((o) => {
          const on = delivery === o.id;
          return (
            <button
              key={o.id}
              onClick={() => setDelivery(o.id)}
              className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all ${
                on
                  ? "border-magenta bg-petal/50 dark:bg-white/[0.04]"
                  : "border-line hover:border-magenta/40 dark:border-white/10"
              }`}
            >
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${on ? "bg-magenta text-white" : "bg-snow text-ink-soft dark:bg-white/5 dark:text-white/60"}`}>
                <o.icon className="h-5 w-5" strokeWidth={1.7} />
              </span>
              <div className="flex-1">
                <p className="font-semibold text-ink dark:text-white">{o.title}</p>
                <p className="text-sm text-ink-soft dark:text-white/55">{o.desc}</p>
              </div>
              <span className="font-semibold text-ink dark:text-white">
                {o.price === 0 ? "Free" : formatPrice(o.price)}
              </span>
              <span className={`grid h-5 w-5 place-items-center rounded-full border ${on ? "border-magenta" : "border-ink/25 dark:border-white/25"}`}>
                {on && <span className="h-2.5 w-2.5 rounded-full bg-magenta" />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PaymentStep({ pay, setPay }) {
  const update = (k, fmt) => (e) => {
    const v = fmt ? fmt(e.target.value) : e.target.value;
    setPay((p) => ({ ...p, [k]: v }));
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
      <h2 className="font-serif text-2xl text-ink dark:text-white">Payment</h2>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-soft dark:text-white/55">
        <Lock className="h-3.5 w-3.5" strokeWidth={2} /> Encrypted & secure · this is a demo, no real charge
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Name on card" full>
          <input value={pay.name} onChange={update("name")} placeholder="SOUMITA PAUL" className={inputCls} />
        </Field>
        <Field label="Card number" full>
          <div className="relative">
            <CreditCard className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft dark:text-white/45" strokeWidth={1.7} />
            <input
              value={pay.number}
              onChange={update("number", fmtCard)}
              placeholder="4242 4242 4242 4242"
              inputMode="numeric"
              className={`${inputCls} pl-11`}
            />
          </div>
        </Field>
        <Field label="Expiry">
          <input value={pay.expiry} onChange={update("expiry", fmtExp)} placeholder="MM/YY" inputMode="numeric" className={inputCls} />
        </Field>
        <Field label="CVC">
          <input value={pay.cvc} onChange={update("cvc", fmtCvc)} placeholder="123" inputMode="numeric" className={inputCls} />
        </Field>
      </div>
    </div>
  );
}

/* ---------- Summary panel (items + totals) ---------- */
function SummaryPanel({ items, subtotal, shipping, total }) {
  return (
    <div className="space-y-4">
      <div className="max-h-72 space-y-4 overflow-y-auto rounded-[1.5rem] bg-snow p-5 ring-1 ring-line dark:bg-white/[0.03] dark:ring-white/10">
        {items.map((item) => (
          <LineItem key={item.id} item={item} compact readOnly />
        ))}
      </div>
      <OrderSummary subtotal={subtotal} shippingCost={shipping} total={total} />
    </div>
  );
}

/* ---------- Success ---------- */
function Success({ order }) {
  const SPARKLES = ["🌸", "✨", "💖", "🌟", "🌺", "💗"];
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 pt-28">
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
        className="relative z-10 w-full max-w-lg rounded-[1.75rem] bg-white p-8 text-center shadow-lift ring-1 ring-line dark:bg-[#0f0f12] dark:ring-white/10 sm:p-10"
      >
        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
          className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-success text-white"
        >
          <Check className="h-10 w-10" strokeWidth={3} />
        </motion.div>

        <h1 className="mt-6 font-serif text-3xl text-ink dark:text-white">
          Your ritual is on its way! <PartyPopper className="inline h-6 w-6 text-magenta" />
        </h1>
        <p className="mt-3 text-ink-soft dark:text-white/65">
          Thank you for glowing with us. A confirmation has been sent to{" "}
          <span className="font-medium text-ink dark:text-white">{order.email}</span>.
        </p>

        <div className="mt-6 rounded-2xl bg-snow p-4 text-left ring-1 ring-line dark:bg-white/[0.04] dark:ring-white/10">
          <div className="flex justify-between text-sm">
            <span className="text-ink-soft dark:text-white/60">Order number</span>
            <span className="font-semibold text-ink dark:text-white">{order.number}</span>
          </div>
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-ink-soft dark:text-white/60">Items</span>
            <span className="font-semibold text-ink dark:text-white">{order.count}</span>
          </div>
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-ink-soft dark:text-white/60">Total paid</span>
            <span className="font-semibold text-ink dark:text-white">{formatPrice(order.total)}</span>
          </div>
        </div>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <a
            href="#/shop"
            className="flex-1 rounded-full bg-magenta py-3.5 text-sm font-semibold text-white shadow-soft transition-shadow hover:shadow-[var(--shadow-glow-pink)]"
          >
            Continue shopping
          </a>
          <a
            href="#/"
            className="flex-1 rounded-full border border-ink/15 py-3.5 text-sm font-semibold text-ink transition-colors hover:border-magenta/50 dark:border-white/15 dark:text-white"
          >
            Back home
          </a>
        </div>
      </motion.div>
    </div>
  );
}
