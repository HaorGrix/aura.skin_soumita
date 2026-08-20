/* =================================================================== *
 * skin.theory admin — Journal articles CMS
 * -------------------------------------------------------------------
 * `journal_articles` (0042_journal_articles.sql) — RLS lets staff
 * (editor+) see every row; anon/authenticated only ever see
 * status = 'published' rows (enforced in Postgres, not just hidden by
 * this UI).
 *
 * Cover + inline body images upload into the existing `site-media`
 * bucket under a journal/ prefix — no new bucket or storage policy
 * needed, same reasoning as admin/testimonials.js.
 * =================================================================== */
import { supabase } from "../client.js";
import { publicUrl } from "../storage-url.js";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB, matches product image cap
export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";

export function journalImageUrl(path) {
  return publicUrl(path, "site-media");
}

export async function listJournalArticles({ search = "", status = "" } = {}) {
  let q = supabase.from("journal_articles").select("*").order("created_at", { ascending: false });
  if (search.trim()) q = q.ilike("title", `%${search.trim()}%`);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  return { data, error };
}

export async function getJournalArticle(id) {
  const { data, error } = await supabase.from("journal_articles").select("*").eq("id", id).maybeSingle();
  return { data, error };
}

/** Turn a title into a URL-safe slug: lowercase, non-alphanumerics to
 *  hyphens, no leading/trailing/duplicate hyphens. */
export function slugify(title) {
  return (title ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Suggest an unused slug, e.g. "my-article-2". Checks the DB so the
 *  admin can't create a duplicate and hit a confusing unique-violation
 *  error. Mirrors admin/promos.js's suggestCode(). */
export async function suggestSlug(title) {
  const base = slugify(title) || "article";
  const { data } = await supabase.from("journal_articles").select("slug").ilike("slug", `${base}%`);
  const taken = new Set((data ?? []).map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 100; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
  return `${base}-${Date.now().toString().slice(-4)}`;
}

/** ~200 words/minute, rounded up, minimum 1 — the standard estimate used
 *  by most reading-time tools. Body HTML tags are stripped first so
 *  markup doesn't inflate the count. */
export function estimateReadMinutes(bodyHtml) {
  const text = (bodyHtml ?? "").replace(/<[^>]*>/g, " ");
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

const FIELDS = [
  "title", "slug", "excerpt", "body_html", "cover_image", "category",
  "read_minutes", "status", "published_at", "author_name",
];

// Every optional field reads an empty string as "not set" and stores null —
// EXCEPT body_html, which has a `not null default ''` constraint (0042):
// an empty draft body is a valid, real state for the column, not a missing
// value. Coercing it to null the same way as the others violated that
// constraint and surfaced as a raw Postgres error the moment an admin
// tried to save a title-only draft with no body content yet.
function pick(input) {
  const out = {};
  for (const k of FIELDS) {
    if (input[k] === undefined) continue;
    out[k] = input[k] === "" && k !== "body_html" ? null : input[k];
  }
  return out;
}

export async function saveJournalArticle(input) {
  const row = pick(input);
  const { data: userData } = await supabase.auth.getUser();
  row.updated_by = userData?.user?.id ?? null;

  // Publishing for the first time (or re-publishing) stamps published_at
  // now if the admin didn't set one explicitly — draft -> published should
  // always carry a real timestamp, not null.
  if (row.status === "published" && !row.published_at) {
    row.published_at = new Date().toISOString();
  }

  if (input.id) {
    const { data, error } = await supabase
      .from("journal_articles").update(row).eq("id", input.id).select().single();
    return { data, error };
  }
  const { data, error } = await supabase
    .from("journal_articles").insert(row).select().single();
  return { data, error };
}

export async function deleteJournalArticle(id, imagePaths = []) {
  const { error } = await supabase.from("journal_articles").delete().eq("id", id);
  if (error) return { error };
  // Best-effort: the row is already gone either way, so a storage failure
  // here shouldn't be reported as the delete having failed.
  const paths = imagePaths.filter(Boolean);
  if (paths.length) await supabase.storage.from("site-media").remove(paths);
  return { error: null };
}

export async function uploadJournalImage(file) {
  if (file.size > MAX_IMAGE_BYTES) {
    return { path: null, error: { message: "Image must be under 5 MB." } };
  }
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `journal/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("site-media")
    .upload(path, file, { cacheControl: "31536000", upsert: false, contentType: file.type });
  if (error) return { path: null, error };
  return { path, error: null };
}
