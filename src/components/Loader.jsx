import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useAdaptiveLoader } from "../lib/useAdaptiveLoader.js";

/**
 * Loader — the first 5–6 seconds of the aura.skin experience.
 *
 * Clean glowing white→pink veil with drifting glass-skin orbs and floating
 * sparkles. Empowering affirmations (with cute K-beauty emojis) bloom from
 * blur → sharp with spring physics, then the veil fades up to the hero.
 */
const AFFIRMATIONS = [
  { text: "You are beautiful.", emoji: "🌸" },
  { text: "You are radiant.", emoji: "✨" },
  { text: "You are strong.", emoji: "💗" },
  { text: "Your soul glows.", emoji: "🌟" },
  { text: "You are enough.", emoji: "💖" },
  { text: "Bloom within.", emoji: "🌺" },
];

/* Per-line timing is now ADAPTIVE — see useAdaptiveLoader.
   First visit: 6 affirmations × 900ms (full warm welcome).
   Return visit: 4 affirmations, perLine driven by real window.load + connection. */

// Soft drifting glass-skin orbs (decorative, GPU-friendly)
const ORBS = [
  { size: 440, x: "6%", y: "16%", from: "var(--color-rose)", delay: 0 },
  { size: 320, x: "74%", y: "10%", from: "var(--color-cyan-soft)", delay: 0.6 },
  { size: 520, x: "62%", y: "60%", from: "var(--color-petal)", delay: 0.3 },
  { size: 280, x: "18%", y: "70%", from: "var(--color-gold-soft)", delay: 0.9 },
];

// Twinkling sparkle field
const SPARKLES = Array.from({ length: 14 }, (_, i) => ({
  id: i,
  left: `${(i * 37) % 100}%`,
  top: `${(i * 53) % 100}%`,
  size: 3 + (i % 4),
  delay: (i % 7) * 0.3,
}));

export default function Loader({ onComplete }) {
  const reduce = useReducedMotion();
  const { perLine, totalLines, markSeen } = useAdaptiveLoader();
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);

  // Trim affirmations to the adaptive total (6 first visit, 4 return).
  const lines = useMemo(() => AFFIRMATIONS.slice(0, totalLines), [totalLines]);

  useEffect(() => {
    if (reduce) {
      const t = setTimeout(() => setDone(true), 1200);
      return () => clearTimeout(t);
    }
    if (index < lines.length - 1) {
      const t = setTimeout(() => setIndex((i) => i + 1), perLine);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setDone(true), perLine + 350);
    return () => clearTimeout(t);
  }, [index, reduce, perLine, lines.length]);

  // Persist "intro seen" once the loader finishes so the next visit adapts.
  useEffect(() => { if (done) markSeen(); }, [done, markSeen]);

  return (
    <AnimatePresence onExitComplete={onComplete}>
      {!done && (
        <motion.div
          key="loader"
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
          style={{
            background:
              "radial-gradient(120% 90% at 50% 0%, #ffffff 0%, var(--color-petal) 55%, #ffe3ee 100%)",
          }}
          initial={{ opacity: 1 }}
          exit={{
            opacity: 0,
            filter: "blur(8px)",
            transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] },
          }}
        >
          {/* Glass-skin orbs */}
          {!reduce &&
            ORBS.map((orb, i) => (
              <motion.div
                key={i}
                aria-hidden
                className="absolute rounded-full blur-3xl will-change-transform"
                style={{
                  width: orb.size,
                  height: orb.size,
                  left: orb.x,
                  top: orb.y,
                  background: `radial-gradient(circle at 30% 30%, ${orb.from}, transparent 70%)`,
                }}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{
                  opacity: [0, 0.6, 0.45, 0.6],
                  scale: [0.85, 1.08, 0.96, 1.05],
                  x: [0, 18, -12, 0],
                  y: [0, -16, 10, 0],
                }}
                transition={{
                  duration: 6,
                  delay: orb.delay,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            ))}

          {/* Sparkles */}
          {!reduce &&
            SPARKLES.map((s) => (
              <motion.span
                key={s.id}
                aria-hidden
                className="absolute rounded-full bg-white"
                style={{
                  left: s.left,
                  top: s.top,
                  width: s.size,
                  height: s.size,
                  boxShadow: "0 0 8px 2px rgba(255,255,255,0.9)",
                }}
                animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5] }}
                transition={{
                  duration: 2.4,
                  delay: s.delay,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            ))}

          {/* Affirmations */}
          <div className="relative z-10 px-6 text-center">
            <AnimatePresence mode="wait">
              <motion.h1
                key={reduce ? "welcome" : index}
                className="font-serif text-4xl text-ink sm:text-6xl md:text-7xl"
                initial={{ opacity: 0, y: 22, filter: "blur(14px)", scale: 0.98 }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)", scale: 1 }}
                exit={{ opacity: 0, y: -16, filter: "blur(10px)" }}
                transition={{ type: "spring", stiffness: 140, damping: 18, mass: 0.7 }}
              >
                {reduce ? (
                  "Welcome to aura.skin 🌸"
                ) : (
                  <>
                    {lines[index].text}{" "}
                    <span className="inline-block">{lines[index].emoji}</span>
                  </>
                )}
              </motion.h1>
            </AnimatePresence>

            {/* Progress dots */}
            {!reduce && (
              <div className="mt-10 flex items-center justify-center gap-2">
                {lines.map((_, i) => (
                  <motion.span
                    key={i}
                    className="h-1.5 rounded-full"
                    animate={{
                      width: i === index ? 28 : 6,
                      opacity: i <= index ? 1 : 0.4,
                      backgroundColor:
                        i === index
                          ? "var(--color-magenta)"
                          : "color-mix(in oklab, var(--color-rose) 60%, transparent)",
                    }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Brand mark */}
          <motion.span
            className="absolute bottom-10 left-1/2 -translate-x-1/2 font-serif text-lg tracking-wide text-ink/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.85 }}
            transition={{ delay: 0.4, duration: 1 }}
          >
            aura<span className="text-magenta">.</span>skin
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
