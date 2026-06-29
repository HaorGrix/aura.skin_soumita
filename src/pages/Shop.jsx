import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SlidersHorizontal, Loader2 } from "lucide-react";
import { PRODUCTS, CONCERNS, BRANDS, CATEGORIES, queryProducts } from "../data/products.js";
import {
  FilterPanel,
  ActiveChips,
  EMPTY_FILTERS,
  countActive,
} from "../components/shop/Filters.jsx";
import SortMenu from "../components/shop/SortMenu.jsx";
import QuickViewModal from "../components/shop/QuickViewModal.jsx";
import PredictiveSearch from "../components/shop/PredictiveSearch.jsx";
import ProductCard from "../components/ui/ProductCard.jsx";
import { useSmoothScroll } from "../lib/useSmoothScroll.js";
import { ProductCardSkeleton } from "../components/ui/Skeleton.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import Button from "../components/ui/Button.jsx";

const PAGE = 12;

/* Read pre-filters from the hash query, e.g. #/shop?concern=Hydration&skinType=Dry&q=snail */
function parseHashQuery() {
  const filters = { ...EMPTY_FILTERS };
  let search = "";
  const qs = window.location.hash.split("?")[1];
  if (!qs) return { filters, search };
  const params = new URLSearchParams(qs);
  for (const key of ["skinType", "concern", "brand", "category", "price", "availability"]) {
    const v = params.get(key);
    if (v) filters[key] = v.split(",");
  }
  search = params.get("q") || "";
  return { filters, search };
}

export default function Shop() {
  const initial = parseHashQuery();
  // <PredictiveSearch /> owns the input + 300ms debounce and reports the
  // committed query via onQueryChange — Shop just stores it for the grid.
  const [search, setSearch] = useState(initial.search);
  const [filters, setFilters] = useState(initial.filters);
  const [sort, setSort] = useState("featured");
  const [visible, setVisible] = useState(PAGE);
  const [loading, setLoading] = useState(true); // initial / re-filter
  const [loadingMore, setLoadingMore] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [quickView, setQuickView] = useState(null);

  // Land at the top when entering the page.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }, []);

  // Lock body scroll while the mobile filter sheet is open. Defense-in-depth
  // alongside `data-lenis-prevent` on the sheet's scroll body: even if a
  // native touch/wheel event escaped the sheet, the body itself can't move.
  // Desktop (lg+) doesn't render the sheet, so this no-ops there.
  useEffect(() => {
    if (!sheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [sheetOpen]);

  const results = useMemo(
    () => queryProducts(PRODUCTS, { search, filters, sort }),
    [search, filters, sort]
  );

  // Curation skeleton is shown ONCE on mount only — never on keystrokes/sort —
  // so incremental search & re-sorts update the grid instantly (no flashing).
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 450);
    return () => clearTimeout(t);
  }, []);

  // Query/filter/sort changes only reset paging; results re-render immediately.
  useEffect(() => {
    setVisible(PAGE);
  }, [search, filters, sort]);

  const shown = results.slice(0, visible);
  const hasMore = visible < results.length;

  const loadMore = useCallback(() => {
    if (loadingMore || loading) return;
    setLoadingMore(true);
    setTimeout(() => {
      setVisible((v) => v + PAGE);
      setLoadingMore(false);
    }, 600);
  }, [loadingMore, loading]);

  // Infinite scroll via IntersectionObserver on a sentinel.
  const sentinelRef = useRef(null);
  const gridScrollRef = useRef(null); // right pane scroll container (desktop dual-pane)
  const asideRef = useRef(null); // left filter pane scroll container

  // Track desktop so smooth-scroll only runs where the panes actually scroll.
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setIsDesktop(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Eased momentum scrolling for each pane (its own Lenis), matching the page.
  useSmoothScroll(asideRef, isDesktop);
  useSmoothScroll(gridScrollRef, isDesktop);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    // Desktop: the right pane owns its scroll → observe within it.
    // Mobile: the page scrolls → observe the viewport (null root).
    const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
    const io = new IntersectionObserver(
      (entries) => entries[0].isIntersecting && loadMore(),
      { root: isDesktop ? gridScrollRef.current : null, rootMargin: "600px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadMore]);

  // —— filter helpers ——
  const toggleFilter = (key, id) =>
    setFilters((f) => {
      const has = f[key].includes(id);
      return { ...f, [key]: has ? f[key].filter((x) => x !== id) : [...f[key], id] };
    });
  const clearFilters = () => setFilters(EMPTY_FILTERS);
  const activeCount = countActive(filters);

  // Stable callback for <PredictiveSearch /> — keeps its debounce effect from
  // re-firing on every Shop render.
  const handleQueryChange = useCallback((q) => setSearch(q), []);

  // Trending = top 3 most-popular catalog items (drives the dropdown's empty state).
  const trending = useMemo(
    () => [...PRODUCTS].sort((a, b) => b.popularity - a.popularity).slice(0, 3),
    []
  );

  return (
    // The page scrolls naturally (no fixed shell → no black voids). The grid
    // rides the page scroll; the sidebar is sticky with its own scroll.
    // Mobile: normal scrolling page (filters in the off-canvas drawer).
    // Desktop (lg+): a fixed-height flex shell whose two panes scroll on their own.
    <div className="min-h-screen pt-28 sm:pt-32 lg:flex lg:h-screen lg:flex-col lg:overflow-hidden">
      <div className="mx-auto flex w-full max-w-7xl flex-col px-5 sm:px-8 lg:min-h-0 lg:flex-1">
        {/* Header — compact on desktop to give the panes vertical room */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="lg:shrink-0"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-magenta">
            Shop the ritual
          </p>
          <h1 className="mt-2 font-serif text-[clamp(2.25rem,6vw,4rem)] leading-[1.02] text-ink dark:text-white lg:text-3xl xl:text-4xl">
            All <span className="italic text-gradient-glow">glass-skin</span> essentials
          </h1>
          <p className="mt-3 max-w-xl text-ink-soft dark:text-white/65 lg:hidden">
            Authentic K & J-Beauty from the brands you love — filtered to your skin,
            your concern, your glow. 🌸
          </p>
        </motion.div>

        {/* Toolbar — sticky on mobile/tablet; a positioned (relative) header row
            on desktop. The desktop `lg:relative` is crucial: it makes the toolbar
            a positioned stacking context at z-sticky, so its absolute child
            (the PredictiveSearch dropdown at z-dropdown) paints ABOVE the body
            grid — fixing the dropdown-behind-cards bug. */}
        <div className="sticky top-20 z-[var(--z-sticky)] mt-8 -mx-5 px-5 py-3 sm:top-24 sm:mx-0 sm:px-0 lg:static lg:relative lg:z-[var(--z-sticky)] lg:mt-4 lg:shrink-0">
          <div className="flex flex-col gap-3 rounded-[1.25rem] bg-snow/70 p-3 backdrop-blur ring-1 ring-line sm:flex-row sm:items-center sm:bg-transparent sm:p-0 sm:ring-0 sm:backdrop-blur-0 dark:bg-white/[0.03] dark:ring-white/10 dark:sm:bg-transparent">
            {/* Predictive search — owns input, debounce, dropdown.
                onApplyFilter wraps the same toggleFilter the sidebar uses,
                so clicking a "Brand · Anua" hint just toggles that filter. */}
            <PredictiveSearch
              products={PRODUCTS}
              brands={BRANDS}
              categories={CATEGORIES}
              trending={trending}
              onQueryChange={handleQueryChange}
              onApplyFilter={toggleFilter}
            />

            <div className="flex items-center gap-2">
              {/* Mobile filter trigger */}
              <button
                onClick={() => setSheetOpen(true)}
                className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-medium text-ink ring-1 ring-line lg:hidden dark:bg-white/5 dark:text-white dark:ring-white/10"
              >
                <SlidersHorizontal className="h-4 w-4 text-magenta" strokeWidth={1.8} />
                Filters
                {activeCount > 0 && (
                  <span className="rounded-full bg-magenta px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {activeCount}
                  </span>
                )}
              </button>
              <SortMenu value={sort} onChange={setSort} />
            </div>
          </div>

          {/* Mobile quick concern chips */}
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {CONCERNS.map((c) => {
              const on = filters.concern.includes(c);
              return (
                <button
                  key={c}
                  onClick={() => toggleFilter("concern", c)}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium ring-1 transition-colors ${
                    on
                      ? "bg-magenta text-white ring-magenta"
                      : "bg-white text-ink-soft ring-line dark:bg-white/5 dark:text-white/65 dark:ring-white/10"
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>

        {/* Body — mobile: single column (filters live in the off-canvas drawer).
            Desktop: dual independent panes, each with its own overflow-y scroll
            and overscroll-contain, filling the remaining viewport height. */}
        <div className="mt-6 pb-24 lg:mt-4 lg:min-h-0 lg:flex-1 lg:grid lg:grid-cols-[16rem_1fr] lg:gap-8 lg:overflow-hidden lg:pb-0">
          {/* LEFT PANE — filters, as a defined surface panel so the space below
              the filters reads as an intentional sidebar (never a dark void).
              `data-lenis-prevent` hands the wheel to native scroll here. */}
          <aside
            ref={asideRef}
            /* This pane has its OWN Lenis (see useSmoothScroll) — no
               data-lenis-prevent, which would make that instance skip itself. */
            /* `relative` makes this the containing block so the filters'
               `sr-only` (position:absolute) checkboxes can't escape the pane's
               overflow and inflate the document height. */
            className="relative hidden lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:overflow-y-auto lg:overscroll-contain lg:rounded-2xl lg:bg-snow lg:p-4 lg:ring-1 lg:ring-line scrollbar-thin dark:lg:bg-white/[0.025] dark:lg:ring-white/10"
          >
            <FilterPanel filters={filters} onToggle={toggleFilter} onClear={clearFilters} />
          </aside>

          {/* RIGHT PANE — products. Own scroll on desktop; rides page scroll on mobile. */}
          <div
            ref={gridScrollRef}
            className="lg:h-full lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:pr-1 lg:pb-10 scrollbar-thin"
          >
            {/* Single content child so the pane's Lenis instance can measure it */}
            <div>
            {/* Result count + active chips */}
            <div className="mb-5 flex flex-col gap-3">
              <p className="text-sm text-ink-soft dark:text-white/60">
                {loading ? "Curating…" : `${results.length} products`}
              </p>
              <ActiveChips filters={filters} onToggle={toggleFilter} onClear={clearFilters} />
            </div>

            {/* States */}
            {loading ? (
              <Grid>
                {Array.from({ length: PAGE }).map((_, i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </Grid>
            ) : results.length === 0 ? (
              <EmptyState
                emoji="🔍"
                title="No matches… yet"
                message="Try removing a filter or searching a different ingredient. Your perfect match is out there. ✨"
                actionLabel={activeCount > 0 || search ? "Clear filters" : undefined}
                onAction={() => {
                  clearFilters();
                  setSearch("");
                }}
              />
            ) : (
              <>
                <Grid>
                  {shown.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onQuickView={setQuickView}
                    />
                  ))}
                  {loadingMore &&
                    Array.from({ length: 4 }).map((_, i) => (
                      <ProductCardSkeleton key={`more-${i}`} />
                    ))}
                </Grid>

                {/* Sentinel + Load More */}
                {hasMore && (
                  <div ref={sentinelRef} className="mt-12 flex justify-center">
                    <Button variant="secondary" onClick={loadMore} disabled={loadingMore}>
                      {loadingMore ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                        </>
                      ) : (
                        "Load more"
                      )}
                    </Button>
                  </div>
                )}
                {!hasMore && results.length > PAGE && (
                  <p className="mt-12 text-center text-sm text-ink-soft dark:text-white/50">
                    You’ve seen it all — that’s your full glow shelf. 🌺
                  </p>
                )}
              </>
            )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile filter bottom sheet */}
      <AnimatePresence>
        {sheetOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-[var(--z-modal)] bg-ink/50 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSheetOpen(false)}
            />
            {/* Bottom sheet — outer wrapper does NOT scroll. It is a flex column
                with a fixed handle/header, a scrollable body, and a fixed
                footer. This keeps the Show-products button always reachable
                regardless of how tall the filter list grows.
                Height is clamped via 85dvh (dynamic viewport units) so iOS
                Safari's collapsing address bar doesn't push the footer
                off-screen. */}
            <motion.div
              className="fixed inset-x-0 bottom-0 z-[var(--z-modal)] flex max-h-[85dvh] flex-col overflow-hidden rounded-t-[1.75rem] bg-white shadow-lift lg:hidden dark:bg-[#0f0f12]"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 260, damping: 30 }}
            >
              {/* Non-scrolling header — drag handle */}
              <div className="shrink-0 px-6 pt-5">
                <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-line dark:bg-white/15" />
              </div>

              {/* Scrollable body — the ONLY scrollable region in the sheet.
                  - `data-lenis-prevent` tells the root <ReactLenis> instance to
                    ignore wheel/touch events whose target lives inside this
                    element, so scroll stays local instead of bubbling to the
                    page-level smooth scroller behind the scrim.
                  - `touch-action: pan-y` signals to the browser that this
                    region owns vertical panning; iOS won't try to bubble the
                    gesture up to the document, and horizontal swipes pass
                    through cleanly.
                  - `overscroll-contain` stops chained scrolling when the user
                    hits the top/bottom of the list.
                  - `min-h-0` is required for `flex-1` overflow children to
                    actually scroll inside a flex column. */}
              <div
                data-lenis-prevent
                className="min-h-0 flex-1 overflow-y-auto px-6"
              >
                <FilterPanel
                  filters={filters}
                  onToggle={toggleFilter}
                  onClear={clearFilters}
                  sort={sort}
                  onSortChange={setSort}
                />
              </div>

              {/* Non-scrolling footer — always visible, even on tall filter lists */}
              <div className="shrink-0 border-t border-line bg-white px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 dark:border-white/10 dark:bg-[#0f0f12]">
                <Button
                  variant="primary"
                  magnetic={false}
                  className="w-full"
                  onClick={() => setSheetOpen(false)}
                >
                  Show {results.length} products
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Quick view */}
      <QuickViewModal product={quickView} onClose={() => setQuickView(null)} />
    </div>
  );
}

/* Responsive product grid: 2 col mobile → 4 col desktop */
function Grid({ children }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 md:grid-cols-3 xl:grid-cols-4">
      {children}
    </div>
  );
}
