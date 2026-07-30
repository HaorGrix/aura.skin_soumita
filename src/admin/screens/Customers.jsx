/* skin.script admin — customers, with their order history in a side panel. */
import { useState } from "react";
import { getCustomerOrders, listCustomers, statusMeta } from "../../lib/api/admin/orders.js";
import { adminNavigate } from "../AdminApp.jsx";
import {
  DataTable, Modal, PageHeader, Pill, SearchInput, Spinner, money, useAsync,
} from "../components/kit.jsx";

export default function Customers() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [active, setActive] = useState(null);

  const list = useAsync(() => listCustomers({ search, page }), [search, page]);

  return (
    <>
      <PageHeader title="Customers" subtitle="Everyone who has ordered or created an account." />

      <div className="mb-4 max-w-md">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(0); }} placeholder="Name, email or phone…" />
      </div>

      <DataTable
        loading={list.loading} error={list.error} rows={list.data} total={list.count}
        page={page} onPage={setPage} onRowClick={setActive}
        empty="No customers yet."
        columns={[
          { key: "full_name", header: "Name", render: (r) => (
              <span className="font-medium text-ink">{r.full_name || "—"}</span>
            ) },
          { key: "email", header: "Email", cellClassName: "text-ink-soft" },
          { key: "phone", header: "Phone", render: (r) => <span className="text-ink-soft">{r.phone || "—"}</span> },
          { key: "points", header: "Points", align: "right", render: (r) => <Pill tone="magenta">{r.points}</Pill> },
          { key: "created_at", header: "Joined", align: "right", render: (r) => new Date(r.created_at).toLocaleDateString() },
        ]}
      />

      <CustomerPanel customer={active} onClose={() => setActive(null)} />
    </>
  );
}

function CustomerPanel({ customer, onClose }) {
  // Keyed on the id so opening a second customer refetches rather than
  // showing the previous one's orders while loading.
  const orders = useAsync(
    () => (customer ? getCustomerOrders(customer.id) : Promise.resolve({ data: [] })),
    [customer?.id]
  );

  if (!customer) return null;
  const lifetime = (orders.data ?? []).reduce((sum, o) => sum + (o.status === "cancelled" ? 0 : o.total_minor), 0);

  return (
    <Modal open onClose={onClose} title={customer.full_name || customer.email} wide>
      <div className="mb-5 grid grid-cols-3 gap-4">
        <Stat label="Orders" value={orders.data?.length ?? "—"} />
        <Stat label="Lifetime value" value={money(lifetime)} />
        <Stat label="Loyalty points" value={customer.points} />
      </div>

      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">Order history</p>
      {orders.loading ? (
        <Spinner />
      ) : !orders.data?.length ? (
        <p className="py-6 text-center text-sm text-ink-soft">No orders yet.</p>
      ) : (
        <ul className="divide-y divide-line">
          {orders.data.map((o) => {
            const m = statusMeta(o.status);
            return (
              <li key={o.id}>
                <button onClick={() => { onClose(); adminNavigate(`/admin/orders/${o.id}`); }}
                  className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-snow">
                  <div>
                    <p className="text-sm font-medium text-ink">{o.number}</p>
                    <p className="text-xs text-ink-soft">{new Date(o.placed_at).toLocaleDateString()}</p>
                  </div>
                  <Pill tone={m.tone}>{m.label}</Pill>
                  <span className="text-sm font-medium">{money(o.total_minor)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-5 space-y-1 border-t border-line pt-4 text-sm">
        <p className="text-ink-soft">Email: <span className="text-ink">{customer.email}</span></p>
        {customer.phone && <p className="text-ink-soft">Phone: <span className="text-ink">{customer.phone}</span></p>}
      </div>
    </Modal>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl bg-snow p-3">
      <p className="text-[11px] text-ink-soft">{label}</p>
      <p className="font-serif text-xl text-ink">{value}</p>
    </div>
  );
}
