import { motion } from "framer-motion";
import { Leaf, Heart, Sparkles, Recycle } from "lucide-react";
import { useStoreSettings } from "../../lib/api/settings.js";
import { useContent } from "../../lib/api/content.js";

// Icon per pillar — NOT a CMS field (same reasoning as ShopByConcern's
// tone/emoji-chip precedent doesn't quite apply here since emoji IS
// editable there; icons here are Lucide REACT COMPONENTS, which can't be
// stored as CMS data at all). Matched by the pillar's position, with
// ICON_FALLBACK for a 5th+ item an admin adds beyond these 4 known ones.
const PILLAR_ICONS = [Leaf, Heart, Sparkles, Recycle];
const ICON_FALLBACK = Sparkles;

export default function WhyAura() {
  const { storeName } = useStoreSettings();
  const { content } = useContent("home.why");
  const pillars = content.items;
  const stats = content.stats;
  return (
    <section id="about" className="py-10 sm:py-14">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-magenta">
            The {storeName} promise
          </p>
          {/* Real admin heading wins outright (plain styling — a freeform
              string can't carry the "love" word's italic/gradient accent);
              the designed default with that flourish is the fallback only
              when the field's genuinely untouched. Same "admin input wins,
              template is fallback-only" contract as every other CMS-backed
              field in this project. */}
          <h2 className="mt-2 font-serif text-[clamp(1.9rem,4.5vw,3.25rem)] leading-tight text-ink">
            {content.heading?.trim()
              ? content.heading
              : <>Why you’ll <span className="italic text-gradient-glow">love</span> {storeName}</>}
          </h2>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((p, i) => {
            const Icon = PILLAR_ICONS[i] ?? ICON_FALLBACK;
            return (
              <motion.div
                key={p.title || i}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-none bg-white p-7 text-center ring-1 ring-line transition-shadow duration-500 hover:shadow-soft"
              >
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-petal text-magenta">
                  <Icon className="h-6 w-6" strokeWidth={1.7} />
                </span>
                <h3 className="mt-4 font-display text-xl text-ink">{p.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{p.body}</p>
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
