/* =================================================================== *
 * skin.script admin — CMS block editor
 * -------------------------------------------------------------------
 * Renders a typed form from the slot's field schema (lib/api/admin/
 * schemas.js). The client never sees or edits raw JSON — that's the whole
 * point of declaring fields rather than dumping a textarea.
 *
 * Every save snapshots the previous payload (DB trigger), so the revision
 * list on the right is a working undo, not a log.
 * =================================================================== */
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { getBlock, listRevisions, restoreRevision, saveBlock } from "../../lib/api/admin/content.js";
import { adminNavigate } from "../AdminApp.jsx";
import { SingleImageField } from "../components/ImageManager.jsx";
import {
  Btn, Card, PageHeader, SaveBar, SelectField, Spinner, TextField, Toggle, useAsync,
} from "../components/kit.jsx";

const ROUTES = ["/", "/shop", "/offers", "/rewards", "/journal", "/about", "/contact", "/wishlist"];

export default function ContentEdit({ slot }) {
  const [schema, setSchema] = useState(null);
  const [form, setForm] = useState(null);
  const [original, setOriginal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const revisions = useAsync(() => listRevisions(slot), [slot, original]);

  const load = async () => {
    const { data, error } = await getBlock(slot);
    if (error) return setError(error.message);
    if (!data?.schema) return setError(`No editor is defined for “${slot}”.`);
    setSchema(data.schema);
    setForm(data.payload);
    setOriginal(data.payload);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [slot]);

  const dirty = useMemo(
    () => form && original && JSON.stringify(form) !== JSON.stringify(original),
    [form, original]
  );

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  async function handleSave() {
    setSaving(true); setError(null); setNotice(null);
    const { data, error } = await saveBlock(slot, form);
    setSaving(false);
    if (error) return setError(error.message);
    setOriginal(data.payload);
    setNotice("Saved. Your storefront is updated.");
  }

  if (error && !form) {
    return (
      <div className="rounded-2xl bg-white p-10 text-center ring-1 ring-line">
        <p className="text-sm text-red-600">{error}</p>
        <Btn variant="secondary" className="mt-4" onClick={() => adminNavigate("/admin/content")}>Back to content</Btn>
      </div>
    );
  }
  if (!form) return <div className="grid place-items-center py-24"><Spinner className="h-7 w-7" /></div>;

  return (
    <>
      <PageHeader
        back={
          <button onClick={() => adminNavigate("/admin/content")} className="mb-2 flex items-center gap-1 text-xs text-ink-soft hover:text-magenta">
            <ArrowLeft className="h-3.5 w-3.5" /> Content
          </button>
        }
        title={schema.label}
        subtitle={schema.help}
      />

      {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}
      {notice && <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">{notice}</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <div className="grid gap-5">
              {schema.fields.map((field) => (
                <FieldRenderer key={field.key} field={field} value={form[field.key]} onChange={set(field.key)} />
              ))}
            </div>
          </Card>
        </div>

        <Card title="Recent versions" description="Restore an earlier version if you change your mind.">
          {revisions.loading ? (
            <Spinner />
          ) : !revisions.data?.length ? (
            <p className="py-4 text-center text-xs text-ink-soft">No earlier versions yet. One is saved every time you edit.</p>
          ) : (
            <ul className="divide-y divide-line">
              {revisions.data.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 py-2.5">
                  <span className="text-xs text-ink-soft">{new Date(r.created_at).toLocaleString()}</span>
                  <Btn size="sm" variant="ghost" onClick={async () => {
                    await restoreRevision(slot, r.id);
                    await load();
                    setNotice("Restored an earlier version.");
                  }}>
                    <RotateCcw className="h-3.5 w-3.5" /> Restore
                  </Btn>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <SaveBar dirty={dirty} saving={saving} onSave={handleSave} onDiscard={() => setForm(original)} />
    </>
  );
}

function FieldRenderer({ field, value, onChange }) {
  const common = { label: field.label, hint: field.help };

  switch (field.type) {
    case "boolean":
      return <Toggle label={field.label} hint={field.help} checked={!!value} onChange={onChange} />;

    case "textarea":
      return (
        <TextField {...common} as="textarea" maxLength={field.max}
          hint={field.max ? `${(value ?? "").length}/${field.max}` : field.help}
          value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
      );

    case "number":
      return <TextField {...common} type="number" value={value ?? ""} onChange={(e) => onChange(Number(e.target.value))} />;

    case "date":
      return <TextField {...common} type="datetime-local" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;

    case "image":
      return <SingleImageField label={field.label} hint={field.help} value={value} onChange={onChange} />;

    case "route":
      return (
        <SelectField {...common} value={value ?? ""} onChange={(e) => onChange(e.target.value)}
          placeholder="Choose a page" options={ROUTES.map((r) => ({ id: r, label: r === "/" ? "Home" : r }))} />
      );

    case "list":
      return <ListField field={field} value={value ?? []} onChange={onChange} />;

    default:
      return (
        <TextField {...common} maxLength={field.max}
          hint={field.max ? `${(value ?? "").length}/${field.max}` : field.help}
          value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
      );
  }
}

/** Repeating group — banners, concern tiles, bullet points. Add / remove /
 *  reorder, with a hard cap from the schema so a client can't add 40 hero
 *  banners and wreck the layout. */
function ListField({ field, value, onChange }) {
  const items = value ?? [];
  const blank = Object.fromEntries(field.itemFields.map((f) => [f.key, ""]));

  const update = (i, key, v) =>
    onChange(items.map((item, idx) => (idx === i ? { ...item, [key]: v } : item)));

  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div>
      <span className="mb-2 block text-xs font-medium text-ink">
        {field.label}
        <span className="ml-2 font-normal text-ink-soft">{items.length}{field.max ? ` / ${field.max}` : ""}</span>
      </span>

      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="rounded-xl bg-snow p-4 ring-1 ring-line">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-medium text-ink-soft">Item {i + 1}</span>
              <div className="flex gap-1">
                <Btn size="sm" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0}>↑</Btn>
                <Btn size="sm" variant="ghost" onClick={() => move(i, 1)} disabled={i === items.length - 1}>↓</Btn>
                <Btn size="sm" variant="ghost" className="text-red-600"
                  onClick={() => onChange(items.filter((_, idx) => idx !== i))}>Remove</Btn>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {field.itemFields.map((f) => (
                <div key={f.key} className={f.type === "image" || f.type === "textarea" ? "sm:col-span-2" : ""}>
                  <FieldRenderer field={f} value={item[f.key]} onChange={(v) => update(i, f.key, v)} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Btn size="sm" variant="secondary" className="mt-3"
        disabled={field.max && items.length >= field.max}
        onClick={() => onChange([...items, blank])}>
        Add {field.label.replace(/s$/, "").toLowerCase()}
      </Btn>
    </div>
  );
}
