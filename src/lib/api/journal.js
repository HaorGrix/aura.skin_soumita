/* =================================================================== *
 * skin.theory — storefront Journal reader
 * -------------------------------------------------------------------
 * THE STOREFRONT MUST NEVER BREAK BECAUSE OF THIS — same governing rule
 * as lib/api/testimonials.js and lib/api/content.js. A missing table, an
 * un-run migration, an offline Supabase, zero published articles: every
 * one of those means the Journal section/page just renders empty, never
 * a crash or a blank page.
 *
 * RLS on journal_articles only ever exposes status = 'published' rows to
 * anon/authenticated sessions — this file trusts that boundary rather
 * than re-filtering client-side.
 * =================================================================== */
import { useEffect, useState } from "react";
import { publicUrl } from "./storage-url.js";

let cache = null; // published articles, newest first — fetched once per page view

async function fetchPublished() {
  if (cache) return cache;
  try {
    const { supabase } = await import("./client.js");
    const { data, error } = await supabase
      .from("journal_articles")
      .select("*")
      .eq("status", "published")
      .order("published_at", { ascending: false });
    cache = error || !data ? [] : data;
  } catch {
    cache = [];
  }
  return cache;
}

/** All published articles, newest first. Empty array (never null) so
 *  callers can test `.length` directly. */
export function usePublishedArticles() {
  const [articles, setArticles] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchPublished().then((list) => {
      if (!alive) return;
      setArticles(list);
      setReady(true);
    });
    return () => { alive = false; };
  }, []);

  return { articles, ready };
}

/** The N most recent published articles — for the homepage teaser. */
export function useRecentArticles(limit = 3) {
  const { articles, ready } = usePublishedArticles();
  return { articles: articles.slice(0, limit), ready };
}

/** One published article by slug, or null if it doesn't exist / isn't
 *  published. Not cached against the list cache above — a direct fetch
 *  by slug so a freshly-shared link works even before the list cache
 *  (if any) has been populated. */
export function useArticleBySlug(slug) {
  const [article, setArticle] = useState(undefined); // undefined = loading
  useEffect(() => {
    let alive = true;
    setArticle(undefined);
    if (!slug) { setArticle(null); return; }
    (async () => {
      try {
        const { supabase } = await import("./client.js");
        const { data, error } = await supabase
          .from("journal_articles")
          .select("*")
          .eq("status", "published")
          .eq("slug", slug)
          .maybeSingle();
        if (!alive) return;
        setArticle(error ? null : data ?? null);
      } catch {
        if (alive) setArticle(null);
      }
    })();
    return () => { alive = false; };
  }, [slug]);
  return article;
}

export function journalImageUrl(path) {
  return publicUrl(path, "site-media");
}

/** Post-publish/edit/delete invalidation from the admin panel is out of
 *  scope (this cache lives only for the current page view), but exported
 *  for symmetry with clearTestimonialCache. */
export function clearJournalCache() {
  cache = null;
}
