import { useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
} from "framer-motion";
import { ArrowRight, Sparkles, ChevronDown } from "lucide-react";
import MagneticButton from "./ui/MagneticButton.jsx";
// Direct import so Vite resolves this specific asset immediately (the
// import.meta.glob registry can be stale for files added after dev-server start).
import HERO_IMG from "../../assests/herosection6.jpg";

// Floating sparkle particles (deterministic positions for SSR-safety)
const PARTICLES = Array.from({ length: 16 }, (_, i) => ({
  id: i,
  left: `${(i * 41 + 7) % 100}%`,
  top: `${(i * 67 + 11) % 100}%`,
  size: 3 + (i % 5),
  delay: (i % 8) * 0.35,
  color:
    i % 3 === 0
      ? "var(--color-magenta)"
      : i % 3 === 1
      ? "var(--color-cyan)"
      : "var(--color-gold)",
}));

const WORD = {
  hidden: { opacity: 0, y: 28, filter: "blur(10px)" },
  show: (i) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { delay: 0.12 * i + 0.25, duration: 0.85, ease: [0.22, 1, 0.36, 1] },
  }),
};

const EASE = [0.22, 1, 0.36, 1];

export default function Hero() {
  const reduce = useReducedMotion();
  const ref = useRef(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const yBg = useTransform(scrollYProgress, [0, 1], ["0%", "16%"]);
  const yLeft = useTransform(scrollYProgress, [0, 1], ["0%", "26%"]);
  const yImg = useTransform(scrollYProgress, [0, 1], ["0%", "-8%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.85], [1, 0]);

  const line1 = ["Glow", "within."];
  const line2 = ["Glass", "skin,", "every", "day."];

  return (
    <section
      id="top"
      ref={ref}
      className="relative flex min-h-[100svh] items-center overflow-hidden"
    >
      {/* ── Background ───────────────────────────────────────── */}
      <motion.div
        style={{ y: reduce ? 0 : yBg }}
        className="absolute inset-0 -z-10 h-[120%] will-change-transform"
      >
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(130% 100% at 72% -10%, var(--color-white) 0%, var(--color-petal) 46%, var(--color-petal-deep) 76%, #ffd6e6 100%)",
          }}
        />
        <div
          aria-hidden
          className="absolute -right-32 -top-24 h-[28rem] w-[28rem] rounded-full opacity-50 blur-3xl"
          style={{ background: "radial-gradient(circle, var(--color-cyan-soft), transparent 70%)" }}
        />
        <div className="absolute inset-0 hidden dark:block dark:bg-gradient-to-b dark:from-[var(--color-ink)] dark:via-[#140810] dark:to-[var(--color-ink)]" />
      </motion.div>

      {/* Sparkle particle field */}
      {!reduce &&
        PARTICLES.map((p) => (
          <motion.span
            key={p.id}
            aria-hidden
            className="absolute -z-[5] rounded-full"
            style={{
              left: p.left,
              top: p.top,
              width: p.size,
              height: p.size,
              background: p.color,
              boxShadow: `0 0 10px 2px ${p.color}`,
            }}
            animate={{ opacity: [0, 0.9, 0], scale: [0.4, 1.2, 0.4], y: [0, -14, 0] }}
            transition={{ duration: 3.4, delay: p.delay, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}

      {/* Soft accent orbs */}
      {!reduce && (
        <>
          <motion.div
            aria-hidden
            className="absolute left-[6%] top-[22%] -z-[5] h-44 w-44 rounded-full bg-rose/40 blur-3xl"
            animate={{ y: [0, -24, 0], opacity: [0.45, 0.75, 0.45] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            aria-hidden
            className="absolute bottom-[14%] left-[34%] -z-[5] h-56 w-56 rounded-full bg-cyan/25 blur-3xl"
            animate={{ y: [0, 22, 0], opacity: [0.35, 0.6, 0.35] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          />
        </>
      )}

      {/* ── Split content ────────────────────────────────────── */}
      <div className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-12 px-6 pb-16 pt-28 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-6 lg:pb-20 lg:pt-24">
        {/* LEFT — copy */}
        <motion.div
          style={{ y: reduce ? 0 : yLeft, opacity: reduce ? 1 : opacity }}
          className="text-center lg:text-left"
        >
          <motion.span
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.7 }}
            whileHover={reduce ? {} : { scale: 1.04 }}
            className="inline-flex cursor-default items-center gap-2 rounded-full border border-ink/10 bg-white/70 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-ink/80 backdrop-blur transition-shadow hover:shadow-soft dark:border-white/15 dark:bg-white/5 dark:text-white/80"
          >
            <Sparkles className="h-3.5 w-3.5 text-magenta" strokeWidth={2} />
            For every skin · K &amp; J-Beauty
          </motion.span>

          <h1 className="mt-6 font-serif text-[clamp(2.8rem,6.5vw,5.25rem)] leading-[0.98] tracking-[-0.01em] text-ink dark:text-white">
            <span className="block">
              {line1.map((word, i) => (
                <motion.span
                  key={word}
                  custom={i}
                  variants={WORD}
                  initial={reduce ? false : "hidden"}
                  animate="show"
                  className="mr-[0.2em] inline-block"
                >
                  {word}
                </motion.span>
              ))}
            </span>
            <span className="mt-1 block">
              {line2.map((word, i) => (
                <motion.span
                  key={word}
                  custom={i + 2}
                  variants={WORD}
                  initial={reduce ? false : "hidden"}
                  animate="show"
                  className={`mr-[0.2em] inline-block ${
                    word === "Glass" || word === "skin," ? "italic text-gradient-glow" : ""
                  }`}
                >
                  {word}
                </motion.span>
              ))}
            </span>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.95, duration: 0.85, ease: EASE }}
            className="mx-auto mt-6 max-w-xl text-pretty text-base text-ink-soft sm:text-lg lg:mx-0 dark:text-white/70"
          >
            Authentic K &amp; J-Beauty, curated into one dewy ritual. Barrier
            repair, gentle actives, and that lit-from-within glow — built for
            your skin, whatever it is. ✨
          </motion.p>

          {/* CTA — centered on mobile/tablet, left-aligned on desktop split */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.15, duration: 0.85, ease: EASE }}
            className="mt-9 flex justify-center lg:justify-start"
          >
            <MagneticButton variant="accent" as="a" href="#/shop" className="w-full sm:w-auto">
              Start Your Ritual
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </MagneticButton>
          </motion.div>

          {/* Mini stat row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.4, duration: 0.9 }}
            className="mt-10 flex items-center justify-center gap-6 lg:justify-start"
          >
            {[
              { n: "4.9★", l: "avg rating" },
              { n: "30+", l: "brands" },
              { n: "12k+", l: "reviews" },
            ].map((s, i) => (
              <div key={s.l} className="flex items-center gap-6">
                {i > 0 && <span className="h-8 w-px bg-ink/15 dark:bg-white/15" />}
                <div className="text-left">
                  <p className="font-serif text-xl text-ink dark:text-white sm:text-2xl">
                    {s.n}
                  </p>
                  <p className="text-[11px] uppercase tracking-wide text-ink/55 dark:text-white/50">
                    {s.l}
                  </p>
                </div>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* RIGHT — framed photo (own proportions, never cropped) */}
        <motion.div
          style={{ y: reduce ? 0 : yImg }}
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.35, duration: 0.9, ease: EASE }}
          className="relative mx-auto w-fit max-w-full"
        >
          {/* Glow halo behind frame */}
          <div
            aria-hidden
            className="absolute inset-0 -z-[1] scale-95 rounded-[2.5rem] opacity-70 blur-2xl"
            style={{
              background:
                "radial-gradient(70% 70% at 50% 30%, var(--color-rose), transparent 70%)",
            }}
          />

          {/* Card hugs the image (w-fit). The image is height-capped so it stays
              clear of the navbar, with object-contain keeping it fully visible. */}
          <motion.div
            whileHover={reduce ? {} : { scale: 1.015 }}
            transition={{ type: "spring", stiffness: 220, damping: 22 }}
            className="relative mx-auto w-fit rounded-[2rem] bg-white p-3 shadow-lift ring-1 ring-white/60 dark:bg-white/5 dark:ring-white/10"
          >
            <img
              src={HERO_IMG}
              alt="Three people of different skin tones with healthy, glowing skin"
              fetchpriority="high"
              className="mx-auto block h-auto w-auto max-h-[56vh] max-w-full rounded-[1.5rem] object-contain sm:max-h-[62vh] lg:max-h-[66vh]"
            />
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      {!reduce && (
        <motion.a
          href="#best-sellers"
          aria-label="Scroll to explore"
          className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2 text-ink/60 dark:text-white/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.7, duration: 1 }}
        >
          <span className="text-[11px] uppercase tracking-[0.25em]">Scroll</span>
          <motion.span
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          >
            <ChevronDown className="h-5 w-5" strokeWidth={1.6} />
          </motion.span>
        </motion.a>
      )}
    </section>
  );
}
