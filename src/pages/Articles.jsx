import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpRight, Home } from "lucide-react";
import BackButton from "../components/ui/BackButton.jsx";

const EASE = [0.22, 1, 0.36, 1];

// The full journal — dedicated "All articles" page. Each article carries a
// `category` used by the filter bar below.
const ARTICLES = [
  {
    category: "Skincare",
    tag: "Routine",
    title: "The 10-Step Korean Skincare Routine, Explained",
    excerpt: "Ten steps sounds excessive. Most take under a minute, and half are optional on a weeknight. Here's what each layer is actually for.",
    read: "8 min read",
    tone: "var(--color-petal)",
    img: new URL("../../assests/jounal1.png", import.meta.url).href,
    link: "https://sokoglam.com/pages/the-korean-skin-care-routine",
  },
  {
    category: "Skincare",
    tag: "Ingredients",
    title: "Salicylic Acid & BHA: Your Guide to Clearer Skin",
    excerpt: "BHA is oil-soluble, so it works inside the pore where a glycolic acid can't reach. What that means for blackheads, and how often you should really use it.",
    read: "5 min read",
    tone: "var(--color-cyan-soft)",
    img: new URL("../../assests/journal2.webp", import.meta.url).href,
    link: "https://kbeautyworld.com/blogs/skincare-101/salicylic-acid-bha-skincare",
  },
  {
    category: "Skincare",
    tag: "Hydration",
    title: "The Best Korean Moisturizers for Dry Skin",
    excerpt: "Dry and dehydrated skin are not the same problem, and they don't want the same cream. Six picks, sorted by which one you actually have.",
    read: "6 min read",
    tone: "var(--color-gold-soft)",
    img: new URL("../../assests/joournal3.webp", import.meta.url).href,
    link: "https://kbeautyworld.com/blogs/skincare-101/korean-moisturizers-for-dry-skin",
  },
  {
    category: "Haircare",
    tag: "Scalp",
    title: "Korean Hair Care: The Scalp-First Approach",
    excerpt: "Korean haircare treats the scalp like facial skin. Cleanse it properly, exfoliate it occasionally, leave the barrier alone. Shine follows.",
    read: "6 min read",
    tone: "var(--color-cyan-soft)",
    img: new URL("../../assests/journal2.webp", import.meta.url).href,
    link: "https://kbeautyworld.com/blogs/skincare-101",
  },
  {
    category: "Haircare",
    tag: "Ingredients",
    title: "Rice Water for Hair: Does It Really Work?",
    excerpt: "Women in Heian-era Japan rinsed their hair with it. The chemistry holds up better than most heritage beauty claims, though not for the reason you'd guess.",
    read: "4 min read",
    tone: "var(--color-gold-soft)",
    img: new URL("../../assests/jounal1.png", import.meta.url).href,
    link: "https://kbeautyworld.com/blogs/skincare-101",
  },
  {
    category: "Makeup",
    tag: "Trends",
    title: "The 'No-Makeup' Korean Makeup Look",
    excerpt: "It reads as bare skin because it's built on skin prep, not coverage. The base does almost all the work; the gradient lip is the easy part.",
    read: "5 min read",
    tone: "var(--color-petal)",
    img: new URL("../../assests/joournal3.webp", import.meta.url).href,
    link: "https://sokoglam.com/pages/the-korean-skin-care-routine",
  },
  {
    category: "Health",
    tag: "Nutrition",
    title: "Beauty From Within: Foods for Glowing Skin",
    excerpt: "Collagen powder is mostly an expensive way to eat protein. Omega-3s, zinc and a decent night's sleep will do more for your barrier than another serum.",
    read: "6 min read",
    tone: "var(--color-cyan-soft)",
    img: new URL("../../assests/journal2.webp", import.meta.url).href,
    link: "https://kbeautyworld.com/blogs/skincare-101",
  },
  {
    category: "Skincare",
    tag: "Barrier",
    title: "Snail Mucin, Explained: Is the Hype Real?",
    excerpt: "The ingredient that pushed K-beauty into every algorithm. It's a genuinely good humectant. Whether it beats a plain hyaluronic serum is the fairer question.",
    read: "4 min read",
    tone: "var(--color-cyan-soft)",
    img: new URL("../../assests/journal2.webp", import.meta.url).href,
    link: "https://kbeautyworld.com/blogs/skincare-101",
  },
  {
    category: "Skincare",
    tag: "Sun Care",
    title: "Why Korean Sunscreens Are a Cut Above",
    excerpt: "No white cast, no tacky finish, and a texture you'll reapply without resenting it. Filter chemistry is the reason, and it's worth understanding.",
    read: "5 min read",
    tone: "var(--color-gold-soft)",
    img: new URL("../../assests/jounal1.png", import.meta.url).href,
    link: "https://kbeautyworld.com/blogs/skincare-101",
  },
  {
    category: "Wellness",
    tag: "Ritual",
    title: "The Mindful Skincare Ritual: Slow Beauty",
    excerpt: "Ten minutes at the sink, taken slowly. Facial massage, warm hands, and the argument for using fewer products more carefully.",
    read: "7 min read",
    tone: "var(--color-petal)",
    img: new URL("../../assests/joournal3.webp", import.meta.url).href,
    link: "https://sokoglam.com/pages/the-korean-skin-care-routine",
  },
];

const CATEGORIES = ["All", "Skincare", "Haircare", "Makeup", "Health", "Wellness"];

export default function Articles() {
  const [active, setActive] = useState("All");

  const filtered = useMemo(
    () => (active === "All" ? ARTICLES : ARTICLES.filter((a) => a.category === active)),
    [active]
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

        {/* Category filter */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
          {CATEGORIES.map((cat) => {
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
                key={a.title}
                layout
                href={a.link}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.4, delay: (i % 3) * 0.06, ease: EASE }}
                whileHover={{ y: -6 }}
                className="group flex flex-col overflow-hidden rounded-[1.5rem] bg-white ring-1 ring-line transition-shadow duration-500 hover:shadow-lift"
              >
                <div
                  className="relative aspect-[16/10] overflow-hidden"
                  style={{ background: `radial-gradient(120% 100% at 30% 0%, #fff, ${a.tone})` }}
                >
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
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
