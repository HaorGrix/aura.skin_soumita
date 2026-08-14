import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Flame } from "lucide-react";
import { listActiveSales } from "../../lib/api/sales.js";

// Fallback banners for a campaign with no uploaded image yet — bundled at
// build, cycled by index so a run of image-less sales still looks intentional
// rather than showing a blank tile.
import summerSale from "../../../assests/summersale2.jpg";
import clearanceSale from "../../../assests/sale3.jpg";
import flashSale from "../../../assests/sale4.jpg";

const EASE = [0.22, 1, 0.36, 1];
const FALLBACK_IMAGES = [summerSale, clearanceSale, flashSale];
const TONES = ["var(--color-gold-soft)", "var(--color-cyan-soft)", "var(--color-petal)"];

/** "20% off" / "৳100 off" — the same summary shown in the admin preview. */
function discountSummary(sale) {
  return sale.kind === "percent" ? `${sale.valuePercent}% off` : `৳${Math.round((sale.valueMinor ?? 0) / 100)} off`;
}

function OfferCard({ offer, index }) {
  return (
    <motion.a
      href={offer.href}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.55, delay: index * 0.1, ease: EASE }}
      whileHover={{ y: -8 }}
      className="group relative flex flex-col overflow-hidden rounded-none bg-white shadow-soft ring-1 ring-line transition-shadow duration-500 hover:shadow-[var(--shadow-glow-pink)]"
    >
      {/* Banner — object-contain on a branded glow so a wrongly-sized upload
          is never cropped, but NO padding: the container is exactly
          aspect-[4/3] (matching the upload guidance), so a correctly-sized
          800×600 image fills it edge to edge with zero gradient showing.
          Padding here would reintroduce a gutter even for a perfect upload. */}
      <div
        className="relative aspect-[4/3] overflow-hidden"
        style={{ background: `radial-gradient(120% 120% at 30% 0%, #fff 0%, ${offer.tone} 90%)` }}
      >
        <img
          src={offer.img}
          alt={`${offer.badge} — ${offer.title}`}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-contain transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform group-hover:scale-[1.04]"
        />

        {/* Scrim behind the badge — an admin-uploaded banner is often a
            designed graphic with its own busy top corner (ribbons, text),
            not a plain product photo. The badge is app chrome, not part of
            that image, so it needs guaranteed contrast regardless of what's
            underneath rather than just sitting directly on the pixels. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-ink/45 to-transparent" />

        {/* Limited-offer badge with a live pinging dot */}
        <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-magenta px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white shadow-lift ring-1 ring-white/40">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
          </span>
          {offer.badge}
        </span>
      </div>

      {/* Caption */}
      <div className="flex flex-1 flex-col p-5">
        <p className="font-serif text-xl text-ink">{offer.title}</p>
        <p className="mt-1 text-sm text-ink-soft">{offer.blurb}</p>
        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-magenta transition-all group-hover:gap-2.5">
          Shop the deal
          <ArrowRight className="h-4 w-4" strokeWidth={2} />
        </span>
      </div>
    </motion.a>
  );
}

/**
 * "Glow deals" — live flash-sale campaigns from the admin Sales screen
 * (list_active_sales(), 0039_flash_sales_storefront.sql), not a fixed
 * array. The RPC itself only ever returns is_active rows whose window
 * covers right now, so a scheduled-but-not-started or already-ended
 * campaign simply never appears here — no manual toggling needed, and
 * nothing to poll: this component just re-fetches on mount, same as any
 * other homepage section.
 */
export default function Offers() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    listActiveSales().then((rows) => {
      if (!alive) return;
      setSales(rows);
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  // Nothing running right now — no empty grid, no section at all.
  if (!loading && sales.length === 0) return null;

  const offers = sales.map((sale, i) => ({
    img: sale.imageUrl || FALLBACK_IMAGES[i % FALLBACK_IMAGES.length],
    badge: sale.badgeLabel || sale.name,
    title: discountSummary(sale),
    blurb: sale.bannerText || `Ends ${new Date(sale.endsAt).toLocaleDateString()}`,
    href: `/shop?sale=${sale.id}`,
    tone: TONES[i % TONES.length],
  }));

  return (
    <section id="offers" className="py-10 sm:py-14">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-magenta">
            <Flame className="h-3.5 w-3.5" strokeWidth={2.2} />
            Limited time
          </p>
          <h2 className="mt-2 font-serif text-[clamp(1.9rem,4.5vw,3.25rem)] leading-tight text-ink">
            Glow <span className="italic text-gradient-glow">deals</span>
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-ink-soft">
            Hand-picked K &amp; J-Beauty markdowns. Tap any drop to shop the
            discounted edit.
          </p>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="aspect-[4/3] animate-pulse rounded-none bg-white/60 ring-1 ring-line" />
              ))
            : offers.map((offer, i) => (
                <OfferCard key={sales[i].id} offer={offer} index={i} />
              ))}
        </div>
      </div>
    </section>
  );
}
