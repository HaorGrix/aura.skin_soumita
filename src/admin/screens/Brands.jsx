/* =================================================================== *
 * skin.theory admin — brands
 * -------------------------------------------------------------------
 * A flat, admin-managed list (0028_brands_table.sql) — no hierarchy, no
 * storefront-facing sort order, unlike Categories. Renaming a brand here
 * cascades to every product using it automatically (a DB trigger keeps
 * products.brand in step with brand_id — see the migration), so this
 * screen never has to touch products itself to keep them in sync.
 *
 * Delete is blocked outright by a real FK (products.brand_id, ON DELETE
 * defaults to NO ACTION) whenever a product still uses the brand — the
 * count shown here is a preview of that, not the enforcement.
 * =================================================================== */
import { useEffect, useState } from "react";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { deleteBrand, listBrandsWithCounts, slugify, upsertBrand } from "../../lib/api/admin/catalog.js";
import { useAdmin } from "../context.js";
import { adminNavigate } from "../AdminApp.jsx";
import { Btn, Card, ConfirmModal, Modal, PageHeader, Spinner, TextField } from "../components/kit.jsx";

export default function Brands() {
  const { can } = useAdmin();
  const readOnly = !can("admin");

  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  const load = async () => {
    const { data, error } = await listBrandsWithCounts();
    if (error) return setError(error.message);
    setRows(data);
  };
  useEffect(() => { load(); }, []);

  if (error && !rows) return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>;
  if (!rows) return <div className="grid place-items-center py-24"><Spinner className="h-7 w-7" /></div>;

  return (
    <>
      <PageHeader
        title="Brands"
        subtitle="The picklist the product editor's Brand field offers. Renaming one updates every product that uses it."
        actions={!readOnly && (
          <Btn onClick={() => setEditing({ name: "" })}>
            <Plus className="h-4 w-4" /> Add brand
          </Btn>
        )}
      />

      {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}
      {deleteError && (
        <p className="mb-4 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {deleteError}
        </p>
      )}

      <Card>
        <ul className="divide-y divide-line">
          {rows.map((b) => (
            <li key={b.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{b.name}</p>
                <p className="text-xs text-ink-soft">/{b.slug}</p>
              </div>

              <button
                onClick={() => adminNavigate(`/admin/products?brand=${b.id}`)}
                className="text-xs text-ink-soft hover:text-magenta"
              >
                {b.productCount} product{b.productCount === 1 ? "" : "s"}
              </button>

              {!readOnly && (
                <>
                  <Btn size="sm" variant="secondary" onClick={() => setEditing(b)}>Rename</Btn>
                  <Btn
                    size="sm" variant="ghost"
                    disabled={b.productCount > 0}
                    title={b.productCount > 0 ? `Used by ${b.productCount} product${b.productCount === 1 ? "" : "s"} — reassign those first.` : "Permanently delete this brand"}
                    onClick={() => setDeleting(b)}
                    className="text-red-600 hover:text-red-700 disabled:text-ink-soft/40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Btn>
                </>
              )}
            </li>
          ))}
          {rows.length === 0 && (
            <li className="py-10 text-center text-sm text-ink-soft">No brands yet.</li>
          )}
        </ul>
      </Card>

      {editing && (
        <BrandModal
          brand={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}

      <ConfirmModal
        open={!!deleting} onClose={() => setDeleting(null)} danger
        title={`Delete “${deleting?.name}”?`}
        confirmLabel="Delete permanently"
        body="This removes the brand itself — it can't be undone. It's not used by any product, so nothing else is affected."
        onConfirm={async () => {
          setDeleteError(null);
          const { error } = await deleteBrand(deleting.id);
          if (error) setDeleteError(error.message);
          else load();
        }}
      />
    </>
  );
}

function BrandModal({ brand, onClose, onSaved }) {
  const [name, setName] = useState(brand.name ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const isNew = !brand.id;

  return (
    <Modal open onClose={onClose} title={isNew ? "New brand" : `Rename “${brand.name}”`}
      footer={
        <>
          <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn size="sm" loading={busy} onClick={async () => {
            if (!name.trim()) return setError("Give the brand a name.");
            setBusy(true); setError(null);
            const { error } = await upsertBrand({ id: brand.id, name });
            setBusy(false);
            if (error) setError(error.message);
            else onSaved();
          }}>Save</Btn>
        </>
      }>
      {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}
      <TextField label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
      <p className="mt-2 text-[11px] text-ink-soft">
        Web address: /{slugify(name)}
        {!isNew && " — renaming updates every product using this brand automatically."}
      </p>
    </Modal>
  );
}
