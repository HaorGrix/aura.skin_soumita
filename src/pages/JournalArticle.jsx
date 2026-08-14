import { Calendar, Home } from "lucide-react";
import { motion } from "framer-motion";
import BackButton from "../components/ui/BackButton.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import ArticleProse from "../components/journal/ArticleProse.jsx";
import { navigate } from "../lib/navigate.js";
import { useArticleBySlug, journalImageUrl } from "../lib/api/journal.js";

const EASE = [0.22, 1, 0.36, 1];

export default function JournalArticle({ slug }) {
  const article = useArticleBySlug(slug);

  if (article === undefined) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-magenta border-t-transparent" />
      </div>
    );
  }

  if (article === null) {
    return (
      <div className="mx-auto max-w-2xl px-5 pb-28 pt-8 sm:px-8">
        <BackButton route="journal" />
        <EmptyState
          emoji="📝"
          title="Article not found"
          message="This article doesn't exist, or isn't published yet."
          actionLabel="Back to the Journal"
          onAction={() => navigate("/journal")}
        />
      </div>
    );
  }

  const published = article.published_at ? new Date(article.published_at) : null;

  return (
    <div className="min-h-screen pb-28">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <BackButton route="journal" />

        <nav className="flex items-center gap-2 text-sm text-ink-soft" aria-label="Breadcrumb">
          <a href="/" className="inline-flex items-center gap-1 hover:text-magenta">
            <Home className="h-3.5 w-3.5" strokeWidth={1.8} /> Home
          </a>
          <span>/</span>
          <a href="/journal" className="hover:text-magenta">Journal</a>
          <span>/</span>
          <span className="truncate text-ink">{article.title}</span>
        </nav>

        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="mt-6"
        >
          <span className="rounded-full bg-petal px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-magenta-deep">
            {article.category}
          </span>
          <h1 className="mt-4 font-serif text-[clamp(1.9rem,4.5vw,3rem)] leading-tight text-ink">
            {article.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-ink-soft">
            {published && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" strokeWidth={1.8} />
                {published.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
              </span>
            )}
            <span>{article.read_minutes ?? 5} min read</span>
            {article.author_name && <span>By {article.author_name}</span>}
          </div>
        </motion.header>

        {article.cover_image && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
            className="mt-6 overflow-hidden rounded-2xl ring-1 ring-line"
          >
            <img
              src={journalImageUrl(article.cover_image)}
              alt={article.title}
              className="aspect-[16/9] w-full object-cover"
            />
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: EASE }}
          className="mt-8"
        >
          <ArticleProse html={article.body_html} />
        </motion.div>

        <div className="mt-12 border-t border-line pt-6">
          <a href="/journal" className="text-sm font-medium text-magenta hover:underline">
            ← Back to all articles
          </a>
        </div>
      </div>
    </div>
  );
}
