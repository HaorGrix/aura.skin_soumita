import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";

const ARTICLES = [
  {
    tag: "Routine",
    title: "The 10-Step Korean Skincare Routine, Explained",
    excerpt: "Everything you need to know about the famous K-beauty philosophy, from oil cleansing to the final layer of SPF.",
    read: "8 min read",
    tone: "var(--color-petal)",
    link: "https://sokoglam.com/pages/the-korean-skin-care-routine"
  },
  {
    tag: "Trends",
    title: "What Is Slugging? The Viral K-Beauty Skincare Trend Explained",
    excerpt: "Dermatologists weigh in on why sealing your face with petrolatum might be the secret to waking up with a glowing, repaired barrier.",
    read: "5 min read",
    tone: "var(--color-cyan-soft)",
    link: "https://www.byrdie.com/slugging-skincare-trend-5087545"
  },
  {
    tag: "Glass Skin",
    title: "How to Get the Glowing, Dewy K-Beauty Look",
    excerpt: "Glass skin is all about a poreless, luminous complexion. Here is the step-by-step guide to achieving the ultimate hydrated glow.",
    read: "6 min read",
    tone: "var(--color-gold-soft)",
    link: "https://www.allure.com/story/glass-skin-k-beauty-trend"
  },
];

export default function Journal() {
  return (
    <section id="journal" className="py-14 sm:py-20">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        {/* Community story */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-petal via-white to-cyan-soft/30 p-8 text-center ring-1 ring-line dark:from-white/[0.05] dark:via-transparent dark:to-white/[0.02] dark:ring-white/10 sm:p-14"
        >
          <span className="text-4xl">🌸</span>
          <blockquote className="mx-auto mt-5 max-w-2xl font-serif text-[clamp(1.4rem,3vw,2.25rem)] leading-snug text-ink dark:text-white">
            “aura.skin didn’t just change my skin — it gave me ten minutes a day
            that feel like self-love. My barrier healed, and so did my confidence.”
          </blockquote>
          <figcaption className="mt-5 text-sm font-medium text-ink-soft dark:text-white/60">
            — Tasnia H., glowing for 8 months
          </figcaption>
          <div className="mt-4 flex items-center justify-center gap-1 text-gold">
            {"★★★★★".split("").map((s, i) => (
              <span key={i}>{s}</span>
            ))}
          </div>
        </motion.div>

        {/* Journal teasers */}
        <div className="mt-12 flex items-end justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-magenta">
              The Journal
            </p>
            <h2 className="mt-2 font-serif text-[clamp(1.75rem,4vw,3rem)] leading-tight text-ink dark:text-white">
              Stories & <span className="italic text-gradient-glow">soulful reads</span>
            </h2>
          </div>
          <a href="#journal" className="hidden text-sm font-medium text-magenta hover:underline sm:inline">
            All articles →
          </a>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 md:gap-5 lg:grid-cols-3">
          {ARTICLES.map((a, i) => (
            <motion.a
              key={a.title}
              href={a.link}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -6 }}
              className="group overflow-hidden rounded-[1.5rem] bg-white ring-1 ring-line transition-shadow duration-500 hover:shadow-lift dark:bg-white/[0.03] dark:ring-white/10"
            >
              <div
                className="relative aspect-[16/10] overflow-hidden"
                style={{ background: `radial-gradient(120% 100% at 30% 0%, #fff, ${a.tone})` }}
              >
                <span className="absolute left-4 top-4 rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-magenta backdrop-blur">
                  {a.tag}
                </span>
                <span className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/80 text-ink backdrop-blur transition-transform duration-300 group-hover:rotate-45">
                  <ArrowUpRight className="h-4 w-4" strokeWidth={1.8} />
                </span>
              </div>
              <div className="p-5">
                <h3 className="font-serif text-lg leading-snug text-ink transition-colors group-hover:text-magenta dark:text-white">
                  {a.title}
                </h3>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-soft dark:text-white/65">
                  {a.excerpt}
                </p>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-ink-soft dark:text-white/45">{a.read}</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-magenta">
                    Read more
                    <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={2} />
                  </span>
                </div>
              </div>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
}
