/* =================================================================== *
 * aura.skin — DESIGN SYSTEM (single source of truth)
 * -------------------------------------------------------------------
 * K/J-Beauty "glass skin" system.
 *
 * Raw token values mirror the Tailwind `@theme` block in `src/index.css`.
 * Import the `tokens` for inline styles/JS logic, and the class-map helpers
 * (`btn`, `badge`, `surface`, `radius`, `shadow`, `motion`) anywhere you build
 * UI so every component stays perfectly consistent.
 * =================================================================== */

/* ------------------------------------------------------------------ *
 * 1. COLOR PALETTE
 * ------------------------------------------------------------------ */
export const tokens = {
  color: {
    // Core neutrals
    ink: "#0a0a0b", // near-black — primary text
    inkSoft: "#5b5b62", // secondary text
    white: "#ffffff",
    snow: "#fbf9fa", // off-white background
    line: "#ececef", // hairlines

    // Pink family (signature accent)
    petal: "#ffeef4", // softest wash
    rose: "#ff8fa8", // SOFT PINK — primary accent
    magenta: "#e1306c", // BOLD PINK — primary action
    magentaDeep: "#b81e54",

    // Glow accents
    cyan: "#00c4b4", // TEAL GLOW
    cyanSoft: "#7fe3da",
    gold: "#d4af37",
    goldSoft: "#ecd58a",

    // Feedback
    success: "#34c79a",
    error: "#f0556b",
    warning: "#e6b54a",
  },

  /* ---------------------------------------------------------------- *
   * 2. TYPOGRAPHY  (Instrument Serif display + Inter body)
   * ---------------------------------------------------------------- */
  font: {
    serif: '"Instrument Serif", ui-serif, Georgia, serif',
    sans: '"Inter", ui-sans-serif, system-ui, sans-serif',
  },

  /* ---------------------------------------------------------------- *
   * 3. SPACING  (4px base grid)
   * ---------------------------------------------------------------- */
  space: {
    xs: "0.5rem", // 8
    sm: "0.75rem", // 12
    md: "1rem", // 16
    lg: "1.5rem", // 24
    xl: "2rem", // 32
    "2xl": "3rem", // 48
    "3xl": "4rem", // 64
    section: "clamp(4rem, 10vw, 8rem)", // vertical rhythm between sections
    gutter: "clamp(1.25rem, 5vw, 2rem)", // page horizontal padding
  },

  /* ---------------------------------------------------------------- *
   * 4. BORDER RADIUS
   * ---------------------------------------------------------------- */
  radius: {
    sm: "0.5rem", // 8  — chips, small inputs
    md: "0.875rem", // 14 — buttons, inputs
    lg: "1.25rem", // 20 — product cards
    xl: "1.75rem", // 28 — large panels
    pill: "9999px",
  },

  /* ---------------------------------------------------------------- *
   * 5. SHADOWS  (soft, high-end, with glow)
   * ---------------------------------------------------------------- */
  shadow: {
    soft: "0 8px 30px -12px rgb(10 10 11 / 0.18)",
    lift: "0 26px 60px -22px rgb(10 10 11 / 0.30)",
    glowPink: "0 0 44px -8px rgb(225 48 108 / 0.45)",
    glowCyan: "0 0 44px -8px rgb(0 196 180 / 0.40)",
  },

  /* ---------------------------------------------------------------- *
   * 6. MOTION
   * ---------------------------------------------------------------- */
  ease: {
    aura: [0.22, 1, 0.36, 1], // signature soft-out
    soft: [0.16, 1, 0.3, 1],
  },
  duration: { fast: 0.25, base: 0.5, slow: 0.9 },
  spring: {
    soft: { type: "spring", stiffness: 140, damping: 18, mass: 0.7 },
    snappy: { type: "spring", stiffness: 320, damping: 22 },
    bouncy: { type: "spring", stiffness: 500, damping: 24 },
  },
};

/* ------------------------------------------------------------------ *
 * TYPOGRAPHY SCALE (Tailwind class presets — use on any text node)
 * ------------------------------------------------------------------ */
export const type = {
  display: "font-serif text-[clamp(2.85rem,8.5vw,7.5rem)] leading-[0.92] tracking-[-0.015em]",
  h1: "font-serif text-[clamp(2.25rem,6vw,4.5rem)] leading-[1.02] tracking-[-0.015em]",
  h2: "font-serif text-[clamp(1.75rem,4vw,3rem)] leading-[1.08] tracking-[-0.01em]",
  h3: "font-serif text-2xl sm:text-3xl leading-snug",
  h4: "font-serif text-xl sm:text-2xl leading-snug",
  lead: "font-sans text-lg sm:text-xl leading-relaxed text-ink-soft",
  body: "font-sans text-base leading-relaxed",
  small: "font-sans text-sm leading-relaxed",
  micro: "font-sans text-xs leading-normal",
  overline: "font-sans text-[11px] font-semibold uppercase tracking-[0.2em]",
  price: "font-sans text-base font-semibold tabular-nums",
};

/* ------------------------------------------------------------------ *
 * BUTTON VARIANTS
 *   primary   → bold magenta pink (main actions)
 *   secondary → glass / outline (alt actions)
 *   ghost     → text-only (tertiary / nav)
 *   addToBag  → product card action (cyan-edged, fills magenta on hover)
 * ------------------------------------------------------------------ */
export const btn = {
  base:
    "group relative inline-flex items-center justify-center gap-2 font-semibold tracking-wide " +
    "rounded-full will-change-transform select-none transition-[box-shadow,background-color,color,border-color] " +
    "duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-magenta " +
    "focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:opacity-50 disabled:pointer-events-none",

  size: {
    sm: "px-5 py-2.5 text-xs",
    md: "px-7 py-3.5 text-sm",
    lg: "px-9 py-4 text-base",
  },

  variant: {
    primary:
      "bg-magenta text-white shadow-soft hover:shadow-[var(--shadow-glow-pink)]",
    secondary:
      "border border-ink/15 bg-white/60 text-ink backdrop-blur hover:border-magenta/50 hover:text-magenta",
    ghost:
      "text-ink/75 hover:text-magenta",
    solid:
      "bg-ink text-white shadow-soft hover:shadow-lift",
    addToBag:
      "border border-cyan/50 text-cyan bg-cyan/5 hover:bg-magenta hover:border-magenta hover:text-white " +
      "hover:shadow-[var(--shadow-glow-pink)]",
  },
};

/* ------------------------------------------------------------------ *
 * BADGE VARIANTS  (product benefit tags)
 * ------------------------------------------------------------------ */
export const badge = {
  base:
    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] backdrop-blur",
  variant: {
    dewy: "bg-cyan/15 text-cyan ring-1 ring-cyan/30",
    barrier: "bg-rose/15 text-magenta ring-1 ring-rose/40",
    exfoliation: "bg-gold/15 text-gold ring-1 ring-gold/40",
    bestseller: "bg-magenta text-white",
    new: "bg-ink text-white",
    sale: "bg-error/15 text-error ring-1 ring-error/30",
  },
};

/* ------------------------------------------------------------------ *
 * SURFACE / RADIUS / SHADOW class helpers
 * ------------------------------------------------------------------ */
export const surface = {
  card:
    "bg-white shadow-soft ring-1 ring-line",
  glass: "glass",
  panel:
    "bg-snow ring-1 ring-line",
};

const TONE_SURFACES = new Map([
  ["#ffeef4", "bg-gradient-to-br from-white via-petal to-rose/25"],
  ["#ffd9e4", "bg-gradient-to-br from-white via-rose/20 to-magenta/10"],
  ["#d6f5ec", "bg-gradient-to-br from-white via-cyan-soft/30 to-cyan/15"],
  ["#dbeffb", "bg-gradient-to-br from-white via-cyan-soft/25 to-cyan/10"],
  ["#f6eccf", "bg-gradient-to-br from-white via-gold-soft/35 to-gold/15"],
  ["#ffe6d6", "bg-gradient-to-br from-white via-petal to-gold/10"],
  ["#ece4fb", "bg-gradient-to-br from-white via-petal to-magenta/10"],
  ["#e3efe0", "bg-gradient-to-br from-white via-cyan-soft/20 to-cyan/8"],
]);

export function toneSurfaceClass(tone) {
  return TONE_SURFACES.get(tone) ?? "bg-gradient-to-br from-white via-petal to-cyan-soft/20";
}

export const radius = {
  sm: "rounded-lg",
  md: "rounded-[0.875rem]",
  lg: "rounded-[1.25rem]",
  xl: "rounded-[1.75rem]",
  pill: "rounded-full",
};

export const shadow = {
  soft: "shadow-soft",
  lift: "shadow-lift",
  glowPink: "shadow-[var(--shadow-glow-pink)]",
  glowCyan: "shadow-[var(--shadow-glow-cyan)]",
};

/* ------------------------------------------------------------------ *
 * FRAMER MOTION presets — reuse for consistent choreography
 * ------------------------------------------------------------------ */
export const motionPresets = {
  fadeUp: {
    hidden: { opacity: 0, y: 24, filter: "blur(8px)" },
    show: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { duration: 0.8, ease: tokens.ease.aura },
    },
  },
  stagger: (gap = 0.08, delay = 0) => ({
    hidden: {},
    show: { transition: { staggerChildren: gap, delayChildren: delay } },
  }),
  scaleIn: {
    hidden: { opacity: 0, scale: 0.96 },
    show: { opacity: 1, scale: 1, transition: tokens.spring.soft },
  },
  // Default viewport config for scroll-triggered reveals
  viewport: { once: true, amount: 0.25, margin: "0px 0px -10% 0px" },
};

export default tokens;
