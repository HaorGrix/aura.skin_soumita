import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";

/* ------------------------------------------------------------------ *
 * Concern image registry — each file lives at /assests/{name}.
 * Vite bundles them via `new URL(..., import.meta.url)`, which also
 * URL-encodes spaces in filenames (e.g. "barrier repair.jpg") cleanly.
 * If an image fails to load at runtime, the card gracefully falls
 * back to its branded gradient (see <ConcernCard />).
 * ------------------------------------------------------------------ */
const IMG = {
  Hydration:         new URL("../../../assests/hydration.jpg",       import.meta.url).href,
  "Barrier Repair":  new URL("../../../assests/barrier repair.jpg",  import.meta.url).href,
  Brightening:       new URL("../../../assests/brightening.jpg",     import.meta.url).href,
  "Acne & Blemishes":new URL("../../../assests/acne.jfif",           import.meta.url).href,
  Pores:             new URL("../../../assests/open pores.jfif",     import.meta.url).href,
  Soothing:          new URL("../../../assests/soothing.webp",       import.meta.url).href,
  "Anti-Aging":      new URL("../../../assests/anti aging.jfif",     import.meta.url).href,
  "Sun Protection":  new URL("../../../assests/sun protection.jfif", import.meta.url).href,
};

const CONCERN_TILES = [
  { label: "Hydration",        emoji: "💧", tone: "var(--color-cyan-soft)",  blurb: "Dewy, plump skin" },
  { label: "Barrier Repair",   emoji: "🛡️", tone: "var(--color-petal)",      blurb: "Strengthen & protect" },
  { label: "Brightening",      emoji: "🌟", tone: "var(--color-gold-soft)",  blurb: "Glass-skin glow" },
  { label: "Acne & Blemishes", emoji: "🌿", tone: "#e3efe0",                 blurb: "Calm & clarify" },
  { label: "Pores",            emoji: "🔬", tone: "#dbeffb",                 blurb: "Refined texture" },
  { label: "Soothing",         emoji: "🍃", tone: "#e3efe0",                 blurb: "Aloe-calm comfort" },
  { label: "Anti-Aging",       emoji: "⏳", tone: "#ece4fb",                 blurb: "Firm & smooth" },
  { label: "Sun Protection",   emoji: "☀️", tone: "var(--color-gold-soft)",  blurb: "Daily SPF shield" },
];

const SKIN_TILES = ["Dry", "Oily", "Combination", "Sensitive", "Normal"];

/** A single dimensional, edge-to-edge concern card. The image fills a fixed
 *  3:4 frame with `object-cover` (perfect ratio, no awkward clipping) and the
 *  gradient halo is the fallback if it fails. Hover zoom is transform-only. */
function ConcernCard({ tile }) {
  const [imgOk, setImgOk] = useState(true);
  const src = IMG[tile.label];

  return (
    <motion.a
      href={`#/shop?concern=${encodeURIComponent(tile.label)}`}
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="group relative w-[15.5rem] shrink-0 snap-start overflow-hidden rounded-[1.75rem] shadow-soft ring-1 ring-line transition-shadow duration-500 hover:shadow-lift sm:w-[17.5rem] dark:ring-white/10"
    >
      <div className="relative aspect-[3/4] overflow-hidden">
        {/* Branded gradient — always painted (fallback + soft glow base) */}
        <span
          aria-hidden
          className="absolute inset-0"
          style={{ background: `radial-gradient(120% 120% at 30% 0%, #fff 0%, ${tile.tone} 85%)` }}
        />

        {/* Full-frame product visual — edge-to-edge, cover, no clip */}
        {imgOk && src && (
          <img
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setImgOk(false)}
            className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform group-hover:scale-[1.06]"
          />
        )}

        {/* Legibility scrim for the bottom content */}
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-ink/85 via-ink/35 to-transparent"
        />

        {/* Emoji chip — frosted glass, top-right */}
        <span className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-white/75 text-lg shadow-sm ring-1 ring-white/60 backdrop-blur transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6 dark:bg-white/15 dark:ring-white/30">
          {tile.emoji}
        </span>

        {/* Title + blurb + reveal CTA */}
        <div className="absolute inset-x-0 bottom-0 z-10 p-5">
          <p className="font-serif text-xl leading-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
            {tile.label}
          </p>
          <p className="mt-1 text-xs font-medium tracking-wide text-white/85">
            {tile.blurb}
          </p>
          <span className="mt-3 inline-flex -translate-y-1 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-rose opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            Explore <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.2} />
          </span>
        </div>
      </div>
    </motion.a>
  );
}

export default function ShopByConcern() {
  const trackRef = useRef(null);

  // Smooth, native horizontal scroll — compositor-driven, never reflows the page.
  const scrollByDir = (dir) => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.firstElementChild;
    const step = card ? card.offsetWidth + 16 /* gap-4 */ : el.clientWidth * 0.85;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  const arrowBtn =
    "grid h-10 w-10 place-items-center rounded-full bg-white text-ink ring-1 ring-line " +
    "transition-colors hover:bg-petal hover:text-magenta active:scale-95 " +
    "dark:bg-white/5 dark:text-white/80 dark:ring-white/10 dark:hover:bg-white/10";

  return (
    <section className="py-10 sm:py-14">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        {/* Heading + slider controls */}
        <div className="flex items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-magenta">
              Signature solutions
            </p>
            <h2 className="mt-2 font-serif text-[clamp(1.9rem,4.5vw,3.25rem)] leading-tight text-ink dark:text-white">
              Shop by <span className="italic text-gradient-glow">concern</span>
            </h2>
          </div>

          {/* Arrows — desktop/tablet; mobile relies on native swipe */}
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <button type="button" aria-label="Scroll left" onClick={() => scrollByDir(-1)} className={arrowBtn}>
              <ChevronLeft className="h-5 w-5" strokeWidth={1.8} />
            </button>
            <button type="button" aria-label="Scroll right" onClick={() => scrollByDir(1)} className={arrowBtn}>
              <ChevronRight className="h-5 w-5" strokeWidth={1.8} />
            </button>
          </div>
        </div>

        {/* Slider track — snap-aligned, GPU-scrolled; never reflows the page.
            A right-edge pad lets the last card rest off the gutter cleanly. */}
        <div
          ref={trackRef}
          className="mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-4 pr-1 scrollbar-thin"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {CONCERN_TILES.map((tile) => (
            <ConcernCard key={tile.label} tile={tile} />
          ))}
        </div>

        {/* Skin type row */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <span className="text-sm font-medium text-ink-soft dark:text-white/55">
            Or by skin type:
          </span>
          {SKIN_TILES.map((s) => (
            <a
              key={s}
              href={`#/shop?skinType=${encodeURIComponent(s)}`}
              className="rounded-full bg-white px-4 py-2 text-sm font-medium text-ink ring-1 ring-line transition-colors hover:ring-magenta hover:text-magenta dark:bg-white/5 dark:text-white/80 dark:ring-white/10"
            >
              {s}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
