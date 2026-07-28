import { motion } from "framer-motion";
import { ArrowRight, Flame, Home } from "lucide-react";
import BackButton from "../components/ui/BackButton.jsx";

// Sale banners (bundled at build; full image always visible via object-contain).
import summerSale from "../../assests/summersale2.jpg";
import clearanceSale from "../../assests/sale3.jpg";
import flashSale from "../../assests/sale4.jpg";

const EASE = [0.22, 1, 0.36, 1];

/* Each offer routes into the Shop pre-filtered to its OWN discount tier
   (discount=30|50|75 — see DISCOUNT_TIERS + queryProducts in data/products.js),
   so every banner lands on a set of products that actually matches its headline
   percentage. */
const OFFERS = [
  {
    img: summerSale,
    badge: "Summer Sale",
    title: "Up to 50% off",
    blurb: "Sun-kissed glow essentials, half price.",
    href: "/shop?discount=50",
    tone: "var(--color-gold-soft)",
  },
  {
    img: clearanceSale,
    badge: "Clearance",
    title: "Up to 75% off",
    blurb: "Personal-care blowout while stocks last.",
    href: "/shop?discount=75",
    tone: "var(--color-cyan-soft)",
  },
  {
    img: flashSale,
    badge: "Flash Sale",
    title: "30% off select",
    blurb: "Friday flash — gone by midnight.",
    href: "/shop?discount=30",
    tone: "var(--color-petal)",
  },
];

function OfferCard({ offer, index }) {
  return (
    <motion.a
      href={offer.href}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.55, delay: (index % 3) * 0.1, ease: EASE }}
      whileHover={{ y: -8 }}
      className="group relative flex flex-col overflow-hidden rounded-[1.75rem] bg-white shadow-soft ring-1 ring-line transition-shadow duration-500 hover:shadow-[var(--shadow-glow-pink)]"
    >
      <div
        className="relative aspect-[4/3] overflow-hidden"
        style={{ background: `radial-gradient(120% 120% at 30% 0%, #fff 0%, ${offer.tone} 90%)` }}
      >
        <img
          src={offer.img}
          alt={`${offer.badge} — ${offer.title}`}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-contain p-3 transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform group-hover:scale-[1.04]"
        />
        <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-magenta px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white shadow-glow-pink">
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
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {OFFERS.map((offer, i) => (
            <OfferCard key={`${offer.badge}-${i}`} offer={offer} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
