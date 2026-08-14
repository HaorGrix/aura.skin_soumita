/* =================================================================== *
 * skin.theory admin — Journal (blog) articles
 * -------------------------------------------------------------------
 * `journal_articles` (0042_journal_articles.sql) — RLS lets staff
 * (editor+) see every row; the storefront only ever sees
 * status = 'published' rows. Drafts are admin-only preview.
 * =================================================================== */
import { useState } from "react";
import { Plus, X } from "lucide-react";
import {
  deleteJournalArticle, estimateReadMinutes, journalImageUrl, listJournalArticles,
  saveJournalArticle, slugify, suggestSlug, uploadJournalImage, MAX_IMAGE_BYTES,
} from "../../lib/api/admin/journal.js";
import { useAdmin } from "../context.js";
import JournalEditor from "../components/JournalEditor.jsx";
import {
  Btn, Card, ConfirmModal, DataTable, Label, Modal, PageHeader, Pill,
  SearchInput, SelectField, Spinner, TextField, useAsync,
} from "../components/kit.jsx";

const CATEGORY_OPTIONS = ["Routine", "Ingredients", "Hydration", "Barrier", "Sun Care", "Wellness", "Nutrition"];

const BLANK = {
  title: "", slug: "", excerpt: "", body_html: "", cover_image: "",
  category: CATEGORY_OPTIONS[0], read_minutes: null, status: "draft",
  published_at: "", author_name: "",
};

export default function Journal() {
  const { can } = useAdmin();
  const readOnly = !can("editor");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const list = useAsync(() => listJournalArticles({ search, status }), [search, status]);

  return (
    <>
      <PageHeader
        title="Journal"
        subtitle="Articles shown in the homepage 'Stories & soulful reads' section and the /journal page. Only Published articles ever appear on the storefront."
        actions={!readOnly && (
          <Btn onClick={() => setEditing({ ...BLANK })}><Plus className="h-4 w-4" /> New article</Btn>
        )}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by title…" className="max-w-xs" />
        <SelectField
          value={status} onChange={(e) => setStatus(e.target.value)}
          options={[{ id: "draft", label: "Draft" }, { id: "published", label: "Published" }]}
          placeholder="All statuses" className="w-44"
        />
      </div>

      <DataTable
        loading={list.loading} error={list.error} rows={list.data}
        onRowClick={!readOnly ? setEditing : undefined}
        empty="No articles yet. Add one to start filling the Journal."
        columns={[
          { key: "title", header: "Title", render: (a) => (
            <div className="min-w-0">
              <p className="truncate font-medium text-ink">{a.title}</p>
              <p className="truncate text-xs text-ink-soft">/journal/{a.slug}</p>
            </div>
          ) },
          { key: "category", header: "Category", render: (a) => <Pill tone="magenta">{a.category}</Pill> },
          { key: "status", header: "Status", render: (a) =>
            a.status === "published" ? <Pill tone="green">Published</Pill> : <Pill tone="amber">Draft</Pill> },
          { key: "published_at", header: "Published", render: (a) =>
            a.published_at ? new Date(a.published_at).toLocaleDateString() : "—" },
          { key: "actions", header: "", align: "right", render: (a) => !readOnly && (
            <Btn size="sm" variant="ghost" className="text-red-600 hover:text-red-700"
              onClick={(e) => { e.stopPropagation(); setRemoving(a); }}>
              Delete
            </Btn>
          ) },
        ]}
      />

      {editing && (
        <ArticleModal
          article={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); list.reload?.(); }}
        />
      )}

      <ConfirmModal
        open={!!removing} onClose={() => setRemoving(null)} danger
        title="Delete this article?"
        confirmLabel="Delete"
        body="It's removed from the homepage and /journal immediately and can't be undone."
        onConfirm={async () => {
          await deleteJournalArticle(removing.id, [removing.cover_image]);
          list.reload?.();
        }}
      />
    </>
  );
}

function ArticleModal({ article, onClose, onSaved }) {
  const [form, setForm] = useState(article);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [slugTouched, setSlugTouched] = useState(!!article.id);
  const isNew = !article.id;

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  async function handleTitleChange(title) {
    setForm((f) => ({ ...f, title }));
    if (!slugTouched) {
      const slug = await suggestSlug(title);
      setForm((f) => ({ ...f, slug }));
    }
  }

  async function handleSave(nextStatus) {
    setError(null);
    if (!form.title?.trim()) return setError("Add a title.");
    if (!form.slug?.trim()) return setError("Add a URL slug.");
    if (!form.category) return setError("Pick a category.");

    setBusy(true);
    const { data, error } = await saveJournalArticle({
      ...(form.id ? { id: form.id } : {}),
      title: form.title.trim(),
      slug: slugify(form.slug),
      excerpt: form.excerpt ?? null,
      body_html: form.body_html ?? "",
      cover_image: form.cover_image ?? null,
      category: form.category,
      read_minutes: form.read_minutes === "" || form.read_minutes == null
        ? estimateReadMinutes(form.body_html)
        : Number(form.read_minutes),
      status: nextStatus ?? form.status,
      published_at: form.published_at || null,
      author_name: form.author_name?.trim() || null,
    });
    setBusy(false);
    if (error) return setError(error.code === "23505" ? "That URL slug is already taken — pick another." : error.message);
    onSaved(data);
  }

  return (
    <Modal open onClose={onClose} title={isNew ? "New article" : "Edit article"} wide
      footer={
        <>
          <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
          {form.status === "published" ? (
            <Btn variant="secondary" size="sm" loading={busy} onClick={() => handleSave("draft")}>
              Unpublish (save as draft)
            </Btn>
          ) : (
            <Btn variant="secondary" size="sm" loading={busy} onClick={() => handleSave("draft")}>
              Save draft
            </Btn>
          )}
          <Btn size="sm" loading={busy} onClick={() => handleSave("published")}>
            {form.status === "published" ? "Save changes" : "Publish"}
          </Btn>
        </>
      }>
      {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}

      <div className="grid gap-4">
        <div className="flex items-center gap-2">
          {form.status === "published" ? <Pill tone="green">Published</Pill> : <Pill tone="amber">Draft</Pill>}
          <span className="text-xs text-ink-soft">
            {form.status === "published"
              ? "Live on the homepage and /journal now."
              : "Only visible here in admin — not on the storefront."}
          </span>
        </div>

        <TextField label="Title" required value={form.title ?? ""}
          onChange={(e) => handleTitleChange(e.target.value)} />

        <TextField label="URL slug" required hint="skin.theory.com/journal/…"
          value={form.slug ?? ""}
          onChange={(e) => { setSlugTouched(true); set("slug")(slugify(e.target.value)); }} />

        <div className="grid grid-cols-2 gap-4">
          <SelectField label="Category" required value={form.category}
            options={CATEGORY_OPTIONS} onChange={(e) => set("category")(e.target.value)} />
          <TextField label="Author (optional)" value={form.author_name ?? ""}
            onChange={(e) => set("author_name")(e.target.value)} />
        </div>

        <TextField label="Excerpt" as="textarea" hint="Shown on the card, homepage & /journal"
          value={form.excerpt ?? ""} onChange={(e) => set("excerpt")(e.target.value)} />

        <CoverImageField value={form.cover_image} onChange={set("cover_image")} />

        <JournalEditor
          label="Body" hint="Headings, bold/italic, lists, inline images"
          value={form.body_html} onChange={set("body_html")}
        />

        <TextField
          label="Read time (minutes)" type="number" min="1"
          hint={`Leave blank to auto-calculate (~${estimateReadMinutes(form.body_html)} min from current body)`}
          value={form.read_minutes ?? ""} onChange={(e) => set("read_minutes")(e.target.value)}
        />
      </div>
    </Modal>
  );
}

function CoverImageField({ value, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function upload(file) {
    if (!file) return;
    setError(null);
    if (file.size > MAX_IMAGE_BYTES) {
      return setError(`"${file.name}" is over the 5 MB limit.`);
    }
    setBusy(true);
    const { path, error } = await uploadJournalImage(file);
    setBusy(false);
    if (error) setError(error.message);
    else onChange(path);
  }

  return (
    <div>
      <Label hint="16:10 recommended, JPG/PNG/WebP, max 5MB">Cover image</Label>
      {value ? (
        <div className="relative w-full max-w-xs overflow-hidden rounded-xl ring-1 ring-line" style={{ aspectRatio: "16/10" }}>
          <img src={journalImageUrl(value)} alt="" className="h-full w-full object-cover" />
          <button type="button" onClick={() => onChange("")}
            className="absolute right-2 top-2 rounded-full bg-ink/70 p-1.5 text-white hover:bg-red-600" aria-label="Remove image">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <label className="flex w-full max-w-xs cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line py-8 text-ink-soft transition-colors hover:border-magenta hover:text-magenta">
          {busy ? <Spinner /> : <span className="text-xs">Click to upload</span>}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={busy}
            onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
      )}
      {error && <p className="mt-2 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
