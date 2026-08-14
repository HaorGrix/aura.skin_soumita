import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Flame, Home } from "lucide-react";
import BackButton from "../components/ui/BackButton.jsx";
import { listActiveSales } from "../lib/api/sales.js";
import EmptyState from "../components/ui/EmptyState.jsx";

// Fallback banners for a campaign with no uploaded image yet — bundled at
// build, cycled by index. Mirrors components/home/Offers.jsx's own fallback;
// this full "/offers" page and the homepage's "Glow deals" section are two
// views onto the exact same live campaigns (list_active_sales(),
// 0039_flash_sales_storefront.sql), never a second hardcoded set — a
// customer landing here from the Offers nav link must see the same reality
// the admin Sales screen shows, not a permanent demo fixture.
import summerSale from "../../assests/summersale2.jpg";
import clearanceSale from "../../assests/sale3.jpg";
import flashSale from "../../assests/sale4.jpg";

const EASE = [0.22, 1, 0.36, 1];
const FALLBACK_IMAGES = [summerSale, clearanceSale, flashSale];
const TONES = ["var(--color-gold-soft)", "var(--color-cyan-soft)", "var(--color-petal)"];

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
      transition={{ duration: 0.55, delay: (index % 3) * 0.1, ease: EASE }}
      whileHover={{ y: -8 }}
      className="group relative flex flex-col overflow-hidden rounded-none bg-white shadow-soft ring-1 ring-line transition-shadow duration-500 hover:shadow-[var(--shadow-glow-pink)]"
    >
      {/* No padding on the image: the container is exactly aspect-[4/3],
          matching the upload guidance, so a correctly-sized 800×600 upload
          fills it edge to edge with zero gradient showing. */}
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
        {/* Scrim behind the badge — see components/home/Offers.jsx for why:
            an uploaded banner can be a full designed graphic with its own
            busy corner, so the badge needs guaranteed contrast, not just
            whatever happens to be under it. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-ink/45 to-transparent" />
        <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-magenta px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white shadow-lift ring-1 ring-white/40">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
          </span>
          {offer.badge}
        </span>
      </div>

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

  const offers = sales.map((sale, i) => ({
    img: sale.imageUrl || FALLBACK_IMAGES[i % FALLBACK_IMAGES.length],
    badge: sale.badgeLabel || sale.name,
    title: discountSummary(sale),
    blurb: sale.bannerText || `Ends ${new Date(sale.endsAt).toLocaleDateString()}`,
    href: `/shop?sale=${sale.id}`,
    tone: TONES[i % TONES.length],
  }));

  return (
    <div className="min-h-screen pb-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <BackButton route="offers" />

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-ink-soft" aria-label="Breadcrumb">
          <a href="/" className="inline-flex items-center gap-1 hover:text-magenta">
            <Home className="h-3.5 w-3.5" strokeWidth={1.8} /> Home
          </a>
          <span>/</span>
          <span className="text-ink">Offers</span>
        </nav>

        {/* Header */}
        <div className="mx-auto mt-8 max-w-2xl text-center">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-magenta">
            <Flame className="h-3.5 w-3.5" strokeWidth={2.2} />
            Limited time
          </p>
          <h1 className="mt-2 font-serif text-[clamp(2.2rem,5vw,3.75rem)] leading-tight text-ink">
            Glow <span className="italic text-gradient-glow">deals</span>
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-ink-soft sm:text-base">
            Every hand-picked K &amp; J-Beauty markdown in one place. Tap any drop
            to shop the discounted edit.
          </p>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="aspect-[4/3] animate-pulse rounded-none bg-snow ring-1 ring-line" />
            ))}
          </div>
        ) : offers.length === 0 ? (
          <div className="mt-12">
            <EmptyState
              emoji="🌸"
              title="No live deals right now"
              message="Check back soon — new drops appear here the moment a campaign goes live."
              actionLabel="Browse the shop"
              onAction={() => (window.location.href = "/shop")}
            />
          </div>
        ) : (
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {offers.map((offer, i) => (
              <OfferCard key={sales[i].id} offer={offer} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
