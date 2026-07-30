/* skin.script admin — order queue. */
import { useState } from "react";
import { listOrders, ORDER_STATUSES, statusMeta } from "../../lib/api/admin/orders.js";
import { adminNavigate } from "../AdminApp.jsx";
import { DataTable, PageHeader, Pill, SearchInput, TextField, money, useAsync } from "../components/kit.jsx";

export default function Orders() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);

  const list = useAsync(() => listOrders({ search, status, from, to, page }), [search, status, from, to, page]);
  const change = (fn) => (v) => { fn(v); setPage(0); };

  return (
    <>
      <PageHeader title="Orders" subtitle="Every order placed on the store. Click one to see its details and update it." />

      {/* Status tabs double as the primary filter — a fulfilment desk works
          by queue ("what's pending"), not by search. */}
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
        {[{ id: "", label: "All" }, ...ORDER_STATUSES].map((s) => (
          <button key={s.id || "all"} onClick={() => change(setStatus)(s.id)}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm transition-colors ${
              status === s.id ? "border-magenta font-medium text-magenta" : "border-transparent text-ink-soft hover:text-ink"
            }`}>
            {s.label}
          </button>
        ))}
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SearchInput value={search} onChange={change(setSearch)} placeholder="Order number, email, tracking…" className="lg:col-span-2" />
        <TextField label="From" type="date" value={from} onChange={(e) => change(setFrom)(e.target.value)} />
        <TextField label="To" type="date" value={to} onChange={(e) => change(setTo)(e.target.value)} />
      </div>

      <DataTable
        loading={list.loading} error={list.error} rows={list.data} total={list.count}
        page={page} onPage={setPage}
        onRowClick={(r) => adminNavigate(`/admin/orders/${r.id}`)}
        empty={status ? `No ${statusMeta(status).label.toLowerCase()} orders.` : "No orders yet."}
        columns={[
          { key: "number", header: "Order", render: (r) => <span className="font-medium text-ink">{r.number}</span> },
          { key: "email", header: "Customer", render: (r) => <span className="text-ink-soft">{r.email}</span> },
          { key: "status", header: "Status", render: (r) => {
              const m = statusMeta(r.status);
              return <Pill tone={m.tone}>{m.label}</Pill>;
            } },
          { key: "payment_method", header: "Payment", render: (r) => (
              <span className="text-xs uppercase text-ink-soft">{r.payment_method}</span>
            ) },
          { key: "placed_at", header: "Placed", render: (r) => new Date(r.placed_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) },
          { key: "total_minor", header: "Total", align: "right", render: (r) => (
              <span className="font-medium">{money(r.total_minor)}</span>
            ) },
        ]}
      />
    </>
  );
}
