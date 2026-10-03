/* =================================================================== *
 * skin.theory admin — Combos
 * -------------------------------------------------------------------
 * A combo is a product flagged is_combo (0071) with a list of the
 * products inside it (combo_items, 0068). Its price, photos and stock are
 * edited like any product; this screen creates combos, picks what is inside
 * each one, and turns them back into plain products. The storefront lists
 * published combos that have items at /shop?combo=1 (the home Combo tile).
 * =================================================================== */
import { useMemo, useState } from "react";
import { ArrowLeft, PackagePlus, Pencil, Search } from "lucide-react";
import { useAdmin } from "../context.js";
import { adminNavigate } from "../AdminApp.jsx";
import ComboItemsTab from "../components/ComboItemsTab.jsx";
import {
  createProduct, listCategoryTree, listCombos, listProducts, setProductCombo,
} from "../../lib/api/admin/catalog.js";
import {
  Btn, ConfirmModal, DataTable, LinesField, Modal, MoneyField, PageHeader, Pill, SelectField, Spinner, TextField, money, useAsync,
} from "../components/kit.jsx";

const STATUS_TONE = { active: "green", draft: "amber", archived: "grey" };

export default function Combos({ id }) {
  const { can } = useAdmin();
  const readOnly = !can("admin");
  const combos = useAsync(() => listCombos(), [id]);

  if (id) return <ComboDetail id={id} combos={combos} readOnly={readOnly} />;
  return <ComboList combos={combos} readOnly={readOnly} />;
}

function ComboList({ combos, readOnly }) {
  const [creating, setCreating] = useState(false);

  const columns = [
    {
      key: "name", header: "Combo",
      render: (r) => (
        <span className="block min-w-0">
          <span className="block truncate font-medium text-ink">{r.name}</span>
          <span className="block truncate text-xs text-ink-soft">{r.brand}</span>
        </span>
      ),
    },
    {
      key: "items", header: "Items",
      render: (r) => (r.itemCount ? `${r.itemCount} product${r.itemCount === 1 ? "" : "s"}` : <span className="text-amber-700">None yet — not shown in the shop</span>),
    },
    { key: "price", header: "Price", align: "right", render: (r) => money(r.price_minor) },
    { key: "stock", header: "Stock", align: "right", render: (r) => r.stock },
    { key: "status", header: "Status", render: (r) => <Pill tone={STATUS_TONE[r.status]}>{r.status}</Pill> },
  ];

  return (
    <>
      <PageHeader
        title="Combos"
        subtitle="Bundles of products sold together at one price. Published combos with items appear on the home Combo tile and at /shop?combo=1."
        actions={!readOnly && (
          <Btn onClick={() => setCreating(true)}>
            <PackagePlus className="h-4 w-4" /> New combo
          </Btn>
        )}
      />
      <DataTable
        columns={columns}
        rows={combos.data ?? []}
        loading={combos.loading}
        error={combos.error}
        empty="No combos yet. Create one with “New combo”."
        onRowClick={(r) => adminNavigate(`/admin/combos/${r.id}`)}
      />
      {creating && <NewComboModal onClose={() => setCreating(false)} />}
    </>
  );
}

function ComboDetail({ id, combos, readOnly }) {
  const [unlinking, setUnlinking] = useState(false);
  const [error, setError] = useState(null);
  const combo = combos.data?.find((c) => c.id === id);

  const back = (
    <button onClick={() => adminNavigate("/admin/combos")} className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-ink-soft hover:text-ink">
      <ArrowLeft className="h-3.5 w-3.5" /> All combos
    </button>
  );

  if (combos.loading && !combos.data) return <div className="grid place-items-center py-24"><Spinner className="h-7 w-7" /></div>;
  if (!combo) {
    return (
      <>
        <PageHeader title="Combo not found" back={back} />
        <p className="text-sm text-ink-soft">{combos.error ? `Couldn't load combos: ${combos.error.message}` : "This product isn't a combo (any more)."}</p>
      </>
    );
  }

  async function unlink() {
    const { error: e } = await setProductCombo(id, false);
    if (e) return setError(`Couldn't remove it from combos: ${e.message}`);
    adminNavigate("/admin/combos");
  }

  return (
    <>
      <PageHeader
        title={combo.name}
        subtitle={`${combo.brand} · ${money(combo.price_minor)} · ${combo.status}`}
        back={back}
        actions={
          <>
            <Btn variant="secondary" onClick={() => adminNavigate(`/admin/products/${id}`)}>
              <Pencil className="h-4 w-4" /> Price, photos & stock
            </Btn>
            {!readOnly && <Btn variant="ghost" onClick={() => setUnlinking(true)}>Remove from combos</Btn>}
          </>
        }
      />
      {combo.status !== "active" && (
        <p className="mb-4 rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          This combo is <strong>{combo.status}</strong> — shoppers don't see it until you set its status to Active under “Price, photos & stock”.
        </p>
      )}
      {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}
      <ComboItemsTab productId={id} comboPriceMinor={combo.price_minor} readOnly={readOnly} onSaved={combos.reload} />
      <ConfirmModal
        open={unlinking} onClose={() => setUnlinking(false)} onConfirm={unlink}
        title="Remove from combos?" confirmLabel="Remove" danger
        body={`“${combo.name}” stays in your catalog as a normal product, but its item list is cleared and it no longer appears under Combos.`}
      />
    </>
  );
}

function NewComboModal({ onClose }) {
  const [mode, setMode] = useState("new"); // "new" | "existing"
  const [form, setForm] = useState({ name: "", brand: "", category_id: "", price_minor: null, key_features: [] });
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const tree = useAsync(() => listCategoryTree({ includeInactive: false }), []);
  const found = useAsync(() => (mode === "existing" ? listProducts({ search: query, pageSize: 15 }) : { data: [] }), [mode, query]);

  const categoryOptions = useMemo(
    () => (tree.data ?? []).map((p) => ({ label: p.name, options: [p, ...(p.children ?? [])].map((c) => ({ id: c.id, label: c.name })) })),
    [tree.data]
  );
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const canCreate = form.name.trim() && form.brand.trim() && form.category_id && form.price_minor > 0;

  async function create() {
    setBusy(true); setError(null);
    const { data, error: e } = await createProduct({
      name: form.name.trim(), brand: form.brand.trim(), category_id: form.category_id,
      price_minor: form.price_minor, key_features: form.key_features, is_combo: true, status: "draft",
    });
    setBusy(false);
    if (e) return setError(`Couldn't create the combo: ${e.message}`);
    adminNavigate(`/admin/combos/${data.id}`);
  }

  async function pickExisting(p) {
    setBusy(true); setError(null);
    const { error: e } = await setProductCombo(p.id, true);
    setBusy(false);
    if (e) return setError(`Couldn't make it a combo: ${e.message}`);
    adminNavigate(`/admin/combos/${p.id}`);
  }

  return (
    <Modal
      open onClose={onClose} title="New combo"
      footer={mode === "new" && (
        <>
          <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn size="sm" loading={busy} disabled={!canCreate} onClick={create}>Create & pick items</Btn>
        </>
      )}
    >
      <div className="mb-4 flex gap-1 rounded-xl bg-snow p-1 ring-1 ring-line">
        {[["new", "Create a new combo"], ["existing", "Use an existing product"]].map(([m, label]) => (
          <button
            key={m} type="button" onClick={() => setMode(m)}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold ${mode === m ? "bg-white text-magenta shadow-sm ring-1 ring-line" : "text-ink-soft"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {error && <p className="mb-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}

      {mode === "new" ? (
        <div className="space-y-4">
          <TextField label="Combo name" required value={form.name} onChange={(e) => set("name")(e.target.value)} placeholder="e.g. Glow Starter Combo" />
          <TextField label="Brand" required value={form.brand} onChange={(e) => set("brand")(e.target.value)} placeholder="e.g. Skin Theory" />
          <SelectField
            label="Category" hint="Where it sits in the menu — combos also show under the Combo tile wherever they're filed."
            required placeholder="Choose a category" options={categoryOptions}
            value={form.category_id} onChange={(e) => set("category_id")(e.target.value)}
          />
          <MoneyField label="Combo price" required valueMinor={form.price_minor} onChangeMinor={set("price_minor")} />
          <LinesField
            label="Key features" hint="One per line — shown on the combo's page. Optional."
            value={form.key_features} onChange={set("key_features")} rows={3}
            placeholder={"Complete morning routine\nSave vs buying separately"}
          />
          <p className="text-xs text-ink-soft">It's created as a draft. Next you pick the products inside it, then add photos and stock and set it Active.</p>
        </div>
      ) : (
        <div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-soft" />
            <input
              value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, brand or SKU…" autoFocus
              className="w-full rounded-xl border border-line bg-white py-2 pl-8 pr-3 text-sm outline-none focus:border-magenta"
            />
          </div>
          <div className="mt-2 max-h-72 overflow-auto rounded-lg ring-1 ring-line">
            {found.loading && <p className="px-3 py-2 text-xs text-ink-soft">Loading…</p>}
            {!found.loading && !(found.data ?? []).length && <p className="px-3 py-2 text-xs text-ink-soft">No products match.</p>}
            {!found.loading && (found.data ?? []).map((p) => (
              <button
                key={p.id} type="button" disabled={busy} onClick={() => pickExisting(p)}
                className="flex min-w-full w-max items-center justify-between gap-6 whitespace-nowrap px-3 py-2 text-left text-xs hover:bg-snow disabled:opacity-40"
              >
                <span>{p.brand} — {p.name}</span>
                <span className="shrink-0 text-ink-soft">{money(p.price_minor)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
