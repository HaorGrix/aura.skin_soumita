import { motion } from "framer-motion";

/* Featured soul-quote cards */
const QUOTES = [
  {
    q: "Skincare isn’t vanity — it’s a daily act of self-love.",
    a: "The aura ritual",
    tone: "var(--color-petal)",
  },
  {
    q: "Your skin hears every kind word you tell yourself.",
    a: "Morning affirmation",
    tone: "var(--color-cyan-soft)",
  },
  {
    q: "Glow isn’t a destination. It’s how you treat yourself today.",
    a: "Evening ritual",
    tone: "var(--color-gold-soft)",
  },
];

export default function Affirmations() {
  return (
    <section className="py-14 sm:py-20">
      {/* Featured quotes */}
      <div className="mx-auto mt-16 max-w-7xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-magenta">
            Daily affirmations
          </p>
          <h2 className="mt-2 font-serif text-[clamp(1.9rem,4.5vw,3.25rem)] leading-tight text-ink dark:text-white">
            Words your skin <span className="italic text-gradient-glow">loves to hear</span>
          </h2>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {QUOTES.map((item, i) => (
            <motion.figure
              key={i}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -8 }}
              className="group relative overflow-hidden rounded-[1.5rem] bg-white p-7 shadow-soft ring-1 ring-line transition-shadow duration-500 hover:shadow-lift dark:bg-white/[0.03] dark:ring-white/10"
            >
              <span
                aria-hidden
                className="absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-60 blur-2xl transition-opacity duration-500 group-hover:opacity-90"
                style={{ background: `radial-gradient(circle, ${item.tone}, transparent 70%)` }}
              />
              <span className="relative font-serif text-5xl leading-none text-magenta/30">“</span>
              <blockquote className="relative mt-2 font-serif text-xl leading-snug text-ink dark:text-white">
                {item.q}
              </blockquote>
              <figcaption className="relative mt-5 text-sm font-medium text-ink-soft dark:text-white/55">
                — {item.a}
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}
