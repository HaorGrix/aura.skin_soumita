/* =================================================================== *
 * aura.skin — SEARCH ENGINE (pure, frontend-only)
 * -------------------------------------------------------------------
 * Shared by `queryProducts` (Shop grid filter) and `<PredictiveSearch>`
 * (dropdown). Pure functions only — case-insensitive, memo-friendly,
 * lightning-fast over a few-hundred-item catalog.
 *
 * Ranking hierarchy:
 *   1. Prefix match (name/brand starts with the query)         strongest
 *   2. In-string inclusion (name/brand contains the query)
 *   3. Keyword/ingredient prefix match (per term)
 *   4. Fuzzy fallback (Levenshtein) — only when strict yields 0,
 *      so happy-path typing never pays the fuzzy cost.
 * =================================================================== */
import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

export const tokenize = (s) =>
  s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/* Natural-language → catalog vocabulary (e.g. "facewash" → "cleanser"). */
export const SEARCH_SYNONYMS = {
  facewash: ["cleanser"], wash: ["cleanser"], cleansing: ["cleanser"], foam: ["cleanser"],
  cleanse: ["cleanser"], balm: ["cleanser"],
  moisturiser: ["moisturizer"], lotion: ["moisturizer"], cream: ["moisturizer"],
  sunblock: ["sunscreen"], sunscreen: ["sunscreen"], spf: ["sunscreen"],
  suncream: ["sunscreen"], sunstick: ["sunscreen"], sunblocker: ["sunscreen"],
  ampoule: ["serum"], vit: ["vitamin"], ha: ["hyaluronic"], cica: ["centella"],
};

const searchWords = (item) =>
  tokenize(
    `${item.brand} ${item.name} ${item.concern.join(" ")} ${item.category} ${item.ingredients.join(" ")}`
  );

/* Strict word-prefix AND match — no substring bleed ("mis" never hits "blemishes"). */
export function matchesSearch(item, terms, words = searchWords(item)) {
  if (!terms.length) return true;
  return terms.every((t) => {
    const variants = [t, ...(SEARCH_SYNONYMS[t] || [])];
    return variants.some((v) => words.some((w) => w.startsWith(v)));
  });
}

/* ------------------------------------------------------------------ *
 * Fuzzy fallback — handles minor typos ("nicainamide" → niacinamide).
 * Levenshtein with a length-aware threshold; skipped for <3-char terms.
 * ------------------------------------------------------------------ */
export function lev(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m = a.length, n = b.length;
  let prev = new Array(n + 1);
  let cur = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

const fuzzyThreshold = (t) => (t.length <= 4 ? 1 : t.length <= 7 ? 2 : 3);

export function fuzzyMatches(item, terms, words = searchWords(item)) {
  if (!terms.length) return true;
  return terms.every((t) => {
    if (t.length < 3) return words.some((w) => w.startsWith(t));
    const tol = fuzzyThreshold(t);
    return words.some((w) => {
      if (w.startsWith(t)) return true;
      if (Math.abs(w.length - t.length) > tol) return false;
      return lev(t, w) <= tol;
    });
  });
}

/* ------------------------------------------------------------------ *
 * Relevance scorer — ranks matched products so the *best* hits surface
 * first. Higher score = more relevant. Popularity is a gentle tiebreak.
 * ------------------------------------------------------------------ */
const prefixesAnyWord = (words, t) => words.some((w) => w.startsWith(t));

export function relevanceScore(item, q, terms) {
  const name = item.name.toLowerCase();
  const brand = item.brand.toLowerCase();
  const nameWords = tokenize(name);
  const brandWords = tokenize(brand);
  const ingWords = tokenize(item.ingredients.join(" "));
  let s = 0;

  // Whole-query signals (strongest)
  if (name.startsWith(q)) s += 1000;
  else if (prefixesAnyWord(nameWords, q)) s += 500;
  else if (name.includes(q)) s += 250;
  if (brand.startsWith(q)) s += 600;
  else if (brand.includes(q)) s += 150;

  // Per-term signals (multi-word queries + ingredient/keyword search)
  for (const t of terms) {
    if (prefixesAnyWord(nameWords, t)) s += 120;
    else if (name.includes(t)) s += 45;
    if (prefixesAnyWord(brandWords, t)) s += 90;
    if (prefixesAnyWord(ingWords, t)) s += 70;
    if (item.category.toLowerCase().startsWith(t)) s += 30;
    if (item.concern.join(" ").toLowerCase().includes(t)) s += 12;
  }

  return s + (item.popularity ?? 0) / 1000;
}

/* ------------------------------------------------------------------ *
 * Dropdown suggestion — facet hints (brand/category) + ranked top-N
 * product matches, with fuzzy fallback if strict gives nothing.
 * Returns `null` for an empty query so callers can render the focused
 * "no query yet" state separately.
 * ------------------------------------------------------------------ */
export function suggest(query, products, { limit = 6, brands = [], categories = [] } = {}) {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const terms = tokenize(q);

  // Facet hints — first brand/category that matches as a prefix
  const facets = [];
  for (const b of brands) {
    const bl = b.toLowerCase();
    if (bl.startsWith(q) || bl === q) {
      facets.push({ key: "brand", value: b, label: `Brand · ${b}` });
      break;
    }
  }
  for (const c of categories) {
    if (c.toLowerCase().startsWith(q)) {
      facets.push({ key: "category", value: c, label: `Category · ${c}` });
      break;
    }
  }

  // Strict pass first (fast). Only fall through to fuzzy on no-hit.
  let hits = products.filter((p) => matchesSearch(p, terms));
  let isFuzzy = false;
  if (hits.length === 0) {
    hits = products.filter((p) => fuzzyMatches(p, terms));
    isFuzzy = true;
  }
  const ranked = [...hits].sort(
    (a, b) => relevanceScore(b, q, terms) - relevanceScore(a, q, terms)
  );

  return { facets, products: ranked.slice(0, limit), totalHits: ranked.length, isFuzzy };
}

/* ------------------------------------------------------------------ *
 * UI helpers — copy + the animated-placeholder hook used by the input.
 * ------------------------------------------------------------------ */
export const SEARCH_HINTS = [
  "Search moisturiser, serum, snail mucin…",
  'Try "niacinamide" or "heartleaf"…',
  "Search COSRX, Anua, Beauty of Joseon…",
  "Find sunscreen, toner, cleanser…",
  "Hunt your next glow ✨",
];

export const POPULAR_SEARCHES = [
  "snail mucin", "niacinamide", "sunscreen", "heartleaf",
  "centella", "vitamin c", "retinol", "hyaluronic",
];

/** Typing-effect placeholder. Pauses when `active` is false; respects reduced-motion. */
export function useTypewriter(words, { typeMs = 65, deleteMs = 28, holdMs = 1500, active = true } = {}) {
  const reduce = useReducedMotion();
  const [text, setText] = useState(words[0]);

  useEffect(() => {
    if (!active || reduce) {
      setText(words[0]);
      return;
    }
    let wi = 0;
    let ch = 0;
    let deleting = false;
    let timer;
    const tick = () => {
      const word = words[wi % words.length];
      ch += deleting ? -1 : 1;
      setText(word.slice(0, ch));
      if (!deleting && ch === word.length) {
        deleting = true;
        timer = setTimeout(tick, holdMs);
      } else if (deleting && ch === 0) {
        deleting = false;
        wi += 1;
        timer = setTimeout(tick, 350);
      } else {
        timer = setTimeout(tick, deleting ? deleteMs : typeMs);
      }
    };
    timer = setTimeout(tick, 500);
    return () => clearTimeout(timer);
  }, [active, reduce, words, typeMs, deleteMs, holdMs]);

  return reduce ? words[0] : text;
}
