/* =================================================================== *
 * skin.script admin — product image manager
 * -------------------------------------------------------------------
 * Upload, reorder and delete a product's gallery. Position 0 is the front
 * shot — the one the ProductCard and every listing uses — so it's labelled
 * explicitly rather than left as an invisible convention the client has to
 * learn from trial and error.
 *
 * All Storage work goes through lib/api/media.js, which rolls back the
 * uploaded file if the database row fails to insert.
 * =================================================================== */
import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ImagePlus, Star, Trash2 } from "lucide-react";
import { supabase } from "../../lib/api/client.js";
import { deleteProductImage, publicImageUrl, uploadProductImage } from "../../lib/api/media.js";
import { Btn, Spinner } from "./kit.jsx";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,image/avif";

export default function ImageManager({ productId, images = [], onChange, disabled }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleFiles(fileList) {
    const files = [...fileList];
    if (!files.length) return;

    const tooBig = files.find((f) => f.size > MAX_BYTES);
    if (tooBig) return setError(`“${tooBig.name}” is larger than 5 MB. Please compress it first.`);

    setBusy(true); setError(null);
    let position = images.length;
    for (const file of files) {
      const { error } = await uploadProductImage(productId, file, { position, alt: "" });
      if (error) { setError(error.message); break; }
      position += 1;
    }
    setBusy(false);
    onChange();
  }

  async function remove(image) {
    setBusy(true);
    const { error } = await deleteProductImage(image);
    setBusy(false);
    if (error) setError(error.message);
    else onChange();
  }

  /** Swap two images' positions. Done as two writes because `position` has a
   *  unique constraint per product — a direct swap would collide, so we park
   *  one row at a temporary negative position first. */
  async function move(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const a = images[index], b = images[target];

    setBusy(true);
    await supabase.from("product_images").update({ position: -1 }).eq("id", a.id);
    await supabase.from("product_images").update({ position: a.position }).eq("id", b.id);
    await supabase.from("product_images").update({ position: b.position }).eq("id", a.id);
    setBusy(false);
    onChange();
  }

  async function setAlt(image, alt) {
    await supabase.from("product_images").update({ alt }).eq("id", image.id);
    onChange();
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((img, i) => (
          <div key={img.id} className="group relative overflow-hidden rounded-xl bg-snow ring-1 ring-line">
            <img
              src={publicImageUrl(img.storage_path)} alt={img.alt || ""}
              className="aspect-[3/4] w-full object-cover"
              loading="lazy"
            />
            {i === 0 && (
              <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-ink/80 px-2 py-0.5 text-[10px] font-medium text-white">
                <Star className="h-2.5 w-2.5 fill-current" /> Main
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-ink/70 p-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              <button onClick={() => move(i, -1)} disabled={i === 0 || disabled} className="rounded p-1 text-white disabled:opacity-30" aria-label="Move earlier">
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => move(i, 1)} disabled={i === images.length - 1 || disabled} className="rounded p-1 text-white disabled:opacity-30" aria-label="Move later">
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => remove(img)} disabled={disabled} className="rounded p-1 text-white hover:text-red-300" aria-label="Delete image">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <input
              defaultValue={img.alt ?? ""} placeholder="Describe this image"
              onBlur={(e) => e.target.value !== (img.alt ?? "") && setAlt(img, e.target.value)}
              className="w-full border-t border-line bg-white px-2 py-1.5 text-[11px] text-ink outline-none placeholder:text-ink-soft/60"
            />
          </div>
        ))}

        <button
          type="button" onClick={() => inputRef.current?.click()} disabled={disabled || busy}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
          className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line text-ink-soft transition-colors hover:border-magenta hover:text-magenta disabled:opacity-50"
        >
          {busy ? <Spinner /> : <ImagePlus className="h-6 w-6" strokeWidth={1.5} />}
          <span className="px-3 text-center text-[11px]">Drop images here or click to upload</span>
        </button>
      </div>

      <input
        ref={inputRef} type="file" accept={ACCEPT} multiple className="hidden"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
      />

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      <p className="mt-3 text-[11px] text-ink-soft">
        The first image is what shoppers see in listings. JPEG, PNG or WebP, up to 5 MB each.
      </p>

      {images.length === 0 && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          With no image, this product falls back to a coloured gradient card on the storefront.
        </p>
      )}
    </div>
  );
}

/** Single-image picker for CMS slots (hero background, banners…). Uploads to
 *  the same bucket under a `content/` prefix and returns the storage path. */
export function SingleImageField({ label, value, onChange, hint }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function upload(file) {
    if (!file) return;
    if (file.size > MAX_BYTES) return setError("Image must be under 5 MB.");
    setBusy(true); setError(null);

    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `content/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("product-images")
      .upload(path, file, { cacheControl: "31536000", upsert: false });

    setBusy(false);
    if (error) setError(error.message);
    else onChange(path);
  }

  return (
    <div>
      {label && (
        <span className="mb-1.5 flex items-baseline gap-2">
          <span className="text-xs font-medium text-ink">{label}</span>
          {hint && <span className="text-[11px] text-ink-soft">{hint}</span>}
        </span>
      )}
      <div className="flex items-start gap-3">
        {value ? (
          <img src={publicImageUrl(value)} alt="" className="h-24 w-20 rounded-xl object-cover ring-1 ring-line" />
        ) : (
          <div className="grid h-24 w-20 place-items-center rounded-xl bg-snow ring-1 ring-line">
            <ImagePlus className="h-5 w-5 text-ink-soft" strokeWidth={1.5} />
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Btn type="button" size="sm" variant="secondary" loading={busy} onClick={() => inputRef.current?.click()}>
            {value ? "Replace" : "Upload"}
          </Btn>
          {value && (
            <Btn type="button" size="sm" variant="ghost" onClick={() => onChange("")}>Remove</Btn>
          )}
        </div>
      </div>
      <input ref={inputRef} type="file" accept={ACCEPT} className="hidden"
        onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
      {error && <p className="mt-2 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
