import { useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
} from "framer-motion";
import { ArrowRight, Sparkles, ChevronDown } from "lucide-react";
import MagneticButton from "./ui/MagneticButton.jsx";
import { contentImage, useContent, words } from "../lib/api/content.js";
// Direct import so Vite resolves this specific asset immediately (the
// import.meta.glob registry can be stale for files added after dev-server start).
// Still the fallback when the admin hasn't uploaded a hero image.
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

  // Editable in /admin/content → "Homepage Hero". The CMS stores each
  // headline as a plain sentence; the per-word stagger below is unchanged —
  // we just split at render instead of hardcoding the arrays.
  const { content } = useContent("home.hero");
  const line1 = words(content.line1);
  const line2 = words(content.line2);

  return (
    <section
      id="top"
      ref={ref}
      className="relative flex min-h-[100svh] items-start overflow-hidden lg:items-center"
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
        <div className="absolute inset-0 hidden" />
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
      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-center gap-8 px-6 pb-16 pt-36 sm:px-8 sm:pt-40 md:pt-40 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-6 lg:pb-20 lg:pt-24">
        {/* LEFT — copy. `contents lg:block` promotes the headline group and the
            action group into the flex flow on mobile so the image can slot
            between them; on desktop it collapses back into one left column. */}
        <motion.div
          style={{ y: reduce ? 0 : yLeft, opacity: reduce ? 1 : opacity }}
          className="contents lg:block lg:text-left"
        >
          {/* Group A — pill + headline + subtext */}
          <div className="order-1 text-center lg:order-none lg:text-left">
          <motion.span
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.7 }}
            whileHover={reduce ? {} : { scale: 1.04 }}
            className="inline-flex cursor-default items-center gap-2 rounded-full border border-ink/10 bg-white/70 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-ink/80 backdrop-blur transition-shadow hover:shadow-soft"
          >
            <Sparkles className="h-3.5 w-3.5 text-magenta" strokeWidth={2} />
            {content.eyebrow || "For every skin · K & J-Beauty"}
          </motion.span>

          <h1 className="mt-6 font-serif text-[clamp(2.8rem,6.5vw,5.25rem)] leading-[0.98] tracking-[-0.01em] text-ink">
            <span className="block">
              {line1.map((word, i) => (
                <motion.span
                  // Index-keyed: CMS copy can legitimately repeat a word, and
                  // a word-keyed list would collide and drop one.
                  key={`${i}-${word}`}
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
                  key={`${i}-${word}`}
                  custom={i + line1.length}
                  variants={WORD}
                  initial={reduce ? false : "hidden"}
                  animate="show"
                  // The glow-italic treatment used to match the literal words
                  // "Glass"/"skin," — which would silently vanish the moment
                  // the client edited the headline. Now it's the first two
                  // words of line 2, so the effect survives any copy.
                  className={`mr-[0.2em] inline-block ${i < 2 ? "italic text-gradient-glow" : ""}`}
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
            className="mx-auto mt-6 max-w-xl text-pretty text-base text-ink-soft sm:text-lg lg:mx-0"
          >
            {content.body ||
              `Real K- and J-Beauty, straight from authorised distributors.
               Barrier-first formulas for the skin you actually have, plus honest
               advice about what you can skip. ✨`}
          </motion.p>
          </div>

          {/* Group B — CTA + stats. Renders after the image on mobile, back in
              the left column on desktop. */}
          <div className="order-3 lg:order-none">
          {/* CTA — centered on mobile/tablet, left-aligned on desktop split */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.15, duration: 0.85, ease: EASE }}
            className="mt-9 flex justify-center lg:justify-start"
          >
            {/* The CMS stores ctaHref as a real path ("/shop"), which is now
                exactly what the router wants — the link interceptor in
                lib/navigate.js promotes it to an SPA navigation. */}
            <MagneticButton
              variant="accent" as="a"
              href={content.ctaHref || "/shop"}
              className="w-full sm:w-auto"
            >
              {content.ctaLabel || "Start Your Ritual"}
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
                {i > 0 && <span className="h-8 w-px bg-ink/15" />}
                <div className="text-left">
                  <p className="font-serif text-xl text-ink sm:text-2xl">
                    {s.n}
                  </p>
                  <p className="whitespace-nowrap text-[10px] font-medium uppercase tracking-wide text-ink/55 sm:text-xs">
                    {s.l}
                  </p>
                </div>
              </div>
            ))}
          </motion.div>
          </div>
        </motion.div>

        {/* RIGHT — framed photo (own proportions, never cropped).
            order-2 slots it between headline and CTA on mobile. */}
        <motion.div
          style={{ y: reduce ? 0 : yImg }}
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.35, duration: 0.9, ease: EASE }}
          className="relative order-2 mx-auto w-fit max-w-full lg:order-none"
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
            className="relative mx-auto w-fit rounded-[2rem] bg-white p-3 shadow-lift ring-1 ring-white/60"
          >
            <img
              src={contentImage(content.image, HERO_IMG)}
              alt={content.imageAlt || "Three people of different skin tones with healthy, glowing skin"}
              fetchpriority="high"
              className="mx-auto block h-auto w-auto max-h-[56vh] max-w-full rounded-[1.5rem] object-contain sm:max-h-[62vh] lg:max-h-[66vh]"
            />
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      {!reduce && (
        <motion.a
          href="#featured"
          aria-label="Scroll to explore"
          className="absolute bottom-6 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-2 text-ink/60 lg:flex"
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
