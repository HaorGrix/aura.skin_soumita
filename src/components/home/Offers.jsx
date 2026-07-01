import { motion } from "framer-motion";
import { ArrowRight, Flame } from "lucide-react";

// Sale banners (bundled at build; full image always visible via object-contain).
import summerSale from "../../../assests/summersale2.jpg";
import clearanceSale from "../../../assests/sale3.jpg";
import flashSale from "../../../assests/sale4.jpg";

const EASE = [0.22, 1, 0.36, 1];

/* Each offer routes into the Shop pre-filtered to discounted products
   (availability=onSale — see queryProducts in data/products.js). */
const OFFERS = [
  {
    img: summerSale,
    badge: "Summer Sale",
    title: "Up to 50% off",
    blurb: "Sun-kissed glow essentials, half price.",
    href: "#/shop?availability=onSale",
    tone: "var(--color-gold-soft)",
  },
  {
    img: clearanceSale,
    badge: "Clearance",
    title: "Up to 75% off",
    blurb: "Personal-care blowout while stocks last.",
    href: "#/shop?availability=onSale",
    tone: "var(--color-cyan-soft)",
  },
  {
    img: flashSale,
    badge: "Flash Sale",
    title: "30% off select",
    blurb: "Friday flash — gone by midnight.",
    href: "#/shop?availability=onSale",
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
      transition={{ duration: 0.55, delay: index * 0.1, ease: EASE }}
      whileHover={{ y: -8 }}
      className="group relative flex flex-col overflow-hidden rounded-[1.75rem] bg-white shadow-soft ring-1 ring-line transition-shadow duration-500 hover:shadow-[var(--shadow-glow-pink)] dark:bg-white/[0.03] dark:ring-white/10"
    >
      {/* Banner — object-contain on a branded glow so nothing is ever cropped */}
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

        {/* Limited-offer badge with a live pinging dot */}
        <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-magenta px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white shadow-glow-pink">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
          </span>
          {offer.badge}
        </span>
      </div>

      {/* Caption */}
      <div className="flex flex-1 flex-col p-5">
        <p className="font-serif text-xl text-ink dark:text-white">{offer.title}</p>
        <p className="mt-1 text-sm text-ink-soft dark:text-white/60">{offer.blurb}</p>
        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-magenta transition-all group-hover:gap-2.5 dark:text-rose">
          Shop the deal
          <ArrowRight className="h-4 w-4" strokeWidth={2} />
        </span>
      </div>
    </motion.a>
  );
}

export default function Offers() {
  return (
    <section id="offers" className="py-10 sm:py-14">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-magenta">
            <Flame className="h-3.5 w-3.5" strokeWidth={2.2} />
            Limited time
          </p>
          <h2 className="mt-2 font-serif text-[clamp(1.9rem,4.5vw,3.25rem)] leading-tight text-ink dark:text-white">
            Glow <span className="italic text-gradient-glow">deals</span>
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-ink-soft dark:text-white/60">
            Hand-picked K &amp; J-Beauty markdowns. Tap any drop to shop the
            discounted edit.
          </p>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {OFFERS.map((offer, i) => (
            <OfferCard key={offer.badge} offer={offer} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
