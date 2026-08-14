import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpRight, Home } from "lucide-react";
import BackButton from "../components/ui/BackButton.jsx";
import { usePublishedArticles, journalImageUrl } from "../lib/api/journal.js";

const EASE = [0.22, 1, 0.36, 1];
const TONES = ["var(--color-petal)", "var(--color-cyan-soft)", "var(--color-gold-soft)"];

export default function Articles() {
  const { articles, ready } = usePublishedArticles();
  const [active, setActive] = useState("All");

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(articles.map((a) => a.category)))],
    [articles]
  );

  const filtered = useMemo(
    () => (active === "All" ? articles : articles.filter((a) => a.category === active)),
    [active, articles]
  );

  return (
    <div className="min-h-screen pb-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <BackButton route="journal" />

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-ink-soft" aria-label="Breadcrumb">
          <a href="/" className="inline-flex items-center gap-1 hover:text-magenta">
            <Home className="h-3.5 w-3.5" strokeWidth={1.8} /> Home
          </a>
          <span>/</span>
          <span className="text-ink">Journal</span>
        </nav>

        {/* Header */}
        <div className="mx-auto mt-8 max-w-2xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-magenta">
            The Journal
          </p>
          <h1 className="mt-2 font-serif text-[clamp(2.2rem,5vw,3.75rem)] leading-tight text-ink">
            Stories & <span className="italic text-gradient-glow">soulful reads</span>
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-ink-soft sm:text-base">
            Ingredient breakdowns, honest routine guides, and the occasional
            beauty myth we'd like to retire.
          </p>
        </div>

        {!ready ? (
          <div className="grid place-items-center py-24">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-magenta border-t-transparent" />
          </div>
        ) : articles.length === 0 ? (
          <p className="mt-16 text-center text-sm text-ink-soft">No articles published yet — check back soon.</p>
        ) : (
          <>
            {/* Category filter */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
              {categories.map((cat) => {
                const on = cat === active;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActive(cat)}
                    aria-pressed={on}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      on
                        ? "bg-magenta text-white shadow-glow-pink"
                        : "bg-white text-ink ring-1 ring-line hover:text-magenta hover:ring-magenta"
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* Grid */}
            <motion.div layout className="mt-10 grid gap-4 sm:grid-cols-2 md:gap-5 lg:grid-cols-3">
              <AnimatePresence mode="popLayout">
                {filtered.map((a, i) => (
                  <motion.a
                    key={a.id}
                    layout
                    href={`/journal/${a.slug}`}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.4, delay: (i % 3) * 0.06, ease: EASE }}
                    whileHover={{ y: -6 }}
                    className="group flex flex-col overflow-hidden rounded-[1.5rem] bg-white ring-1 ring-line transition-shadow duration-500 hover:shadow-lift"
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
              </AnimatePresence>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}
