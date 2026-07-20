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
  FlaskConical,
  Users,
} from "lucide-react";
import Button from "../components/ui/Button.jsx";
import Footer from "../components/Footer.jsx";

/* ─────────────────────────────────────────────
   Shared motion config — stays inside design
   system easing: ease-aura = cubic(0.22,1,0.36,1)
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
const PILLARS = [
  {
    icon: ShieldCheck,
    title: "100% Authentic Guarantee",
    body: "Every product on aura.skin is sourced directly from authorized brand distributors. We verify each batch with lot-number tracing so you never unknowingly receive a counterfeit.",
    accent: "magenta",
  },
  {
    icon: FlaskConical,
    title: "Rigorous Quality Control",
    body: "Our curation team evaluates formula integrity, shelf life, and packaging before a SKU reaches the catalogue. If it doesn't pass, it doesn't ship.",
    accent: "cyan",
  },
  {
    icon: RotateCcw,
    title: "Money-Back Promise",
    body: "Not seeing results in 30 days? Send it back. No forms, no restocking fee, no asking you to justify it. Opened bottles included.",
    accent: "gold",
  },
  {
    icon: Sparkles,
    title: "Expert Skin-Care Guidance",
    body: "Our care desk is staffed by certified estheticians. Tell us your skin type and concern and we'll build you a personalised AM/PM ritual — free of charge.",
    accent: "rose",
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
              Transparency{" "}
              <span className="italic text-magenta">in Every Drop.</span>
            </h1>
          </Reveal>

          <Reveal delay={2}>
            <p className="mx-auto mt-8 max-w-2xl text-[1.1rem] leading-relaxed text-ink-soft sm:text-xl">
              We believe skincare is not just a market — it's a trust contract between
              a brand and a person's skin. Every decision we make at aura.skin flows
              from one question:{" "}
              <em className="text-ink">"Would we use this ourselves?"</em>
            </p>
          </Reveal>

          <Reveal delay={3}>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <Button
                variant="primary"
                size="lg"
                as="a"
                href="#/shop"
                magnetic
              >
                Shop the collection
                <ArrowRight className="h-4 w-4" strokeWidth={2} />
              </Button>
              <Button variant="secondary" size="lg" as="a" href="#/contact" magnetic={false}>
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
            Our Four Commitments
          </p>
          <h2 className="mt-3 font-serif text-[clamp(2rem,5vw,3.5rem)] leading-tight text-ink">
            What we promise. What we prove.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-ink-soft">
            Not marketing slogans — operational standards that every team member is
            accountable to, every single day.
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
                <h3 className="font-serif text-xl leading-snug text-ink">
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
      <section className="relative overflow-hidden bg-ink px-5 py-20 sm:py-28">
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

        <div className="relative mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-[1fr_400px]">
          <div>
            <Reveal>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-rose">
                Transparency & Authenticity
              </p>
            </Reveal>
            <Reveal delay={1}>
              <h2 className="mt-4 font-serif text-[clamp(2.2rem,5vw,4rem)] leading-tight text-white">
                We show our work — because you deserve to know what you're putting on your skin.
              </h2>
            </Reveal>
            <Reveal delay={2}>
              <p className="mt-6 max-w-lg text-base leading-relaxed text-white/65">
                Every brand in our catalogue passes a source verification review. Lot numbers
                are traceable. Expiry dates are checked at intake. When a product doesn't clear
                our threshold, it doesn't appear on the shelf — no exceptions, no shortcuts.
              </p>
            </Reveal>
            <Reveal delay={3}>
              <ul className="mt-8 space-y-3">
                {[
                  "Authorized distributor contracts on file",
                  "Batch-level lot-number tracing",
                  "Expiry verified at warehouse intake",
                  "No grey-market or parallel-import stock",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-white/80">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-magenta" strokeWidth={2} />
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

          {/* Money-back card */}
          <Reveal delay={2}>
            <div className="rounded-[1.75rem] bg-white/[0.06] p-7 ring-1 ring-white/15 backdrop-blur-md sm:p-8">
              <span className="inline-grid h-14 w-14 place-items-center rounded-2xl bg-magenta text-white shadow-[var(--shadow-glow-pink)]">
                <RotateCcw className="h-6 w-6" strokeWidth={1.7} />
              </span>
              <h3 className="mt-5 font-serif text-2xl leading-snug text-white">
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
                  href="#/contact"
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
            The Aura Standard
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
        <Reveal className="mx-auto max-w-3xl rounded-[2rem] bg-gradient-to-br from-petal via-white to-cyan-soft/30 p-10 text-center ring-1 ring-line sm:p-14">
          <span className="text-4xl" role="img" aria-label="glow">✨</span>
          <h2 className="mt-5 font-serif text-[clamp(2rem,5vw,3.4rem)] leading-tight text-ink">
            Your glow routine starts here.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-ink-soft">
            Explore verified K-Beauty and J-Beauty formulations curated for real skin, real lives,
            and the rituals that make mornings sacred.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button variant="primary" size="lg" as="a" href="#/shop" magnetic>
              Shop the collection
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </Button>
            <Button variant="secondary" size="lg" as="a" href="#/account" magnetic={false}>
              Join Aura Rewards
              <Sparkles className="h-4 w-4" strokeWidth={2} />
            </Button>
          </div>
        </Reveal>
      </section>

      <Footer />
    </div>
  );
}
