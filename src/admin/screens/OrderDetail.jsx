/* =================================================================== *
 * skin.script admin — order detail
 * -------------------------------------------------------------------
 * Status changes call set_order_status(), which writes the timeline event
 * and — on cancel or refund — puts every line item's units back into stock
 * via the inventory ledger. That's why the UI never touches products.stock
 * here: one RPC, one transaction, no half-applied restock.
 * =================================================================== */
import { useEffect, useState } from "react";
import { ArrowLeft, Printer, Truck } from "lucide-react";
import {
  getOrder, nextStatuses, setInternalNote, setStatus, setTracking, statusMeta,
} from "../../lib/api/admin/orders.js";
import { publicImageUrl } from "../../lib/api/media.js";
import { useAdmin } from "../context.js";
import { adminNavigate } from "../AdminApp.jsx";
import {
  Btn, Card, ConfirmModal, PageHeader, Pill, SelectField, Spinner, TextField, money,
} from "../components/kit.jsx";

export default function OrderDetail({ id }) {
  const { can } = useAdmin();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(null); // status awaiting confirmation
  const [courier, setCourier] = useState("");
  const [tracking, setTrackingNo] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error } = await getOrder(id);
    if (error) return setError(error.message);
    if (!data) return setError("Order not found.");
    setOrder(data);
    setCourier(data.courier ?? "");
    setTrackingNo(data.tracking_number ?? "");
    setNote(data.notes ?? "");
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  // Only a LOAD failure is fatal. An action failure (a rejected status
  // change) must not tear down the page the admin is working on — that
  // used to throw away the whole order view and force a re-navigation.
  if (error && !order) {
    return (
      <div className="rounded-2xl bg-white p-10 text-center ring-1 ring-line">
        <p className="text-sm text-red-600">{error}</p>
        <Btn variant="secondary" className="mt-4" onClick={() => adminNavigate("/admin/orders")}>Back to orders</Btn>
      </div>
    );
  }
  if (!order) return <div className="grid place-items-center py-24"><Spinner className="h-7 w-7" /></div>;

  const meta = statusMeta(order.status);
  const moves = nextStatuses(order.status);
  const restocks = pending === "cancelled" || pending === "refunded";

  return (
    <>
      <PageHeader
        back={
          <button onClick={() => adminNavigate("/admin/orders")} className="mb-2 flex items-center gap-1 text-xs text-ink-soft hover:text-magenta">
            <ArrowLeft className="h-3.5 w-3.5" /> Orders
          </button>
        }
        title={order.number}
        subtitle={`Placed ${new Date(order.placed_at).toLocaleString()} · ${order.email}`}
        actions={
          <Btn variant="secondary" size="sm" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" /> Print invoice
          </Btn>
        }
      />

      {error && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-xl bg-red-50 px-4 py-2.5">
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={() => setError(null)} className="shrink-0 text-xs text-red-700 underline">Dismiss</button>
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl bg-white px-5 py-3 ring-1 ring-line">
        <Pill tone={meta.tone}>{meta.label}</Pill>
        {can("support") && moves.length > 0 && (
          <>
            <span className="text-xs text-ink-soft">Move to</span>
            {moves.map((s) => (
              <Btn key={s} size="sm" variant="secondary" onClick={() => setPending(s)}>
                {statusMeta(s).label}
              </Btn>
            ))}
          </>
        )}
        {moves.length === 0 && <span className="text-xs text-ink-soft">This order is complete — no further changes.</span>}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title={`Items (${order.order_items?.length ?? 0})`}>
            <ul className="divide-y divide-line">
              {order.order_items?.map((item) => (
                <li key={item.id} className="flex gap-3 py-3">
                  {item.image_path ? (
                    <img src={publicImageUrl(item.image_path)} alt="" className="h-16 w-14 rounded-lg object-cover ring-1 ring-line" />
                  ) : (
                    <div className="h-16 w-14 rounded-lg bg-snow ring-1 ring-line" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{item.product_name}</p>
                    <p className="text-xs text-ink-soft">{item.brand_name}</p>
                    <p className="mt-0.5 text-xs text-ink-soft">{money(item.unit_price_minor)} × {item.quantity}</p>
                  </div>
                  <span className="text-sm font-medium">{money(item.line_total_minor)}</span>
                </li>
              ))}
            </ul>

            {/* Frozen totals — these are what the customer was charged, not a
                recalculation from today's prices. */}
            <dl className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm">
              <Row label="Subtotal" value={money(order.subtotal_minor)} />
              {order.discount_minor > 0 && (
                <Row label={`Discount${order.coupon_code ? ` (${order.coupon_code})` : ""}`}
                  value={`− ${money(order.discount_minor)}`} tone="text-emerald-600" />
              )}
              <Row label="Shipping" value={order.shipping_minor ? money(order.shipping_minor) : "Free"} />
              {order.tax_minor > 0 && <Row label="Tax" value={money(order.tax_minor)} />}
              <div className="flex justify-between border-t border-line pt-2 text-base font-medium">
                <dt>Total</dt><dd>{money(order.total_minor)}</dd>
              </div>
            </dl>
          </Card>

          <Card title="Status history">
            {!order.order_events?.length ? (
              <p className="py-4 text-center text-sm text-ink-soft">No changes recorded yet.</p>
            ) : (
              <ol className="relative space-y-4 border-l border-line pl-5">
                {order.order_events.map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute -left-[1.6rem] top-1.5 h-2 w-2 rounded-full bg-magenta" />
                    <p className="text-sm text-ink">
                      {e.from_status ? `${statusMeta(e.from_status).label} → ` : ""}
                      <strong>{statusMeta(e.to_status).label}</strong>
                    </p>
                    {e.note && <p className="text-xs text-ink-soft">{e.note}</p>}
                    <p className="text-[11px] text-ink-soft">{new Date(e.created_at).toLocaleString()}</p>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Customer">
            <p className="text-sm font-medium text-ink">{order.customers?.full_name || "Guest"}</p>
            <p className="text-sm text-ink-soft">{order.email}</p>
            {order.customers?.phone && <p className="text-sm text-ink-soft">{order.customers.phone}</p>}
            {order.customers && (
              <button onClick={() => adminNavigate("/admin/customers")} className="mt-2 text-xs text-magenta hover:underline">
                View customer
              </button>
            )}
          </Card>

          <Card title="Shipping address">
            <address className="whitespace-pre-line text-sm not-italic text-ink-soft">
              {formatAddress(order.shipping_address)}
            </address>
          </Card>

          <Card title="Delivery" description="Adding a tracking number lets the customer follow their order.">
            <div className="space-y-3">
              <TextField label="Courier" value={courier} onChange={(e) => setCourier(e.target.value)}
                placeholder="Pathao, Sundarban…" disabled={!can("support")} />
              <TextField label="Tracking number" value={tracking} onChange={(e) => setTrackingNo(e.target.value)} disabled={!can("support")} />
              {can("support") && (
                <Btn size="sm" variant="secondary" loading={busy} onClick={async () => {
                  setBusy(true);
                  await setTracking(order.id, { courier: courier || null, tracking_number: tracking || null });
                  setBusy(false); load();
                }}>
                  <Truck className="h-3.5 w-3.5" /> Save delivery info
                </Btn>
              )}
            </div>
          </Card>

          <Card title="Internal notes" description="Only staff can see this.">
            <TextField as="textarea" value={note} onChange={(e) => setNote(e.target.value)} disabled={!can("support")} />
            {can("support") && (
              <Btn size="sm" variant="secondary" className="mt-2" onClick={async () => {
                await setInternalNote(order.id, note); load();
              }}>Save note</Btn>
            )}
          </Card>

          <Card title="Payment">
            <Row label="Method" value={<span className="uppercase">{order.payment_method}</span>} />
            <Row label="Status" value={order.payment_status} />
          </Card>
        </div>
      </div>

      <ConfirmModal
        open={!!pending} onClose={() => setPending(null)} danger={restocks}
        title={`Move to ${pending ? statusMeta(pending).label : ""}?`}
        confirmLabel={pending ? statusMeta(pending).label : "Confirm"}
        body={
          restocks
            ? "The customer will see this order as cancelled, and every item on it goes back into your stock automatically."
            : "The customer will see this status the next time they check their order."
        }
        onConfirm={async () => {
          const { error } = await setStatus(order.id, pending);
          if (error) setError(error.message);
          else load();
        }}
      />
    </>
  );
}

function Row({ label, value, tone = "" }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <dt className="text-ink-soft">{label}</dt>
      <dd className={tone}>{value}</dd>
    </div>
  );
}

function formatAddress(a) {
  if (!a) return "No address on file.";
  if (typeof a === "string") return a;
  return [a.name, a.line1, a.line2, a.area, a.city, a.postcode, a.country, a.phone]
    .filter(Boolean)
    .join("\n");
}
