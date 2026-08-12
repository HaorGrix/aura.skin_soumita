/* =================================================================== *
 * skin.theory — shared layout for the legal/policy pages (Privacy,
 * Terms, Cookies). One place for the header/breadcrumb/section chrome
 * so the three pages read as one consistent system, not three one-off
 * designs — only the content differs per page.
 * =================================================================== */
import { Home } from "lucide-react";
import BackButton from "../ui/BackButton.jsx";
import Footer from "../Footer.jsx";

export default function PolicyPage({ route, eyebrow, title, updated, intro, sections }) {
  return (
    <div className="min-h-screen pb-4">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <BackButton route={route} />

        <nav className="flex items-center gap-2 text-sm text-ink-soft" aria-label="Breadcrumb">
          <a href="/" className="inline-flex items-center gap-1 hover:text-magenta">
            <Home className="h-3.5 w-3.5" strokeWidth={1.8} /> Home
          </a>
          <span>/</span>
          <span className="text-ink">{title}</span>
        </nav>

        <div className="mt-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-magenta">
            {eyebrow}
          </p>
          <h1 className="mt-2 font-serif text-[clamp(2rem,5vw,3.25rem)] leading-tight text-ink">
            {title}
          </h1>
          {updated && (
            <p className="mt-3 text-xs font-medium uppercase tracking-wide text-ink-soft">
              Last updated {updated}
            </p>
          )}
          {intro && (
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-soft">
              {intro}
            </p>
          )}
        </div>

        <div className="mt-10 space-y-9 pb-24">
          {sections.map((s) => (
            <section key={s.heading}>
              <h2 className="font-serif text-xl leading-snug text-ink sm:text-2xl">
                {s.heading}
              </h2>
              {(Array.isArray(s.body) ? s.body : [s.body]).map((p, i) => (
                <p key={i} className="mt-3 text-sm leading-relaxed text-ink-soft sm:text-[15px]">
                  {p}
                </p>
              ))}
              {s.list && (
                <ul className="mt-3 space-y-2">
                  {s.list.map((item) => (
                    <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-ink-soft sm:text-[15px]">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-magenta" />
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </div>

      <Footer />
    </div>
  );
}
