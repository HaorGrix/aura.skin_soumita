import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";

// Journal cover art lives in /assests as jounal{1,2,3}.png. Each card maps to
// its own file; missing files fall back to the gradient wash (see onError).
const ARTICLES = [
  {
    tag: "Routine",
    title: "The 10-Step Korean Skincare Routine, Explained",
    excerpt: "Everything you need to know about the famous K-beauty philosophy, from oil cleansing to the final layer of SPF.",
    read: "8 min read",
    tone: "var(--color-petal)",
    img: new URL("../../../assests/jounal1.png", import.meta.url).href,
    link: "https://sokoglam.com/pages/the-korean-skin-care-routine"
  },
  {
    tag: "Ingredients",
    title: "Salicylic Acid & BHA: Your Guide to Clearer Skin",
    excerpt: "How beta-hydroxy acids unclog pores, smooth texture, and calm breakouts — plus the gentle K-beauty toners that do it best.",
    read: "5 min read",
    tone: "var(--color-cyan-soft)",
    img: new URL("../../../assests/journal2.webp", import.meta.url).href,
    link: "https://kbeautyworld.com/blogs/skincare-101/salicylic-acid-bha-skincare"
  },
  {
    tag: "Hydration",
    title: "The Best Korean Moisturizers for Dry Skin",
    excerpt: "From rich creams to barrier-loving balms, these K-beauty picks quench thirsty skin and seal in a dewy, lasting glow.",
    read: "6 min read",
    tone: "var(--color-gold-soft)",
    img: new URL("../../../assests/joournal3.webp", import.meta.url).href,
    link: "https://kbeautyworld.com/blogs/skincare-101/korean-moisturizers-for-dry-skin"
  },
];

export default function Journal() {
  return (
    <section id="journal" className="py-10 sm:py-14">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        {/* Community story */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-petal via-white to-cyan-soft/30 p-8 text-center ring-1 ring-line sm:p-14"
        >
          <span className="text-4xl">🌸</span>
          <blockquote className="mx-auto mt-5 max-w-2xl font-serif text-[clamp(1.4rem,3vw,2.25rem)] leading-snug text-ink">
            “skin.script didn’t just change my skin — it gave me ten minutes a day
            that feel like self-love. My barrier healed, and so did my confidence.”
          </blockquote>
          <figcaption className="mt-5 text-sm font-medium text-ink-soft">
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
            <h2 className="mt-2 font-serif text-[clamp(1.75rem,4vw,3rem)] leading-tight text-ink">
              Stories & <span className="italic text-gradient-glow">soulful reads</span>
            </h2>
          </div>
          <a href="/journal" className="hidden text-sm font-medium text-magenta hover:underline sm:inline">
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
              className="group flex flex-col overflow-hidden rounded-[1.5rem] bg-white ring-1 ring-line transition-shadow duration-500 hover:shadow-lift"
            >
              <div
                className="relative aspect-[16/10] overflow-hidden"
                style={{ background: `radial-gradient(120% 100% at 30% 0%, #fff, ${a.tone})` }}
              >
                {/* Cover image — sits over the gradient; if the file isn't
                    present yet it hides itself, revealing the gradient wash. */}
                <img
                  src={a.img}
                  alt={a.title}
                  loading="lazy"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <span className="absolute left-4 top-4 rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-magenta backdrop-blur">
                  {a.tag}
                </span>
                <span className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/80 text-ink backdrop-blur transition-transform duration-300 group-hover:rotate-45">
                  <ArrowUpRight className="h-4 w-4" strokeWidth={1.8} />
                </span>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="line-clamp-2 font-serif text-lg leading-snug text-ink transition-colors group-hover:text-magenta">
                  {a.title}
                </h3>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-soft">
                  {a.excerpt}
                </p>
                <div className="mt-auto flex items-center justify-between pt-4 text-xs">
                  <span className="text-ink-soft">{a.read}</span>
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
