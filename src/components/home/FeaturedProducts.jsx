import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { PRODUCTS } from "../../data/products.js";
import ProductCard from "../ui/ProductCard.jsx";
import QuickViewModal from "../shop/QuickViewModal.jsx";

const TABS = [
  { id: "best", label: "Best Sellers" },
  { id: "new", label: "New Arrivals" },
];

export default function FeaturedProducts() {
  const [tab, setTab] = useState("best");
  const [quickView, setQuickView] = useState(null);

  const items = useMemo(() => {
    if (tab === "new")
      // Only show products tagged isNew, ranked by popularity.
      return [...PRODUCTS]
        .filter((p) => p.isNew)
        .sort((a, b) => b.popularity - a.popularity)
        .slice(0, 8);
    // Best Sellers: rank by salesCount (synthetic units-sold), matching the Shop page.
    return [...PRODUCTS].sort((a, b) => b.salesCount - a.salesCount).slice(0, 8);
  }, [tab]);

  return (
    <section id="featured" className="py-10 sm:py-14">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-magenta">
              Loved by 12k+ glowing humans
            </p>
            <h2 className="mt-2 font-serif text-[clamp(1.9rem,4.5vw,3.25rem)] leading-tight text-ink">
              Shelf <span className="italic text-gradient-glow">favourites</span>
            </h2>
          </div>

          {/* Tab switch */}
          <div className="flex rounded-full bg-snow p-1 ring-1 ring-line">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="relative rounded-full px-5 py-2 text-sm font-medium"
              >
                {tab === t.id && (
                  <motion.span
                    layoutId="featured-tab"
                    className="absolute inset-0 rounded-full bg-magenta"
                    transition={{ type: "spring", stiffness: 360, damping: 30 }}
                  />
                )}
                <span className={`relative z-10 ${tab === t.id ? "text-white" : "text-ink-soft"}`}>
                  {t.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
            className="mt-10 grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 xl:grid-cols-4"
          >
            {items.map((p) => (
              <ProductCard key={p.id} product={p} onQuickView={setQuickView} />
            ))}
          </motion.div>
        </AnimatePresence>

        <div className="mt-12 text-center">
          <a
            href="#/shop"
            className="inline-flex items-center gap-2 rounded-full border border-ink/15 px-8 py-3.5 text-sm font-semibold text-ink transition-colors hover:border-magenta/50 hover:text-magenta"
          >
            Shop all products <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </a>
        </div>
      </div>

      <QuickViewModal product={quickView} onClose={() => setQuickView(null)} />
    </section>
  );
}
