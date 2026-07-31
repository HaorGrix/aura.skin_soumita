/* =================================================================== *
 * skin.script admin — categories
 * -------------------------------------------------------------------
 * Categories drive the storefront's category filter and navigation, so the
 * order set here is the order shoppers see. Each row shows its product
 * count: renaming or hiding a category with 40 products in it is a very
 * different act from doing it to an empty one, and the client should be able
 * to see which they're about to do.
 *
 * There is no delete. products.category_id is a real foreign key, so the
 * database would refuse to remove a category that still has products — and
 * removing an empty one still breaks any existing link to it. Hiding is
 * offered instead, which is the operation people actually want.
 * =================================================================== */
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import {
  listCategoriesWithCounts, reorderCategories, setCategoryActive, slugify, upsertCategory,
} from "../../lib/api/admin/catalog.js";
import { useAdmin } from "../context.js";
import { adminNavigate } from "../AdminApp.jsx";
import {
  Btn, Card, ConfirmModal, Modal, PageHeader, Pill, SaveBar, SelectField, Spinner, TextField,
} from "../components/kit.jsx";

export default function Categories() {
  const { can } = useAdmin();
  const readOnly = !can("admin");

  const [rows, setRows] = useState(null);
  const [original, setOriginal] = useState(null);
  const [editing, setEditing] = useState(null);
  const [toggling, setToggling] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    const { data, error } = await listCategoriesWithCounts();
    if (error) return setError(error.message);
    setRows(data);
    setOriginal(data);
  };
  useEffect(() => { load(); }, []);

  const dirty = rows && original &&
    rows.map((r) => r.id).join(",") !== original.map((r) => r.id).join(",");

  /**
   * Move a category among its OWN siblings.
   *
   * Swapping with whatever happens to be adjacent in the flat array would let
   * a Skin Care sub-category jump into the Lip Care column. The neighbour is
   * therefore looked up by matching parent_id.
   */
  function move(id, direction) {
    const index = rows.findIndex((r) => r.id === id);
    if (index < 0) return;
    const me = rows[index];

    const siblings = rows
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => (r.parent_id ?? null) === (me.parent_id ?? null));

    const at = siblings.findIndex(({ r }) => r.id === id);
    const swapWith = siblings[at + direction];
    if (!swapWith) return; // already first/last in its column

    const next = [...rows];
    [next[index], next[swapWith.i]] = [next[swapWith.i], next[index]];
    setRows(next);
  }

  /* Parents first, each followed by its own children — so the list reads the
     way the mega menu renders. */
  const ordered = [];
  for (const root of rows.filter((r) => !r.parent_id)) {
    ordered.push({ ...root, depth: 0 });
    for (const child of rows.filter((r) => r.parent_id === root.id)) {
      ordered.push({ ...child, depth: 1 });
    }
  }
  // Anything whose parent was deleted would otherwise vanish from this screen.
  for (const orphan of rows.filter((r) => r.parent_id && !rows.some((p) => p.id === r.parent_id))) {
    ordered.push({ ...orphan, depth: 0, orphaned: true });
  }

  if (error && !rows) return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>;
  if (!rows) return <div className="grid place-items-center py-24"><Spinner className="h-7 w-7" /></div>;

  return (
    <>
      <PageHeader
        title="Categories"
        subtitle="The groupings shoppers filter by. Drag order here is the order they appear on the storefront."
        actions={!readOnly && (
          <Btn onClick={() => setEditing({ name: "", slug: "", is_active: true, sort_order: rows.length })}>
            <Plus className="h-4 w-4" /> Add category
          </Btn>
        )}
      />

      {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}

      <Card>
        <ul className="divide-y divide-line">
          {ordered.map((c) => (
            <li key={c.id} className={`flex items-center gap-3 py-3 ${c.depth ? "pl-8" : ""}`}>
              <div className="flex flex-col">
                <button onClick={() => move(c.id, -1)} disabled={readOnly}
                  className="rounded p-0.5 text-ink-soft hover:text-magenta disabled:opacity-25" aria-label="Move up">
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => move(c.id, 1)} disabled={readOnly}
                  className="rounded p-0.5 text-ink-soft hover:text-magenta disabled:opacity-25" aria-label="Move down">
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="min-w-0 flex-1">
                <p className={`text-sm text-ink ${c.depth ? "" : "font-semibold"}`}>
                  {c.name}
                  {c.depth === 0 && !c.orphaned && (
                    <span className="ml-2 text-[11px] font-normal text-ink-soft">menu column</span>
                  )}
                  {c.orphaned && <Pill tone="amber" className="ml-2">Orphaned</Pill>}
                </p>
                <p className="text-xs text-ink-soft">/{c.slug}</p>
              </div>

              <button
                onClick={() => adminNavigate(`/admin/products?category=${c.id}`)}
                className="text-xs text-ink-soft hover:text-magenta"
              >
                {c.productCount} product{c.productCount === 1 ? "" : "s"}
                {c.productCount !== c.activeCount && (
                  <span className="ml-1 text-ink-soft/70">({c.activeCount} live)</span>
                )}
              </button>

              {c.is_active ? <Pill tone="green">Visible</Pill> : <Pill tone="grey">Hidden</Pill>}

              {!readOnly && (
                <>
                  <Btn size="sm" variant="secondary" onClick={() => setEditing(c)}>Rename</Btn>
                  <Btn size="sm" variant="ghost" onClick={() => setToggling(c)}>
                    {c.is_active ? "Hide" : "Show"}
                  </Btn>
                </>
              )}
            </li>
          ))}
          {rows.length === 0 && (
            <li className="py-10 text-center text-sm text-ink-soft">No categories yet.</li>
          )}
        </ul>
      </Card>

      <SaveBar
        dirty={dirty} saving={saving}
        message="You've changed the category order."
        onDiscard={() => setRows(original)}
        onSave={async () => {
          setSaving(true);
          const { error } = await reorderCategories(rows);
          setSaving(false);
          if (error) setError(error.message);
          else load();
        }}
      />

      {editing && (
        <CategoryModal
          category={editing} allCategories={rows}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}

      <ConfirmModal
        open={!!toggling} onClose={() => setToggling(null)} danger={toggling?.is_active}
        title={toggling?.is_active ? "Hide this category?" : "Show this category?"}
        confirmLabel={toggling?.is_active ? "Hide it" : "Show it"}
        body={
          toggling?.is_active
            ? `“${toggling?.name}” disappears from the storefront filters. Its ${toggling?.productCount} product${toggling?.productCount === 1 ? "" : "s"} stay published and still reachable by search and direct link — hide the products themselves if you want them gone too.`
            : `“${toggling?.name}” will appear in the storefront filters again.`
        }
        onConfirm={async () => { await setCategoryActive(toggling.id, !toggling.is_active); load(); }}
      />
    </>
  );
}

function CategoryModal({ category, allCategories = [], onClose, onSaved }) {
  const [form, setForm] = useState(category);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const isNew = !category.id;

  // Only top-level rows can be parents — the taxonomy is deliberately two
  // levels deep, matching what the mega menu can render. A category also
  // can't be its own parent (the database rejects that outright).
  const parentChoices = allCategories
    .filter((c) => !c.parent_id && c.id !== category.id)
    .map((c) => ({ id: c.id, name: c.name }));

  return (
    <Modal open onClose={onClose} title={isNew ? "New category" : `Edit “${category.name}”`}
      footer={
        <>
          <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn size="sm" loading={busy} onClick={async () => {
            if (!form.name?.trim()) return setError("Give the category a name.");
            setBusy(true); setError(null);
            const { error } = await upsertCategory({
              ...(form.id ? { id: form.id } : {}),
              name: form.name.trim(),
              slug: form.slug?.trim() || slugify(form.name),
              parent_id: form.parent_id || null,
              is_active: form.is_active ?? true,
              sort_order: form.sort_order ?? 0,
            });
            setBusy(false);
            if (error) {
              // The unique index is per-parent, so this is the likely clash.
              setError(
                /duplicate key/i.test(error.message)
                  ? "Another category in the same section already uses that name or web address."
                  : error.message
              );
            } else onSaved();
          }}>Save</Btn>
        </>
      }>
      {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}
      <div className="grid gap-4">
        <TextField label="Name" required value={form.name ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />

        <SelectField
          label="Section" placeholder="Top level (its own menu column)"
          hint="Where this appears in the Shop menu"
          value={form.parent_id ?? ""} options={parentChoices}
          onChange={(e) => setForm((f) => ({ ...f, parent_id: e.target.value || null }))}
        />
        <TextField label="Web address" hint="Leave blank to generate from the name"
          placeholder={slugify(form.name ?? "")} value={form.slug ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
        {!isNew && form.slug !== category.slug && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Changing the web address will break any existing links that use the old one.
            Category addresses have no automatic forwarding — unlike products.
          </p>
        )}
      </div>
    </Modal>
  );
}
