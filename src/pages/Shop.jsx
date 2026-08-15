import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SlidersHorizontal, Loader2 } from "lucide-react";
import {
  CONCERNS,
  BRANDS,
  CATEGORIES,
  SKIN_TYPES,
  PRICE_RANGES,
  DISCOUNT_TIERS,
  AVAILABILITY,
  SORTS,
  queryProducts,
} from "../data/products.js";
import { listProducts } from "../lib/api/products.js";
import { listActiveSales } from "../lib/api/sales.js";
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
import BackButton from "../components/ui/BackButton.jsx";
import { useBodyScrollLock } from "../lib/scrollLock.js";
import { onRouteChange } from "../lib/navigate.js";
import {
  useCategoryTree, useProductCategoryMap,
  categoryNamesFor, categorySlugsFor, findBySlug,
} from "../lib/api/categories.js";

const PAGE = 12;

/* Valid values per facet — the single source of truth for what a URL param may
 * legally hold. Parsing filters incoming values through these sets so a stale,
 * misspelled, or renamed param (e.g. an old "Acne" link vs "Acne & Blemishes")
 * is dropped instead of silently producing an empty grid. */
const FACET_VALUES = {
  skinType: new Set(SKIN_TYPES),
  concern: new Set(CONCERNS),
  brand: new Set(BRANDS),
  category: new Set(CATEGORIES),
  price: new Set(PRICE_RANGES.map((r) => r.id)),
  discount: new Set(DISCOUNT_TIERS.map((t) => t.id)),
  availability: new Set(AVAILABILITY.map((a) => a.id)),
};

/* Read pre-filters from the URL query, e.g. /shop?concern=Hydration&skinType=Dry&q=snail
 * Values are validated against FACET_VALUES so any junk param resolves to "no
 * filter" (full catalog) rather than an empty result set. Multiple values per
 * facet (comma-separated) combine, and different facets combine too — so
 * concern + skinType logically AND together in the query engine. */
/**
 * Turn a `?category=` value into the category NAMES the grid filters on.
 *
 * The mega menu links by SLUG (`skin-care-facewash`), because a slug is
 * unique and a name is not — "Facewash" exists under both Skin Care and
 * K-Beauty. Products, however, carry a category NAME, so slugs have to be
 * resolved before they can match anything.
 *
 * A parent slug expands to its children's names: no product is literally
 * categorised "Skin Care", so without expansion that link would return an
 * empty grid.
 *
 * Plain names are still accepted, so the sidebar's own filter chips and any
 * older `?category=Serum` link keep working.
 */
function resolveCategoryTokens(raw, tree) {
  const known = new Set(CATEGORIES);
  for (const parent of tree ?? []) {
    known.add(parent.name);
    for (const child of parent.children ?? []) known.add(child.name);
  }

  const out = [];
  for (const token of String(raw).split(",").map((v) => v.trim()).filter(Boolean)) {
    const viaSlug = categoryNamesFor(tree, token);
    if (viaSlug.length) out.push(...viaSlug);
    else if (known.has(token)) out.push(token);
    // else: stale or misspelled → dropped, same as every other facet
  }
  return [...new Set(out)];
}

function parseUrlQuery(tree) {
  const filters = structuredClone(EMPTY_FILTERS);
  let search = "";
  // Clean-URL routing: the query lives in location.search, not the hash.
  const params = new URLSearchParams(window.location.search);
  for (const key of Object.keys(FACET_VALUES)) {
    const raw = params.get(key);
    if (!raw) continue;

    if (key === "category") {
      const names = resolveCategoryTokens(raw, tree);
      if (names.length) filters.category = names;
      continue;
    }

    // Split, decode-safe (URLSearchParams already decoded), keep only known values.
    const valid = raw.split(",").map((v) => v.trim()).filter((v) => FACET_VALUES[key].has(v));
    if (valid.length) filters[key] = valid;
  }
  search = params.get("q") || "";
  return { filters, search };
}

export default function Shop() {
  // <PredictiveSearch /> owns the input + 300ms debounce and reports the
  // committed query via onQueryChange — Shop just stores it for the grid.
  //
  // Initialise filters/search DIRECTLY from the URL (lazy useState) so the very
  // first render is already filtered. This must NOT be a mount effect: child
  // effects run before parent mount effects, so <PredictiveSearch> reports its
  // empty query first → handleQueryChange("") → syncUrl() rewrites the URL to
  // bare "/shop", stripping ?concern=… before a mount-effect read could catch
  // it. Seeding at render time means `filters` already holds the concern when
  // that empty-query callback fires, so syncUrl preserves it.
  const [search, setSearch] = useState(() => parseUrlQuery().search);
  const [filters, setFilters] = useState(() => parseUrlQuery().filters);

  // The tree arrives asynchronously, but the two useState initialisers above
  // run on the very first render. A `?category=<slug>` link therefore can't be
  // resolved yet — the effect below re-resolves it the moment the tree lands.
  // Held in a ref as well so the route-change handler always reads the current
  // tree without needing to be re-subscribed.
  const categoryTree = useCategoryTree();
  const treeRef = useRef(categoryTree);
  useEffect(() => { treeRef.current = categoryTree; }, [categoryTree]);

  // True while the URL carries a category we haven't been able to resolve yet.
  // syncUrl() refuses to touch the URL until this clears — see the note there.
  const pendingCategoryRef = useRef(
    typeof window !== "undefined" &&
      !!new URLSearchParams(window.location.search).get("category")
  );

  /* The URL-driven category selection, kept separate from `filters.category`.
   *
   * The sidebar's own category checkboxes are NAME-based and stay that way —
   * ticking "Serum" there reasonably means "serums wherever they live". The
   * menu, by contrast, points at one specific column, so it selects by slug.
   * Two different questions, two different filters. */
  const [categorySlugs, setCategorySlugs] = useState([]);
  const [categoryNames, setCategoryNames] = useState([]); // fallback, see results memo
  const [activeCategoryName, setActiveCategoryName] = useState(null);
  // True only when the URL carries a ?category= that doesn't resolve to any
  // node in the tree (a dead/misspelled slug, or a nav link — CategoryTiles,
  // the mega menu — pointing at a category that was never created). Kept
  // apart from `categorySlugs` because an empty categorySlugs array means
  // BOTH "no category was ever specified" and "one was specified but
  // doesn't exist" — the results memo needs to tell those apart, or a
  // dead category link silently shows the whole unfiltered catalog instead
  // of the empty result a nonexistent category actually has.
  const [categoryUnresolved, setCategoryUnresolved] = useState(false);
  const productCategory = useProductCategoryMap();

  // ?sale=<id> — a homepage "Glow deals" card link, filtering to exactly
  // the products that campaign's active discount currently covers
  // (Product.activeSaleId, set by mapProduct() from products_public's
  // live best_sale_price_minor() match). Same "one query param, resolved
  // straight off the already-fetched product list" shape as ?category=,
  // just without a slug/tree resolution step since a sale id is already
  // the exact key products carry.
  const [saleId, setSaleId] = useState(
    () => new URLSearchParams(window.location.search).get("sale") || null
  );
  useEffect(() => onRouteChange(() => {
    setSaleId(new URLSearchParams(window.location.search).get("sale") || null);
  }), []);
  // Just for the header chip's label — filtering itself only needs the id
  // (matched against each product's own activeSaleId), so this fetch is
  // display-only and never blocks the grid.
  const [saleName, setSaleName] = useState(null);
  useEffect(() => {
    if (!saleId) { setSaleName(null); return; }
    let alive = true;
    listActiveSales().then((rows) => {
      if (alive) setSaleName(rows.find((s) => s.id === saleId)?.name ?? null);
    });
    return () => { alive = false; };
  }, [saleId]);

  // Re-sync on REAL navigation only — browser back/forward, or clicking another
  // concern card while already on Shop. In-page filter toggles use
  // history.replaceState (see syncUrl), which emits no route event, so they
  // never round-trip through here and can't clobber React state.
  useEffect(() => onRouteChange(() => {
    const { filters: parsedFilters, search: parsedSearch } = parseUrlQuery(treeRef.current);
    setFilters(parsedFilters);
    setSearch(parsedSearch);
  }), []);

  // Resolve a slug-based ?category= once the tree is available. Guarded on the
  // URL still carrying a category param, so it can never overwrite filters the
  // shopper has since changed by hand.
  useEffect(() => {
    if (!categoryTree.length) return;
    const raw = new URLSearchParams(window.location.search).get("category");
    if (!raw) {
      pendingCategoryRef.current = false;
      setCategorySlugs([]); setCategoryNames([]); setActiveCategoryName(null);
      setCategoryUnresolved(false);
      return;
    }

    // Slugs, not names: after the hierarchy landed, "Serum" exists under both
    // Skin Care and K-Beauty, so a name can no longer identify one column.
    const slugs = [...new Set(
      raw.split(",").map((t) => t.trim()).filter(Boolean)
        .flatMap((token) => categorySlugsFor(categoryTree, token))
    )];

    // Release the URL guard either way: an unresolvable slug is a dead link,
    // and holding the guard forever would freeze the URL for the whole visit.
    pendingCategoryRef.current = false;
    setCategorySlugs(slugs);
    setCategoryUnresolved(slugs.length === 0);
    setCategoryNames([...new Set(
      raw.split(",").map((t) => t.trim()).filter(Boolean)
        .flatMap((token) => categoryNamesFor(categoryTree, token))
    )]);
    setActiveCategoryName(findBySlug(categoryTree, raw.split(",")[0].trim())?.name ?? null);
  }, [categoryTree]);
  // ?sort=best|newest|... — same "read once on mount" pattern as ?sale=
  // above; an unrecognized/missing value falls back to "featured" rather
  // than crashing queryProducts on a bad sort id.
  const [sort, setSort] = useState(() => {
    const raw = new URLSearchParams(window.location.search).get("sort");
    return SORTS.some((s) => s.id === raw) ? raw : "featured";
  });
  const [visible, setVisible] = useState(PAGE);
  const [loading, setLoading] = useState(true); // true until the initial fetch settles
  const [loadingMore, setLoadingMore] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [quickView, setQuickView] = useState(null);
  const [products, setProducts] = useState([]);
  const [fetchError, setFetchError] = useState(null);

  // Land at the top when entering the page.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }, []);

  // Lock body scroll while the mobile filter sheet is open. Defense-in-depth
  // alongside `data-lenis-prevent` on the sheet's scroll body: even if a
  // native touch/wheel event escaped the sheet, the body itself can't move.
  // Desktop (lg+) doesn't render the sheet, so this no-ops there. Uses the
  // shared ref-counted lock so it can't leave the body stuck if it overlaps
  // with another overlay's lock.
  useBodyScrollLock(sheetOpen);

  const results = useMemo(() => {
    let list = queryProducts(products, { search, filters, sort });

    if (saleId) list = list.filter((p) => p.activeSaleId === saleId);

    // Menu-driven category selection, applied on top of the facet engine.
    // Held apart from queryProducts because that matches on category NAME and
    // names are no longer unique across the tree — this narrows by the
    // product's actual category slug instead.
    //
    // A ?category= that didn't resolve to any real node (dead nav link, or
    // stale ?category=<old-slug>) is NOT the same as no category being
    // requested at all — it must show empty, not fall through to the whole
    // catalog, or a broken category link silently looks like it worked.
    if (categoryUnresolved) return [];
    if (!categorySlugs.length) return list;

    if (productCategory.size > 0) {
      const wanted = new Set(categorySlugs);
      return list.filter((p) => wanted.has(productCategory.get(p.dbId ?? p.id)));
    }

    // Fallback: the map view isn't available (migration 0010 not applied, or
    // the request failed). Match on category NAME instead — correct for every
    // name that appears once, and the previous behaviour for all of them.
    // Better than returning the whole catalog and looking like the filter was
    // ignored. Still skipped entirely while names are empty.
    if (!categoryNames.length) return list;
    const wantedNames = new Set(categoryNames);
    return list.filter((p) => wantedNames.has(p.category));
  }, [products, search, filters, sort, categorySlugs, categoryNames, productCategory, saleId, categoryUnresolved]);

  // Fetch the live catalog. The skeleton (existing `loading` state — same UI
  // as before) now reflects a REAL fetch instead of a fixed timer. Extracted
  // so both the initial mount effect AND the error state's "Retry" button
  // share one code path. `fetchToken` guards against a stale request (e.g. a
  // retry fired, then the component unmounted, then the OLD request resolves)
  // clobbering newer state.
  const fetchToken = useRef(0);
  const fetchProducts = useCallback(() => {
    const token = ++fetchToken.current;
    setLoading(true);
    setFetchError(null);
    listProducts().then(({ data, error }) => {
      if (fetchToken.current !== token) return; // superseded or unmounted
      if (error) setFetchError(error);
      else setProducts(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    fetchProducts();
    return () => {
      fetchToken.current++; // invalidate any in-flight request on unmount
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch once on mount only
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
  const syncUrl = (nextFilters, currentSearch) => {
    // A `?category=<slug>` arriving from the mega menu cannot be resolved on
    // the first render — the category tree is still in flight, so `filters`
    // is legitimately empty. <PredictiveSearch> reports its empty query on
    // mount, which calls straight through to here, and without this guard
    // that first call rewrites the URL to a bare "/shop" and destroys the
    // slug before the tree ever lands. Hold off until it's resolved.
    if (pendingCategoryRef.current) return;

    const params = new URLSearchParams();
    if (currentSearch) params.set("q", currentSearch);
    Object.entries(nextFilters).forEach(([key, arr]) => {
      if (arr.length > 0) params.set(key, arr.join(","));
    });
    // sort/sale aren't part of `filters` (they're their own state), but the
    // URL should still reflect them — otherwise a shared/bookmarked
    // /shop?sort=best link silently loses its query on the very next
    // syncUrl call (e.g. PredictiveSearch reporting its empty query on
    // mount), even though the sort itself is still applied correctly.
    if (sort !== "featured") params.set("sort", sort);
    if (saleId) params.set("sale", saleId);
    const qs = params.toString();
    // Use replaceState so filter clicks don't bloat the history stack,
    // but the URL remains shareable. Clean path — query in the search string.
    window.history.replaceState(null, "", qs ? `/shop?${qs}` : "/shop");
  };

  const toggleFilter = (key, id) => {
    setFilters((f) => {
      const has = f[key].includes(id);
      const next = { ...f, [key]: has ? f[key].filter((x) => x !== id) : [...f[key], id] };
      syncUrl(next, search);
      return next;
    });
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    syncUrl(EMPTY_FILTERS, search);
  };
  const activeCount = countActive(filters);

  // Stable callback for <PredictiveSearch /> — keeps its debounce effect from
  // re-firing on every Shop render.
  const handleQueryChange = useCallback((q) => {
    setSearch(q);
    setFilters((currentFilters) => {
      syncUrl(currentFilters, q);
      return currentFilters;
    });
  }, []);

  // Trending = top 3 most-popular catalog items (drives the dropdown's empty state).
  const trending = useMemo(
    () => [...products].sort((a, b) => b.popularity - a.popularity).slice(0, 3),
    [products]
  );

  return (
    // The page scrolls naturally (no fixed shell → no black voids). The grid
    // rides the page scroll; the sidebar is sticky with its own scroll.
    // Mobile: normal scrolling page (filters in the off-canvas drawer).
    // Desktop (lg+): a fixed-height flex shell whose two panes scroll on their own.
    <div className="min-h-screen lg:flex lg:h-screen lg:flex-col lg:overflow-hidden">
      <div className="mx-auto flex w-full max-w-7xl flex-col px-5 sm:px-8 lg:min-h-0 lg:flex-1">
        {/* Header — compact on desktop to give the panes vertical room */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="lg:shrink-0"
        >
          <BackButton route="shop" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-magenta">
            Shop the ritual
          </p>
          <h1 className="mt-2 font-serif text-[clamp(2.25rem,6vw,4rem)] leading-[1.02] text-ink lg:text-3xl xl:text-4xl">
            All <span className="italic text-gradient-glow">glass-skin</span> essentials
          </h1>
          <p className="mt-3 max-w-xl text-ink-soft lg:hidden">
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
          <div className="flex flex-col gap-3 rounded-[1.25rem] bg-snow/70 p-3 backdrop-blur ring-1 ring-line sm:flex-row sm:items-center sm:bg-transparent sm:p-0 sm:ring-0 sm:backdrop-blur-0">
            {/* Predictive search — owns input, debounce, dropdown.
                onApplyFilter wraps the same toggleFilter the sidebar uses,
                so clicking a "Brand · Anua" hint just toggles that filter. */}
            <PredictiveSearch
              products={products}
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
                className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-medium text-ink ring-1 ring-line lg:hidden"
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
                      : "bg-white text-ink-soft ring-line"
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
            className="relative hidden lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:overflow-y-auto lg:overscroll-contain lg:rounded-2xl lg:bg-snow lg:p-4 lg:ring-1 lg:ring-line scrollbar-thin"
          >
            <FilterPanel filters={filters} onToggle={toggleFilter} onClear={clearFilters}
              hiddenGroups={saleId ? ["discount"] : []} />
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
              <p className="text-sm text-ink-soft">
                {loading ? "Curating…" : fetchError ? "" : `${results.length} products`}
              </p>

              {/* The menu-driven category isn't part of `filters`, so it gets
                  no ActiveChip. Without this the grid would look filtered for
                  no visible reason — and with no way back to everything. */}
              {activeCategoryName && !loading && !fetchError && (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-petal px-3 py-1 text-xs font-medium text-magenta">
                    {activeCategoryName}
                  </span>
                  <a href="/shop" className="text-xs text-ink-soft underline-offset-2 hover:text-magenta hover:underline">
                    Clear
                  </a>
                </div>
              )}

              {saleId && !loading && !fetchError && (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-magenta px-3 py-1 text-xs font-medium text-white">
                    {saleName ?? "Flash sale"}
                  </span>
                  <a href="/shop" className="text-xs text-ink-soft underline-offset-2 hover:text-magenta hover:underline">
                    Clear
                  </a>
                </div>
              )}

              {!fetchError && (
                <ActiveChips filters={filters} onToggle={toggleFilter} onClear={clearFilters} />
              )}
            </div>

            {/* States */}
            {loading ? (
              <Grid>
                {Array.from({ length: PAGE }).map((_, i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </Grid>
            ) : fetchError ? (
              <EmptyState
                emoji="🔌"
                title="Couldn't load the shop"
                message="Something went wrong reaching our catalog. Please check your connection and try again."
                actionLabel="Retry"
                onAction={fetchProducts}
              />
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
                  <p className="mt-12 text-center text-sm text-ink-soft">
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
              className="fixed inset-x-0 bottom-0 z-[var(--z-modal)] flex max-h-[85dvh] flex-col overflow-hidden rounded-t-[1.75rem] bg-white shadow-lift lg:hidden"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 260, damping: 30 }}
            >
              {/* Non-scrolling header — drag handle */}
              <div className="shrink-0 px-6 pt-5">
                <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-line" />
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
                  hiddenGroups={saleId ? ["discount"] : []}
                />
              </div>

              {/* Non-scrolling footer — always visible, even on tall filter lists */}
              <div className="shrink-0 border-t border-line bg-white px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3">
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
