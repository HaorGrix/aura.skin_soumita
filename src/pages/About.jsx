import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import {
  ShieldCheck,
  Microscope,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Star,
  Leaf,
  Heart,
  Users,
  Check,
} from "lucide-react";
import Button from "../components/ui/Button.jsx";
import Footer from "../components/Footer.jsx";
import { useStoreSettings } from "../lib/api/settings.js";
import { useContent } from "../lib/api/content.js";

/* ─────────────────────────────────────────────
   Shared motion config — stays inside design
   system easing: ease-signature = cubic(0.22,1,0.36,1)
───────────────────────────────────────────── */
const EASE = [0.22, 1, 0.36, 1];

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, delay: i * 0.12, ease: EASE },
  }),
};

/** Scroll-triggered reveal wrapper */
function Reveal({ children, delay = 0, className = "" }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      variants={fadeUp}
      custom={delay}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   TRUST PILLARS  — the four commitments
───────────────────────────────────────────── */
const buildPillars = () => [
  {
    icon: ShieldCheck,
    title: "Authentic, Always",
    body: "We carefully source our products so you can shop your favourite skincare with confidence.",
    accent: "magenta",
  },
  {
    icon: Sparkles,
    title: "Chosen With Purpose",
    body: "We don't believe in stocking everything. We focus on products worth making part of your routine.",
    accent: "cyan",
  },
  {
    icon: Leaf,
    title: "Freshness Matters",
    body: "Products are checked for packaging, condition and expiry before reaching your shelf.",
    accent: "gold",
  },
  {
    icon: Heart,
    title: "Care Beyond Checkout",
    body: "Confused about what suits your skin? We're here to help you make a more informed choice.",
    accent: "rose",
  },
];

/* ─────────────────────────────────────────────
   TRANSPARENCY CHECKLIST — dark-mode trust section
───────────────────────────────────────────── */
const TRUST_CHECKLIST = [
  {
    title: "Authentic Products",
    body: "We carefully source genuine skincare from trusted suppliers.",
  },
  {
    title: "Quality Checked",
    body: "Every order is checked for product condition and packaging before dispatch.",
  },
  {
    title: "Fresh Stock",
    body: "We pay attention to expiry dates and product condition before products reach you.",
  },
  {
    title: "Here to Help",
    body: "Need help choosing between products? Our team is here to make skincare shopping simpler.",
  },
];

/* ─────────────────────────────────────────────
   STATS ROW — social proof numbers
───────────────────────────────────────────── */
const STATS = [
  { value: "10,000+", label: "Happy shoppers" },
  { value: "98%", label: "Verified authentic" },
  { value: "4.9 ★", label: "Average rating" },
  { value: "30-day", label: "Refund window" },
];

/* ─────────────────────────────────────────────
   BRAND VALUES  — bottom ethos grid
───────────────────────────────────────────── */
const VALUES = [
  { icon: Leaf, label: "Clean formulations" },
  { icon: Star, label: "K-Beauty curated" },
  { icon: Microscope, label: "Science-backed" },
  { icon: Users, label: "Community-first" },
];

/* ─────────────────────────────────────────────
   ACCENT TOKEN MAP
───────────────────────────────────────────── */
const ACCENT_ICON = {
  magenta: "bg-petal text-magenta",
  cyan: "bg-cyan/10 text-cyan",
  gold: "bg-gold/10 text-gold",
  rose: "bg-rose/10 text-rose",
};
const ACCENT_BORDER = {
  magenta: "hover:border-magenta/50",
  cyan: "hover:border-cyan/50",
  gold: "hover:border-gold/50",
  rose: "hover:border-rose/40",
};

/* ─────────────────────────────────────────────
   PAGE
───────────────────────────────────────────── */
export default function About() {
  const { storeName } = useStoreSettings();
  const { content } = useContent("page.about");
  const PILLARS = buildPillars();
  const heroIntro = (content.intro || "").replace(/\{storeName\}/g, storeName);
  // "Transparency|in Every Drop." -> plain "Transparency" + italic "in Every
  // Drop." — the pipe is the admin-editable equivalent of the two <span>s
  // this heading used before it was wired to the CMS. No pipe = render the
  // whole headline plain rather than guessing where to split it.
  const [titlePlain, titleItalic] = (content.title || "").split("|");
  return (
    <div className="flex min-h-screen flex-col bg-snow text-ink">

      {/* ══════════════════════════════════════
          HERO
      ══════════════════════════════════════ */}
      <section className="relative flex min-h-[90vh] items-center justify-center overflow-hidden px-5 pt-40 sm:pt-44">
        {/* Ambient glow orbs */}
        <div
          aria-hidden
          className="pointer-events-none absolute -left-32 -top-32 h-[520px] w-[520px] rounded-full bg-magenta/10 blur-[120px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 bottom-0 h-[400px] w-[400px] rounded-full bg-cyan/10 blur-[100px]"
        />

        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <Reveal>
            <span className="inline-block rounded-full bg-magenta/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-magenta">
              Our Commitment
            </span>
          </Reveal>

          <Reveal delay={1}>
            <h1 className="mt-6 font-serif text-[clamp(3rem,8vw,6.5rem)] leading-[0.95] tracking-tight text-ink">
              {titlePlain}
              {titleItalic && (
                <>
                  {" "}
                  <span className="italic text-magenta">{titleItalic}</span>
                </>
              )}
            </h1>
          </Reveal>

          <Reveal delay={2}>
            <p className="mx-auto mt-8 max-w-2xl text-[1.1rem] leading-relaxed text-ink-soft sm:text-xl">
              {heroIntro}
            </p>
          </Reveal>

          <Reveal delay={3}>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <Button
                variant="primary"
                size="lg"
                as="a"
                href="/shop"
                magnetic
              >
                Shop the collection
                <ArrowRight className="h-4 w-4" strokeWidth={2} />
              </Button>
              <Button variant="secondary" size="lg" as="a" href="/contact" magnetic={false}>
                Talk to the care desk
              </Button>
            </div>
          </Reveal>

          {/* Divider dash */}
          <Reveal delay={4}>
            <div className="mx-auto mt-16 h-px w-16 bg-magenta/40" />
          </Reveal>
        </div>
      </section>

      {/* ══════════════════════════════════════
          STATS BAND
      ══════════════════════════════════════ */}
      <section className="border-y border-line bg-white">
        <div className="mx-auto grid max-w-5xl grid-cols-2 divide-x divide-line sm:grid-cols-4">
          {STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.5} className="flex flex-col items-center py-8 px-4 text-center">
              <span className="font-serif text-[clamp(1.8rem,4vw,2.8rem)] leading-none text-ink">
                {s.value}
              </span>
              <span className="mt-2 text-xs font-semibold uppercase tracking-widest text-ink-soft">
                {s.label}
              </span>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════
          TRUST PILLARS GRID
      ══════════════════════════════════════ */}
      <section className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
        <Reveal className="mb-14 max-w-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-magenta">
            The Skin Theory Promise
          </p>
          <h2 className="mt-3 font-serif text-[clamp(2rem,5vw,3.5rem)] leading-tight text-ink">
            What your skin deserves, every time.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-ink-soft">
            No complicated promises. Just authentic products, thoughtful choices, and
            skincare you can shop with confidence.
          </p>
        </Reveal>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map((p, i) => (
            <Reveal key={p.title} delay={i}>
              <article
                className={`group flex h-full flex-col rounded-[1.5rem] border border-line bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-soft)] ${ACCENT_BORDER[p.accent]}`}
              >
                <span className={`mb-5 inline-grid h-12 w-12 place-items-center rounded-2xl ${ACCENT_ICON[p.accent]}`}>
                  <p.icon className="h-5 w-5" strokeWidth={1.7} />
                </span>
                <h3 className="font-display text-xl leading-snug text-ink">
                  {p.title}
                </h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-soft">
                  {p.body}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════
          TRANSPARENCY / AUTHENTICITY BANNER
      ══════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-ink px-5 py-16 sm:py-20">
        {/* Pink glow top-left */}
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 -top-24 h-[400px] w-[400px] rounded-full bg-magenta/20 blur-[100px]"
        />
        {/* Cyan glow bottom-right */}
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-16 right-0 h-[360px] w-[360px] rounded-full bg-cyan/15 blur-[90px]"
        />

        <div className="relative mx-auto grid max-w-7xl items-start gap-10 lg:grid-cols-[1fr_400px]">
          <div>
            <Reveal>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan">
                Skin Theory, With Confidence
              </p>
            </Reveal>
            <Reveal delay={1}>
              <h2 className="mt-4 font-serif text-[clamp(2.2rem,5vw,4rem)] leading-tight text-white">
                Your skin deserves the real thing.
              </h2>
            </Reveal>
            <Reveal delay={2}>
              <p className="mt-6 max-w-lg text-[1.05rem] leading-[1.6] text-white/65">
                From cult-favourite K-Beauty to everyday skincare essentials, we carefully
                select every product so you can shop with confidence.
              </p>
            </Reveal>
            <Reveal delay={3}>
              <ul className="mt-9 max-w-lg space-y-6">
                {TRUST_CHECKLIST.map((item) => (
                  <li key={item.title} className="flex items-start gap-4">
                    <span className="mt-0.5 inline-grid h-12 w-12 shrink-0 place-items-center rounded-full bg-cyan/15 text-cyan">
                      <Check className="h-5 w-5" strokeWidth={2.25} />
                    </span>
                    <div>
                      <h3 className="text-[1.1rem] font-bold text-white">{item.title}</h3>
                      <p className="mt-1 text-[0.95rem] leading-[1.5] text-white/60">{item.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={4}>
              <p className="mt-9 max-w-lg text-base italic leading-relaxed text-white/55">
                No confusion. No compromise. Just skincare you can trust.
              </p>
            </Reveal>
          </div>

          {/* Money-back card */}
          <Reveal delay={2}>
            <div className="rounded-[1.75rem] bg-white/[0.06] p-7 ring-1 ring-white/15 backdrop-blur-md sm:p-8">
              <span className="inline-grid h-14 w-14 place-items-center rounded-2xl bg-magenta text-white shadow-[var(--shadow-glow-pink)]">
                <RotateCcw className="h-6 w-6" strokeWidth={1.7} />
              </span>
              <h3 className="mt-5 font-display text-2xl leading-snug text-white">
                30-Day Money-Back Promise
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-white/60">
                If you're unsatisfied with any product — for any reason — contact our care desk
                within 30 days of delivery and we'll make it right. No receipts, no lectures,
                no hoops.
              </p>
              <div className="mt-6 flex items-center gap-3 rounded-xl bg-magenta/15 p-4 ring-1 ring-magenta/25">
                <ShieldCheck className="h-5 w-5 shrink-0 text-rose" strokeWidth={2} />
                <span className="text-sm font-semibold text-white">
                  100% satisfaction or your money back
                </span>
              </div>
              <div className="mt-5">
                <Button
                  variant="primary"
                  size="md"
                  magnetic={false}
                  as="a"
                  href="/contact"
                  className="w-full justify-center"
                >
                  Contact the care desk
                </Button>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══════════════════════════════════════
          BRAND ETHOS — values row
      ══════════════════════════════════════ */}
      <section className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
        <Reveal className="mb-12 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-magenta">
            The {storeName} Standard
          </p>
          <h2 className="mt-3 font-serif text-[clamp(2rem,5vw,3.2rem)] text-ink">
            Guided by science, grounded in care.
          </h2>
        </Reveal>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map((v, i) => (
            <Reveal key={v.label} delay={i * 0.8}>
              <div className="flex flex-col items-center gap-4 rounded-[1.5rem] bg-white py-8 px-5 text-center ring-1 ring-line transition-shadow hover:shadow-[var(--shadow-soft)]">
                <span className="inline-grid h-12 w-12 place-items-center rounded-full bg-petal text-magenta">
                  <v.icon className="h-5 w-5" strokeWidth={1.7} />
                </span>
                <span className="font-serif text-lg text-ink">{v.label}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════
          FINAL CTA
      ══════════════════════════════════════ */}
      <section className="relative overflow-hidden px-5 pb-24 sm:pb-32">
        <Reveal className="mx-auto max-w-3xl rounded-[2rem] bg-gradient-to-br from-petal via-white to-cyan-soft/30 p-12 text-center ring-1 ring-line sm:p-16">
          <Sparkles className="mx-auto h-8 w-8 text-gold" strokeWidth={1.7} />
          <h2 className="mt-5 font-serif text-[clamp(2rem,5vw,3.4rem)] leading-tight text-ink">
            Your glow routine starts here.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-ink-soft">
            Explore verified K-Beauty and J-Beauty formulations curated for real skin, real lives,
            and the rituals that make mornings sacred.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button variant="primary" size="lg" as="a" href="/shop" magnetic>
              Shop the collection
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </Button>
            <Button variant="secondary" size="lg" as="a" href="/rewards" magnetic={false}>
              Join {storeName} Rewards
              <Sparkles className="h-4 w-4" strokeWidth={2} />
            </Button>
          </div>
        </Reveal>
      </section>

      <Footer />
    </div>
  );
}
