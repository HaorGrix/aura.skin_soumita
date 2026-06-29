import { useState } from "react";
import { motion } from "framer-motion";
import { Star, BadgeCheck, ThumbsUp } from "lucide-react";

/** Shared star row — reused by the card and the reviews summary. */
export function Stars({ value, className = "h-4 w-4" }) {
  return (
    <span className="inline-flex text-gold">
      {[0, 1, 2, 3, 4].map((i) => (
        <Star
          key={i}
          className={className}
          fill={i < Math.round(value) ? "var(--color-gold)" : "transparent"}
          stroke={i < Math.round(value) ? "var(--color-gold)" : "currentColor"}
          strokeWidth={1.5}
        />
      ))}
    </span>
  );
}

function whenLabel(daysAgo) {
  if (daysAgo <= 0) return "Just now";
  if (daysAgo === 1) return "Yesterday";
  if (daysAgo < 30) return `${daysAgo} days ago`;
  const m = Math.round(daysAgo / 30);
  return `${m} month${m > 1 ? "s" : ""} ago`;
}

/**
 * ReviewCard — one reusable review tile. Used in the PDP reviews list and
 * anywhere else reviews surface. `tone` drives the avatar gradient.
 */
export default function ReviewCard({ review, tone = "var(--color-petal)" }) {
  const r = review;
  const [helpful, setHelpful] = useState(r.helpful ?? 0);
  const [voted, setVoted] = useState(false);

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.4 }}
      className={`rounded-[1.25rem] p-5 ring-1 ${
        r.mine
          ? "bg-petal/60 ring-magenta/30 dark:bg-magenta/[0.08] dark:ring-magenta/25"
          : "bg-snow ring-line dark:bg-white/[0.03] dark:ring-white/10"
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-semibold text-ink"
          style={{ background: `radial-gradient(circle at 30% 30%, #fff, ${r.tone ?? tone})` }}
        >
          {r.name.charAt(0)}
        </span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-1.5 text-sm font-semibold text-ink dark:text-white">
            {r.name}
            {r.verified && (
              <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-cyan">
                <BadgeCheck className="h-3.5 w-3.5" strokeWidth={2} /> Verified Purchase
              </span>
            )}
          </p>
          <div className="flex items-center gap-2">
            <Stars value={r.stars} className="h-3.5 w-3.5" />
            <span className="text-xs text-ink-soft dark:text-white/45">{whenLabel(r.daysAgo)}</span>
          </div>
        </div>
      </div>

      {r.title && <p className="mt-3 font-semibold text-ink dark:text-white">{r.title}</p>}
      {r.body && <p className="mt-1 leading-relaxed text-ink-soft dark:text-white/70">{r.body}</p>}

      {r.hasPhoto && (
        <div className="mt-3 flex gap-2">
          {[0, 1].map((i) => (
            <span
              key={i}
              className="h-16 w-16 rounded-xl ring-1 ring-line dark:ring-white/10"
              style={{ background: `linear-gradient(135deg, #fff, ${r.tone ?? tone})` }}
            />
          ))}
        </div>
      )}

      <button
        onClick={() => {
          if (voted) return;
          setHelpful((n) => n + 1);
          setVoted(true);
        }}
        className={`mt-3 inline-flex items-center gap-1.5 text-xs font-medium transition-colors ${
          voted ? "text-magenta" : "text-ink-soft hover:text-magenta dark:text-white/55"
        }`}
      >
        <ThumbsUp className="h-3.5 w-3.5" strokeWidth={1.8} /> Helpful ({helpful})
      </button>
    </motion.article>
  );
}
