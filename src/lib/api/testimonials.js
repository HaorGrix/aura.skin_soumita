/* =================================================================== *
 * skin.theory — storefront testimonial reader
 * -------------------------------------------------------------------
 * THE STOREFRONT MUST NEVER BREAK BECAUSE OF THIS — same governing rule
 * as lib/api/content.js. A missing table, an un-run migration, an offline
 * Supabase, zero featured rows: every one of those means the homepage
 * testimonial section just doesn't render, never a crash or a blank card.
 *
 * The homepage shows the WHOLE featured set as a grid, not one card — the
 * admin decides how many are in rotation (1, 3, 9, whatever), and every one
 * of them shows at once as long as it fits within MAX_VISIBLE. Only past
 * that ceiling does the weekly rotation kick in: featured entries are
 * ranked once (text by rating desc, image by priority desc then created_at
 * desc, merged into one list), and the current ISO week number picks a
 * MAX_VISIBLE-sized WINDOW into that list, wrapping around — so the same
 * subset holds for everyone within a week, then quietly slides to the next
 * window at the week boundary, no cron job required, same "derived from
 * the calendar, not from stored state" trick the old single-pick version
 * used.
 * =================================================================== */
import { useEffect, useState } from "react";
import { publicUrl } from "./storage-url.js";

// How many cards the homepage grid ever shows in one go. Featuring at or
// under this many means the rotation below never engages — everything the
// admin featured just shows, always. Raise or lower freely; nothing else
// needs to change.
export const MAX_VISIBLE_TESTIMONIALS = 9;

let cache = null; // the ranked featured list, fetched once per page view

function isoWeekNumber(date) {
  // ISO-8601 week number — Thursday of the current week determines the
  // year the week belongs to, per the standard algorithm.
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function rank(rows) {
  const text = rows
    .filter((r) => r.type === "text")
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.priority ?? 0) - (a.priority ?? 0));
  const image = rows
    .filter((r) => r.type === "image")
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || new Date(b.created_at) - new Date(a.created_at));
  // Interleave rather than concatenate, so the weekly pick alternates
  // between quote cards and image cards instead of running through every
  // text quote before an image ever has a turn.
  const merged = [];
  for (let i = 0; i < Math.max(text.length, image.length); i++) {
    if (text[i]) merged.push(text[i]);
    if (image[i]) merged.push(image[i]);
  }
  return merged;
}

async function fetchFeatured() {
  if (cache) return cache;
  try {
    const { supabase } = await import("./client.js");
    const { data, error } = await supabase.from("testimonials").select("*").eq("is_featured", true);
    cache = error || !data?.length ? [] : rank(data);
  } catch {
    cache = [];
  }
  return cache;
}

/** This week's visible SET of testimonials — every featured entry when
 *  there are MAX_VISIBLE_TESTIMONIALS or fewer, else a rotating window of
 *  that size. Empty array (never null) when there's nothing featured, so
 *  callers can test `.length` directly; render nothing at length 0, exactly
 *  like a never-edited CMS slot. */
export function useFeaturedTestimonials() {
  const [testimonials, setTestimonials] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchFeatured().then((list) => {
      if (!alive) return;
      if (list.length <= MAX_VISIBLE_TESTIMONIALS) {
        setTestimonials(list);
      } else {
        const start = isoWeekNumber(new Date()) % list.length;
        setTestimonials(
          Array.from({ length: MAX_VISIBLE_TESTIMONIALS }, (_, i) => list[(start + i) % list.length])
        );
      }
      setReady(true);
    });
    return () => { alive = false; };
  }, []);

  return { testimonials, ready };
}

export function testimonialImageUrl(path) {
  return publicUrl(path, "site-media");
}

/** Test seam / post-save invalidation from the admin panel is out of scope
 *  here (this cache lives only for the current page view), but exported for
 *  symmetry with content.js's clearContentCache and for tests. */
export function clearTestimonialCache() {
  cache = null;
}
