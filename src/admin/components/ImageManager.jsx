/* =================================================================== *
 * skin.theory admin — product image manager
 * -------------------------------------------------------------------
 * Upload (drag-and-drop or click), drag-to-reorder, replace, and delete a
 * product's gallery — 0 to MAX_IMAGES images, laid out on a fluid auto-fit
 * grid so the tile count drives the layout instead of a fixed column count.
 * Replace swaps the file behind one existing slot in place (same position,
 * alt text and spot in the order) — the gap plain delete-then-add left,
 * since Add always appends at the end rather than refilling the slot that
 * was just emptied.
 * Position 0 is the front shot — the one ProductCard and every listing
 * uses — labelled explicitly ("Main") rather than left as an invisible
 * convention.
 *
 * All Storage/DB work goes through lib/api/media.js, which already does the
 * safety-critical parts (rollback the uploaded file if the DB insert fails;
 * delete the DB row before the Storage object) — unchanged by this file.
 * The one addition there, `reorderProductImages`, is a pure extension of
 * the position-swap trick this component already used for its old
 * adjacent-only reorder.
 * =================================================================== */
import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Play, RefreshCw, Star, X, Plus } from "lucide-react";
import { supabase } from "../../lib/api/client.js";
import {
  deleteProductImage, deleteProductVideo, publicImageUrl, publicVideoUrl,
  replaceProductImage, reorderProductImages, uploadProductImage, uploadProductVideo,
} from "../../lib/api/media.js";
import { Btn, ConfirmModal, Spinner } from "./kit.jsx";

const MAX_BYTES = 5 * 1024 * 1024;
// Storefront note: the PDP gallery (Gallery.jsx) only ever shows the first
// PDP_VISIBLE_THUMBS (6) thumbnails inline — anything past that collapses
// into a single "+N more" tile that opens the full set in the lightbox, so
// raising this doesn't clutter the customer-facing gallery. This admin
// grid itself always shows every slot; only the storefront collapses.
const MAX_IMAGES = 12;
// 15 MB caps a short (~30–60s), 720p H.264 clip — long enough for a real
// "how to use" demo, small enough not to blow through a shopper's mobile
// data just loading a product page. MP4/WebM only: universally playable in
// <video>, no server-side transcoding step exists for anything else.
const MAX_VIDEO_BYTES = 15 * 1024 * 1024;
const VIDEO_ACCEPT = "video/mp4,video/webm";
const VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);
// HEIC files never appear in this list: they're converted to JPEG client-side
// before this check ever runs (see convertIfHeic).
const ACCEPT = "image/jpeg,image/png,image/webp,image/avif";
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

function isHeic(file) {
  return /\.(heic|heif)$/i.test(file.name) || /^image\/hei[cf]/i.test(file.type);
}

/** HEIC has no reliable browser decode/preview support, so it's converted to
 *  a normal JPEG before anything else touches it — validation, preview, and
 *  upload all then see a completely ordinary image/jpeg file. The backend
 *  and Storage bucket never need to know HEIC was ever involved. */
async function convertIfHeic(file) {
  if (!isHeic(file)) return file;
  const heic2any = (await import("heic2any")).default;
  const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
  const blob = Array.isArray(out) ? out[0] : out;
  return new File([blob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), { type: "image/jpeg" });
}

/** Shared HEIC-convert + type/size validation, factored out so a single
 *  replace (one file, immediate) and the multi-file add flow (per-file,
 *  staged progress) don't drift out of sync on what counts as a valid
 *  photo. Returns the (possibly HEIC->JPEG converted) file, or an error
 *  string — never both. */
async function validateImage(original) {
  let file;
  try {
    file = await convertIfHeic(original);
  } catch {
    return { file: null, error: "Couldn't convert this HEIC photo. Try exporting it as JPEG first." };
  }
  if (!IMAGE_TYPES.has(file.type)) {
    return { file: null, error: "Not a supported image type (JPEG, PNG, WebP, AVIF, or HEIC)." };
  }
  if (file.size > MAX_BYTES) {
    return { file: null, error: "Larger than 5 MB — please compress it first." };
  }
  return { file, error: null };
}

export default function ImageManager({ productId, images = [], onChange, disabled }) {
  const inputRef = useRef(null);
  const replaceInputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // { [tempKey]: { name, stage: "converting"|"uploading"|"saving", error } }
  const [inFlight, setInFlight] = useState({});
  const [removing, setRemoving] = useState(null);
  // The exact image row a Replace click targets — set right before opening
  // the (shared, hidden) file picker, read back once a file is chosen. One
  // input serves every tile rather than one-per-tile, same reasoning as the
  // single `inputRef` above for Add.
  const [replaceTarget, setReplaceTarget] = useState(null);
  const [replacingId, setReplacingId] = useState(null);
  const [insertTargetIndex, setInsertTargetIndex] = useState(null);
  const insertInputRef = useRef(null);
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const [order, setOrder] = useState(null); // local optimistic order while dragging
  const [optimisticImages, setOptimisticImages] = useState(images);
  const [pressTimer, setPressTimer] = useState(null);

  useEffect(() => {
    setOptimisticImages(images);
  }, [images]);

  const shown = order ?? optimisticImages;
  const roomLeft = MAX_IMAGES - images.length;

  const setStage = (key, patch) =>
    setInFlight((f) => ({ ...f, [key]: { ...f[key], ...patch } }));
  const clearStage = (key) =>
    setInFlight((f) => { const n = { ...f }; delete n[key]; return n; });

  async function handleFiles(fileList) {
    const incoming = [...fileList];
    if (!incoming.length) return;
    /* Re-entrancy guard. `position` for a new upload is derived from
     * `images.length`, which only advances once the parent re-fetches after
     * this call's onChange() — so a second call starting before that lands
     * would see the same stale count and both uploads could claim the same
     * position (product_images has a unique (product_id, position) index,
     * so one insert would fail). The visible Add button is already disabled
     * while busy; this guards the same thing at the data layer, in case
     * something ever calls handleFiles a second way (e.g. a second drop
     * event on the tile while the first is still in flight). */
    if (busy) return;
    setError(null);

    const accepted = incoming.slice(0, Math.max(roomLeft, 0));
    if (incoming.length > accepted.length) {
      setError(
        accepted.length === 0
          ? `This product already has the maximum of ${MAX_IMAGES} images.`
          : `Only ${accepted.length} of ${incoming.length} files added — that's the ${MAX_IMAGES}-image limit for this product.`
      );
    }
    if (!accepted.length) return;

    let positionOffset = 0;
    const uploadedImages = [];

    // Sequential, not Promise.all: `position` must be assigned in the order
    // files were dropped, and parallel uploads would race that assignment.
    for (const original of accepted) {
      const key = `${original.name}-${Date.now()}-${Math.random()}`;
      const previewUrl = URL.createObjectURL(original);
      setStage(key, { name: original.name, stage: "converting", error: null, previewUrl });

      const { file, error: validationError } = await validateImage(original);
      if (validationError) {
        setStage(key, { stage: "error", error: validationError });
        setTimeout(() => clearStage(key), 4000);
        continue;
      }

      setStage(key, { stage: "uploading" });
      const tempPos = 10000 + Math.floor(Math.random() * 1000000) + positionOffset;
      const { data, error: upErr } = await uploadProductImage(productId, file, { position: tempPos, alt: "" });
      if (upErr) {
        setStage(key, { stage: "error", error: "Upload failed — please try again." });
        setTimeout(() => clearStage(key), 4000);
        continue;
      }
      if (data) uploadedImages.push(data);
      clearStage(key);
      positionOffset += 1;
    }

    if (uploadedImages.length > 0) {
      const newOrder = [...images, ...uploadedImages];
      await reorderProductImages(newOrder.map(img => img.id));
    }

    setBusy(false);
    onChange();
  }

  async function handleInsertFiles(fileList) {
    const incoming = [...fileList];
    if (!incoming.length) return;
    if (busy || insertTargetIndex === null) return;
    setError(null);

    const accepted = incoming.slice(0, Math.max(roomLeft, 0));
    if (incoming.length > accepted.length) {
      setError(
        accepted.length === 0
          ? `This product already has the maximum of ${MAX_IMAGES} images.`
          : `Only ${accepted.length} of ${incoming.length} files added — that's the ${MAX_IMAGES}-image limit for this product.`
      );
    }
    if (!accepted.length) return;

    setBusy(true);
    let positionOffset = 0;
    const uploadedImages = [];

    for (const original of accepted) {
      const key = `${original.name}-${Date.now()}-${Math.random()}`;
      const previewUrl = URL.createObjectURL(original);
      setStage(key, { name: original.name, stage: "converting", error: null, previewUrl });

      const { file, error: validationError } = await validateImage(original);
      if (validationError) {
        setStage(key, { stage: "error", error: validationError });
        setTimeout(() => clearStage(key), 4000);
        continue;
      }

      setStage(key, { stage: "uploading" });
      // Use a high random position temporarily to avoid collisions. Reorder will fix this right after.
      const tempPos = 10000 + Math.floor(Math.random() * 1000000) + positionOffset;
      const { data, error: upErr } = await uploadProductImage(productId, file, { position: tempPos, alt: "" });
      if (upErr) {
        setStage(key, { stage: "error", error: "Upload failed — please try again." });
        setTimeout(() => clearStage(key), 4000);
        continue;
      }
      if (data) {
        uploadedImages.push(data);
      }
      clearStage(key);
      positionOffset += 1;
    }

    if (uploadedImages.length > 0) {
      const newOrder = [...images];
      newOrder.splice(insertTargetIndex, 0, ...uploadedImages);
      await reorderProductImages(newOrder.map(img => img.id));
    }

    setBusy(false);
    setInsertTargetIndex(null);
    onChange();
  }

  async function setAlt(image, alt) {
    await supabase.from("product_images").update({ alt }).eq("id", image.id);
    onChange();
  }

  async function confirmRemove() {
    if (!removing) return;
    setBusy(true);
    const { error } = await deleteProductImage(removing);
    setBusy(false);
    setRemoving(null);
    if (error) setError(error.message);
    else onChange();
  }

  /** Swap the file behind one existing gallery slot in place — the target
   *  row's id/position/alt/label are untouched; only which file it points
   *  at changes. No confirmation modal, matching SingleImageField's
   *  immediate-on-pick Replace elsewhere in this file: a wrong pick here is
   *  a second click away from being un-done, same as swapping a CMS banner. */
  async function handleReplace(picked) {
    const target = replaceTarget;
    setReplaceTarget(null);
    if (!picked || !target) return;

    setError(null);
    setReplacingId(target.id);
    const previewUrl = URL.createObjectURL(picked);
    setStage(`replace-${target.id}`, { previewUrl });

    // Validate async without blocking render of the preview
    const { file, error: validationError } = await validateImage(picked);
    if (validationError) {
      setReplacingId(null);
      setError(validationError);
      clearStage(`replace-${target.id}`);
      return;
    }

    const { error } = await replaceProductImage(productId, target, file);
    setReplacingId(null);
    clearStage(`replace-${target.id}`);
    if (error) setError(error.message);
    else onChange();
  }

  /* ---- Drag-to-reorder — native HTML5 DnD, no dependency needed. ---- */
  const onDragStart = useCallback((i) => (e) => {
    if (disabled) return;
    setDragIndex(i);
    setOrder(images);
    e.dataTransfer.effectAllowed = "move";
  }, [disabled, images]);

  const onDragOver = useCallback((i) => (e) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === i) return;
    setOverIndex(i);
    setOrder((cur) => {
      const list = [...(cur ?? images)];
      const [moved] = list.splice(dragIndex, 1);
      list.splice(i, 0, moved);
      return list;
    });
    setDragIndex(i);
  }, [dragIndex, images]);

  const onDragEnd = useCallback(async () => {
    setOverIndex(null);
    setDragIndex(null);
    const finalOrder = order;
    if (!finalOrder) return;
    if (finalOrder.every((img, i) => img.id === optimisticImages[i]?.id)) {
      setOrder(null);
      return;
    }

    // Instantly commit locally
    setOptimisticImages(finalOrder);
    setOrder(null);

    const { error } = await reorderProductImages(finalOrder.map((img) => img.id));
    if (error) {
      setError(error.message);
      setOptimisticImages(images); // rollback on fail
    }
    onChange();
  }, [order, optimisticImages, images, onChange]);

  /* ---- Touch-to-reorder (Mobile polyfill) ---- */
  const onTouchStart = useCallback((i) => (e) => {
    if (disabled) return;
    const timer = setTimeout(() => {
      setDragIndex(i);
      setOrder(images);
      document.body.style.overflow = "hidden"; // Prevent pull-to-refresh / scrolling
      if (navigator.vibrate) navigator.vibrate(50);
    }, 400);
    setPressTimer(timer);
  }, [disabled, images]);

  const onTouchMove = useCallback((e) => {
    if (dragIndex === null) {
      if (pressTimer) {
        clearTimeout(pressTimer);
        setPressTimer(null);
      }
      return;
    }
    const touch = e.touches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!target) return;

    const dropZone = target.closest("[data-index]");
    if (dropZone) {
      const i = parseInt(dropZone.getAttribute("data-index"), 10);
      if (i !== dragIndex && i !== overIndex) {
        setOverIndex(i);
        setOrder((cur) => {
          const list = [...(cur ?? images)];
          const [moved] = list.splice(dragIndex, 1);
          list.splice(i, 0, moved);
          return list;
        });
        setDragIndex(i);
      }
    }
  }, [dragIndex, overIndex, images]);

  const onTouchEnd = useCallback(async () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      setPressTimer(null);
    }
    document.body.style.overflow = "";
    if (dragIndex === null) return;
    setOverIndex(null);
    setDragIndex(null);
    
    const finalOrder = order;
    if (!finalOrder) return;
    if (finalOrder.every((img, i) => img.id === optimisticImages[i]?.id)) {
      setOrder(null);
      return;
    }

    // Instantly commit locally
    setOptimisticImages(finalOrder);
    setOrder(null);

    const { error } = await reorderProductImages(finalOrder.map((img) => img.id));
    if (error) {
      setError(error.message);
      setOptimisticImages(images); // rollback on fail
    }
    onChange();
  }, [order, optimisticImages, images, onChange, dragIndex]);

  return (
    <div>
      {/* Auto-fit: the browser decides how many tiles fit per row at the
          viewport's actual width, so any count up to MAX_IMAGES lays out
          cleanly with no leftover empty cells and no JS breakpoint logic to
          keep in sync with the design.

          aspect-[4/5] on every tile below (grid, in-flight, add-button) is
          deliberately the SAME crop the storefront uses for this image —
          ProductCard's shop-grid tile and Gallery's PDP stage are both
          aspect-[4/5]. It used to be 3/4, a ratio nothing on the storefront
          actually renders at, so an admin framing a photo by eye here was
          previewing a crop shoppers would never see. */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}
      >
        {shown.map((img, i) => (
          <div
            key={img.id}
            data-index={i}
            draggable={!disabled}
            onDragStart={onDragStart(i)}
            onDragOver={onDragOver(i)}
            onDragEnd={onDragEnd}
            onDrop={(e) => e.preventDefault()}
            onTouchStart={onTouchStart(i)}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            className={`group relative cursor-grab overflow-hidden rounded-xl bg-snow ring-1 ring-line active:cursor-grabbing ${
              overIndex === i ? "ring-2 ring-magenta" : ""
            }`}
          >
            <img
              src={publicImageUrl(img.storage_path)} alt={img.alt || ""}
              className="aspect-[4/5] w-full select-none object-cover"
              loading="lazy" draggable={false}
            />
            {i === 0 && (
              <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-ink/80 px-2 py-0.5 text-[10px] font-medium text-white">
                <Star className="h-2.5 w-2.5 fill-current" /> Main
              </span>
            )}
            {replacingId === img.id && (
              <>
                {inFlight[`replace-${img.id}`]?.previewUrl && (
                  <img src={inFlight[`replace-${img.id}`].previewUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                )}
                <div className="absolute inset-0 grid place-items-center bg-ink/50">
                  <Spinner className="h-5 w-5 text-white" />
                </div>
              </>
            )}
            {!disabled && replacingId !== img.id && (
              <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-100 lg:opacity-0 transition-opacity lg:group-hover:opacity-100 focus-within:opacity-100">
                {roomLeft > 0 && (
                  <button
                    onClick={() => { setInsertTargetIndex(i); insertInputRef.current?.click(); }}
                    className="rounded-full bg-ink/70 p-1 text-white hover:bg-ink"
                    aria-label="Insert image before"
                    title="Insert new photo before this one"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => { setReplaceTarget(img); replaceInputRef.current?.click(); }}
                  className="rounded-full bg-ink/70 p-1 text-white hover:bg-ink"
                  aria-label="Replace image"
                  title="Replace this photo"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setRemoving(img)}
                  className="rounded-full bg-ink/70 p-1 text-white hover:bg-red-600"
                  aria-label="Delete image"
                  title="Delete this photo"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <input
              defaultValue={img.alt ?? ""} placeholder="Label (e.g. Texture, Ingredients)" disabled={disabled}
              onBlur={(e) => e.target.value !== (img.alt ?? "") && setAlt(img, e.target.value)}
              className="w-full border-t border-line bg-white px-2 py-1.5 text-[11px] text-ink outline-none placeholder:text-ink-soft/60"
            />
          </div>
        ))}

        {Object.entries(inFlight).map(([key, f]) => {
          if (key.startsWith("replace-")) return null; // rendered inside the tile
          return (
            <div key={key} className="relative flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-xl bg-snow text-center ring-1 ring-line overflow-hidden">
              {f.previewUrl && (
                <img src={f.previewUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
              )}
              <div className="relative z-10 flex flex-col items-center gap-2 rounded-lg bg-white/80 px-2 py-1 backdrop-blur-sm">
                {f.stage === "error" ? (
                  <>
                    <X className="h-5 w-5 text-red-500" />
                    <span className="text-[11px] leading-snug text-red-600">{f.error}</span>
                  </>
                ) : (
                  <>
                    <Spinner className="h-5 w-5" />
                    <span className="text-[11px] leading-snug text-ink-soft">
                      {f.stage === "converting" ? "Converting…" : f.stage === "saving" ? "Saving…" : "Uploading…"}
                    </span>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {/* The single add tile — appears after the last real image, or alone
            as the empty-state prompt when the product has none yet. Never
            more than one, regardless of how many images already exist. */}
        {roomLeft > 0 && (
          <button
            type="button" onClick={() => inputRef.current?.click()} disabled={disabled || busy}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
            className="flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line text-ink-soft transition-colors hover:border-magenta hover:text-magenta disabled:opacity-50"
          >
            <ImagePlus className="h-6 w-6" strokeWidth={1.5} />
            <span className="px-3 text-center text-[11px]">
              {images.length === 0 ? "Drop images here or click to upload" : `Add photo${roomLeft > 1 ? "s" : ""}`}
            </span>
          </button>
        )}
      </div>

      <input
        ref={inputRef} type="file" accept={ACCEPT} multiple disabled={disabled || busy} className="hidden"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
      />
      <input
        ref={replaceInputRef} type="file" accept={ACCEPT} disabled={disabled} className="hidden"
        onChange={(e) => { handleReplace(e.target.files?.[0]); e.target.value = ""; }}
      />
      <input
        ref={insertInputRef} type="file" accept={ACCEPT} multiple disabled={disabled || busy} className="hidden"
        onChange={(e) => { handleInsertFiles(e.target.files); e.target.value = ""; }}
      />

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      <p className="mt-3 text-[11px] text-ink-soft">
        The first image is what shoppers see in listings — drag any photo to the front to make it the main one.
        The label under each photo shows on the storefront gallery thumbnail exactly as typed — leave it blank
        to show nothing. JPEG, PNG, WebP, AVIF or HEIC (auto-converted), up to 5 MB each, {MAX_IMAGES} max.
      </p>

      {images.length === 0 && Object.keys(inFlight).length === 0 && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          With no image, this product falls back to a coloured gradient card on the storefront.
        </p>
      )}

      <ConfirmModal
        open={!!removing} onClose={() => setRemoving(null)} danger
        title="Delete this image?"
        confirmLabel="Delete"
        body="This removes it from the product permanently — it can't be undone."
        onConfirm={confirmRemove}
      />
    </div>
  );
}

/** Single-image picker for CMS slots (hero background, banners…). Uploads to
 *  the same bucket under a `content/` prefix and returns the storage path.
 *  Unrelated to ImageManager's product gallery — kept here only because both
 *  share this file historically. Not touched by this change. */
export function SingleImageField({ label, value, onChange, hint }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function upload(file) {
    if (!file) return;
    if (file.size > MAX_BYTES) return setError("Image must be under 5 MB.");
    setBusy(true); setError(null);

    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `content/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("product-images")
        .upload(path, file, { cacheControl: "31536000", upsert: false });

      if (error) setError(error.message);
      else onChange(path);
    } catch (e) {
      // A thrown (not returned) error — network drop, storage misconfig —
      // must still clear `busy`, or the button is stuck disabled-looking
      // ("not clickable") for the rest of the session with no explanation.
      setError(e.message || "Upload failed. Please try again.");
    } finally {
      setBusy(false);
    }
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

/** One optional product video (0023_product_video.sql) — separate from
 *  ImageManager's photo grid since a product has at most one, uploaded and
 *  replaced as a single slot rather than a reorderable list. Storage/DB
 *  work goes through lib/api/media.js's uploadProductVideo/deleteProductVideo,
 *  which point `products.video_url` at the file the same way ImageManager
 *  points `product_images` rows at theirs. */
export function VideoField({ productId, videoPath, onChange, disabled }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [removing, setRemoving] = useState(false);
  // A video already exists and a new file was picked to go in its place —
  // held here, NOT uploaded yet, until the admin explicitly confirms the
  // replace in the modal below. A silent overwrite-on-upload is exactly how
  // the hero video got accidentally destroyed before; a single slot (as
  // opposed to the photo grid, where a new upload only ever ADDS a tile)
  // makes every video upload after the first one a replace, so it's the one
  // upload path that needs this extra step.
  const [pendingReplace, setPendingReplace] = useState(null);

  function validate(file) {
    if (!VIDEO_TYPES.has(file.type)) {
      setError("Not a supported video type — MP4 or WebM only.");
      return false;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      setError(`Larger than ${MAX_VIDEO_BYTES / 1024 / 1024} MB — please compress it first.`);
      return false;
    }
    return true;
  }

  async function doUpload(file) {
    setError(null);
    setBusy(true);
    const oldPath = videoPath;
    const { error: upErr } = await uploadProductVideo(productId, file);
    if (upErr) {
      setBusy(false);
      return setError("Upload failed — please try again.");
    }
    // Replacing an existing video: the DB now points at the new file, so the
    // old one is a pure orphan — remove it. Best-effort: the swap already
    // succeeded either way, so a cleanup failure here isn't surfaced as an
    // upload error (same reasoning as deleteProductImage's storage removal).
    if (oldPath) await supabase.storage.from("site-media").remove([oldPath]);
    setBusy(false);
    onChange();
  }

  function handleFile(file) {
    if (!file || busy) return;
    setError(null);
    if (!validate(file)) return;
    // First upload for this product — nothing to overwrite, so this is
    // unambiguously an ADD, not a replace. No confirmation needed, same as
    // adding a new photo to the grid.
    if (!videoPath) return doUpload(file);
    // A video already exists: this file would replace it. Hold it and ask
    // first, rather than uploading immediately.
    setPendingReplace(file);
  }

  function confirmReplace() {
    const file = pendingReplace;
    setPendingReplace(null);
    if (file) doUpload(file);
  }

  async function confirmRemove() {
    if (!videoPath) return;
    setBusy(true);
    const { error } = await deleteProductVideo(productId, videoPath);
    setBusy(false);
    setRemoving(false);
    if (error) setError(error.message);
    else onChange();
  }

  return (
    <div>
      <div className="flex items-start gap-3">
        {videoPath ? (
          <video
            src={publicVideoUrl(videoPath)} controls muted playsInline
            className="h-32 w-48 rounded-xl bg-ink object-cover ring-1 ring-line"
          />
        ) : (
          <div className="grid h-32 w-48 place-items-center rounded-xl bg-snow ring-1 ring-line">
            <Play className="h-6 w-6 text-ink-soft" strokeWidth={1.5} />
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Btn type="button" size="sm" variant="secondary" loading={busy} disabled={disabled}
            onClick={() => inputRef.current?.click()}>
            {videoPath ? "Replace" : "Upload video"}
          </Btn>
          {videoPath && !disabled && (
            <Btn type="button" size="sm" variant="ghost" onClick={() => setRemoving(true)}>Remove</Btn>
          )}
        </div>
      </div>
      <input ref={inputRef} type="file" accept={VIDEO_ACCEPT} disabled={disabled || busy} className="hidden"
        onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ""; }} />
      {error && <p className="mt-2 text-[11px] text-red-600">{error}</p>}
      <p className="mt-3 text-[11px] text-ink-soft">
        Shows as a playable "Video" tab next to the photos on the product page. MP4 or WebM, up to{" "}
        {MAX_VIDEO_BYTES / 1024 / 1024} MB — keep it short (~30–60s) so it doesn't eat into a shopper's mobile data.
      </p>

      <ConfirmModal
        open={removing} onClose={() => setRemoving(false)} danger
        title="Remove this video?"
        confirmLabel="Remove"
        body="This removes it from the product permanently — it can't be undone."
        onConfirm={confirmRemove}
      />

      <ConfirmModal
        open={!!pendingReplace} onClose={() => setPendingReplace(null)} danger
        title="Replace the current video?"
        confirmLabel="Replace"
        body="The existing video will be permanently removed and can't be recovered. The new file will take its place."
        onConfirm={confirmReplace}
      />
    </div>
  );
}
