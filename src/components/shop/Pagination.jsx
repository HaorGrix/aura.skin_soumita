/* =================================================================== *
 * skin.theory — numbered pagination for the shop grid
 * -------------------------------------------------------------------
 * Prev · 1 … 4 5 6 … 12 · Next. Shows at most 5 page numbers around the
 * current one (plus first/last), so it fits a phone at any catalog size.
 * =================================================================== */
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Page numbers to show, with "…" gaps: e.g. [1, "…", 4, 5, 6, "…", 12]. */
function pageList(page, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const from = Math.max(2, Math.min(page - 1, total - 4));
  const to = Math.min(total - 1, Math.max(page + 1, 5));
  const out = [1];
  if (from > 2) out.push("…");
  for (let p = from; p <= to; p++) out.push(p);
  if (to < total - 1) out.push("…");
  out.push(total);
  return out;
}

export default function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  const btn = "grid h-10 min-w-10 place-items-center rounded-full px-3 text-sm font-medium transition-colors";

  return (
    <nav aria-label="Product pages" className="mt-10 flex flex-wrap items-center justify-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        aria-label="Previous page"
        className={`${btn} bg-white text-ink ring-1 ring-line hover:ring-magenta disabled:opacity-40 disabled:hover:ring-line`}
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={2} />
      </button>

      {pageList(page, totalPages).map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className="px-1 text-ink-soft" aria-hidden>…</span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-label={`Page ${p}`}
            aria-current={p === page ? "page" : undefined}
            className={`${btn} ${p === page ? "bg-magenta text-white" : "bg-white text-ink ring-1 ring-line hover:ring-magenta"}`}
          >
            {p}
          </button>
        )
      )}

      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        aria-label="Next page"
        className={`${btn} bg-white text-ink ring-1 ring-line hover:ring-magenta disabled:opacity-40 disabled:hover:ring-line`}
      >
        <ChevronRight className="h-4 w-4" strokeWidth={2} />
      </button>
    </nav>
  );
}
