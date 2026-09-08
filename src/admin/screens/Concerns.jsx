/* =================================================================== *
 * skin.theory admin — concerns
 * -------------------------------------------------------------------
 * A flat, admin-managed list (0059_concerns_table.sql) — no hierarchy,
 * like Brands. Renaming or re-imaging an existing concern here updates
 * every consumer live (the Shop-by-Concern tile dropdown, the product
 * tagging multi-select, the shop's concern filter) with no code change —
 * they all look the name up by slug at render time (lib/api/concerns.js)
 * rather than storing it, so nothing here needs to touch products or
 * content_blocks to keep them in sync on a rename.
 *
 * Create/delete followed later, once "let admins edit the 9 that exist"
 * grew into "let them manage the full set" — upsertConcern() already
 * supported creation from day one (same shape as upsertBrand), so Create
 * here is just the UI. Delete has no FK to lean on the way Brands/
 * Categories do (a concern's slug lives inside a text[] and inside CMS
 * jsonb, not behind a real foreign key), so it's blocked in application
 * code instead — see deleteConcern()'s doc comment.
 * =================================================================== */
import { useEffect, useState } from "react";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { deleteConcern, listConcernsWithCounts, slugify, upsertConcern } from "../../lib/api/admin/catalog.js";
import { clearConcernCache } from "../../lib/api/concerns.js";
import { useAdmin } from "../context.js";
import { adminNavigate } from "../AdminApp.jsx";
import { Btn, Card, ConfirmModal, Modal, PageHeader, Spinner, TextField } from "../components/kit.jsx";
import { SingleImageField } from "../components/ImageManager.jsx";

/** Plain-English "why the delete button is disabled" reason, or null if
 *  the concern is free to delete. Shared between the row's disabled/title
 *  and the confirm dialog's body so the two never say different things. */
function inUseReason(c) {
  const parts = [];
  if (c.productCount > 0) parts.push(`${c.productCount} product${c.productCount === 1 ? "" : "s"}`);
  if (c.tileCount > 0) parts.push(`${c.tileCount} Shop-by-Concern tile${c.tileCount === 1 ? "" : "s"}`);
  return parts.length ? `Still used by ${parts.join(" and ")} — untag/unlink those first.` : null;
}

export default function Concerns() {
  const { can } = useAdmin();
  const readOnly = !can("admin");

  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  const load = async () => {
    const { data, error } = await listConcernsWithCounts();
    if (error) return setError(error.message);
    setRows(data);
  };
  useEffect(() => { load(); }, []);

  if (error && !rows) return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>;
  if (!rows) return <div className="grid place-items-center py-24"><Spinner className="h-7 w-7" /></div>;

  return (
    <>
      <PageHeader
        title="Concerns"
        subtitle="The skin concerns products can be tagged with and Shop-by-Concern tiles link to. Renaming or re-imaging one updates every product tag, tile, and filter that uses it."
        actions={!readOnly && (
          <Btn onClick={() => setEditing({ name: "" })}>
            <Plus className="h-4 w-4" /> Add concern
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
          {rows.map((c) => {
            const reason = inUseReason(c);
            return (
              <li key={c.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{c.name}</p>
                  <p className="text-xs text-ink-soft">{c.slug}</p>
                </div>

                <button
                  onClick={() => adminNavigate(`/admin/products?concern=${c.slug}`)}
                  className="text-xs text-ink-soft hover:text-magenta"
                >
                  {c.productCount} product{c.productCount === 1 ? "" : "s"}
                </button>

                {c.tileCount > 0 && (
                  <button
                    onClick={() => adminNavigate("/admin/content/home.concerns")}
                    className="text-xs text-ink-soft hover:text-magenta"
                  >
                    {c.tileCount} tile{c.tileCount === 1 ? "" : "s"}
                  </button>
                )}

                {!readOnly && (
                  <>
                    <Btn size="sm" variant="secondary" onClick={() => setEditing(c)}>Edit</Btn>
                    <Btn
                      size="sm" variant="ghost"
                      disabled={!!reason}
                      title={reason ?? "Permanently delete this concern"}
                      onClick={() => setDeleting(c)}
                      className="text-red-600 hover:text-red-700 disabled:text-ink-soft/40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Btn>
                  </>
                )}
              </li>
            );
          })}
          {rows.length === 0 && (
            <li className="py-10 text-center text-sm text-ink-soft">No concerns yet.</li>
          )}
        </ul>
      </Card>

      {editing && (
        <ConcernModal
          concern={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); clearConcernCache(); load(); }}
        />
      )}

      <ConfirmModal
        open={!!deleting} onClose={() => setDeleting(null)} danger
        title={`Delete "${deleting?.name}"?`}
        confirmLabel="Delete permanently"
        body={
          inUseReason(deleting ?? { productCount: 0, tileCount: 0 })
          ?? "This removes the concern itself — it can't be undone. It's not tagged on any product or linked from any Shop-by-Concern tile, so nothing else is affected."
        }
        onConfirm={async () => {
          setDeleteError(null);
          const { error } = await deleteConcern(deleting.id, deleting.slug);
          if (error) setDeleteError(error.message);
          else { clearConcernCache(); load(); }
        }}
      />
    </>
  );
}

function ConcernModal({ concern, onClose, onSaved }) {
  const [name, setName] = useState(concern.name ?? "");
  const [imagePath, setImagePath] = useState(concern.image_path ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const isNew = !concern.id;

  return (
    <Modal open onClose={onClose} title={isNew ? "New concern" : `Edit "${concern.name}"`}
      footer={
        <>
          <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn size="sm" loading={busy} onClick={async () => {
            if (!name.trim()) return setError("Give the concern a name.");
            setBusy(true); setError(null);
            const { error } = await upsertConcern({ id: concern.id, name, image_path: imagePath || null });
            setBusy(false);
            if (error) setError(error.message);
            else onSaved();
          }}>Save</Btn>
        </>
      }>
      {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}
      <TextField label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
      <p className="mt-2 mb-4 text-[11px] text-ink-soft">
        Web address: /{isNew ? slugify(name) : concern.slug}
        {isNew
          ? " — generated from the name, and stable from here on: renaming later can't break a product tag or tile link made against it."
          : " — this never changes, so renaming can't break an existing product tag or Shop-by-Concern tile link."}
      </p>
      <SingleImageField
        label="Image"
        hint="Optional. Not shown anywhere on the storefront today — the Shop-by-Concern tiles use their own per-tile image, set in Content → Shop by Concern."
        value={imagePath}
        onChange={setImagePath}
      />
    </Modal>
  );
}
