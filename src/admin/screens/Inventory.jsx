/* =================================================================== *
 * skin.script admin — inventory
 * -------------------------------------------------------------------
 * A stock-only grid with inline editing, one row per SIZE — not per
 * product. A single-size product still shows exactly one row here (the
 * size label just isn't worth showing when there's only one), so nothing
 * about this screen changes for the common case; a multi-size product
 * shows one row per size, each independently editable.
 *
 * Every change goes through adjust_stock_variant(), so the ledger stays
 * complete and per-size.
 * =================================================================== */
import { useState } from "react";
import { Check } from "lucide-react";
import { listInventoryRows, setVariantStock } from "../../lib/api/admin/catalog.js";
import { adminNavigate } from "../AdminApp.jsx";
import {
  Btn, DataTable, PageHeader, SearchInput, SelectField, StockPill, money, useAsync,
} from "../components/kit.jsx";

export default function Inventory() {
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("");
  const [page, setPage] = useState(0);
  const [edits, setEdits] = useState({}); // variantId → typed value
  const [saving, setSaving] = useState({});

  const list = useAsync(
    () => listInventoryRows({ search, stockFilter, page, pageSize: 50 }),
    [search, stockFilter, page]
  );

  async function commit(row) {
    const next = Number(edits[row.id]);
    if (!Number.isFinite(next) || next < 0 || next === row.stock) {
      setEdits((e) => ({ ...e, [row.id]: undefined }));
      return;
    }
    setSaving((s) => ({ ...s, [row.id]: true }));
    await setVariantStock(row.id, row.stock, next, "counted in inventory screen");
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
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(0); }} placeholder="Find a size or SKU…" className="sm:col-span-2" />
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
              <button onClick={() => adminNavigate(`/admin/products/${r.productId}`)} className="text-left">
                <p className="font-medium text-ink hover:text-magenta">
                  {r.productName}
                  {/* The size label only earns its place on screen once a
                      product actually has more than one — for the common
                      single-size product this renders exactly as it always did. */}
                  {r.sizeLabel && r.sizeLabel !== "Standard" && (
                    <span className="ml-1.5 font-normal text-ink-soft">· {r.sizeLabel}</span>
                  )}
                </p>
                <p className="text-xs text-ink-soft">{r.brand}</p>
              </button>
            ) },
          { key: "current", header: "Current", render: (r) => <StockPill stock={r.stock} lowAt={r.lowStockAt ?? 5} /> },
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
          { key: "price_minor", header: "Price", align: "right", render: (r) => money(r.priceMinor) },
        ]}
      />
    </>
  );
}
