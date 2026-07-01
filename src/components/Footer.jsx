import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ArrowRight, Instagram, Youtube, Twitter, Facebook } from "lucide-react";

const COLUMNS = [
  {
    title: "Shop",
    links: [
      { label: "All Products", href: "#/shop" },
      { label: "Best Sellers", href: "#/shop" },
      { label: "New Arrivals", href: "#/shop" },
    ],
  },
      {
        title: "About",
        links: [
      { label: "Our Story", href: "#/about" },
      { label: "Rituals", href: "#rituals" },
      { label: "Journal", href: "#journal" },
      { label: "Sustainability", href: "#/about" },
    ],
  },
  {
    title: "Help",
    links: [
      { label: "Shipping & Returns", href: "#/about" },
      { label: "Track Order", href: "#/about" },
      { label: "FAQs", href: "#/contact" },
      { label: "Contact", href: "#/contact" },
    ],
  },
];

const SOCIALS = [Instagram, Youtube, Twitter, Facebook];

export default function Footer() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  function submit(e) {
    e.preventDefault();
    if (!ok) return;
    setSent(true);
    setTimeout(() => {
      setSent(false);
      setEmail("");
    }, 3500);
  }

  return (
    <footer className="border-t border-line bg-snow dark:border-white/10 dark:bg-[var(--color-ink)]">
      {/* Newsletter */}
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="grid gap-8 rounded-[1.75rem] bg-gradient-to-br from-petal via-white to-cyan-soft/40 p-8 ring-1 ring-line dark:from-white/[0.05] dark:via-transparent dark:to-white/[0.02] dark:ring-white/10 sm:p-12 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="font-serif text-[clamp(1.75rem,4vw,2.75rem)] leading-tight text-ink dark:text-white">
              Join the <span className="italic text-gradient-glow">glow letter</span> 🌸
            </h2>
            <p className="mt-3 max-w-md text-ink-soft dark:text-white/70">
              Soulful skincare tips, early drops, and a little daily affirmation.
              Plus <strong>10% off</strong> your first ritual.
            </p>
          </div>

          <form onSubmit={submit} className="relative">
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                aria-label="Email address"
                className="flex-1 rounded-full bg-white px-5 py-4 text-sm text-ink ring-1 ring-line outline-none focus:ring-2 focus:ring-magenta/50 dark:bg-white/5 dark:text-white dark:ring-white/10"
              />
              <button
                type="submit"
                disabled={!ok || sent}
                className={`inline-flex items-center justify-center gap-2 rounded-full px-7 py-4 text-sm font-semibold text-white transition-all ${
                  ok && !sent ? "bg-magenta hover:shadow-[var(--shadow-glow-pink)]" : "bg-ink/30 dark:bg-white/20"
                }`}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {sent ? (
                    <motion.span key="sent" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} className="inline-flex items-center gap-2">
                      <Check className="h-4 w-4" strokeWidth={3} /> You’re in!
                    </motion.span>
                  ) : (
                    <motion.span key="join" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="inline-flex items-center gap-2">
                      Subscribe <ArrowRight className="h-4 w-4" strokeWidth={2} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            </div>
            <AnimatePresence>
              {sent && (
                <motion.p
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-3 text-sm font-medium text-magenta"
                >
                  Welcome to the glow ✨ Check your inbox for your 10% code.
                </motion.p>
              )}
            </AnimatePresence>
          </form>
        </div>
      </div>

      {/* Links */}
      <div className="mx-auto max-w-7xl px-5 pb-12 sm:px-8">
        <div className="grid gap-10 border-t border-line pt-12 dark:border-white/10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <a href="#/" className="font-serif text-2xl text-ink dark:text-white">
              aura<span className="text-magenta">.</span>skin
            </a>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-soft dark:text-white/60">
              Authentic K & J-Beauty, curated into rituals that help your skin —
              and your spirit — glow from within.
            </p>
            <div className="mt-5 flex gap-2">
              {SOCIALS.map((Icon, i) => (
                <a
                  key={i}
                  href="#/about"
                  aria-label="Social link"
                  className="grid h-10 w-10 place-items-center rounded-full bg-white text-ink-soft ring-1 ring-line transition-colors hover:text-magenta hover:ring-magenta/40 dark:bg-white/5 dark:text-white/60 dark:ring-white/10"
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={1.7} />
                </a>
              ))}
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-semibold text-ink dark:text-white">{col.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a href={l.href} className="text-sm text-ink-soft transition-colors hover:text-magenta dark:text-white/60">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-line pt-6 text-xs text-ink-soft dark:border-white/10 dark:text-white/45 sm:flex-row">
          <p>© {new Date().getFullYear()} aura.skin — Glow within, bloom daily. 🌸</p>
          <div className="flex gap-5">
            <a href="#/about" className="hover:text-magenta">Privacy</a>
            <a href="#/about" className="hover:text-magenta">Terms</a>
            <a href="#/about" className="hover:text-magenta">Cookies</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
