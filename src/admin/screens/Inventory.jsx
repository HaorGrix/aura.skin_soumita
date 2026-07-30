/* =================================================================== *
 * skin.script admin — inventory
 * -------------------------------------------------------------------
 * A stock-only grid with inline editing. Separate from the product editor
 * because restocking is a different job done at a different time: the
 * client walks the shelf with a phone and types numbers, and shouldn't
 * have to open 20 product pages to do it.
 *
 * Every change goes through adjust_stock(), so the ledger stays complete.
 * =================================================================== */
import { useState } from "react";
import { Check } from "lucide-react";
import { listProducts, setStock } from "../../lib/api/admin/catalog.js";
import { adminNavigate } from "../AdminApp.jsx";
import {
  Btn, DataTable, PageHeader, SearchInput, SelectField, StockPill, money, useAsync,
} from "../components/kit.jsx";

export default function Inventory() {
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("");
  const [page, setPage] = useState(0);
  const [edits, setEdits] = useState({}); // productId → typed value
  const [saving, setSaving] = useState({});

  const list = useAsync(
    () => listProducts({ search, stockFilter, status: "active", sort: "stock", ascending: true, page, pageSize: 50 }),
    [search, stockFilter, page]
  );

  async function commit(row) {
    const next = Number(edits[row.id]);
    if (!Number.isFinite(next) || next < 0 || next === row.stock) {
      setEdits((e) => ({ ...e, [row.id]: undefined }));
      return;
    }
    setSaving((s) => ({ ...s, [row.id]: true }));
    await setStock(row.id, row.stock, next, "counted in inventory screen");
    setSaving((s) => ({ ...s, [row.id]: false }));
    setEdits((e) => ({ ...e, [row.id]: undefined }));
    list.reload();
  }

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle="Type a new number and press Enter to update stock. Every change is recorded with a reason."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(0); }} placeholder="Find a product…" className="sm:col-span-2" />
        <SelectField value={stockFilter} onChange={(e) => { setStockFilter(e.target.value); setPage(0); }}
          placeholder="All products"
          options={[{ id: "low", label: "Running low" }, { id: "out", label: "Out of stock" }]} />
      </div>

      <DataTable
        loading={list.loading} error={list.error} rows={list.data} total={list.count}
        page={page} pageSize={50} onPage={setPage}
        empty="No products match."
        columns={[
          { key: "name", header: "Product", render: (r) => (
              <button onClick={() => adminNavigate(`/admin/products/${r.id}`)} className="text-left">
                <p className="font-medium text-ink hover:text-magenta">{r.name}</p>
                <p className="text-xs text-ink-soft">{r.brand}</p>
              </button>
            ) },
          { key: "current", header: "Current", render: (r) => <StockPill stock={r.stock} lowAt={r.low_stock_at ?? 5} /> },
          { key: "edit", header: "Set to", align: "right", render: (r) => {
              const value = edits[r.id];
              const changed = value !== undefined && value !== "" && Number(value) !== r.stock;
              return (
                <div className="flex items-center justify-end gap-2">
                  <input
                    type="number" min="0"
                    className="w-20 rounded-lg bg-white px-2 py-1.5 text-right text-sm ring-1 ring-line outline-none focus:ring-2 focus:ring-magenta/50"
                    value={value ?? ""} placeholder={String(r.stock)}
                    onChange={(e) => setEdits((s) => ({ ...s, [r.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && commit(r)}
                  />
                  {changed && (
                    <Btn size="sm" loading={saving[r.id]} onClick={() => commit(r)} aria-label="Save stock">
                      <Check className="h-3.5 w-3.5" />
                    </Btn>
                  )}
                </div>
              );
            } },
          { key: "price_minor", header: "Price", align: "right", render: (r) => money(r.price_minor) },
        ]}
      />
    </>
  );
}
