import { motion } from "framer-motion";
import { Shield, Sparkles, Leaf, Heart } from "lucide-react";
import { useContent } from "../../lib/api/content.js";

// Icon per card — NOT a CMS field (icons here are Lucide REACT COMPONENTS,
// which can't be stored as CMS data). Matched by the card's position, with
// ICON_FALLBACK for a 5th+ item an admin adds beyond these 4 known ones.
const PILLAR_ICONS = [Shield, Sparkles, Leaf, Heart];
const ICON_FALLBACK = Sparkles;

export default function WhyAura() {
  const { content } = useContent("home.why");
  const pillars = content.items;
  const stats = content.stats;
  return (
    <section id="about" className="py-12 sm:py-14">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-magenta">
            {content.eyebrow}
          </p>
          <h2 className="mt-2 font-serif text-[clamp(1.9rem,4.5vw,3.25rem)] leading-tight text-ink">
            {content.heading}
          </h2>
          <p className="mt-3 text-base leading-relaxed text-ink-soft">
            {content.body}
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl gap-6 sm:grid-cols-2">
          {pillars.map((p, i) => {
            const Icon = PILLAR_ICONS[i] ?? ICON_FALLBACK;
            return (
              <motion.div
                key={p.title || i}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                className="group rounded-2xl bg-snow p-7 ring-1 ring-line transition-all duration-500 hover:-translate-y-1 hover:bg-white hover:shadow-soft sm:p-8"
              >
                <span className="grid h-16 w-16 place-items-center rounded-full bg-petal text-magenta transition-colors duration-500 group-hover:bg-magenta group-hover:text-white">
                  <Icon className="h-7 w-7" strokeWidth={1.7} />
                </span>
                <h3 className="mt-5 font-display text-xl font-bold text-ink">{p.title}</h3>
                <p className="mt-2 text-[0.95rem] leading-[1.5] text-ink-soft">{p.body}</p>
              </motion.div>
            );
          })}
        </div>

        {/* Stats bar — vibrant hot-pink (the signature magenta used on button
            hover), white text for contrast, and the pink glow for a premium,
            on-brand feel. Now CMS-backed (home.why's `stats` field) — was a
            hardcoded STATS constant, the one piece of this section's visible
            content that had no admin control at all. */}
        <div className="mt-10 grid grid-cols-2 gap-6 rounded-[1.5rem] bg-magenta px-6 py-8 text-center text-white shadow-[var(--shadow-glow-pink)] ring-1 ring-magenta-deep/30 sm:grid-cols-4">
          {stats.map((s, i) => (
            <motion.div
              key={s.l || i}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
            >
              <p className="font-serif text-3xl text-white sm:text-4xl">{s.n}</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-white/75">{s.l}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
