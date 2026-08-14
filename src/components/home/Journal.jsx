import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { useRecentArticles, journalImageUrl } from "../../lib/api/journal.js";

// Same gradient wash the admin's category pills rotate through — no per-
// article "tone" field in the DB, so it's derived deterministically from
// the article's position so cards still read as distinct, not because any
// admin picks a colour when writing a post.
const TONES = ["var(--color-petal)", "var(--color-cyan-soft)", "var(--color-gold-soft)"];

export default function Journal() {
  const { articles, ready } = useRecentArticles(3);

  // Nothing published yet: render nothing, same as an unfilled CMS slot
  // elsewhere in this project (testimonials, hero carousel).
  if (ready && articles.length === 0) return null;

  return (
    <section id="journal" className="py-10 sm:py-14">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        {/* Journal teasers */}
        <div className="flex items-end justify-between">
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
          {articles.map((a, i) => (
            <motion.a
              key={a.id}
              href={`/journal/${a.slug}`}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -6 }}
              className="group flex flex-col overflow-hidden rounded-none bg-white ring-1 ring-line transition-shadow duration-500 hover:shadow-lift"
            >
              <div
                className="relative aspect-[16/10] overflow-hidden"
                style={{ background: `radial-gradient(120% 100% at 30% 0%, #fff, ${TONES[i % TONES.length]})` }}
              >
                {a.cover_image && (
                  <img
                    src={journalImageUrl(a.cover_image)}
                    alt={a.title}
                    loading="lazy"
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                )}
                <span className="absolute left-4 top-4 rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-magenta backdrop-blur">
                  {a.category}
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
                  <span className="text-ink-soft">{a.read_minutes ?? 5} min read</span>
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
