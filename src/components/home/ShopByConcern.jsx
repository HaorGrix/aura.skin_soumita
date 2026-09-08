import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { SKIN_TYPES } from "../../data/products.js";
import { useContent, contentImage } from "../../lib/api/content.js";
import { useConcerns } from "../../lib/api/concerns.js";

/* ------------------------------------------------------------------ *
 * Concern image registry — each file lives at /assests/{name}. Vite
 * bundles them via `new URL(..., import.meta.url)`, which also
 * URL-encodes spaces in filenames (e.g. "barrier repair.jpg") cleanly.
 *
 * This is now a FALLBACK, not the source of truth: the real image for
 * each tile comes from the CMS (home.concerns, admin/content), and this
 * only fills in for a concern whose CMS image field is still empty —
 * same "never show a broken or empty tile" contract as everywhere else
 * lib/api/content.js's contentImage() is used. If a card's image still
 * fails to load at runtime (a stale/broken Storage path), it falls back
 * further, to the branded gradient (see <ConcernCard />).
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

// Decorative gradient tone per tile — NOT a CMS field, same reasoning as
// Offers.jsx's card tones: it's a purely visual accent, not content an
// admin edits. Known concerns keep their originally-designed tone; any
// concern an admin adds beyond these (a new label, or a 9th+ tile) cycles
// through TONE_FALLBACKS instead of defaulting to nothing.
const TONE_BY_LABEL = {
  Hydration: "var(--color-cyan-soft)",
  "Barrier Repair": "var(--color-petal)",
  Brightening: "var(--color-gold-soft)",
  "Acne & Blemishes": "#e3efe0",
  Pores: "#dbeffb",
  Soothing: "#e3efe0",
  "Anti-Aging": "#ece4fb",
  "Sun Protection": "var(--color-gold-soft)",
};
const TONE_FALLBACKS = ["var(--color-cyan-soft)", "var(--color-petal)", "var(--color-gold-soft)", "#e3efe0"];
const toneFor = (label, index) => TONE_BY_LABEL[label] ?? TONE_FALLBACKS[index % TONE_FALLBACKS.length];

// Skin-type pills come straight from the catalog's canonical SKIN_TYPES so they
// can never drift from what the filter engine actually recognises.
const SKIN_TILES = SKIN_TYPES;

/** A single dimensional, edge-to-edge concern card. The image fills a fixed
 *  3:4 frame with `object-cover` (perfect ratio, no awkward clipping) and the
 *  gradient halo is the fallback if it fails. Hover zoom is transform-only. */
function ConcernCard({ tile, src }) {
  const [imgOk, setImgOk] = useState(true);
  // `src` starts as the schema default and swaps to the admin's real CMS
  // image once useContent's fetch resolves — reset the "did it fail"
  // flag when that happens, or a default image that happened to 404
  // would permanently hide a perfectly good image saved afterwards.
  useEffect(() => setImgOk(true), [src]);

  // `concern` (a catalog-exact value, admin-picked from a dropdown) drives
  // the link; `label` is free-text display copy and is never sent to the
  // filter — the two used to be the same field, which meant editing the
  // headline could silently break the link (or vice versa). A tile with no
  // concern picked yet (blank, honestly, rather than a guessed match) links
  // to the unfiltered shop instead of a dead/empty filter.
  const href = tile.concern ? `/shop?concern=${encodeURIComponent(tile.concern)}` : "/shop";

  return (
    <motion.a
      href={href}
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="group relative w-[15.5rem] shrink-0 snap-start overflow-hidden rounded-none shadow-soft ring-1 ring-line transition-shadow duration-500 hover:shadow-lift sm:w-[17.5rem]"
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

        {/* Emoji chip — frosted glass, top-right. Every tile in the original
            hardcoded CONCERN_TILES always carried an emoji, so this never had
            an empty state to handle. Now that it's a CMS-editable field
            (admin/content), an unfilled emoji renders "" here — this used to
            render the chip regardless, showing as a bare white circle with
            nothing inside it. Skipping the chip entirely when there's no
            emoji is the fix: it reappears the moment an admin fills it in,
            and never leaves an empty styled blob sitting on the image. */}
        {tile.emoji && (
          <span className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-white/75 text-lg shadow-sm ring-1 ring-white/60 backdrop-blur transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6">
            {tile.emoji}
          </span>
        )}

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
  const { content } = useContent("home.concerns");
  const items = content.items;
  const concerns = useConcerns();

  // Dev guard — every tile with a `concern` set MUST match a real, live
  // concern slug, or its link would land on Shop with zero matches. A tile
  // with no concern set at all is fine (deliberately falls back to the
  // unfiltered shop, see ConcernCard's `href`) — only a set-but-wrong value
  // is worth warning about. Runs against whatever's live (defaults first,
  // then the admin's saved items once loaded), fails loud in dev, no-ops
  // in prod.
  useEffect(() => {
    if (!import.meta.env?.DEV || !concerns.length) return;
    const knownSlugs = new Set(concerns.map((c) => c.slug));
    const orphanConcerns = items.filter((t) => t.concern && !knownSlugs.has(t.concern));
    if (orphanConcerns.length) {
      console.warn(
        "[ShopByConcern] These tiles' concern doesn't match any catalog concern (clicks would return empty):",
        orphanConcerns.map((t) => `${t.label} -> ${t.concern}`)
      );
    }
  }, [items, concerns]);

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
    "transition-colors hover:bg-petal hover:text-magenta active:scale-95";

  return (
    <section className="py-10 sm:py-14">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        {/* Heading + slider controls */}
        <div className="flex items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-magenta">
              Signature solutions
            </p>
            {/* Heading stays hardcoded (not content.heading) — the schema
                field is plain text and would lose the italic "concern"
                treatment below. Out of scope for the CMS-wiring fix here;
                see PR notes. */}
            <h2 className="mt-2 font-serif text-[clamp(1.9rem,4.5vw,3.25rem)] leading-tight text-ink">
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
          {items.map((tile, i) => (
            <ConcernCard
              key={tile.label || i}
              tile={{ ...tile, tone: toneFor(tile.label, i) }}
              src={contentImage(tile.image, IMG[tile.label])}
            />
          ))}
        </div>

        {/* Skin type row */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <span className="text-sm font-medium text-ink-soft">
            Or by skin type:
          </span>
          {SKIN_TILES.map((s) => (
            <a
              key={s}
              href={`/shop?skinType=${encodeURIComponent(s)}`}
              className="rounded-full bg-white px-4 py-2 text-sm font-medium text-ink ring-1 ring-line transition-colors hover:ring-magenta hover:text-magenta"
            >
              {s}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
