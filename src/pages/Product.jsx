import { navigate } from "../lib/navigate.js";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, Home } from "lucide-react";
import { buildPdp, pickRelated } from "../data/product-details.js";
import { getProductBySlug, listProducts } from "../lib/api/products.js";
import { useUser } from "../context/UserContext.jsx";
import { useStoreSettings } from "../lib/api/settings.js";
import { applyProductSeo } from "../lib/seo.js";
import { smartNavigate } from "../lib/nav-history.js";
import Gallery from "../components/pdp/Gallery.jsx";
import ProductInfo from "../components/pdp/ProductInfo.jsx";
import ProductTabs from "../components/pdp/ProductTabs.jsx";
import RelatedProducts from "../components/pdp/RelatedProducts.jsx";
import PdpSkeleton from "../components/pdp/PdpSkeleton.jsx";
import QuickViewModal from "../components/shop/QuickViewModal.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { trackEvent } from "../lib/analytics.js";
import { CONVERSION_RATE, CURRENCY } from "../lib/format.js";

export default function Product({ id }) {
  const { authed, openAuth } = useUser();
  const { storeName } = useStoreSettings();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("description");
  const [quickView, setQuickView] = useState(null);
  const tabsRef = useRef(null);

  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [error, setError] = useState(null);

  /**
   * Load the product from Supabase.
   *
   * `id` is the URL slug. getProductBySlug() returns the same legacy-shaped
   * object the static catalog produced, so buildPdp() — which adds benefits,
   * ingredient copy, how-to, variants and the review block — is reused
   * unchanged. Only the data source moved.
   *
   * The related rail needs the wider catalog to score against, so it's a
   * second, non-blocking request: the PDP renders as soon as the product
   * itself lands rather than waiting on 139 rows it doesn't need yet.
   */
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setProduct(null);
    setRelated([]);
    setTab("description");
    window.scrollTo({ top: 0, behavior: "auto" });

    (async () => {
      const { data, error } = await getProductBySlug(id);
      if (!alive) return;

      if (error) {
        setError(error);
        setLoading(false);
        return;
      }
      if (!data) {
        setProduct(null);      // falls through to the not-found state below
        setLoading(false);
        return;
      }

      const pdp = buildPdp(data);
      setProduct(pdp);
      setLoading(false);
      applyProductSeo(pdp, storeName);

      trackEvent("ViewContent", {
        content_ids: [pdp.id],
        content_name: pdp.name,
        content_type: "product",
        value: (Number(pdp.price) || 0) * CONVERSION_RATE,
        currency: CURRENCY.code,
      });

      const { data: all } = await listProducts();
      if (alive && all) setRelated(pickRelated(all, pdp, 8));
    })();

    return () => { alive = false; };
  }, [id]);

  const goReviews = () => {
    setTab("reviews");
    setTimeout(
      () => tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      60
    );
  };

  if (loading) return <PdpSkeleton />;

  /* A failed request is NOT the same as a product that doesn't exist —
     telling someone their product is gone when the network blipped sends
     them away for no reason. Offer a retry instead. */
  if (error) {
    return (
      <div>
        <EmptyState
          emoji="📡"
          title="We couldn’t load this product"
          message="Something went wrong reaching our shelves. Please try again."
          actionLabel="Try again"
          onAction={() => window.location.reload()}
        />
      </div>
    );
  }

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
      <div className="relative z-10 mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-10">
        {/* Breadcrumb / back — the shared page paddingTop (App.jsx's
            --header-h, published by <Navbar>) clears the fixed header
            EXACTLY, with no margin of its own, so without this pt-4 the
            breadcrumb rendered flush against the header's bottom edge —
            visibly touching it, not just close to it. */}
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
          <ProductInfo product={product} onWriteReview={goReviews} />
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
