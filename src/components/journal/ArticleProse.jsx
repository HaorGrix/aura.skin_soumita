/* =================================================================== *
 * skin.theory — sanitized article body renderer
 * -------------------------------------------------------------------
 * `body_html` is admin-authored via Tiptap (see admin/components/
 * JournalEditor.jsx) but rendered straight to the public storefront, so
 * it's sanitized here with DOMPurify right before render — sanitize-on-
 * render rather than sanitize-on-write, so the allowlist can evolve
 * without a data migration touching every stored article.
 * =================================================================== */
import { useMemo } from "react";
import DOMPurify from "dompurify";

const ALLOWED_TAGS = [
  "p", "h1", "h2", "h3", "strong", "em", "b", "i", "u", "s",
  "ul", "ol", "li", "a", "img", "br", "blockquote", "code", "pre",
];
const ALLOWED_ATTR = ["href", "src", "alt", "title", "class", "target", "rel"];

export default function ArticleProse({ html, className = "" }) {
  const clean = useMemo(
    () => DOMPurify.sanitize(html ?? "", { ALLOWED_TAGS, ALLOWED_ATTR }),
    [html]
  );

  return (
    <div
      className={
        "max-w-none text-ink " +
        "[&_h1]:mt-8 [&_h1]:mb-3 [&_h1]:font-serif [&_h1]:text-2xl sm:[&_h1]:text-3xl [&_h1]:leading-snug [&_h1]:text-ink " +
        "[&_h2]:mt-7 [&_h2]:mb-3 [&_h2]:font-serif [&_h2]:text-xl sm:[&_h2]:text-2xl [&_h2]:leading-snug [&_h2]:text-ink " +
        "[&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:font-serif [&_h3]:text-lg [&_h3]:text-ink " +
        "[&_p]:mb-4 [&_p]:leading-relaxed [&_p]:text-[15px] sm:[&_p]:text-base " +
        "[&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1.5 " +
        "[&_img]:my-5 [&_img]:w-full [&_img]:rounded-xl " +
        "[&_a]:text-magenta [&_a]:underline [&_a]:underline-offset-2 " +
        "[&_strong]:font-semibold [&_blockquote]:my-4 [&_blockquote]:border-l-2 [&_blockquote]:border-magenta [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-ink-soft " +
        className
      }
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
