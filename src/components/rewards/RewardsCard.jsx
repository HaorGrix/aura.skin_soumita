/* =================================================================== *
 * skin.theory — points card + unlocked rewards (Rewards page, Account)
 * -------------------------------------------------------------------
 * Driven entirely by Admin → Rewards: the tiers are the live reward
 * coupons (list_reward_tiers()), the earn line comes from the live rates.
 * =================================================================== */
import { motion } from "framer-motion";
import { Check, Gift, Sparkles, Ticket, Truck } from "lucide-react";
import { useUser } from "../../context/UserContext.jsx";

const ease = [0.22, 1, 0.36, 1];

/** Progress from the last unlocked tier to the next one. */
function progressPct(points, tiers) {
  if (!tiers.length) return 0;
  const prev = [...tiers].reverse().find((t) => points >= t.points)?.points ?? 0;
  const next = tiers.find((t) => points < t.points)?.points ?? tiers.at(-1).points;
  return Math.min(100, Math.round(((points - prev) / (next - prev || 1)) * 100));
}

/** "1 point for every ৳1000 spent · 5 per review" — only what's switched on. */
export function earnLine({ earnsOnSpend, earnsOnReview, spendText, pointsPerReview }) {
  const parts = [];
  if (earnsOnSpend) parts.push(spendText);
  if (earnsOnReview) parts.push(`${pointsPerReview} per review`);
  return parts.join(" · ");
}

export function PointsCard() {
  const { points, nextMilestone, rewards } = useUser();
  const tiers = rewards.tiers;
  const pct = progressPct(points, tiers);
  const line = earnLine(rewards);

  return (
    <div className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-magenta to-magenta-deep p-6 text-white shadow-[var(--shadow-glow-pink)] sm:p-8">
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/15 blur-2xl" />

      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.16em] text-white/80">
            <Sparkles className="h-4 w-4" strokeWidth={2} /> {rewards.name}
          </p>
          <p className="mt-2 font-serif text-5xl leading-none">{points}</p>
          <p className="mt-1 text-sm text-white/85">loyalty points{line ? ` · ${line}` : ""}</p>
        </div>
        {tiers.length > 0 && (
          <div className="text-left sm:text-right">
            {nextMilestone ? (
              <p className="text-sm text-white/90">
                <span className="font-semibold">{nextMilestone.points - points} pts</span> to {nextMilestone.short}
              </p>
            ) : (
              <p className="text-sm font-semibold text-white/90">Top tier unlocked 🎉</p>
            )}
          </div>
        )}
      </div>

      {tiers.length > 0 && (
        <div className="relative mt-6">
          <div className="h-2.5 overflow-hidden rounded-full bg-white/25">
            <motion.span
              className="block h-full rounded-full bg-white"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.85, ease, delay: 0.3 }}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {tiers.map((t) => {
              const unlocked = points >= t.points;
              return (
                <span
                  key={t.code}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${
                    unlocked ? "bg-white text-magenta ring-white" : "bg-white/10 text-white/75 ring-white/25"
                  }`}
                >
                  {unlocked ? <Check className="h-3 w-3" strokeWidth={3} /> : <Gift className="h-3 w-3" strokeWidth={2} />}
                  {t.points} → {t.short}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** Reward codes the signed-in shopper has unlocked. */
export function UnlockedRewards({ title = "Your Unlocked Rewards" }) {
  const { coupons } = useUser();
  if (!coupons.length) return null;
  return (
    <section>
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-magenta">{title}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {coupons.map((c) => (
          <div key={c.code} className="flex items-center gap-4 rounded-2xl border border-dashed border-magenta/40 bg-petal/50 p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-magenta/10 text-magenta">
              {c.freeShipping ? <Truck className="h-5 w-5" strokeWidth={1.8} /> : <Ticket className="h-5 w-5" strokeWidth={1.8} />}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{c.reward}</p>
              <p className="mt-0.5 font-mono text-xs text-magenta">Code: {c.code}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
