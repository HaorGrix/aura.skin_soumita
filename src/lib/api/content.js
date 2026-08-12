/* =================================================================== *
 * skin.theory — storefront-side CMS reader
 * -------------------------------------------------------------------
 * The read half of the admin's Content screens. Whatever the client saves
 * in /admin/content lands here.
 *
 * The governing rule: THE STOREFRONT MUST NEVER BREAK BECAUSE OF THIS.
 * A missing content_blocks row, an un-run migration, an offline Supabase, a
 * half-filled form — every one of those falls back to the defaults declared
 * in the slot schema, which are the same strings that were hardcoded in the
 * components before the CMS existed. So the worst case is "the site shows
 * what it showed yesterday", never a blank hero or a crash.
 *
 * That is also why this returns content synchronously on first render (from
 * defaults) and swaps in the saved values when the fetch resolves: no
 * loading spinner on the hero, no layout shift from an empty state.
 * =================================================================== */
import { useEffect, useState } from "react";
// Both from the schema module, which imports nothing — see defaultsFor's note.
import { defaultsFor, schemaFor } from "./admin/schemas.js";
// SDK-free URL builder, not media.js — see the dynamic import below.
import { publicUrl } from "./storage-url.js";

/** In-memory cache — several components read the same slot (footer, nav) and
 *  the content is immutable for the lifetime of a page view. */
const cache = new Map();

/**
 * Fetch one content block. Never throws, never returns null: on any failure
 * you get the schema defaults, so callers can render unconditionally.
 */
export async function getContent(slot) {
  if (cache.has(slot)) return cache.get(slot);

  const fallback = defaultsFor(schemaFor(slot));

  // The Supabase client is imported dynamically on purpose. <Hero> is on the
  // eager homepage path, so a static import would put the whole SDK (~200 kB)
  // in the initial bundle just to fetch a headline — and since useContent
  // renders the defaults first anyway, none of it is needed for first paint.
  // A failed import (offline, blocked) falls through to the defaults like any
  // other failure.
  let data, error;
  try {
    const { supabase } = await import("./client.js");
    ({ data, error } = await supabase
      .from("content_blocks")
      .select("payload")
      .eq("slot", slot)
      .maybeSingle());
  } catch (e) {
    error = e;
  }

  // error → table missing / RLS / offline. No row → never edited.
  // Both mean "use what the component always used".
  const payload = error || !data?.payload ? fallback : { ...fallback, ...data.payload };

  cache.set(slot, payload);
  return payload;
}

/**
 * Read a content slot in a component.
 *
 * Returns the defaults on the very first render, then re-renders once with
 * the saved values. `ready` tells you whether the fetch has settled, for the
 * rare case where you need to defer an animation until the real copy lands.
 */
export function useContent(slot) {
  const [content, setContent] = useState(() => cache.get(slot) ?? defaultsFor(schemaFor(slot)));
  const [ready, setReady] = useState(() => cache.has(slot));

  useEffect(() => {
    if (cache.has(slot)) {
      setContent(cache.get(slot));
      setReady(true);
      return;
    }
    let alive = true;
    getContent(slot).then((payload) => {
      if (!alive) return;
      setContent(payload);
      setReady(true);
    });
    return () => { alive = false; };
  }, [slot]);

  return { content, ready };
}

/**
 * Resolve an image field from a CMS payload to a URL.
 *
 * CMS images are Storage paths; the components they replace used bundled
 * imports. `fallbackUrl` is that original bundled asset, so an unset field
 * keeps rendering the designed image rather than a broken <img>.
 */
export function contentImage(path, fallbackUrl = null) {
  if (!path) return fallbackUrl;
  // Already an absolute URL (e.g. someone pasted one in) — pass it through.
  if (/^https?:\/\//i.test(path)) return path;
  return publicUrl(path) ?? fallbackUrl;
}

const VIDEO_EXTENSIONS = new Set(["mp4", "webm"]);

/** True if a CMS media path/URL is a video, false for images (default). */
export function isVideoPath(path) {
  const clean = (path ?? "").split("?")[0];
  const ext = clean.split(".").pop()?.toLowerCase();
  return VIDEO_EXTENSIONS.has(ext);
}

/** Same as contentImage but for the `media` field type (site-media bucket,
 *  which — unlike product-images — also holds video). */
export function contentMedia(path, fallbackUrl = null) {
  if (!path) return fallbackUrl;
  if (/^https?:\/\//i.test(path)) return path;
  return publicUrl(path, "site-media") ?? fallbackUrl;
}

/** Split a CMS headline into words for per-word entrance animations. */
export function words(text) {
  return String(text ?? "").trim().split(/\s+/).filter(Boolean);
}

/** Test seam / post-save invalidation. */
export function clearContentCache(slot) {
  if (slot) cache.delete(slot);
  else cache.clear();
}
