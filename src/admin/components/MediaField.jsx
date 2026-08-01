/* =================================================================== *
 * skin.script admin — CMS media picker (image OR video)
 * -------------------------------------------------------------------
 * Sibling to SingleImageField (ImageManager.jsx), which is image-only and
 * uploads into the product-images bucket. This uploads into `site-media`
 * (0011_hero_carousel_media.sql), which additionally allows mp4/webm and a
 * larger size cap — built for the Hero Carousel, but usable by any future
 * CMS field that needs mixed media.
 * =================================================================== */
import { useRef, useState } from "react";
import { Film, ImagePlus, Trash2 } from "lucide-react";
import { supabase } from "../../lib/api/client.js";
import { publicUrl } from "../../lib/api/storage-url.js";
import { Btn, Spinner } from "./kit.jsx";

const MAX_BYTES = 30 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm";
const VIDEO_EXT = new Set(["mp4", "webm"]);

export function isVideoPath(path) {
  const ext = (path ?? "").split(".").pop()?.toLowerCase();
  return VIDEO_EXT.has(ext);
}

export function siteMediaUrl(path) {
  return publicUrl(path, "site-media");
}

/**
 * Every `media` path referenced by a payload, walking both top-level fields
 * and repeating-list item fields.
 *
 * Used to diff a block's media BEFORE and AFTER a save so files the admin
 * removed (or replaced) can be deleted from Storage instead of lingering as
 * invisible orphans that only ever grow the bucket's bill.
 */
export function collectMediaPaths(schema, payload) {
  const out = new Set();
  if (!schema?.fields || !payload) return out;

  const add = (v) => { if (typeof v === "string" && v.trim()) out.add(v.trim()); };

  for (const f of schema.fields) {
    if (f.type === "media") add(payload[f.key]);
    if (f.type === "list" && Array.isArray(payload[f.key])) {
      for (const item of payload[f.key]) {
        for (const sf of f.itemFields ?? []) if (sf.type === "media") add(item?.[sf.key]);
      }
    }
  }
  return out;
}

/** Hard-delete files from the site-media bucket. */
export async function deleteSiteMedia(paths) {
  if (!paths.length) return { data: null, error: null };
  return supabase.storage.from("site-media").remove(paths);
}

export function MediaField({ label, value, onChange, hint }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function upload(file) {
    if (!file) return;
    if (file.size > MAX_BYTES) return setError("File must be under 30 MB.");
    setBusy(true); setError(null);

    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `hero/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("site-media")
      .upload(path, file, { cacheControl: "31536000", upsert: false });

    setBusy(false);
    if (error) setError(error.message);
    else onChange(path);
  }

  const isVideo = isVideoPath(value);

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
          isVideo ? (
            <video
              src={siteMediaUrl(value)} muted playsInline
              className="h-24 w-20 rounded-xl bg-ink object-cover ring-1 ring-line"
            />
          ) : (
            <img src={siteMediaUrl(value)} alt="" className="h-24 w-20 rounded-xl object-cover ring-1 ring-line" />
          )
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
            <Btn type="button" size="sm" variant="ghost" onClick={() => onChange("")}>
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </Btn>
          )}
          {isVideo && (
            <span className="inline-flex items-center gap-1 text-[10px] text-ink-soft">
              <Film className="h-3 w-3" /> Video
            </span>
          )}
        </div>
      </div>
      <input ref={inputRef} type="file" accept={ACCEPT} className="hidden"
        onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
      {error && <p className="mt-2 text-[11px] text-red-600">{error}</p>}
      {busy && <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-soft"><Spinner className="h-3 w-3" /> Uploading…</p>}

      {/* Size guidance sits next to the button on purpose — a spec buried in a
          doc gets ignored, and a wrongly-sized banner is only obvious once
          it's live. Numbers are measured from the real rendered tile, not
          guessed: the widest it ever gets is 1202 CSS px (2560px monitor),
          so 2400×1200 covers that at 2× pixel density. */}
      <div className="mt-2 rounded-lg bg-snow px-3 py-2 ring-1 ring-line">
        <p className="text-[11px] font-semibold text-ink">Recommended: 2400 × 1200 px &nbsp;·&nbsp; aspect ratio 2:1</p>
        <ul className="mt-1 space-y-0.5 text-[11px] text-ink-soft">
          <li>• Minimum 1920 × 960 px. Anything wider than 2400 px is wasted bytes.</li>
          <li>• The banner is shown <strong>uncropped</strong>, so any ratio is safe — but
            non-2:1 art gets soft blurred bars at the sides.</li>
          <li>• <strong>Video</strong> is cropped to fill, so 2:1 matters more: keep titles and
            logos away from the top/bottom edges.</li>
          <li>• JPEG, PNG, WebP, or MP4/WebM — up to 30 MB. Aim under 400 KB for
            images and 3 MB for video so the homepage stays fast.</li>
        </ul>
      </div>
    </div>
  );
}
