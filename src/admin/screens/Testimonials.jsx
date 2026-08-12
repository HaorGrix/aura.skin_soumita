/* =================================================================== *
 * skin.theory admin — testimonials
 * -------------------------------------------------------------------
 * Dual-mode entries: a structured text quote (customer name, quote, star
 * rating) or a single admin-uploaded image (e.g. a collage of review
 * screenshots) that stands in for the whole card.
 *
 * `is_featured` is the eligibility pool for the homepage, not a direct
 * "show this one" switch — the storefront rotates through the featured
 * pool one entry per week (lib/api/testimonials.js), ranked by rating for
 * text entries and by priority/recency for image entries. This screen
 * shows that rank as the row order so the client can see how the rotation
 * is queued.
 * =================================================================== */
import { useRef, useState } from "react";
import { AlertTriangle, ImagePlus, Plus, Star, X } from "lucide-react";
import {
  deleteTestimonial, listTestimonials, MAX_IMAGE_BYTES, RECOMMENDED_RATIO,
  IMAGE_ACCEPT, saveTestimonial, testimonialImageUrl, uploadTestimonialImage,
} from "../../lib/api/admin/testimonials.js";
import { useAdmin } from "../context.js";
import {
  Btn, Card, ConfirmModal, Modal, PageHeader, Pill, SelectField, Spinner,
  TextField, Toggle, useAsync,
} from "../components/kit.jsx";

const TYPE_OPTIONS = [
  { id: "text", label: "Text quote" },
  { id: "image", label: "Single image" },
];

export default function Testimonials() {
  const { can } = useAdmin();
  const readOnly = !can("editor");
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const list = useAsync(() => listTestimonials(), []);

  return (
    <>
      <PageHeader
        title="Testimonials"
        subtitle="Featured entries rotate on the homepage, one per week — text quotes ranked by star rating, images by priority then recency."
        actions={!readOnly && (
          <Btn onClick={() => setEditing({ type: "text", is_featured: true, priority: 0 })}>
            <Plus className="h-4 w-4" /> Add testimonial
          </Btn>
        )}
      />

      <div className="mb-6 rounded-xl bg-petal px-4 py-3 text-sm text-magenta-deep">
        <strong>What this controls:</strong> the trust card on the homepage, shown
        right before the Journal section — it's meant to reassure a shopper
        that real customers have bought and loved these products before they
        check out. Only one entry shows at a time; mark the ones you want in
        rotation as <strong>Featured</strong> below and the homepage
        automatically swaps to a different one each week.
      </div>

      {list.loading ? (
        <div className="grid place-items-center py-24"><Spinner className="h-7 w-7" /></div>
      ) : list.error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{list.error.message ?? list.error}</p>
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {(list.data ?? []).map((t) => (
              <li key={t.id} className="flex items-center gap-4 p-4">
                {t.type === "image" ? (
                  <img
                    src={testimonialImageUrl(t.image_url)} alt=""
                    className="h-14 w-[3.9rem] shrink-0 rounded-lg object-cover ring-1 ring-line"
                    style={{ aspectRatio: "1300/500" }}
                  />
                ) : (
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-petal text-magenta ring-1 ring-line">
                    <Star className="h-5 w-5" strokeWidth={1.8} />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium text-ink">
                    {t.type === "image" ? "Image testimonial" : t.customer_name}
                    <Pill tone={t.type === "image" ? "sky" : "grey"}>{t.type}</Pill>
                    {t.is_featured ? <Pill tone="green">Featured</Pill> : <Pill tone="grey">Not shown</Pill>}
                  </p>
                  <p className="truncate text-xs text-ink-soft">
                    {t.type === "image"
                      ? `Priority ${t.priority} · added ${new Date(t.created_at).toLocaleDateString()}`
                      : `${t.quote_text}${t.duration_label ? ` — ${t.duration_label}` : ""}`}
                  </p>
                </div>

                {t.type === "text" && t.rating != null && (
                  <span className="flex items-center gap-1 text-xs font-medium text-ink">
                    <Star className="h-3.5 w-3.5 fill-current text-amber-400" strokeWidth={0} />
                    {Number(t.rating).toFixed(1)}
                  </span>
                )}

                {!readOnly && (
                  <div className="flex shrink-0 gap-2">
                    <Btn size="sm" variant="secondary" onClick={() => setEditing(t)}>Edit</Btn>
                    <Btn size="sm" variant="ghost" className="text-red-600 hover:text-red-700"
                      onClick={() => setRemoving(t)}>
                      Delete
                    </Btn>
                  </div>
                )}
              </li>
            ))}
            {(list.data ?? []).length === 0 && (
              <li className="py-12 text-center text-sm text-ink-soft">
                No testimonials yet. Add one to start filling the homepage rotation.
              </li>
            )}
          </ul>
        </Card>
      )}

      {editing && (
        <TestimonialModal
          testimonial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); list.reload?.(); }}
        />
      )}

      <ConfirmModal
        open={!!removing} onClose={() => setRemoving(null)} danger
        title="Delete this testimonial?"
        confirmLabel="Delete"
        body="It's removed from the homepage rotation immediately and can't be undone."
        onConfirm={async () => {
          await deleteTestimonial(removing.id, removing.type === "image" ? removing.image_url : null);
          list.reload?.();
        }}
      />
    </>
  );
}

function TestimonialModal({ testimonial, onClose, onSaved }) {
  const [form, setForm] = useState(testimonial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const isNew = !testimonial.id;

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSave() {
    setError(null);
    if (form.type === "text") {
      if (!form.customer_name?.trim()) return setError("Add the customer's name.");
      if (!form.quote_text?.trim()) return setError("Add the quote.");
    } else if (!form.image_url) {
      return setError("Upload an image first.");
    }
    setBusy(true);
    const { data, error } = await saveTestimonial({
      ...(form.id ? { id: form.id } : {}),
      type: form.type,
      customer_name: form.customer_name ?? null,
      quote_text: form.quote_text ?? null,
      rating: form.rating === "" || form.rating == null ? null : Number(form.rating),
      duration_label: form.duration_label ?? null,
      image_url: form.image_url ?? null,
      is_featured: !!form.is_featured,
      priority: Number(form.priority ?? 0),
    });
    setBusy(false);
    if (error) return setError(error.message);
    onSaved(data);
  }

  return (
    <Modal open onClose={onClose} title={isNew ? "New testimonial" : "Edit testimonial"}
      footer={
        <>
          <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn size="sm" loading={busy} onClick={handleSave}>Save</Btn>
        </>
      }>
      <p className="mb-4 rounded-xl bg-petal px-4 py-3 text-xs leading-relaxed text-magenta-deep">
        This appears in the trust section on the homepage, shown to build
        confidence before a purchase. Choose one featured entry — a text
        quote or a photo collage of reviews — and it goes into the weekly
        rotation shown to shoppers.
      </p>

      {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}

      <div className="grid gap-4">
        <SelectField
          label="Type" value={form.type} options={TYPE_OPTIONS}
          onChange={(e) => set("type")(e.target.value)}
        />

        {form.type === "text" ? (
          <>
            <TextField label="Customer name" required value={form.customer_name ?? ""}
              onChange={(e) => set("customer_name")(e.target.value)} />
            <TextField label="Quote" as="textarea" required value={form.quote_text ?? ""}
              onChange={(e) => set("quote_text")(e.target.value)} />
            <div className="grid grid-cols-2 gap-4">
              <TextField label="Rating" type="number" min="0" max="5" step="0.5"
                hint="0–5, optional" value={form.rating ?? ""}
                onChange={(e) => set("rating")(e.target.value)} />
              <TextField label="Duration label" hint="e.g. “Using for 3 months”"
                value={form.duration_label ?? ""}
                onChange={(e) => set("duration_label")(e.target.value)} />
            </div>
          </>
        ) : (
          <TestimonialImageField value={form.image_url} onChange={set("image_url")} />
        )}

        <Toggle
          label="Featured (eligible for the homepage rotation)"
          hint="Un-featured entries stay saved here but never appear on the storefront."
          checked={!!form.is_featured} onChange={set("is_featured")}
        />
        <TextField label="Priority" type="number"
          hint={form.type === "image"
            ? "Higher shows earlier in the rotation. Ties broken by most recently added."
            : "Only used to break ties between equally-rated quotes."}
          value={form.priority ?? 0} onChange={(e) => set("priority")(e.target.value)} />
      </div>
    </Modal>
  );
}

/** Single-image upload for the 'image' testimonial type, with client-side
 *  size validation (hard block — matches the DB-safe cap) and aspect-ratio
 *  validation (soft warning — the admin can still proceed). Modeled on
 *  ImageManager.jsx's SingleImageField, but scoped to this feature's exact
 *  2 MB / ~2.6:1 spec rather than sharing that more general component. */
function TestimonialImageField({ value, onChange }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [ratioWarning, setRatioWarning] = useState(null);

  function checkRatio(file) {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const ratio = img.width / img.height;
        // Generous band around 2.6:1 — only warns on something genuinely off
        // (square, portrait, or very wide), not minor crops.
        resolve(ratio < RECOMMENDED_RATIO * 0.65 || ratio > RECOMMENDED_RATIO * 1.35
          ? { width: img.width, height: img.height, ratio }
          : null);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  }

  async function upload(file) {
    if (!file) return;
    setError(null); setRatioWarning(null);

    if (!["image/jpeg", "image/png"].includes(file.type)) {
      return setError("JPG or PNG only.");
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return setError(`“${file.name}” is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is 2 MB.`);
    }

    const off = await checkRatio(file);
    if (off) {
      setRatioWarning(
        `This image is ${off.width}×${off.height} (${off.ratio.toFixed(2)}:1) — ` +
        `recommended ratio is ~2.6:1 (1300×500). It may not display well, but you can still upload it.`
      );
    }

    setBusy(true);
    const { path, error } = await uploadTestimonialImage(file);
    setBusy(false);
    if (error) setError(error.message);
    else onChange(path);
  }

  return (
    <div>
      <span className="mb-1.5 block text-xs font-medium text-ink">Image</span>

      {value ? (
        <div className="relative w-full overflow-hidden rounded-xl ring-1 ring-line" style={{ aspectRatio: "1300/500" }}>
          <img src={testimonialImageUrl(value)} alt="" className="h-full w-full object-cover" />
          <button
            type="button" onClick={() => { onChange(""); setRatioWarning(null); }}
            className="absolute right-2 top-2 rounded-full bg-ink/70 p-1.5 text-white hover:bg-red-600"
            aria-label="Remove image"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button" onClick={() => inputRef.current?.click()} disabled={busy}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files?.[0]); }}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line py-10 text-ink-soft transition-colors hover:border-magenta hover:text-magenta disabled:opacity-50"
        >
          {busy ? <Spinner /> : <ImagePlus className="h-6 w-6" strokeWidth={1.5} />}
          <span className="text-xs">Drop an image here or click to upload</span>
        </button>
      )}

      <input ref={inputRef} type="file" accept={IMAGE_ACCEPT} className="hidden"
        onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />

      {/* The size/ratio guidance sits directly under the upload control, on
          purpose — visible before the admin picks a file, not just after a
          rejection. */}
      <p className="mt-2 text-[11px] text-ink-soft">
        Recommended size: 1300 × 500px (~2.6:1 ratio), JPG or PNG, max 2MB.
      </p>

      {ratioWarning && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {ratioWarning}
        </p>
      )}
      {error && <p className="mt-2 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
