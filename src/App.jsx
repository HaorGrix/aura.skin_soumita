import { lazy, startTransition, Suspense, useEffect, useRef, useState, useMemo, useCallback } from "react";
import { ReactLenis } from "lenis/react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { listProducts } from "./lib/api/products.js";
import PredictiveSearch from "./components/shop/PredictiveSearch.jsx";
import { CartProvider } from "./context/CartContext.jsx";
import { UserProvider } from "./context/UserContext.jsx";
import { WishlistProvider } from "./context/WishlistContext.jsx";
import { ToastProvider } from "./components/ui/Toast.jsx";
import Navbar from "./components/Navbar.jsx";
import Home from "./pages/Home.jsx";
import CartDrawer from "./components/cart/CartDrawer.jsx";
import AuthModal from "./components/auth/AuthModal.jsx";
import FloatingCart from "./components/FloatingCart.jsx";
import { recordRoute } from "./lib/nav-history.js";
import { navigate, onRouteChange } from "./lib/navigate.js";
import { isAdminPath } from "./lib/adminPath.js";
import { applySeo } from "./lib/seo.js";
import { useStoreSettings } from "./lib/api/settings.js";
import { categoryFacetOptions, useCategoryTree } from "./lib/api/categories.js";
import { injectMetaPixel, trackEvent } from "./lib/analytics.js";

// Route-level code splitting — the home page loads eagerly; the rest lazy-load.
// The loaders for the pages a shopper reaches first are kept as functions so
// they can also be fetched in the background right after the home page
// renders (see the preload effect in App), before anyone taps a link.
const loadShop = () => import("./pages/Shop.jsx");
const loadProduct = () => import("./pages/Product.jsx");
const loadCart = () => import("./pages/Cart.jsx");
const loadCheckout = () => import("./pages/Checkout.jsx");
const loadOffers = () => import("./pages/Offers.jsx");
const Shop = lazy(loadShop);
const Product = lazy(loadProduct);
const Cart = lazy(loadCart);
const Checkout = lazy(loadCheckout);
const Account = lazy(() => import("./pages/Account.jsx"));
const Wishlist = lazy(() => import("./pages/Wishlist.jsx"));
const Contact = lazy(() => import("./pages/Contact.jsx"));
const About = lazy(() => import("./pages/About.jsx"));
const Rewards = lazy(() => import("./pages/Rewards.jsx"));
const Offers = lazy(loadOffers);
const Journal = lazy(() => import("./pages/Articles.jsx"));
const JournalArticle = lazy(() => import("./pages/JournalArticle.jsx"));
const ShippingReturns = lazy(() => import("./pages/ShippingReturns.jsx"));
const TrackOrder = lazy(() => import("./pages/TrackOrder.jsx"));
const Privacy = lazy(() => import("./pages/Privacy.jsx"));
const Terms = lazy(() => import("./pages/Terms.jsx"));
const Cookies = lazy(() => import("./pages/Cookies.jsx"));
const NotFound = lazy(() => import("./pages/NotFound.jsx"));
// The whole admin panel is one lazy chunk — storefront visitors never
// download a byte of it.
const AdminApp = lazy(() => import("./admin/AdminApp.jsx"));
import ErrorBoundary from "./components/ui/ErrorBoundary.jsx";

// Shown only when a page is opened directly (first load or refresh) before
// its code has arrived. In-app navigation never reaches it: route changes run
// in a transition, so the current page stays until the next one is ready.
// A thin bar at the top instead of a full-screen spinner.
function RouteFallback() {
  return (
    <div className="min-h-[60vh]" aria-busy="true" aria-label="Loading">
      <div className="fixed inset-x-0 top-0 z-[200] h-0.5 overflow-hidden bg-magenta/15">
        <div className="h-full w-1/3 animate-[route-progress_1.1s_ease-in-out_infinite] bg-magenta" />
      </div>
    </div>
  );
}

// Minimal History-API router — clean paths (/shop, /product/slug), no hash.
// Query (?concern=…) lives in location.search and fragments (#section) in
// location.hash; the route is derived purely from the pathname.
function useRoute() {
  const parse = useCallback(() => {
    // Normalize a trailing slash away (except root); query + fragment are ignored.
    let p = window.location.pathname.replace(/\/+$/, "");
    if (p === "") p = "/";
    // Admin does its own /admin/* sub-routing and renders outside the
    // storefront chrome, so it's matched before any storefront route.
    // isAdminPath is the SAME check AdminApp.jsx's own dev-time safeguard
    // uses (src/lib/adminPath.js) — shared rather than re-derived here, so
    // the two routers can never drift on where the admin boundary is.
    if (isAdminPath(p)) return { name: "admin" };
    if (p === "/") return { name: "home" };
    if (p.startsWith("/product/")) {
      let id = p.slice("/product/".length);
      // Guard: a malformed %-sequence must not throw and kill route parsing.
      try { id = decodeURIComponent(id); } catch { /* keep raw slug */ }
      return { name: "product", id };
    }
    if (p === "/shop") return { name: "shop" };
    if (p === "/cart") return { name: "cart" };
    if (p === "/checkout") return { name: "checkout" };
    if (p === "/account") return { name: "account" };
    if (p === "/wishlist") return { name: "wishlist" };
    if (p === "/contact") return { name: "contact" };
    if (p === "/about") return { name: "about" };
    if (p === "/rewards") return { name: "rewards" };
    if (p === "/offers") return { name: "offers" };
    if (p === "/journal") return { name: "journal" };
    if (p.startsWith("/journal/")) {
      let slug = p.slice("/journal/".length);
      try { slug = decodeURIComponent(slug); } catch { /* keep raw slug */ }
      return { name: "journal-article", slug };
    }
    if (p === "/shipping") return { name: "shipping" };
    if (p === "/track") return { name: "track" };
    if (p === "/privacy") return { name: "privacy" };
    if (p === "/terms") return { name: "terms" };
    if (p === "/cookies") return { name: "cookies" };
    return { name: "404" };
  }, []);
  const [route, setRoute] = useState(parse);
  // onRouteChange listens on popstate (browser back/forward) + our synthetic
  // navigate() event; it returns the matching cleanup fn for the effect.
  //
  // startTransition: React keeps the current page on screen while a lazy
  // page's code downloads, instead of swapping it for the Suspense fallback.
  useEffect(() => onRouteChange(() => startTransition(() => setRoute(parse()))), [parse]);
  return route;
}

export default function App() {
  const route = useRoute();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const storeSettings = useStoreSettings();

  // The header search's catalog. Empty until the live list loads — never the
  // bundled demo catalog, whose products don't exist in the shop (tapping one
  // opened a broken /product/undefined page).
  const [liveProducts, setLiveProducts] = useState([]);
  const [productsLoaded, setProductsLoaded] = useState(false);

  // Fetch the most-visited pages' code once the browser is idle, so the first
  // tap on Shop, a product, an offer or the cart opens instantly.
  useEffect(() => {
    const preload = () => [loadShop, loadProduct, loadOffers, loadCart, loadCheckout].forEach((load) => load());
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(preload, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(preload, 2500);
    return () => clearTimeout(t);
  }, []);

  // After a deploy, a tab opened earlier asks for page code that no longer
  // exists. Reload once to pick up the new build instead of showing the
  // error screen; the session flag stops a reload loop if it keeps failing.
  useEffect(() => {
    const onPreloadError = (event) => {
      try {
        if (sessionStorage.getItem("skinscript_chunk_reload")) return;
        sessionStorage.setItem("skinscript_chunk_reload", "1");
      } catch {
        return;
      }
      event.preventDefault();
      window.location.reload();
    };
    window.addEventListener("vite:preloadError", onPreloadError);
    return () => window.removeEventListener("vite:preloadError", onPreloadError);
  }, []);

  useEffect(() => {
    let alive = true;
    listProducts().then(({ data }) => {
      if (!alive) return;
      if (data) setLiveProducts(data);
      setProductsLoaded(true);
    });
    return () => { alive = false; };
  }, []);

  const trending = useMemo(() => [...liveProducts].sort((a, b) => b.popularity - a.popularity).slice(0, 3), [liveProducts]);
  // Search hints ("Brand · Anua", "Category · Serum"): brands from the live
  // catalog, categories from the admin's category tree.
  const searchBrands = useMemo(
    () => [...new Set(liveProducts.map((p) => p.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [liveProducts]
  );
  const categoryTree = useCategoryTree();
  const searchCategories = useMemo(() => categoryFacetOptions(categoryTree), [categoryTree]);

  // Same "full-bleed, owns its own top spacing" set the padding logic below
  // already uses — these are the only routes with a hero/banner directly
  // under the header for it to transparently overlay. Every other route has
  // no hero image at all, so the header should just be solid from the start
  // there (see Navbar's hasHero prop).
  const hasHero = ["home", "about", "contact"].includes(route.name);

  // Feed our own route stack — BackButton resolves a loop-proof target from it.
  useEffect(() => {
    recordRoute(route.name);
  }, [route.name]);

  // Meta Pixel PageView for in-app navigation. The pixel's own PageView only
  // covers the first page load; every later page is a client-side route
  // change. trackEvent() is a no-op until the pixel has loaded, and the
  // first run is skipped because injectMetaPixel() already counted it.
  // Keyed on the path: one page can emit several route updates (e.g. a
  // product page settling its URL), which used to count as two PageViews.
  const lastTrackedPath = useRef(window.location.pathname);
  useEffect(() => {
    const path = window.location.pathname;
    if (path === lastTrackedPath.current) return;
    lastTrackedPath.current = path;
    trackEvent("PageView");
  }, [route]);

  // Per-route SEO: title, description, canonical, OG tags + robots noindex.
  // Re-runs when the live store name changes too, so a rebrand from
  // /admin/settings retitles the current page immediately.
  useEffect(() => {
    applySeo(route, storeSettings.storeName);
  }, [route, storeSettings.storeName]);

  // Meta Pixel: DB-driven, never hardcoded. Only fires once both a saved ID
  // and the enable toggle are true — a fresh install or a disabled pixel
  // injects nothing. Runs on the storefront only (admin returns early below).
  useEffect(() => {
    if (storeSettings.metaPixelEnabled && storeSettings.metaPixelId) {
      injectMetaPixel(storeSettings.metaPixelId);
    }
  }, [storeSettings.metaPixelEnabled, storeSettings.metaPixelId]);

  // Honour a #fragment in the URL (e.g. the hero's #featured) by smooth-scrolling
  // to the matching element after React paints. rAF gives one frame for the DOM
  // to settle before querying. Clean-URL routes carry no hash, so this only
  // fires for genuine in-page anchors.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    const raf = requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(raf);
  }, [route]);

  // The admin renders on its own, deliberately outside every storefront
  // provider and effect below: no Lenis smooth scroll, no intro Loader, no
  // Navbar, no cart drawer, no FloatingCart. It's a working tool, not a
  // shopping experience — and none of that chrome makes sense over a data
  // grid. Placed after all hooks so the hook order stays stable.
  if (route.name === "admin") {
    return (
      <Suspense fallback={<RouteFallback />}>
        <ErrorBoundary><AdminApp /></ErrorBoundary>
      </Suspense>
    );
  }

  return (
    <ReactLenis
      root
      options={{
        lerp: 0.1,
        duration: 1.4,
        smoothWheel: true,
        wheelMultiplier: 1,
        touchMultiplier: 2,
      }}
    >
      <CartProvider>
        <UserProvider>
        <WishlistProvider>
        <ToastProvider>
          <Navbar onOpenSearch={() => setIsSearchOpen(true)} hasHero={hasHero} />

          <AnimatePresence>
            {isSearchOpen && (
              <motion.div
                className="fixed inset-0 z-[var(--z-modal)] bg-ink/60 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsSearchOpen(false)}
              >
                <motion.div 
                  initial={{ y: "-100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "-100%" }}
                  transition={{ type: "tween", ease: [0.22, 1, 0.36, 1], duration: 0.4 }}
                  className="w-full bg-snow shadow-lift pt-8 pb-12 px-5 sm:px-8 relative max-h-[90vh] overflow-y-auto scrollbar-thin rounded-b-3xl"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="max-w-6xl mx-auto flex items-start gap-4">
                    <div className="w-full relative z-[var(--z-dropdown)] flex-1">
                      <PredictiveSearch 
                        products={liveProducts} brands={searchBrands} categories={searchCategories} trending={trending}
                        loading={!productsLoaded}
                        onQueryChange={() => {}} 
                        onSubmit={(q) => {
                          navigate(`/shop?q=${encodeURIComponent(q)}`);
                          setIsSearchOpen(false);
                        }}
                        onApplyFilter={(key, val) => {
                          navigate(`/shop?${key}=${val}`);
                          setIsSearchOpen(false);
                        }}
                        variant="megamenu"
                        onClose={() => setIsSearchOpen(false)}
                      />
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <CartDrawer />

          {/* Login / sign-up — global, opened on demand (navbar, checkout) */}
          <AuthModal />

          {/* Floating cart FAB — hidden on the cart/checkout pages, where
              opening the cart drawer is redundant — consistent behaviour
              everywhere else (it self-hides when the cart is empty). */}
          {route.name !== "cart" && route.name !== "checkout" && (
            <FloatingCart />
          )}

          {/* Full-bleed pages (home/about/contact) own their top spacing; every
              other route clears the fixed header dynamically via --header-h
              (published by <Navbar>). The 11rem fallback matches the old pt-44
              so first paint (before measurement) never overlaps. */}
          <main
            className="relative w-full overflow-x-hidden"
            style={hasHero ? undefined : { paddingTop: "var(--header-h, 11rem)" }}
          >
            <Suspense fallback={<RouteFallback />}>
              {route.name === "product" ? (
                <ErrorBoundary><Product id={route.id} /></ErrorBoundary>
              ) : route.name === "shop" ? (
                <ErrorBoundary><Shop /></ErrorBoundary>
              ) : route.name === "cart" ? (
                <ErrorBoundary><Cart /></ErrorBoundary>
              ) : route.name === "checkout" ? (
                <ErrorBoundary><Checkout /></ErrorBoundary>
              ) : route.name === "account" ? (
                <ErrorBoundary><Account /></ErrorBoundary>
              ) : route.name === "wishlist" ? (
                <ErrorBoundary><Wishlist /></ErrorBoundary>
              ) : route.name === "contact" ? (
                <ErrorBoundary><Contact /></ErrorBoundary>
              ) : route.name === "about" ? (
                <ErrorBoundary><About /></ErrorBoundary>
              ) : route.name === "rewards" ? (
                <ErrorBoundary><Rewards /></ErrorBoundary>
              ) : route.name === "offers" ? (
                <ErrorBoundary><Offers /></ErrorBoundary>
              ) : route.name === "journal" ? (
                <ErrorBoundary><Journal /></ErrorBoundary>
              ) : route.name === "journal-article" ? (
                <ErrorBoundary><JournalArticle slug={route.slug} /></ErrorBoundary>
              ) : route.name === "shipping" ? (
                <ErrorBoundary><ShippingReturns /></ErrorBoundary>
              ) : route.name === "track" ? (
                <ErrorBoundary><TrackOrder /></ErrorBoundary>
              ) : route.name === "privacy" ? (
                <ErrorBoundary><Privacy /></ErrorBoundary>
              ) : route.name === "terms" ? (
                <ErrorBoundary><Terms /></ErrorBoundary>
              ) : route.name === "cookies" ? (
                <ErrorBoundary><Cookies /></ErrorBoundary>
              ) : route.name === "home" ? (
                <ErrorBoundary><Home /></ErrorBoundary>
              ) : (
                <ErrorBoundary><NotFound /></ErrorBoundary>
              )}
            </Suspense>
          </main>
        </ToastProvider>
        </WishlistProvider>
        </UserProvider>
      </CartProvider>
    </ReactLenis>
  );
}
