import { useRef } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useReducedMotion,
} from "framer-motion";
import { btn } from "../../lib/design-system.js";

/**
 * Button — the canonical skin.script button. Reads variants from the design
 * system so every CTA across the site stays consistent.
 *
 * Props:
 *  - variant: "primary" | "secondary" | "ghost" | "solid" | "addToBag"
 *  - size:    "sm" | "md" | "lg"
 *  - magnetic: cursor-follow lean (default true; auto-off for reduced motion)
 *  - as: render as a different element, e.g. "a"
 */
export default function Button({
  children,
  variant = "primary",
  size = "md",
  magnetic = true,
  className = "",
  strength = 22,
  as = "button",
  ...props
}) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const enableMagnet = magnetic && !reduce;

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 18, mass: 0.6 });
  const sy = useSpring(y, { stiffness: 220, damping: 18, mass: 0.6 });

  function handleMove(e) {
    if (!enableMagnet || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    x.set(((e.clientX - (r.left + r.width / 2)) / r.width) * strength);
    y.set(((e.clientY - (r.top + r.height / 2)) / r.height) * strength);
  }
  const reset = () => {
    x.set(0);
    y.set(0);
  };

  const MotionTag = motion[as] ?? motion.button;
  const classes = `${btn.base} ${btn.size[size]} ${btn.variant[variant]} ${className}`;

  return (
    <MotionTag
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      style={enableMagnet ? { x: sx, y: sy } : undefined}
      whileHover={reduce ? {} : { scale: 1.04 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 320, damping: 20 }}
      className={classes}
      {...props}
    >
      {/* Sheen sweep for filled variants */}
      {(variant === "primary" || variant === "solid") && (
        <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
          <span className="absolute -inset-y-2 -left-1/3 w-1/3 -skew-x-12 bg-white/25 blur-md transition-transform duration-700 ease-out group-hover:translate-x-[420%]" />
        </span>
      )}
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </MotionTag>
  );
}
