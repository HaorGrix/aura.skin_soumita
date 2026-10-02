import { useMemo } from "react";
import { ArrowUp, Instagram, Facebook } from "lucide-react";
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

  return (
    <footer className="border-t border-line bg-snow">
      {/* Links */}
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
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
              <h3 className="font-display text-sm text-ink">{col.title}</h3>
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

        {/* Bottom bar — attribution + back-to-top on the left, legal links on
            the right. Stacks (centered) below sm; side-by-side from sm up. */}
        <div className="mt-12 flex flex-col items-center gap-3 border-t border-line pt-6 text-xs text-ink-soft sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:text-left">
          <div className="flex flex-col items-center gap-2 text-center sm:items-start sm:text-left">
            <p>
              Website designed &amp; developed by{" "}
              <a
                href="https://haorgrix.com/"
                target="_blank"
                rel="noopener"
                className="font-medium text-ink-soft underline underline-offset-2 transition-colors hover:text-magenta"
              >
                HaorGrix
              </a>
            </p>
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-widest text-ink-soft/70 transition-colors hover:text-magenta"
            >
              <ArrowUp className="h-3 w-3" strokeWidth={2} /> Back to top
            </button>
          </div>

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
