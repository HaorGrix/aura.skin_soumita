/* skin.theory admin — Dashboard. The first screen the client sees each day:
 * what came in, what needs doing, what's about to run out. */
import { AlertTriangle, PackageX, ShoppingBag } from "lucide-react";
import { getStats, recentOrders, statusMeta } from "../../lib/api/admin/orders.js";
import { listLowStock } from "../../lib/api/admin/catalog.js";
import { Card, DataTable, PageHeader, Pill, StatCard, money, useAsync } from "../components/kit.jsx";
import { adminNavigate } from "../AdminApp.jsx";

export default function Dashboard() {
  const stats = useAsync(() => getStats(), []);
  const orders = useAsync(() => recentOrders(8), []);
  const lowStock = useAsync(() => listLowStock(8), []);

  const s = stats.data ?? {};

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Today at a glance. Everything here is live from the store database."
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Revenue today" value={money(s.revenue_today)} sub={`${s.orders_today ?? 0} orders`} />
        <StatCard label="Revenue (30 days)" value={money(s.revenue_30d)} />
        <StatCard label="Needs action" value={s.pending_orders ?? 0} sub="Pending or processing" />
        <StatCard label="Active products" value={s.total_products ?? 0} sub={`${s.customers ?? 0} customers`} />
      </div>

      {/* Only surface the stock warnings that actually apply — an always-on
          row of zeroes trains the client to ignore this area. */}
      {(s.low_stock > 0 || s.out_of_stock > 0) && (
        <div className="mb-6 flex flex-wrap gap-3">
          {s.out_of_stock > 0 && (
            <button onClick={() => adminNavigate("/admin/inventory")} className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700 ring-1 ring-red-200 hover:bg-red-100">
              <PackageX className="h-4 w-4" /> {s.out_of_stock} product{s.out_of_stock === 1 ? "" : "s"} out of stock
            </button>
          )}
          {s.low_stock > 0 && (
            <button onClick={() => adminNavigate("/admin/inventory")} className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100">
              <AlertTriangle className="h-4 w-4" /> {s.low_stock} running low
            </button>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Recent orders" description="Click any row to open it." className="lg:col-span-2">
          <DataTable
            loading={orders.loading} error={orders.error} rows={orders.data}
            empty="No orders yet. They'll appear here the moment one is placed."
            onRowClick={(r) => adminNavigate(`/admin/orders/${r.id}`)}
            columns={[
              { key: "number", header: "Order", render: (r) => <span className="font-medium text-ink">{r.number}</span> },
              { key: "email", header: "Customer", render: (r) => <span className="text-ink-soft">{r.email}</span> },
              { key: "status", header: "Status", render: (r) => {
                  const m = statusMeta(r.status);
                  return <Pill tone={m.tone}>{m.label}</Pill>;
                } },
              { key: "placed_at", header: "Placed", render: (r) => new Date(r.placed_at).toLocaleDateString() },
              { key: "total_minor", header: "Total", align: "right", render: (r) => money(r.total_minor) },
            ]}
          />
        </Card>

        <Card title="Running low" description="Restock these before they sell out." className="lg:col-span-2">
          <DataTable
            loading={lowStock.loading} error={lowStock.error} rows={lowStock.data}
            empty="Nothing is running low. Stock levels are healthy."
            onRowClick={(r) => adminNavigate(`/admin/products/${r.id}`)}
            columns={[
              { key: "name", header: "Product", render: (r) => (
                  <div><p className="font-medium text-ink">{r.name}</p><p className="text-xs text-ink-soft">{r.brand}</p></div>
                ) },
              { key: "stock", header: "Units left", align: "right", render: (r) => (
                  <Pill tone={r.stock === 0 ? "red" : "amber"}>{r.stock}</Pill>
                ) },
              { key: "price_minor", header: "Price", align: "right", render: (r) => money(r.price_minor) },
            ]}
          />
        </Card>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <button onClick={() => adminNavigate("/admin/products/new")} className="flex items-center gap-2 rounded-xl bg-magenta px-4 py-2.5 text-sm text-white hover:bg-magenta-deep">
          <ShoppingBag className="h-4 w-4" /> Add a product
        </button>
      </div>
    </>
  );
}
