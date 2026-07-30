import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Gift, Check, Ticket, Truck, Star, ShoppingBag, Package } from "lucide-react";
import { useUser } from "../context/UserContext.jsx";
import OrdersTab from "../components/account/OrdersTab.jsx";

/* ── Motion ─────────────────────────────────────────────────────────────── */

const ease = [0.22, 1, 0.36, 1];

const panelAnim = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.32, ease } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.2, ease } },
};

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function progressPct(points, milestones) {
  const prev = [...milestones].reverse().find((m) => points >= m.points)?.points ?? 0;
  const next = milestones.find((m) => points < m.points)?.points ?? milestones.at(-1).points;
  return Math.min(100, Math.round(((points - prev) / (next - prev || 1)) * 100));
}

/* ── Tab button ──────────────────────────────────────────────────────────── */

function TabBtn({ active, onClick, icon: Icon, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all duration-200 ${
        active
          ? "bg-white text-magenta shadow-soft ring-1 ring-line"
          : "text-ink-soft hover:text-ink"
      }`}
    >
      <Icon className="h-4 w-4" strokeWidth={active ? 2.2 : 1.8} />
      {children}
    </button>
  );
}

/* ── Points card ─────────────────────────────────────────────────────────── */

function PointsCard({ points, nextMilestone, milestones }) {
  const pct = progressPct(points, milestones);
  return (
    <div className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-magenta to-magenta-deep p-6 text-white shadow-[var(--shadow-glow-pink)] sm:p-8">
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/15 blur-2xl" />

      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.16em] text-white/80">
            <Sparkles className="h-4 w-4" strokeWidth={2} /> Skin Script Rewards
          </p>
          <p className="mt-2 font-serif text-5xl leading-none">{points}</p>
          <p className="mt-1 text-sm text-white/85">loyalty points · 1 per verified review</p>
        </div>
        <div className="text-left sm:text-right">
          {nextMilestone ? (
            <p className="text-sm text-white/90">
              <span className="font-semibold">{nextMilestone.points - points} pts</span> to {nextMilestone.short}
            </p>
          ) : (
            <p className="text-sm font-semibold text-white/90">Top tier unlocked 🎉</p>
          )}
        </div>
      </div>

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
          {milestones.map((m) => {
            const unlocked = points >= m.points;
            return (
              <span
                key={m.code}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${
                  unlocked ? "bg-white text-magenta ring-white" : "bg-white/10 text-white/75 ring-white/25"
                }`}
              >
                {unlocked
                  ? <Check className="h-3 w-3" strokeWidth={3} />
                  : <Gift className="h-3 w-3" strokeWidth={2} />}
                {m.points} → {m.short}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Guest teaser ────────────────────────────────────────────────────────── */

function GuestTeaser({ openAuth }) {
  return (
    <div className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-magenta to-magenta-deep p-6 text-white shadow-[var(--shadow-glow-pink)] sm:p-8">
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
      <div className="relative space-y-4">
        <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.16em] text-white/80">
          <Sparkles className="h-4 w-4" strokeWidth={2} /> Skin Script Rewards
        </p>
        <p className="font-serif text-2xl">
          Sign in to track your points and unlock exclusive rewards.
        </p>
        <div className="flex flex-wrap gap-3 pt-1">
          <button
            onClick={() => openAuth("login")}
            className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-magenta transition-colors hover:bg-white/90"
          >
            Log in
          </button>
          <button
            onClick={() => openAuth("signup")}
            className="rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/30 transition-colors hover:bg-white/20"
          >
            Create account
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Coupon grid ─────────────────────────────────────────────────────────── */

function CouponGrid({ coupons }) {
  return (
    <section>
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-magenta">Your Unlocked Rewards</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {coupons.map((c) => (
          <div
            key={c.code}
            className="flex items-center gap-4 rounded-2xl border border-dashed border-magenta/40 bg-petal/50 p-4"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-magenta/10 text-magenta">
              {c.code === "SKN8FS"
                ? <Truck className="h-5 w-5" strokeWidth={1.8} />
                : <Ticket className="h-5 w-5" strokeWidth={1.8} />}
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">{c.reward}</p>
              <p className="mt-0.5 font-mono text-xs text-magenta">Code: {c.code}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Tiers grid ──────────────────────────────────────────────────────────── */

function TiersGrid({ milestones, points, authed }) {
  return (
    <section>
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-magenta">Reward Tiers</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {milestones.map((m) => {
          const unlocked = authed && points >= m.points;
          return (
            <div
              key={m.code}
              className={`rounded-2xl p-4 ring-1 transition-colors ${
                unlocked
                  ? "bg-petal/60 ring-magenta/30"
                  : "bg-snow ring-line"
              }`}
            >
              <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${
                unlocked
                  ? "bg-magenta text-white"
                  : "bg-line/60 text-ink-soft"
              }`}>
                {unlocked
                  ? <Check className="h-4 w-4" strokeWidth={2.5} />
                  : <Gift className="h-4 w-4" strokeWidth={1.8} />}
              </span>
              <p className={`mt-3 text-sm font-semibold ${unlocked ? "text-magenta" : "text-ink"}`}>
                {m.short}
              </p>
              <p className="mt-0.5 text-xs text-ink-soft">{m.points} points</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ── How to earn ─────────────────────────────────────────────────────────── */

const HOW_TO_EARN = [
  { icon: ShoppingBag, label: "Shop your ritual", desc: "+1 point for every ৳1000 you spend" },
  { icon: Star,        label: "Leave a review",   desc: "+5 points per verified purchase review" },
];

function HowToEarn() {
  return (
    <section className="rounded-[1.5rem] bg-snow p-6 ring-1 ring-line">
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-magenta">How to Earn</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {HOW_TO_EARN.map(({ icon: Icon, label, desc }) => (
          <div key={label} className="flex items-start gap-3">
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-petal text-magenta">
              <Icon className="h-4 w-4" strokeWidth={1.8} />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">{label}</p>
              <p className="mt-0.5 text-xs text-ink-soft">{desc}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 border-t border-line pt-5">
        <a
          href="/shop"
          className="inline-flex items-center gap-2 rounded-full bg-magenta px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-magenta-deep hover:shadow-[var(--shadow-glow-pink)]"
        >
          Shop to earn points →
        </a>
      </div>
    </section>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function Rewards() {
  const { points, coupons, nextMilestone, milestones, authed, openAuth } = useUser();
  const [view, setView] = useState("rewards");

  return (
    <div className="min-h-screen pb-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease }}
          className="mt-12 mb-8"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-magenta">
            Skin Script Rewards
          </p>
          <h1 className="mt-2 font-serif text-[clamp(2rem,5vw,3.25rem)] leading-tight text-ink">
            Your Glow, Rewarded
          </h1>
          <p className="mt-3 max-w-lg text-base text-ink-soft">
            Earn a point for every ৳1000 you spend, plus 5 for each verified review. Unlock exclusive discount codes and free shipping as you grow your ritual.
          </p>
        </motion.div>

        {/* Tab switcher */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.12, ease }}
          className="mb-8 flex gap-1 rounded-2xl bg-snow p-1 ring-1 ring-line"
        >
          <TabBtn active={view === "rewards"} onClick={() => setView("rewards")} icon={Sparkles}>
            My Rewards
          </TabBtn>
          <TabBtn active={view === "history"} onClick={() => setView("history")} icon={Package}>
            Order History
          </TabBtn>
        </motion.div>

        {/* Tab panels */}
        <AnimatePresence mode="wait">
          {view === "rewards" ? (
            <motion.div key="rewards" {...panelAnim} className="space-y-8">
              {authed
                ? <PointsCard points={points} nextMilestone={nextMilestone} milestones={milestones} />
                : <GuestTeaser openAuth={openAuth} />}

              {authed && coupons.length > 0 && <CouponGrid coupons={coupons} />}

              <TiersGrid milestones={milestones} points={points} authed={authed} />

              <HowToEarn />
            </motion.div>
          ) : (
            <motion.div key="history" {...panelAnim}>
              <OrdersTab />
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
