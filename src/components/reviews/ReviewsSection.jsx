import { navigate } from "../../lib/navigate.js";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, SlidersHorizontal, ShieldCheck, Sparkles, ChevronRight } from "lucide-react";
import { useUser } from "../../context/UserContext.jsx";
import { listApprovedReviews } from "../../lib/api/reviews.js";
import ReviewCard, { Stars } from "./ReviewCard.jsx";

const SORTS = [
  { id: "newest", label: "Newest" },
  { id: "helpful", label: "Most Helpful" },
  { id: "rating", label: "Highest Rated" },
];

const sorters = {
  newest: (a, b) => a.daysAgo - b.daysAgo,
  helpful: (a, b) => (b.helpful ?? 0) - (a.helpful ?? 0),
  rating: (a, b) => b.stars - a.stars || a.daysAgo - b.daysAgo,
};

/**
 * ReviewsSection — the full PDP reviews experience: rating summary, keyword
 * search (WhatsApp-style live filter), sort, and the list. The user's own
 * verified reviews are merged in at the top so they appear instantly after
 * submitting. Reused wherever a product's reviews need to render.
 */
export default function ReviewsSection({ product }) {
  // Authoring lives on the Order History page (verified-purchase only). This
  // component is read-only on the PDP, so a fake review for discount farming is
  // impossible from here. `authed`/`openAuth` drive the "review to earn" CTA:
  // signed-in shoppers jump straight to My Orders; guests get the auth modal
  // first, then land on My Orders on success.
  const { myReviewsFor, authed, openAuth } = useUser();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");
  // Real, verified-purchase reviews from Postgres (0031_reviews_table.sql) —
  // fetched by the storefront slug, which IS product.id in this static
  // catalog (see data/products.js's `id: slug(brand)-slug(name)`).
  const [dbReviews, setDbReviews] = useState([]);

  useEffect(() => {
    let cancelled = false;
    listApprovedReviews(product.id).then(({ data }) => {
      if (!cancelled) setDbReviews(data);
    });
    return () => {
      cancelled = true;
    };
  }, [product.id]);

  // Deep-link straight to the Orders tab — the only place reviews are authored.
  const goToOrders = () => {
    navigate("/account?tab=orders");
  };

  const handleReviewCta = (e) => {
    e.preventDefault();
    if (authed) {
      goToOrders();
    } else {
      // Open login/sign-up; redirect to My Orders once the user is in.
      openAuth("login", goToOrders);
    }
  };

  // Merge the shopper's own local (mock-login) reviews, real verified
  // reviews from Postgres, and the seeded demo ones — deduped by id so a
  // review just submitted through the verified flow (which also lands in
  // dbReviews on the next fetch) never doubles up.
  const all = useMemo(() => {
    const mine = myReviewsFor(product.id).map((r) => ({ ...r, tone: product.tone }));
    const seen = new Set();
    return [...mine, ...dbReviews, ...product.reviews].filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
  }, [myReviewsFor, product.id, product.reviews, product.tone, dbReviews]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? all.filter((r) =>
          `${r.name} ${r.title} ${r.body}`.toLowerCase().includes(q)
        )
      : all;
    return [...filtered].sort(sorters[sort] ?? sorters.newest);
  }, [all, query, sort]);

  // Rating summary is computed live from the merged set (not the static
  // seed numbers) so a newly-submitted real review moves it immediately.
  const total = all.length;
  const bd = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    all.forEach((r) => { counts[r.stars] = (counts[r.stars] ?? 0) + 1; });
    return counts;
  }, [all]);
  const avgRating = total ? all.reduce((sum, r) => sum + r.stars, 0) / total : product.rating;

  return (
    <div className="grid gap-10 lg:grid-cols-[300px_1fr]">
      {/* Summary */}
      <div className="lg:sticky lg:top-40 lg:self-start">
        <div className="flex items-end gap-3">
          <span className="font-serif text-5xl text-ink">
            {avgRating.toFixed(1)}
          </span>
          <div className="pb-1.5">
            <Stars value={avgRating} />
            <p className="mt-1 text-xs text-ink-soft">
              {total.toLocaleString()} reviews
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-1.5">
          {[5, 4, 3, 2, 1].map((s) => {
            const pct = total ? Math.round(((bd[s] ?? 0) / total) * 100) : 0;
            return (
              <div key={s} className="flex items-center gap-2 text-xs">
                <span className="w-3 text-ink-soft">{s}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-line">
                  <motion.span
                    className="block h-full rounded-full bg-gold"
                    initial={{ width: 0 }}
                    whileInView={{ width: `${pct}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  />
                </span>
                <span className="w-8 text-right text-ink-soft">{pct}%</span>
              </div>
            );
          })}
        </div>

        {/* Reviews are authored only from My Orders (verified purchase), so the
            CTA never writes a review here — it routes the shopper to their
            orders (via the auth modal first if they're a guest). This keeps
            every PDP review trustworthy and blocks review-farming for points. */}
        <div className="mt-6 rounded-2xl bg-snow p-3.5 text-xs ring-1 ring-line">
          <p className="flex items-start gap-2 text-ink-soft">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan" strokeWidth={1.8} />
            Every review is from a verified purchase.
          </p>
          <button
            type="button"
            onClick={handleReviewCta}
            className="mt-2.5 flex w-full items-center justify-between gap-2 rounded-xl bg-white px-3 py-2.5 text-left font-medium text-ink ring-1 ring-line transition-colors hover:text-magenta hover:ring-magenta/50"
          >
            <span className="inline-flex items-start gap-2">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-magenta" strokeWidth={1.8} />
              Bought this? Review your orders to earn points &amp; unlock discounts.
            </span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Controls + list */}
      <div>
        {/* Search + sort toolbar */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft"
              strokeWidth={1.8}
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search reviews (e.g. “oily”, “sticky”, “delivery”)"
              className="w-full rounded-full bg-white py-2.5 pl-10 pr-9 text-sm text-ink ring-1 ring-line outline-none transition-shadow placeholder:text-ink-soft/70 focus:ring-2 focus:ring-magenta/50"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-ink-soft hover:text-magenta"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.2} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 rounded-full bg-white p-1 ring-1 ring-line">
            <SlidersHorizontal className="ml-2 h-3.5 w-3.5 text-ink-soft" strokeWidth={1.8} />
            {SORTS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSort(s.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  sort === s.id
                    ? "bg-magenta text-white"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <p className="mb-4 text-xs text-ink-soft">
          {query
            ? `${visible.length} review${visible.length === 1 ? "" : "s"} matching “${query}”`
            : `Showing ${visible.length} review${visible.length === 1 ? "" : "s"}`}
        </p>

        {/* List */}
        {visible.length > 0 ? (
          <div className="space-y-5">
            <AnimatePresence mode="popLayout">
              {visible.map((r) => (
                <motion.div key={r.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <ReviewCard review={r} tone={product.tone} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="rounded-[1.25rem] bg-snow p-10 text-center ring-1 ring-line">
            <p className="text-3xl">🔍</p>
            <p className="mt-2 font-medium text-ink">No reviews match “{query}”</p>
            <button onClick={() => setQuery("")} className="mt-1 text-sm font-medium text-magenta hover:underline">
              Clear search
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
