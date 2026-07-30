/* skin.script admin — product list with search, filters and bulk actions. */
import { useState } from "react";
import { Plus } from "lucide-react";
import {
  bulkPrice, listCategories, listProducts, setProductStatus,
} from "../../lib/api/admin/catalog.js";
import { useAdmin } from "../context.js";
import { adminNavigate } from "../AdminApp.jsx";
import {
  Btn, DataTable, Modal, PageHeader, Pill, SearchInput, SelectField, StockPill,
  TextField, money, useAsync,
} from "../components/kit.jsx";

const STATUS_TONE = { active: "green", draft: "amber", archived: "grey" };

export default function Products() {
  const { can } = useAdmin();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [stockFilter, setStockFilter] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState([]);
  const [priceModal, setPriceModal] = useState(false);

  const categories = useAsync(() => listCategories(), []);
  const list = useAsync(
    () => listProducts({ search, status, categoryId, stockFilter, page }),
    [search, status, categoryId, stockFilter, page]
  );

  // A filter change with a stale page number shows an empty table and reads
  // as "no results". Reset to the first page whenever the query changes.
  const setFilter = (fn) => (v) => { fn(v); setPage(0); setSelected([]); };

  async function applyStatus(next) {
    await setProductStatus(selected, next);
    setSelected([]);
    list.reload();
  }

  return (
    <>
      <PageHeader
        title="Products"
        subtitle="Everything in your catalog. Click a product to edit it."
        actions={can("admin") && (
          <Btn onClick={() => adminNavigate("/admin/products/new")}>
            <Plus className="h-4 w-4" /> Add product
          </Btn>
        )}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SearchInput value={search} onChange={setFilter(setSearch)} placeholder="Name, brand or SKU…" />
        <SelectField value={status} onChange={(e) => setFilter(setStatus)(e.target.value)}
          placeholder="All statuses"
          options={[{ id: "active", label: "Active" }, { id: "draft", label: "Draft" }, { id: "archived", label: "Archived" }]} />
        <SelectField value={categoryId} onChange={(e) => setFilter(setCategoryId)(e.target.value)}
          placeholder="All categories" options={categories.data ?? []} />
        <SelectField value={stockFilter} onChange={(e) => setFilter(setStockFilter)(e.target.value)}
          placeholder="Any stock level"
          options={[{ id: "low", label: "Running low" }, { id: "out", label: "Out of stock" }]} />
      </div>

      {selected.length > 0 && can("admin") && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm text-white">
          <span className="mr-auto">{selected.length} selected</span>
          <Btn size="sm" variant="secondary" onClick={() => applyStatus("active")}>Publish</Btn>
          <Btn size="sm" variant="secondary" onClick={() => applyStatus("draft")}>Unpublish</Btn>
          <Btn size="sm" variant="secondary" onClick={() => setPriceModal(true)}>Change price</Btn>
          <Btn size="sm" variant="danger" onClick={() => applyStatus("archived")}>Archive</Btn>
        </div>
      )}

      <DataTable
        loading={list.loading} error={list.error} rows={list.data} total={list.count}
        page={page} onPage={setPage}
        selectable={can("admin")} selected={selected} onSelect={setSelected}
        onRowClick={(r) => adminNavigate(`/admin/products/${r.id}`)}
        empty={search || status || categoryId ? "No products match these filters." : "No products yet. Add your first one."}
        columns={[
          { key: "name", header: "Product", render: (r) => (
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{r.name}</p>
                <p className="truncate text-xs text-ink-soft">{r.brand}</p>
              </div>
            ) },
          { key: "status", header: "Status", render: (r) => (
              <Pill tone={STATUS_TONE[r.status]}>{r.status}</Pill>
            ) },
          { key: "stock", header: "Stock", render: (r) => <StockPill stock={r.stock} lowAt={r.low_stock_at ?? 5} /> },
          { key: "price_minor", header: "Price", align: "right", render: (r) => (
              <div>
                <span className="font-medium text-ink">{money(r.price_minor)}</span>
                {r.compare_at_minor > r.price_minor && (
                  <span className="ml-1.5 text-xs text-ink-soft line-through">{money(r.compare_at_minor)}</span>
                )}
              </div>
            ) },
          { key: "sales_count", header: "Sold", align: "right", cellClassName: "text-ink-soft" },
        ]}
      />

      <BulkPriceModal
        open={priceModal} onClose={() => setPriceModal(false)} count={selected.length}
        onApply={async (mode, amount) => {
          await bulkPrice(selected, mode, amount);
          setSelected([]); setPriceModal(false); list.reload();
        }}
      />
    </>
  );
}

function BulkPriceModal({ open, onClose, count, onApply }) {
  const [mode, setMode] = useState("percent");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const help = {
    percent: "Use a negative number to discount, e.g. -20 for 20% off.",
    fixed: "Adds or subtracts a flat amount, e.g. -100 to take ৳100 off each.",
    set: "Sets every selected product to exactly this price.",
  }[mode];

  return (
    <Modal open={open} onClose={onClose} title={`Change price on ${count} product${count === 1 ? "" : "s"}`}
      footer={
        <>
          <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn size="sm" loading={busy} disabled={amount === ""}
            onClick={async () => { setBusy(true); await onApply(mode, Number(amount)); setBusy(false); }}>
            Apply
          </Btn>
        </>
      }>
      <div className="space-y-4">
        <SelectField label="How" value={mode} onChange={(e) => setMode(e.target.value)}
          options={[
            { id: "percent", label: "Change by a percentage" },
            { id: "fixed", label: "Change by a fixed amount" },
            { id: "set", label: "Set to a specific price" },
          ]} />
        <TextField label="Amount" type="number" value={amount} hint={help}
          onChange={(e) => setAmount(e.target.value)} />
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          This writes new prices immediately. Past orders keep the price they were placed at.
        </p>
      </div>
    </Modal>
  );
}
