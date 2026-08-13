import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ArrowRight, Instagram, Facebook } from "lucide-react";
import { isValidEmail } from "../lib/email-validation.js";
import { useStoreSettings } from "../lib/api/settings.js";
import { useContent } from "../lib/api/content.js";

/* lucide-react ships no TikTok glyph — inline outline, sized/stroked to
   match the Instagram/Facebook icons it sits next to. */
function TikTokIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}
      strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16.5 3c.3 2.1 1.8 3.7 4 4v3c-1.5.1-2.9-.4-4-1.2V15a6 6 0 1 1-6-6c.3 0 .7 0 1 .1v3.1a3 3 0 1 0 2 2.8V3h3Z" />
    </svg>
  );
}

export default function Footer() {
  const { storeName } = useStoreSettings();
  const { content } = useContent("footer.columns");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  // Group the flat admin-editable link list back into columns, in the order
  // each column heading first appears — so an admin adding a brand-new
  // heading just works without any code change here.
  const columns = useMemo(() => {
    const groups = [];
    const byTitle = new Map();
    for (const link of content.links ?? []) {
      if (!link.column || !link.label || !link.href) continue;
      let group = byTitle.get(link.column);
      if (!group) {
        group = { title: link.column, links: [] };
        byTitle.set(link.column, group);
        groups.push(group);
      }
      group.links.push({ label: link.label, href: link.href });
    }
    return groups;
  }, [content.links]);

  // Only accounts with a real URL show an icon — leaving a field blank in
  // admin hides that icon entirely rather than linking to a dead "#".
  const socials = [
    { Icon: Facebook, label: "Facebook", href: content.facebook },
    { Icon: Instagram, label: "Instagram", href: content.instagram },
    { Icon: TikTokIcon, label: "TikTok", href: content.tiktok },
  ].filter((s) => s.href);

  const ok = isValidEmail(email);

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
    <footer className="border-t border-line bg-snow">
      {/* Newsletter */}
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="grid gap-8 rounded-[1.75rem] bg-gradient-to-br from-petal via-white to-cyan-soft/40 p-8 ring-1 ring-line sm:p-12 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="font-serif text-[clamp(1.75rem,4vw,2.75rem)] leading-tight text-ink">
              Join the <span className="italic text-gradient-glow">glow letter</span> 🌸
            </h2>
            <p className="mt-3 max-w-md text-ink-soft">
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
                className="flex-1 rounded-full bg-white px-5 py-4 text-sm text-ink ring-1 ring-line outline-none focus:ring-2 focus:ring-magenta/50"
              />
              <button
                type="submit"
                disabled={!ok || sent}
                className={`inline-flex items-center justify-center gap-2 rounded-full px-7 py-4 text-sm font-semibold text-white transition-all ${
                  ok && !sent ? "bg-magenta hover:shadow-[var(--shadow-glow-pink)]" : "bg-ink/30"
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
        <div className="grid gap-10 border-t border-line pt-12 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <a href="/" className="font-serif text-2xl text-ink">
              {storeName}
            </a>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-soft">
              {content.blurb}
            </p>
            <div className="mt-5 flex gap-2">
              {socials.map(({ Icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="grid h-10 w-10 place-items-center rounded-full bg-white text-ink-soft ring-1 ring-line transition-colors hover:text-magenta hover:ring-magenta/40"
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={1.7} />
                </a>
              ))}
            </div>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-semibold text-ink">{col.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a href={l.href} className="text-sm text-ink-soft transition-colors hover:text-magenta">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-line pt-6 text-xs text-ink-soft sm:flex-row">
          <p>© {new Date().getFullYear()} {storeName} — {content.copyright}</p>
          <div className="flex gap-5">
            <a href="/privacy" className="hover:text-magenta">Privacy</a>
            <a href="/terms" className="hover:text-magenta">Terms</a>
            <a href="/cookies" className="hover:text-magenta">Cookies</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
