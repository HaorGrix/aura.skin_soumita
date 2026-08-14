/* =================================================================== *
 * skin.theory admin — flash & seasonal sales
 * -------------------------------------------------------------------
 * The important part of this screen is the scope preview: before a
 * campaign goes live it shows exactly which products it touches and what
 * each new price would be. "20% off everything" and "20% off everything,
 * including the six items I sell near cost" look identical until you can
 * see the list.
 * =================================================================== */
import { useEffect, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { deactivateSale, deleteSale, listSales, previewSaleScope, saveSale } from "../../lib/api/admin/promos.js";
import { listCategories, listBrands, listProducts as listCatalogProducts, listProductsByIds } from "../../lib/api/admin/catalog.js";
import { SingleImageField } from "../components/ImageManager.jsx";
import { useAdmin } from "../context.js";
import {
  Btn, ConfirmModal, DataTable, Modal, PageHeader, Pill, SelectField, Spinner,
  TextField, Toggle, money, toLocalInputValue, toUtcIso, useAsync,
} from "../components/kit.jsx";

// "all" (whole catalog) and "specific" (products/categories/brands) are
// mutually exclusive choices, not two independent toggles — a sale that's
// somehow both is ambiguous about what it actually discounts.
const BLANK = {
  name: "", kind: "percent", value_percent: 20,
  starts_at: "", ends_at: "",
  scope: { all: true, products: [], categories: [], brands: [] },
  banner_text: "", badge_label: "", image_path: "",
  show_countdown: true, priority: 0, is_active: true,
};

export default function Sales() {
  const { can } = useAdmin();
  const [editing, setEditing] = useState(null);
  const [ending, setEnding] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const list = useAsync(() => listSales(), []);

  const state = (s) => {
    const now = new Date();
    if (!s.is_active) return { tone: "grey", label: "Off" };
    if (new Date(s.starts_at) > now) return { tone: "sky", label: "Scheduled" };
    if (new Date(s.ends_at) < now) return { tone: "grey", label: "Finished" };
    return { tone: "green", label: "Running now" };
  };

  return (
    <>
      <PageHeader
        title="Flash sales"
        subtitle="Time-limited campaigns across a group of products."
        actions={can("editor") && (
          <Btn onClick={() => setEditing(BLANK)}><Plus className="h-4 w-4" /> New sale</Btn>
        )}
      />

      <DataTable
        loading={list.loading} error={list.error} rows={list.data}
        onRowClick={can("editor") ? setEditing : undefined}
        empty="No sales yet. Create one to run a seasonal or flash promotion."
        columns={[
          { key: "name", header: "Campaign", render: (s) => <span className="font-medium text-ink">{s.name}</span> },
          { key: "value", header: "Discount", render: (s) =>
              s.kind === "percent" ? `${s.value_percent}% off` : `${money(s.value_minor)} off` },
          { key: "window", header: "Runs", render: (s) => (
              <span className="text-ink-soft text-xs">
                {new Date(s.starts_at).toLocaleDateString()} → {new Date(s.ends_at).toLocaleDateString()}
              </span>
            ) },
          { key: "scope", header: "Applies to", render: (s) =>
              s.scope?.all ? "Whole catalog"
              : [
                  s.scope?.products?.length && `${s.scope.products.length} products`,
                  s.scope?.categories?.length && `${s.scope.categories.length} categories`,
                  s.scope?.brands?.length && `${s.scope.brands.length} brands`,
                ].filter(Boolean).join(", ") || "Nothing selected" },
          { key: "state", header: "Status", render: (s) => {
              const st = state(s);
              return <Pill tone={st.tone}>{st.label}</Pill>;
            } },
        ]}
      />

      {editing && (
        <SaleModal
          sale={editing} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); list.reload(); }}
          onEnd={() => setEnding(editing)}
          onDelete={() => setDeleting(editing)}
        />
      )}

      <ConfirmModal
        open={!!ending} onClose={() => setEnding(null)} danger
        title="End this sale?" confirmLabel="End it"
        body="Prices go back to normal and the campaign banner disappears from the storefront. The campaign itself stays on record — this doesn't delete it."
        onConfirm={async () => { await deactivateSale(ending.id); setEditing(null); list.reload(); }}
      />

      <ConfirmModal
        open={!!deleting} onClose={() => setDeleting(null)} danger
        title={`Delete "${deleting?.name}"?`} confirmLabel="Delete"
        body="This removes the campaign entirely — it can't be undone. Past orders keep whatever price they actually charged either way; this only removes the campaign record itself."
        onConfirm={async () => { await deleteSale(deleting.id); setEditing(null); list.reload(); }}
      />
    </>
  );
}

function SaleModal({ sale, onClose, onSaved, onEnd, onDelete }) {
  const [form, setForm] = useState(sale);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);

  const categories = useAsync(() => listCategories(), []);
  const brands = useAsync(() => listBrands(), []);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const setScope = (k) => (v) => setForm((f) => ({ ...f, scope: { ...f.scope, [k]: v } }));

  const toggleIn = (list, id) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  async function runPreview() {
    setPreviewing(true);
    const { data } = await previewSaleScope(form.scope, form.value_percent);
    setPreview(data ?? []);
    setPreviewing(false);
  }

  async function handleSave() {
    if (!form.name?.trim()) return setError("Give the campaign a name.");
    if (!form.starts_at || !form.ends_at) return setError("Set both a start and an end time.");
    if (new Date(form.ends_at) <= new Date(form.starts_at)) return setError("The end must be after the start.");

    setBusy(true); setError(null);
    const { error } = await saveSale(form);
    setBusy(false);
    if (error) setError(error.message);
    else onSaved();
  }

  return (
    <Modal open onClose={onClose} wide title={sale.id ? sale.name : "New flash sale"}
      footer={
        <>
          {sale.id && (
            <div className="mr-auto flex gap-2">
              <Btn variant="ghost" size="sm" className="text-red-600" onClick={onEnd}>End sale</Btn>
              <Btn variant="ghost" size="sm" className="text-red-600" onClick={onDelete}>Delete</Btn>
            </div>
          )}
          <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn size="sm" loading={busy} onClick={handleSave}>Save</Btn>
        </>
      }>
      {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Campaign name" hint="Internal — shoppers don't see this" required
          value={form.name} onChange={(e) => set("name")(e.target.value)} className="sm:col-span-2" />
        <TextField label="Percentage off" type="number" min="1" max="90"
          value={form.value_percent ?? ""} onChange={(e) => set("value_percent")(Number(e.target.value))} />
        <TextField label="Priority" hint="Higher wins when sales overlap" type="number"
          value={form.priority ?? 0} onChange={(e) => set("priority")(Number(e.target.value))} />
        <TextField label="Starts" type="datetime-local" required hint="Your local time"
          value={toLocalInputValue(form.starts_at)} onChange={(e) => set("starts_at")(toUtcIso(e.target.value))} />
        <TextField label="Ends" type="datetime-local" required hint="Your local time"
          value={toLocalInputValue(form.ends_at)} onChange={(e) => set("ends_at")(toUtcIso(e.target.value))} />
        <TextField label="Banner text" hint="Shown on the storefront while the sale runs"
          value={form.banner_text ?? ""} onChange={(e) => set("banner_text")(e.target.value)} className="sm:col-span-2" />
        <TextField label="Badge label" hint='Shown on the card, e.g. "SUMMER SALE", "CLEARANCE"'
          value={form.badge_label ?? ""} onChange={(e) => set("badge_label")(e.target.value)} className="sm:col-span-2" />
        <div className="sm:col-span-2">
          <SingleImageField
            label="Card banner image" value={form.image_path ?? ""} onChange={set("image_path")}
            hint="Recommended 800 × 600px (4:3) — shown on the homepage deal card"
          />
        </div>
        <div className="sm:col-span-2">
          <Toggle label="Show a countdown timer" checked={form.show_countdown} onChange={set("show_countdown")} />
        </div>
      </div>

      <div className="mt-6 rounded-xl bg-snow p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-soft">What's included</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setScope("all")(true)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 ${
              form.scope?.all ? "bg-magenta text-white ring-magenta" : "bg-white text-ink-soft ring-line hover:ring-magenta"
            }`}>
            The whole catalog
          </button>
          <button type="button" onClick={() => setScope("all")(false)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 ${
              !form.scope?.all ? "bg-magenta text-white ring-magenta" : "bg-white text-ink-soft ring-line hover:ring-magenta"
            }`}>
            Specific products
          </button>
        </div>

        {!form.scope?.all && (
          <div className="mt-4 space-y-4">
            <ProductPicker
              selected={form.scope.products ?? []}
              onChange={setScope("products")}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-xs font-medium text-ink">Categories</p>
                <div className="flex flex-wrap gap-1.5">
                  {(categories.data ?? []).map((c) => (
                    <button key={c.id} onClick={() => setScope("categories")(toggleIn(form.scope.categories ?? [], c.id))}
                      className={`rounded-full px-2.5 py-1 text-xs ring-1 ${
                        form.scope.categories?.includes(c.id)
                          ? "bg-magenta text-white ring-magenta" : "bg-white text-ink-soft ring-line hover:ring-magenta"
                      }`}>{c.name}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-ink">Brands</p>
                <div className="flex flex-wrap gap-1.5">
                  {(brands.data ?? []).map((b) => (
                    <button key={b} onClick={() => setScope("brands")(toggleIn(form.scope.brands ?? [], b))}
                      className={`rounded-full px-2.5 py-1 text-xs ring-1 ${
                        form.scope.brands?.includes(b)
                          ? "bg-magenta text-white ring-magenta" : "bg-white text-ink-soft ring-line hover:ring-magenta"
                      }`}>{b}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <Btn size="sm" variant="secondary" className="mt-4" loading={previewing} onClick={runPreview}>
          Preview affected products
        </Btn>

        {preview && (
          <div className="mt-3 max-h-56 overflow-y-auto rounded-lg bg-white ring-1 ring-line">
            <p className="border-b border-line px-3 py-2 text-xs font-medium text-ink">
              {preview.length} product{preview.length === 1 ? "" : "s"} would change price
            </p>
            {preview.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-ink-soft">
                Nothing selected yet — pick at least one category or brand.
              </p>
            ) : (
              <ul className="divide-y divide-line text-xs">
                {preview.slice(0, 60).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-1.5">
                    <span className="min-w-0 truncate text-ink">{p.name}</span>
                    <span className="shrink-0 text-ink-soft">
                      <span className="line-through">{money(p.price_minor)}</span>{" "}
                      <span className="font-medium text-magenta">{money(p.new_price_minor)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {previewing && <Spinner className="mt-3 h-4 w-4" />}
      </div>
    </Modal>
  );
}

/** Search-as-you-type multi-select over the real catalog (paginated —
 *  there's no "list all products" call here on purpose, matching the
 *  admin Products grid's own server-side search). `selected` holds
 *  product ids only; names for ids picked in an earlier session are
 *  fetched once on mount so already-chosen products still show a label
 *  instead of a bare id. */
function ProductPicker({ selected, onChange }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [labels, setLabels] = useState({}); // id -> "Brand — Name"

  useEffect(() => {
    let alive = true;
    listProductsByIds(selected).then(({ data }) => {
      if (!alive || !data) return;
      setLabels((prev) => {
        const next = { ...prev };
        for (const p of data) next[p.id] = `${p.brand} — ${p.name}`;
        return next;
      });
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-resolve for ids we don't have a label for yet
  }, [selected.filter((id) => !labels[id]).join(",")]);

  // Browse the catalog by default (query "") so opening the picker shows
  // real products to pick from immediately, not a blank box waiting for a
  // search term — the admin asked to "see and select from my actual
  // product catalog," not hunt for the right keyword first.
  useEffect(() => {
    let alive = true;
    setSearching(true);
    const t = setTimeout(() => {
      listCatalogProducts({ search: query, pageSize: query.trim() ? 15 : 30 }).then(({ data, error }) => {
        if (!alive) return;
        if (error) setLoadError(error.message);
        else { setLoadError(null); setResults(data ?? []); }
        setSearching(false);
      });
    }, query.trim() ? 250 : 0);
    return () => { alive = false; clearTimeout(t); };
  }, [query]);

  function add(p) {
    if (selected.includes(p.id)) return;
    setLabels((prev) => ({ ...prev, [p.id]: `${p.brand} — ${p.name}` }));
    onChange([...selected, p.id]);
  }
  function remove(id) {
    onChange(selected.filter((x) => x !== id));
  }

  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-ink">Products</p>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-soft" />
        <input
          value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Browse below, or search by name, brand, or SKU…"
          className="w-full rounded-xl border border-line bg-white py-2 pl-8 pr-3 text-xs outline-none focus:border-magenta"
        />
      </div>

      <div className="mt-1.5 max-h-52 overflow-y-auto rounded-lg bg-white ring-1 ring-line">
        {!query.trim() && !searching && (
          <p className="border-b border-line px-3 py-1.5 text-[11px] text-ink-soft">
            {results.length > 0 ? "Your catalog — search to narrow" : ""}
          </p>
        )}
        {searching && <p className="px-3 py-2 text-xs text-ink-soft">Loading…</p>}
        {loadError && <p className="px-3 py-2 text-xs text-red-600">Couldn't load products: {loadError}</p>}
        {!searching && !loadError && results.length === 0 && (
          <p className="px-3 py-2 text-xs text-ink-soft">
            {query.trim() ? "No products match that search." : "No products in the catalog yet."}
          </p>
        )}
        {!searching && results.map((p) => (
          <button key={p.id} type="button" onClick={() => add(p)}
            disabled={selected.includes(p.id)}
            className="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-snow disabled:opacity-40">
            <span className="truncate">{p.brand} — {p.name}</span>
            {selected.includes(p.id) && <span className="shrink-0 text-ink-soft">Added</span>}
          </button>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {selected.length === 0 && (
          <p className="text-xs text-ink-soft">No products selected yet — pick some from the list above.</p>
        )}
        {selected.map((id) => (
          <span key={id} className="inline-flex items-center gap-1 rounded-full bg-magenta/10 px-2.5 py-1 text-xs text-magenta-deep ring-1 ring-magenta/20">
            {labels[id] ?? id}
            <button type="button" onClick={() => remove(id)} className="hover:text-red-600"><X className="h-3 w-3" /></button>
          </span>
        ))}
      </div>
    </div>
  );
}
