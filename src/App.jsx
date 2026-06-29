import { lazy, Suspense, useEffect, useState } from "react";
import { ReactLenis } from "lenis/react";
import { CartProvider } from "./context/CartContext.jsx";
import { UserProvider } from "./context/UserContext.jsx";
import { WishlistProvider } from "./context/WishlistContext.jsx";
import { ToastProvider } from "./components/ui/Toast.jsx";
import Loader from "./components/Loader.jsx";
import Navbar from "./components/Navbar.jsx";
import Home from "./pages/Home.jsx";
import CartDrawer from "./components/cart/CartDrawer.jsx";
import FloatingCart from "./components/FloatingCart.jsx";

// Route-level code splitting — the home page loads eagerly; the rest lazy-load.
const Shop = lazy(() => import("./pages/Shop.jsx"));
const Product = lazy(() => import("./pages/Product.jsx"));
const Cart = lazy(() => import("./pages/Cart.jsx"));
const Checkout = lazy(() => import("./pages/Checkout.jsx"));
const Account = lazy(() => import("./pages/Account.jsx"));
const Wishlist = lazy(() => import("./pages/Wishlist.jsx"));
const About = lazy(() => import("./pages/About.jsx"));
const Contact = lazy(() => import("./pages/Contact.jsx"));

function RouteFallback() {
  return (
    <div className="grid min-h-[60vh] place-items-center pt-32">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-magenta border-t-transparent" />
    </div>
  );
}

// Minimal hash router — keeps the SPA tiny while we add pages.
function useRoute() {
  const parse = () => {
    const h = window.location.hash;
    if (h.startsWith("#/product/"))
      return { name: "product", id: decodeURIComponent(h.slice("#/product/".length)) };
    if (h.startsWith("#/shop")) return { name: "shop" };
    if (h.startsWith("#/cart")) return { name: "cart" };
    if (h.startsWith("#/checkout")) return { name: "checkout" };
    if (h.startsWith("#/account")) return { name: "account" };
    if (h.startsWith("#/wishlist")) return { name: "wishlist" };
    if (h.startsWith("#/about")) return { name: "about" };
    if (h.startsWith("#/contact")) return { name: "contact" };
    return { name: "home" };
  };
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const onChange = () => setRoute(parse());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const route = useRoute();
  // Dark-mode dominant: default to dark unless the user has opted into light.
  const [isDark, setIsDark] = useState(true);

  // Sync the dark class on <html>.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  // Respect saved preference on first paint (defaults to dark).
  useEffect(() => {
    const saved = localStorage.getItem("aura-theme");
    if (saved) setIsDark(saved === "dark");
  }, []);

  const toggleTheme = () =>
    setIsDark((d) => {
      localStorage.setItem("aura-theme", !d ? "dark" : "light");
      return !d;
    });

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

          <Navbar onToggleTheme={toggleTheme} isDark={isDark} />

          <CartDrawer />

          {/* Floating cart FAB — sits above the loader (z-140 > z-100), so gate
              it on the splash finishing. Hidden while the loader is active,
              visible everywhere else (it self-hides when the cart is empty). */}
          {loaded && <FloatingCart />}

          <main>
            <Suspense fallback={<RouteFallback />}>
              {route.name === "product" ? (
                <Product id={route.id} />
              ) : route.name === "shop" ? (
                <Shop />
              ) : route.name === "cart" ? (
                <Cart />
              ) : route.name === "checkout" ? (
                <Checkout />
              ) : route.name === "account" ? (
                <Account />
              ) : route.name === "wishlist" ? (
                <Wishlist />
              ) : route.name === "about" ? (
                <About />
              ) : route.name === "contact" ? (
                <Contact />
              ) : (
                <Home />
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
