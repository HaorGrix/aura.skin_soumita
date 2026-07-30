import { motion } from "framer-motion";
import { Sparkles, Gift, Check, Ticket, Truck } from "lucide-react";
import { useUser } from "../../context/UserContext.jsx";
import { POINTS_PER_REVIEW, TAKA_PER_POINT } from "../../data/reviews.js";

export default function LoyaltyTab() {
  const { points, coupons, nextMilestone, milestones } = useUser();

  const prevTier = [...milestones].reverse().find((m) => points >= m.points)?.points ?? 0;
  const target = nextMilestone?.points ?? milestones[milestones.length - 1].points;
  const span = target - prevTier || 1;
  const pct = Math.min(100, Math.round(((points - prevTier) / span) * 100));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-8"
    >
      <div>
        <h2 className="font-serif text-2xl text-ink">Loyalty Rewards</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Earn points by leaving verified reviews on products you've purchased.
        </p>
      </div>

      <div className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-magenta to-magenta-deep p-6 text-white shadow-[var(--shadow-glow-pink)] sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/15 blur-2xl"
        />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.16em] text-white/80">
              <Sparkles className="h-4 w-4" strokeWidth={2} /> Skin Script Rewards
            </p>
            <p className="mt-2 font-serif text-5xl leading-none">{points}</p>
            <p className="mt-1 text-sm text-white/85">
              loyalty points · 1 per ৳{TAKA_PER_POINT} spent, +{POINTS_PER_REVIEW} per review
            </p>
          </div>
          <div className="text-left sm:text-right">
            {nextMilestone ? (
              <p className="text-sm text-white/90">
                <span className="font-semibold">{nextMilestone.points - points} pts</span> to{" "}
                {nextMilestone.short}
              </p>
            ) : (
              <p className="text-sm font-semibold text-white/90">Top tier unlocked 🎉</p>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative mt-6">
          <div className="h-2.5 overflow-hidden rounded-full bg-white/25">
            <motion.span
              className="block h-full rounded-full bg-white"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {milestones.map((m) => {
              const unlocked = points >= m.points;
              return (
                <span
                  key={m.code}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${
                    unlocked
                      ? "bg-white text-magenta ring-white"
                      : "bg-white/10 text-white/75 ring-white/25"
                  }`}
                >
                  {unlocked ? <Check className="h-3 w-3" strokeWidth={3} /> : <Gift className="h-3 w-3" strokeWidth={2} />}
                  {m.points} → {m.short}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {coupons.length > 0 && (
        <section>
          <h3 className="mb-4 text-sm font-semibold text-ink">Your Unlocked Rewards</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {coupons.map((c) => (
              <div
                key={c.code}
                className="flex items-center gap-4 rounded-2xl border border-dashed border-magenta/40 bg-petal/50 p-4"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-magenta/10 text-magenta">
                  {c.code === "SKN8FS" ? <Truck className="h-5 w-5" strokeWidth={1.8} /> : <Ticket className="h-5 w-5" strokeWidth={1.8} />}
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">{c.reward}</p>
                  <p className="mt-0.5 font-mono text-xs text-magenta">Code: {c.code}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </motion.div>
  );
}
