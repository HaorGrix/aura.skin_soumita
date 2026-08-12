import { motion } from "framer-motion";
import { Leaf, Heart, Sparkles, Recycle } from "lucide-react";
import { useStoreSettings } from "../../lib/api/settings.js";

const PILLARS = [
  { icon: Leaf, title: "Organic", text: "Plant-derived actives, sourced from growers we can name." },
  { icon: Heart, title: "Cruelty-Free", text: "Never tested on animals, at any stage, by anyone we stock." },
  { icon: Sparkles, title: "Clean", text: "Full INCI on every product. Nothing hidden behind “fragrance”." },
  { icon: Recycle, title: "Sustainable", text: "Glass and aluminium where it works. Refills where it doesn’t." },
];

const STATS = [
  { n: "12k+", l: "5-star reviews" },
  { n: "30+", l: "authentic brands" },
  { n: "100%", l: "cruelty-free" },
  { n: "48h", l: "fast dispatch" },
];

export default function WhyAura() {
  const { storeName } = useStoreSettings();
  return (
    <section id="about" className="py-10 sm:py-14">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-magenta">
            The {storeName} promise
          </p>
          <h2 className="mt-2 font-serif text-[clamp(1.9rem,4.5vw,3.25rem)] leading-tight text-ink">
            Why you’ll <span className="italic text-gradient-glow">love</span> {storeName}
          </h2>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-[1.5rem] bg-white p-7 text-center ring-1 ring-line transition-shadow duration-500 hover:shadow-soft"
            >
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-petal text-magenta">
                <p.icon className="h-6 w-6" strokeWidth={1.7} />
              </span>
              <h3 className="mt-4 font-serif text-xl text-ink">{p.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{p.text}</p>
            </motion.div>
          ))}
        </div>

        {/* Stats bar — vibrant hot-pink (the signature magenta used on button
            hover), white text for contrast, and the pink glow for a premium,
            on-brand feel. */}
        <div className="mt-10 grid grid-cols-2 gap-6 rounded-[1.5rem] bg-magenta px-6 py-8 text-center text-white shadow-[var(--shadow-glow-pink)] ring-1 ring-magenta-deep/30 sm:grid-cols-4">
          {STATS.map((s, i) => (
            <motion.div
              key={s.l}
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
