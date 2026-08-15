import { motion, AnimatePresence } from "framer-motion";
import { Truck, RotateCcw, PackageCheck } from "lucide-react";
import ReviewsSection from "../reviews/ReviewsSection.jsx";
import { useStoreSettings } from "../../lib/api/settings.js";
import { formatPrice } from "../../lib/format.js";

const TABS = [
  { id: "description", label: "Description" },
  { id: "ingredients", label: "Key Ingredients" },
  { id: "how", label: "How to Use" },
  { id: "reviews", label: "Reviews" },
  { id: "shipping", label: "Shipping & Returns" },
];

export default function ProductTabs({ product, active, onChange, onWriteReview }) {
  return (
    <section className="mt-16">
      {/* Tab bar */}
      <div className="sticky top-20 z-20 -mx-5 mb-6 overflow-x-auto bg-[var(--bg)]/80 px-5 backdrop-blur sm:top-24 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-max gap-1 border-b border-line">
          {TABS.map((t) => {
            const on = active === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onChange(t.id)}
                className={`relative whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors ${
                  on ? "text-ink" : "text-ink-soft hover:text-ink"
                }`}
              >
                {t.label}
                {t.id === "reviews" && (
                  <span className="ml-1.5 text-xs text-ink-soft">({product.reviewCount.toLocaleString()})</span>
                )}
                {on && (
                  <motion.span
                    layoutId="tab-underline"
                    className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-magenta"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Panels */}
      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          {active === "description" && <Description product={product} />}
          {active === "ingredients" && <Ingredients product={product} />}
          {active === "how" && <HowToUse product={product} />}
          {active === "reviews" && <ReviewsSection product={product} />}
          {active === "shipping" && <Shipping product={product} />}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

function Description({ product }) {
  return (
    <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
      <div className="max-w-2xl">
        <h3 className="font-display text-2xl text-ink">The story</h3>
        <p className="mt-3 leading-relaxed text-ink-soft">
          {product.longDescription}
        </p>
        <h4 className="mt-6 font-display text-xl text-ink">Our philosophy 🌸</h4>
        <p className="mt-2 leading-relaxed text-ink-soft">{product.philosophy}</p>
      </div>
      <div className="rounded-[1.25rem] bg-snow p-6 ring-1 ring-line">
        <h4 className="font-display text-sm text-ink">At a glance</h4>
        <dl className="mt-4 space-y-3 text-sm">
          <Row k="Category" v={product.category} />
          <Row k="Best for" v={product.skinType.join(", ")} />
          <Row k="Targets" v={product.concern.join(", ")} />
          <Row k="Hero actives" v={product.ingredients.map((i) => i.name).join(", ")} />
        </dl>
      </div>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line pb-3 last:border-0">
      <dt className="shrink-0 text-ink-soft">{k}</dt>
      <dd className="text-right font-medium text-ink">{v}</dd>
    </div>
  );
}

function Ingredients({ product }) {
  return (
    <div>
      <h3 className="font-display text-2xl text-ink">Key ingredients</h3>
      <p className="mt-2 max-w-xl text-ink-soft">
        Clean, effective actives — nothing harsh, everything purposeful.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {product.ingredients.map((ing) => (
          <motion.div
            key={ing.name}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.4 }}
            className="flex gap-4 rounded-[1.25rem] bg-snow p-5 ring-1 ring-line"
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-petal text-2xl">
              {ing.emoji}
            </span>
            <div>
              <p className="font-semibold text-ink">{ing.name}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">{ing.blurb}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function HowToUse({ product }) {
  return (
    <div>
      <h3 className="font-display text-2xl text-ink">Your ritual, step by step</h3>
      <div className="mt-6 grid gap-5 sm:grid-cols-3">
        {product.howTo.map((step, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
            className="relative rounded-[1.25rem] bg-gradient-to-b from-petal/60 to-transparent p-6 ring-1 ring-line"
          >
            <span className="absolute right-4 top-4 font-serif text-3xl text-magenta/30">
              0{i + 1}
            </span>
            <div className="text-4xl">{step.emoji}</div>
            <p className="mt-3 font-semibold text-ink">{step.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">{step.text}</p>
          </motion.div>
        ))}
      </div>
      <p className="mt-5 text-sm italic text-ink-soft">
        Tip: consistency over intensity — your glow loves a gentle daily ritual. ✨
      </p>
    </div>
  );
}

function Shipping({ product }) {
  const { freeShippingThreshold } = useStoreSettings();
  const items = [
    { icon: PackageCheck, title: "Dispatch", text: product.shipping.ships },
    {
      icon: Truck,
      title: "Delivery",
      text: `Free standard delivery on orders over ${formatPrice(freeShippingThreshold)} (3–5 business days).`,
    },
    { icon: RotateCcw, title: "Returns", text: product.shipping.returns },
  ];
  return (
    <div className="grid gap-5 sm:grid-cols-3">
      {items.map((it) => (
        <div key={it.title} className="rounded-[1.25rem] bg-snow p-6 ring-1 ring-line">
          <it.icon className="h-6 w-6 text-magenta" strokeWidth={1.6} />
          <p className="mt-3 font-semibold text-ink">{it.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">{it.text}</p>
        </div>
      ))}
    </div>
  );
}

