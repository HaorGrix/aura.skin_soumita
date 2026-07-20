import { useRef } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useReducedMotion,
} from "framer-motion";

/**
 * MagneticButton — Sephora-style: bold, high contrast, strong glow on hover.
 * Leans toward the cursor, then springs home. Honors prefers-reduced-motion.
 *
 * Variants:
 *  - "solid"   → black pill (white text)
 *  - "accent"  → magenta→rose gradient with pink glow
 *  - "outline" → glass hairline pill
 */
export default function MagneticButton({
  children,
  variant = "solid",
  className = "",
  strength = 24,
  as = "button",
  ...props
}) {
  const ref = useRef(null);
  const reduce = useReducedMotion();

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springConfig = { stiffness: 220, damping: 18, mass: 0.6 };
  const sx = useSpring(x, springConfig);
  const sy = useSpring(y, springConfig);

  function handleMove(e) {
    if (reduce || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const relX = e.clientX - (rect.left + rect.width / 2);
    const relY = e.clientY - (rect.top + rect.height / 2);
    x.set((relX / rect.width) * strength);
    y.set((relY / rect.height) * strength);
  }

  function reset() {
    x.set(0);
    y.set(0);
  }

  const base =
    "group relative inline-flex items-center justify-center gap-2 rounded-full px-8 py-4 " +
    "text-sm font-semibold tracking-wide will-change-transform select-none " +
    "transition-shadow duration-500 focus-visible:outline-none focus-visible:ring-2 " +
    "focus-visible:ring-magenta focus-visible:ring-offset-2 focus-visible:ring-offset-transparent";

  const variants = {
    solid:
      "bg-ink text-white shadow-soft hover:shadow-lift",
    accent:
      "bg-magenta text-white shadow-soft hover:shadow-[var(--shadow-glow-pink)]",
    outline:
      "border border-ink/15 bg-white/60 text-ink backdrop-blur " +
      "hover:border-magenta/50 hover:text-magenta",
  };

  const MotionTag = motion[as] ?? motion.button;

  return (
    <MotionTag
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      style={{ x: sx, y: sy }}
      whileHover={reduce ? {} : { scale: 1.04 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 320, damping: 20 }}
      className={`${base} ${variants[variant]} ${className}`}
      {...props}
    >
      {/* Accent sheen sweep on hover */}
      {variant === "accent" && (
        <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
          <span className="absolute -inset-y-2 -left-1/3 w-1/3 -skew-x-12 bg-white/30 blur-md transition-transform duration-700 ease-out group-hover:translate-x-[420%]" />
        </span>
      )}
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </MotionTag>
  );
}
