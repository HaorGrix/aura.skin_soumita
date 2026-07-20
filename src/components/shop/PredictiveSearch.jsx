import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Sparkles, TrendingUp, Tag } from "lucide-react";
import {
  suggest,
  useTypewriter,
  SEARCH_HINTS,
  POPULAR_SEARCHES,
} from "../../lib/search.js";
import { formatPrice } from "../../lib/format.js";

/**
 * <PredictiveSearch /> — production-grade smart search.
 *
 * Drop-in replacement for the basic <input>. Owns its own input/debounce/
 * dropdown state and notifies the parent via callbacks so the grid pipeline
 * (queryProducts) keeps working without coupling.
 *
 *   debounce(300ms) → onQueryChange(q)  → parent re-runs queryProducts
 *   facet chip click → onApplyFilter(key, value)
 *   product click   → navigate (#/product/:id)
 *   popular pill    → commits the query
 *
 * Renders:
 *   • animated typing-effect placeholder
 *   • suggested filter chips (Brand · X, Category · Y)
 *   • compact product cards (thumb / brand / name / price)
 *   • empty state → popular searches + trending products
 *   • fuzzy-match notice when the strict pass returns nothing
 *
 * Keyboard: ↑/↓ move highlight, Enter opens, Esc closes.
 */
export default function PredictiveSearch({
  products,
  brands = [],
  categories = [],
  trending = [],
  onQueryChange,
  onApplyFilter,
}) {
  const [input, setInput] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const rootRef = useRef(null);

  // 300ms debounce — keeps typing snappy + batches the heavy filter work
  useEffect(() => {
    const t = setTimeout(() => setDebounced(input.trim()), 300);
    return () => clearTimeout(t);
  }, [input]);

  // Sync the parent so the grid filter updates in real time
  useEffect(() => {
    onQueryChange?.(debounced);
  }, [debounced, onQueryChange]);

  // Pure, memoized suggestion engine — re-runs only when query/catalog changes
  const suggestion = useMemo(
    () => suggest(debounced, products, { limit: 6, brands, categories }),
    [debounced, products, brands, categories]
  );

  // Animated typing placeholder (paused while the user has typed something)
  const typed = useTypewriter(SEARCH_HINTS, { active: !input });

  // Outside click + Esc closes the dropdown
  useEffect(() => {
    const onDoc = (e) =>
      rootRef.current && !rootRef.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // Reset highlighted row whenever results change
  useEffect(() => setActiveIdx(-1), [debounced]);

  function commit(text) {
    setInput(text);
    setDebounced(text);
    onQueryChange?.(text);
    setOpen(true);
  }

  function pickProduct(p) {
    window.location.hash = `#/product/${p.id}`;
    setOpen(false);
  }

  function pickFacet(f) {
    onApplyFilter?.(f.key, f.value);
    setOpen(false);
  }

  function handleKey(e) {
    if (!open) return;
    const results = suggestion?.products ?? [];
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" && activeIdx >= 0 && results[activeIdx]) {
      pickProduct(results[activeIdx]);
    }
  }

  const showProducts = !!suggestion && suggestion.products.length > 0;
  const showEmpty = !!debounced && suggestion && suggestion.products.length === 0;
  const showFocused = !debounced && open && trending.length > 0;

  return (
    <div ref={rootRef} className="relative flex-1">
      <Search
        className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft"
        strokeWidth={1.8}
      />
      <input
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKey}
        placeholder={input ? "Search…" : `${typed}│`}
        aria-label="Search products"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls="search-results-listbox"
        /* py-3 mobile = ~48px thumb-friendly target; tighter on desktop */
        className="w-full rounded-full bg-white py-3 pl-11 pr-10 text-base text-ink ring-1 ring-line outline-none transition-shadow placeholder:text-ink-soft/70 focus:ring-2 focus:ring-magenta/50 sm:py-2.5 sm:text-sm"
      />
      {input && (
        <button
          onClick={() => {
            setInput("");
            setDebounced("");
            onQueryChange?.("");
          }}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-ink-soft hover:text-magenta"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.2} />
        </button>
      )}

      <AnimatePresence>
        {open && (showProducts || showEmpty || showFocused) && (
          <motion.div
            id="search-results-listbox"
            role="listbox"
            aria-label="Search suggestions"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            /* Layering: `z-[var(--z-dropdown)]` puts the panel above the body
               grid. For this to actually beat sibling siblings of the toolbar,
               the toolbar itself must be a positioned stacking context at
               `z-sticky` — see Shop.jsx. Together they guarantee the dropdown
               paints above all product cards. */
            className="absolute left-0 right-0 top-full z-[var(--z-dropdown)] mt-2 max-h-[70vh] overflow-y-auto rounded-2xl bg-white/95 p-2 shadow-lift ring-1 ring-line backdrop-blur-md scrollbar-thin"
          >
            {/* Suggested filter chips */}
            {suggestion && suggestion.facets.length > 0 && (
              <div className="border-b border-line p-2">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-soft">
                  Refine by
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestion.facets.map((f) => (
                    <button
                      key={`${f.key}-${f.value}`}
                      onClick={() => pickFacet(f)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-petal px-3 py-1.5 text-xs font-medium text-magenta hover:bg-rose/30"
                    >
                      <Tag className="h-3 w-3" strokeWidth={2} /> {f.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Top product matches */}
            {showProducts && (
              <ul className="p-1">
                {suggestion.isFuzzy && (
                  <li className="px-2 py-1.5 text-[11px] italic text-ink-soft">
                    Showing close matches…
                  </li>
                )}
                {suggestion.products.map((p, i) => (
                  <ProductRow
                    key={p.id}
                    product={p}
                    active={activeIdx === i}
                    onHover={() => setActiveIdx(i)}
                    onPick={() => pickProduct(p)}
                  />
                ))}
                {suggestion.totalHits > suggestion.products.length && (
                  <li className="px-3 py-2 text-[11px] text-ink-soft">
                    +{suggestion.totalHits - suggestion.products.length} more — see all results below
                  </li>
                )}
              </ul>
            )}

            {/* Empty state — popular searches + trending products */}
            {showEmpty && (
              <EmptyPanel
                query={debounced}
                trending={trending}
                onPickSearch={commit}
                onPickProduct={pickProduct}
              />
            )}

            {/* Focused (no query yet) — same suggestions without the apology */}
            {showFocused && (
              <FocusedPanel
                trending={trending}
                onPickSearch={commit}
                onPickProduct={pickProduct}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* -------------------- internal pieces -------------------- */

function ProductRow({ product: p, active, onHover, onPick, compact = false }) {
  return (
    <li>
      <button
        onClick={onPick}
        onMouseEnter={onHover}
        className={`flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors ${
          active ? "bg-snow" : "hover:bg-snow"
        }`}
      >
        <span
          className={`relative ${compact ? "h-10 w-10" : "h-12 w-12"} shrink-0 overflow-hidden rounded-lg ring-1 ring-line`}
          style={{
            background: `radial-gradient(120% 100% at 50% 0%, #fff 0%, ${p.tone} 75%, #ffe1ec 100%)`,
          }}
        >
          {p.image && (
            <img
              src={p.image}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-magenta">
            {p.brand}
          </span>
          <span className="block truncate text-sm font-medium text-ink">
            {p.name}
          </span>
        </span>
        <span
          className={`shrink-0 ${compact ? "text-xs" : "text-sm"} font-semibold tabular-nums ${
            p.isOnSale ? "text-magenta" : "text-ink"
          }`}
        >
          {formatPrice(p.price)}
        </span>
      </button>
    </li>
  );
}

function PopularPills({ onPick }) {
  return (
    <div className="flex flex-wrap gap-1.5 px-2">
      {POPULAR_SEARCHES.map((s) => (
        <button
          key={s}
          onClick={() => onPick(s)}
          className="rounded-full bg-snow px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-petal hover:text-magenta"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

function TrendingList({ trending, onPick }) {
  return (
    <ul>
      {trending.map((p) => (
        <ProductRow key={p.id} product={p} active={false} onHover={() => {}} onPick={() => onPick(p)} compact />
      ))}
    </ul>
  );
}

function EmptyPanel({ query, trending, onPickSearch, onPickProduct }) {
  return (
    <div className="p-2">
      <p className="px-2 py-1.5 text-sm text-ink-soft">
        No products match “{query}”.
      </p>
      <p className="mt-3 mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-soft">
        Popular searches
      </p>
      <PopularPills onPick={onPickSearch} />
      {trending.length > 0 && (
        <>
          <p className="mt-4 mb-1 inline-flex items-center gap-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-soft">
            <TrendingUp className="h-3 w-3" strokeWidth={2} /> Trending now
          </p>
          <TrendingList trending={trending} onPick={onPickProduct} />
        </>
      )}
    </div>
  );
}

function FocusedPanel({ trending, onPickSearch, onPickProduct }) {
  return (
    <div className="p-2">
      <p className="mt-2 mb-1.5 px-2 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-soft">
        <Sparkles className="h-3 w-3" strokeWidth={2} /> Popular searches
      </p>
      <PopularPills onPick={onPickSearch} />
      <p className="mt-4 mb-1 inline-flex items-center gap-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-soft">
        <TrendingUp className="h-3 w-3" strokeWidth={2} /> Trending now
      </p>
      <TrendingList trending={trending} onPick={onPickProduct} />
    </div>
  );
}
