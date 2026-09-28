/* =================================================================== *
 * skin.theory — Track your order
 * -------------------------------------------------------------------
 * Guest-friendly: order number + the phone used at checkout, looked up
 * through track_order() (0061). Shows the status staff actually set in the
 * admin, not a time-based estimate. ?order=AUR-000084 prefills the number
 * (links from the order confirmation and the account's order history).
 * =================================================================== */
import { useState } from "react";
import { Home, PackageSearch, Check, Truck, PackageCheck, ClipboardList, XCircle } from "lucide-react";
import BackButton from "../components/ui/BackButton.jsx";
import Footer from "../components/Footer.jsx";
import Button from "../components/ui/Button.jsx";
import { Field, Input } from "../components/ui/index.js";
import { trackOrder } from "../lib/api/tracking.js";
import { formatPrice } from "../lib/format.js";

const STEPS = [
  { id: "pending", label: "Order placed", icon: ClipboardList },
  { id: "processing", label: "Processing", icon: PackageSearch },
  { id: "shipped", label: "Shipped", icon: Truck },
  { id: "delivered", label: "Delivered", icon: PackageCheck },
];
const STATUS_LABEL = {
  pending: "Order placed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

const formatDate = (iso) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";

export default function TrackOrder() {
  const [number, setNumber] = useState(
    () => new URLSearchParams(window.location.search).get("order") ?? ""
  );
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    if (!number.trim() || !phone.trim()) {
      setMessage("Enter your order number and the phone number used at checkout.");
      return;
    }
    setLoading(true);
    setMessage(null);
    const { data, error } = await trackOrder(number, phone);
    setLoading(false);
    setResult(data);
    if (error) setMessage("We couldn't reach the server. Please try again.");
    else if (!data) setMessage("No order matches that order number and phone. Please check both and try again.");
  }

  return (
    <div className="min-h-screen pb-4">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <BackButton route="track" />

        <nav className="flex items-center gap-2 text-sm text-ink-soft" aria-label="Breadcrumb">
          <a href="/" className="inline-flex items-center gap-1 hover:text-magenta">
            <Home className="h-3.5 w-3.5" strokeWidth={1.8} /> Home
          </a>
          <span>/</span>
          <span className="text-ink">Track order</span>
        </nav>

        <div className="mt-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-magenta">Where's my order?</p>
          <h1 className="mt-2 font-serif text-[clamp(2rem,5vw,3.25rem)] leading-tight text-ink">Track your order</h1>
          <p className="mt-3 text-ink-soft">
            Your order number is on your order confirmation (for example AUR-000084).
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-8 grid gap-4 rounded-[1.5rem] bg-white p-6 ring-1 ring-line sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label="Order number">
            <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="AUR-000000" autoComplete="off" />
          </Field>
          <Field label="Phone used at checkout">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX" inputMode="tel" autoComplete="tel" />
          </Field>
          <Button type="submit" disabled={loading} className="h-[46px] justify-center">
            {loading ? "Checking…" : "Track"}
          </Button>
        </form>

        {message && (
          <p role="status" className="mt-4 rounded-xl bg-petal/40 px-4 py-3 text-sm text-ink ring-1 ring-line">{message}</p>
        )}

        {result && <TrackResult order={result} />}
      </div>
      <Footer />
    </div>
  );
}

function TrackResult({ order }) {
  const stopped = order.status === "cancelled" || order.status === "refunded";
  const reached = STEPS.findIndex((s) => s.id === order.status);
  const whenReached = Object.fromEntries(order.events.map((e) => [e.status, e.at]));
  whenReached.pending = whenReached.pending ?? order.placedAt;

  return (
    <section className="mt-8 rounded-[1.5rem] bg-white p-6 ring-1 ring-line" aria-live="polite">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-2xl text-ink">Order {order.number}</h2>
        <span className="text-sm text-ink-soft">Placed {formatDate(order.placedAt)}</span>
      </div>

      {stopped ? (
        <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-ink/5 px-4 py-2 text-sm font-semibold text-ink">
          <XCircle className="h-4 w-4" strokeWidth={2} />
          {STATUS_LABEL[order.status]}
          {order.cancelledAt ? ` · ${formatDate(order.cancelledAt)}` : ""}
        </p>
      ) : (
        <ol className="mt-6 grid grid-cols-4 gap-2">
          {STEPS.map((s, i) => {
            const done = i <= reached;
            const Icon = done ? Check : s.icon;
            return (
              <li key={s.id} className="flex flex-col items-center text-center">
                <span className={`grid h-10 w-10 place-items-center rounded-full ${done ? "bg-success text-white" : "bg-snow text-ink-soft ring-1 ring-line"}`}>
                  <Icon className="h-5 w-5" strokeWidth={2} />
                </span>
                <span className={`mt-2 text-xs font-semibold ${done ? "text-ink" : "text-ink-soft"}`}>{s.label}</span>
                {done && whenReached[s.id] && (
                  <span className="mt-0.5 text-[11px] text-ink-soft">{formatDate(whenReached[s.id])}</span>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {(order.courier || order.trackingNumber) && (
        <p className="mt-6 text-sm text-ink">
          <span className="text-ink-soft">Courier:</span> {order.courier ?? "—"}
          {order.trackingNumber && (
            <>
              {" · "}<span className="text-ink-soft">Tracking number:</span>{" "}
              <span className="font-semibold">{order.trackingNumber}</span>
            </>
          )}
        </p>
      )}

      <div className="mt-6 border-t border-line pt-4">
        <h3 className="text-sm font-semibold text-ink">Items</h3>
        <ul className="mt-2 space-y-1 text-sm text-ink">
          {order.items.map((it, i) => (
            <li key={`${it.name}-${i}`} className="flex justify-between gap-3">
              <span>{it.name}{it.size && it.size !== "Standard" ? ` (${it.size})` : ""}</span>
              <span className="text-ink-soft">× {it.qty}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex justify-between text-sm font-semibold text-ink">
          <span>Order total</span><span>{formatPrice(order.total)}</span>
        </p>
      </div>
    </section>
  );
}
