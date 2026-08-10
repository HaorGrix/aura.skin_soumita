import { lazy, Suspense, useEffect, useState, useMemo, useCallback } from "react";
import { ReactLenis } from "lenis/react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { PRODUCTS, BRANDS, CATEGORIES } from "./data/products.js";
import PredictiveSearch from "./components/shop/PredictiveSearch.jsx";
import { CartProvider } from "./context/CartContext.jsx";
import { UserProvider } from "./context/UserContext.jsx";
import { WishlistProvider } from "./context/WishlistContext.jsx";
import { ToastProvider } from "./components/ui/Toast.jsx";
import Loader from "./components/Loader.jsx";
import Navbar from "./components/Navbar.jsx";
import Home from "./pages/Home.jsx";
import CartDrawer from "./components/cart/CartDrawer.jsx";
import AuthModal from "./components/auth/AuthModal.jsx";
import FloatingCart from "./components/FloatingCart.jsx";
import { recordRoute } from "./lib/nav-history.js";
import { navigate, onRouteChange } from "./lib/navigate.js";
import { applySeo } from "./lib/seo.js";

// Route-level code splitting — the home page loads eagerly; the rest lazy-load.
const Shop = lazy(() => import("./pages/Shop.jsx"));
const Product = lazy(() => import("./pages/Product.jsx"));
const Cart = lazy(() => import("./pages/Cart.jsx"));
const Checkout = lazy(() => import("./pages/Checkout.jsx"));
const Account = lazy(() => import("./pages/Account.jsx"));
const Wishlist = lazy(() => import("./pages/Wishlist.jsx"));
const Contact = lazy(() => import("./pages/Contact.jsx"));
const About = lazy(() => import("./pages/About.jsx"));
const Rewards = lazy(() => import("./pages/Rewards.jsx"));
const Offers = lazy(() => import("./pages/Offers.jsx"));
const Journal = lazy(() => import("./pages/Articles.jsx"));
const NotFound = lazy(() => import("./pages/NotFound.jsx"));
// The whole admin panel is one lazy chunk — storefront visitors never
// download a byte of it.
const AdminApp = lazy(() => import("./admin/AdminApp.jsx"));
import ErrorBoundary from "./components/ui/ErrorBoundary.jsx";

function RouteFallback() {
  return (
    <div className="grid min-h-[60vh] place-items-center pt-32">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-magenta border-t-transparent" />
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
    if (p === "/admin" || p.startsWith("/admin/")) return { name: "admin" };
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
    return { name: "404" };
  }, []);
  const [route, setRoute] = useState(parse);
  // onRouteChange listens on popstate (browser back/forward) + our synthetic
  // navigate() event; it returns the matching cleanup fn for the effect.
  useEffect(() => onRouteChange(() => setRoute(parse())), [parse]);
  return route;
}

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const route = useRoute();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const trending = useMemo(() => [...PRODUCTS].sort((a, b) => b.popularity - a.popularity).slice(0, 3), []);

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

  // Per-route SEO: title, description, canonical, OG tags + robots noindex.
  useEffect(() => {
    applySeo(route);
  }, [route]);

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
          {/* Entry ritual */}
          <Loader onComplete={() => setLoaded(true)} />

          <Navbar onOpenSearch={() => setIsSearchOpen(true)} hasHero={hasHero} />

          <AnimatePresence>
            {isSearchOpen && (
              <motion.div
                className="fixed inset-0 z-[var(--z-modal)] bg-ink/60 backdrop-blur-sm p-4 sm:p-10 flex flex-col items-center pt-24"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsSearchOpen(false)}
              >
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: -20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -20 }}
                  className="w-full max-w-2xl relative"
                  onClick={e => e.stopPropagation()}
                >
                  <button onClick={() => setIsSearchOpen(false)} className="absolute -right-2 -top-12 sm:-right-4 sm:-top-4 text-white/80 hover:text-white p-2">
                    <X className="h-6 w-6" strokeWidth={1.5} />
                  </button>
                  <div className="bg-white rounded-2xl shadow-lift w-full relative z-[var(--z-dropdown)]">
                    <PredictiveSearch 
                      products={PRODUCTS} brands={BRANDS} categories={CATEGORIES} trending={trending}
                      onQueryChange={() => {}} onApplyFilter={(key, val) => {
                        navigate(`/shop?${key}=${val}`);
                        setIsSearchOpen(false);
                      }}
                    />
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <CartDrawer />

          {/* Login / sign-up — global, opened on demand (navbar, checkout) */}
          <AuthModal />

          {/* Floating cart FAB — sits above the loader (z-140 > z-100), so gate
              it on the splash finishing. Also hidden on the cart/checkout pages,
              where opening the cart drawer is redundant — consistent behaviour
              everywhere else (it self-hides when the cart is empty). */}
          {loaded && route.name !== "cart" && route.name !== "checkout" && (
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
