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
import ErrorBoundary from "./components/ui/ErrorBoundary.jsx";

function RouteFallback() {
  return (
    <div className="grid min-h-[60vh] place-items-center pt-32">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-magenta border-t-transparent" />
    </div>
  );
}

// Minimal hash router — keeps the SPA tiny while we add pages.
function useRoute() {
  const parse = useCallback(() => {
    const h = window.location.hash;
    if (h === "" || h === "#/" || h.startsWith("#/?")) return { name: "home" };
    if (h.startsWith("#/product/"))
      return { name: "product", id: decodeURIComponent(h.slice("#/product/".length)) };
    if (h.startsWith("#/shop")) return { name: "shop" };
    if (h.startsWith("#/cart")) return { name: "cart" };
    if (h.startsWith("#/checkout")) return { name: "checkout" };
    if (h.startsWith("#/account")) return { name: "account" };
    if (h.startsWith("#/wishlist")) return { name: "wishlist" };
    if (h.startsWith("#/contact")) return { name: "contact" };
    if (h.startsWith("#/about")) return { name: "about" };
    if (h.startsWith("#/rewards")) return { name: "rewards" };
    if (h.startsWith("#/offers")) return { name: "offers" };
    if (h.startsWith("#/journal")) return { name: "journal" };
    // Plain anchor (e.g. #rituals) — not a SPA route.
    // Return "home" so the home page stays/mounts; the scroll-to-id useEffect
    // in <App> then scrolls to the matching section after React finishes painting.
    if (h.startsWith("#") && !h.startsWith("#/")) return { name: "home" };
    return { name: "404" };
  }, []);
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const onChange = () => setRoute(parse());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, [parse]);
  return route;
}

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const route = useRoute();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const trending = useMemo(() => [...PRODUCTS].sort((a, b) => b.popularity - a.popularity).slice(0, 3), []);

  // Feed our own route stack — BackButton resolves a loop-proof target from it.
  useEffect(() => {
    recordRoute(route.name);
  }, [route.name]);

  // When a plain anchor (e.g. #offers, #rituals) routes back to "home", scroll
  // to the matching section after React finishes painting. rAF gives one frame
  // for the DOM to settle before querying the element.
  useEffect(() => {
    if (route.name !== "home") return;
    const h = window.location.hash;
    if (!h.startsWith("#") || h.startsWith("#/") || h.length <= 1) return;
    const id = h.slice(1);
    const raf = requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(raf);
  }, [route]);

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

          <Navbar onOpenSearch={() => setIsSearchOpen(true)} />

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
                        window.location.hash = `#/shop?${key}=${val}`;
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
            style={
              ["home", "about", "contact"].includes(route.name)
                ? undefined
                : { paddingTop: "var(--header-h, 11rem)" }
            }
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
