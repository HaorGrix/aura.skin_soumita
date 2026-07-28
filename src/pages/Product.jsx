import { navigate } from "../lib/navigate.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, Home } from "lucide-react";
import { getProductDetail, getRelated } from "../data/product-details.js";
import { useUser } from "../context/UserContext.jsx";
import { smartNavigate } from "../lib/nav-history.js";
import Gallery from "../components/pdp/Gallery.jsx";
import ProductInfo from "../components/pdp/ProductInfo.jsx";
import ProductTabs from "../components/pdp/ProductTabs.jsx";
import RelatedProducts from "../components/pdp/RelatedProducts.jsx";
import PdpSkeleton from "../components/pdp/PdpSkeleton.jsx";
import QuickViewModal from "../components/shop/QuickViewModal.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";

export default function Product({ id }) {
  const { authed, openAuth } = useUser();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("description");
  const [quickView, setQuickView] = useState(null);
  const tabsRef = useRef(null);

  const product = useMemo(() => getProductDetail(id), [id]);
  const related = useMemo(() => (product ? getRelated(product, 8) : []), [product]);

  // Reset + simulate fetch whenever the product id changes.
  useEffect(() => {
    setLoading(true);
    setTab("description");
    window.scrollTo({ top: 0, behavior: "auto" });
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, [id]);

  const goReviews = () => {
    setTab("reviews");
    setTimeout(
      () => tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      60
    );
  };

  if (loading) return <PdpSkeleton />;

  if (!product) {
    return (
      <div>
        <EmptyState
          emoji="🫧"
          title="We couldn’t find that product"
          message="It may have sold out or moved. Let’s get you back to the good stuff."
          actionLabel="Back to Shop"
          onAction={() => (navigate("/shop"))}
        />
      </div>
    );
  }

  return (
    /* Tight mobile gutters (px-4) for an immersive, edge-to-edge feel like
       Sephora/ASOS; generous on desktop. Bottom padding clears the mobile
       sticky add-bar (~70px). */
    <div className="pb-28 lg:pb-24">
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
        {/* Breadcrumb / back */}
        <motion.nav
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-2 text-sm text-ink-soft"
          aria-label="Breadcrumb"
        >
          <a href="/" className="inline-flex items-center gap-1 hover:text-magenta">
            <Home className="h-3.5 w-3.5" strokeWidth={1.8} /> Home
          </a>
          <span>/</span>
          <a href="/shop" className="hover:text-magenta">Shop</a>
          <span>/</span>
          <span className="truncate text-ink">{product.name}</span>
        </motion.nav>

        <a
          href="/shop"
          onClick={(e) => {
            e.preventDefault();
            smartNavigate("/shop", "shop", "product");
          }}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft transition-colors hover:text-magenta"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.8} /> Back to Shop
        </a>

        {/* Main: gallery + sticky info.
            Slight gallery-favored ratio (1.05:1) gives the hero image more
            visual weight without crowding the info column — standard PDP
            balance on Sephora/ASOS. Mobile stays single-column. */}
        <div className="mt-6 grid gap-8 sm:gap-10 lg:grid-cols-[1.05fr_1fr] xl:gap-14">
          <Gallery product={product} />
          <ProductInfo product={product} related={related} onWriteReview={goReviews} />
        </div>

        {/* Tabs */}
        <div ref={tabsRef}>
          <ProductTabs
            product={product}
            active={tab}
            onChange={setTab}
            onWriteReview={goReviews}
          />
          {/* Only guests need the sign-in nudge — and it needs a way to act on it. */}
          {!authed && (
            <p className="mt-2 text-center text-sm italic text-ink-soft">
              Verified purchases only —{" "}
              <button
                onClick={() => openAuth("login")}
                className="font-semibold not-italic text-magenta hover:underline"
              >
                sign in
              </button>{" "}
              to share your glow ritual.
            </p>
          )}
        </div>

        {/* Complete your ritual */}
        <RelatedProducts products={related.slice(0, 8)} onQuickView={setQuickView} />
      </div>

      <QuickViewModal product={quickView} onClose={() => setQuickView(null)} />
    </div>
  );
}
