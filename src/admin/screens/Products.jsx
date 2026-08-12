/* =================================================================== *
 * skin.theory admin — product list with search, filters and bulk actions.
 * -------------------------------------------------------------------
 * A multi-variant product shows one row per size ("Rice Toner — 30ml",
 * "Rice Toner — 150ml") instead of one row that can't represent more than
 * one price — same idea as the Inventory screen, applied here so price can
 * be quick-edited without opening the full editor. A single-variant product
 * (the common case) still shows exactly one row, pixel-identical to before.
 *
 * The inline price edit writes through updateVariantPrice(), a plain
 * UPDATE on the exact product_variants row the Variants tab itself edits —
 * same table, same triggers (mirror_variant_to_product keeps products.
 * price_minor in step when it's the default size). No parallel price path.
 *
 * Bulk select/actions still target PRODUCTS, not sizes: only the first row
 * of a multi-variant product carries a checkbox (rowSelectable below); its
 * later size-rows are display + quick-edit only.
 * =================================================================== */
import { useState } from "react";
import { Check, Plus } from "lucide-react";
import {
  bulkPrice, categoryOptions, listCategoryTree, listProductsWithVariants,
  setProductStatus, updateVariantPrice,
} from "../../lib/api/admin/catalog.js";
import { useAdmin } from "../context.js";
import { adminNavigate } from "../AdminApp.jsx";
import {
  Btn, DataTable, Modal, PageHeader, Pill, SearchInput, SelectField, StockPill,
  TextField, minorToMajor, majorToMinor, money, useAsync,
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
  // variantId -> typed value (string, major currency units) while editing
  // inline; cleared on commit/cancel. Separate from the full editor's own
  // price field entirely — this only ever touches one variant row.
  const [priceEdits, setPriceEdits] = useState({});
  const [savingPrice, setSavingPrice] = useState({});
  const [priceError, setPriceError] = useState({});

  const categories = useAsync(() => listCategoryTree(), []);
  const list = useAsync(
    () => listProductsWithVariants({ search, status, categoryId, stockFilter, page }),
    [search, status, categoryId, stockFilter, page]
  );

  async function commitPrice(row) {
    const raw = priceEdits[row.variantId];
    const nextMinor = majorToMinor(raw);
    if (nextMinor == null || nextMinor === row.price_minor) {
      setPriceEdits((e) => ({ ...e, [row.variantId]: undefined }));
      return;
    }
    setSavingPrice((s) => ({ ...s, [row.variantId]: true }));
    setPriceError((e) => ({ ...e, [row.variantId]: undefined }));
    const { error } = await updateVariantPrice(row.variantId, nextMinor);
    setSavingPrice((s) => ({ ...s, [row.variantId]: false }));
    if (error) {
      setPriceError((e) => ({ ...e, [row.variantId]: error.message }));
      return;
    }
    setPriceEdits((e) => ({ ...e, [row.variantId]: undefined }));
    list.reload();
  }

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
          placeholder="Active & Draft"
          options={[
            { id: "active", label: "Active" },
            { id: "draft", label: "Draft" },
            { id: "archived", label: "Archived" },
            { id: "all", label: "All statuses (incl. archived)" },
          ]} />
        <SelectField value={categoryId} onChange={(e) => setFilter(setCategoryId)(e.target.value)}
          placeholder="All categories" options={categoryOptions(categories.data)} />
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
        rowKey={(r) => r.rowId}
        // A size row (kind "variant") isn't individually bulk-selectable —
        // status/archive/bulk-price all operate on the PRODUCT, and the
        // lead row already represents it. See listProductsWithVariants().
        rowSelectable={(r) => r.kind !== "variant"}
        // Every row still opens the same product; a size row lands
        // straight on the Variants tab instead of Details, since that's
        // almost certainly why an admin clicked past the quick-edit price.
        onRowClick={(r) => adminNavigate(`/admin/products/${r.id}${r.kind === "single" ? "" : "?tab=variants"}`)}
        empty={search || status || categoryId ? "No products match these filters." : "No products yet. Add your first one."}
        columns={[
          { key: "name", header: "Product", render: (r) => {
              if (r.kind === "single") {
                return (
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{r.name}</p>
                    <p className="truncate text-xs text-ink-soft">{r.brand}</p>
                  </div>
                );
              }
              // Multi-variant sizes — each its own row, grouped visually
              // with a left accent bar and de-emphasized brand line so
              // it reads as "this product, this size" rather than a
              // separate product ("Rice Toner — 30ml" / "— 150ml").
              return (
                <div className={`min-w-0 ${r.kind === "variant" ? "border-l-2 border-magenta/25 pl-3" : ""}`}>
                  <p className="truncate font-medium text-ink">
                    {r.name} <span className="font-normal text-ink-soft">— {r.sizeLabel}</span>
                  </p>
                  <p className="truncate text-xs text-ink-soft/80">
                    {r.kind === "variant-lead" ? `${r.brand} · ${r.variantCount} sizes` : r.brand}
                  </p>
                </div>
              );
            } },
          { key: "status", header: "Status", render: (r) => (
              <Pill tone={STATUS_TONE[r.status]}>{r.status}</Pill>
            ) },
          { key: "stock", header: "Stock", render: (r) => (
              <StockPill stock={r.kind === "single" ? r.stock : r.variantStock} lowAt={r.low_stock_at ?? 5} />
            ) },
          { key: "price_minor", header: "Price", align: "right", render: (r) => {
              if (r.kind === "single") {
                return (
                  <div>
                    <span className="font-medium text-ink">{money(r.price_minor)}</span>
                    {r.compare_at_minor > r.price_minor && (
                      <span className="ml-1.5 text-xs text-ink-soft line-through">{money(r.compare_at_minor)}</span>
                    )}
                  </div>
                );
              }
              // Inline quick-edit for a size's price — pre-filled with the
              // current value (click straight in and adjust), Enter or the
              // checkmark commits. Writes through updateVariantPrice(), the
              // exact same product_variants row/columns the Variants tab
              // itself edits.
              const editVal = priceEdits[r.variantId];
              const changed = editVal !== undefined && editVal !== "" && majorToMinor(editVal) !== r.price_minor;
              return (
                <div onClick={(e) => e.stopPropagation()} className="flex flex-col items-end gap-1">
                  <div className="flex items-center justify-end gap-2">
                    {r.compare_at_minor > r.price_minor && (
                      <span className="text-xs text-ink-soft line-through">{money(r.compare_at_minor)}</span>
                    )}
                    <input
                      type="number" min="0" step="1" inputMode="decimal"
                      disabled={!can("admin")}
                      className="w-24 rounded-lg bg-white px-2 py-1.5 text-right text-sm ring-1 ring-line outline-none focus:ring-2 focus:ring-magenta/50 disabled:bg-snow disabled:text-ink-soft"
                      value={editVal ?? minorToMajor(r.price_minor)}
                      onChange={(e) => setPriceEdits((s) => ({ ...s, [r.variantId]: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && commitPrice(r)}
                      aria-label={`Price for ${r.sizeLabel}`}
                    />
                    {changed && (
                      <Btn size="sm" loading={savingPrice[r.variantId]} onClick={() => commitPrice(r)} aria-label={`Save price for ${r.sizeLabel}`}>
                        <Check className="h-3.5 w-3.5" />
                      </Btn>
                    )}
                  </div>
                  {priceError[r.variantId] && (
                    <span className="max-w-[14rem] text-right text-[11px] text-red-600">{priceError[r.variantId]}</span>
                  )}
                </div>
              );
            } },
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
