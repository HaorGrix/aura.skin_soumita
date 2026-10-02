import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Gift, Check, Star, ShoppingBag, Package, PauseCircle, PlusCircle } from "lucide-react";
import { useUser } from "../context/UserContext.jsx";
import { useContent } from "../lib/api/content.js";
import { PointsCard, UnlockedRewards } from "../components/rewards/RewardsCard.jsx";
import OrdersTab from "../components/account/OrdersTab.jsx";

/* Everything on this page comes from the admin: the programme (on/off,
 * name, earn rates, tiers) from Admin → Rewards, the wording from
 * Content → Rewards Page (slot page.rewards). */

const ease = [0.22, 1, 0.36, 1];

const panelAnim = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.32, ease } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2, ease } },
};

function TabBtn({ active, onClick, icon: Icon, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all duration-200 ${
        active ? "bg-white text-magenta shadow-soft ring-1 ring-line" : "text-ink-soft hover:text-ink"
      }`}
    >
      <Icon className="h-4 w-4" strokeWidth={active ? 2.2 : 1.8} />
      {children}
    </button>
  );
}

function GuestTeaser({ name, text, openAuth }) {
  return (
    <div className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-magenta to-magenta-deep p-6 text-white shadow-[var(--shadow-glow-pink)] sm:p-8">
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
      <div className="relative space-y-4">
        <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.16em] text-white/80">
          <Sparkles className="h-4 w-4" strokeWidth={2} /> {name}
        </p>
        <p className="font-serif text-2xl">{text}</p>
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

function TiersGrid({ tiers, points, authed }) {
  if (!tiers.length) return null;
  return (
    <section>
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-magenta">Reward Tiers</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {tiers.map((t) => {
          const unlocked = authed && points >= t.points;
          return (
            <div key={t.code} className={`rounded-2xl p-4 ring-1 transition-colors ${unlocked ? "bg-petal/60 ring-magenta/30" : "bg-snow ring-line"}`}>
              <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${unlocked ? "bg-magenta text-white" : "bg-line/60 text-ink-soft"}`}>
                {unlocked ? <Check className="h-4 w-4" strokeWidth={2.5} /> : <Gift className="h-4 w-4" strokeWidth={1.8} />}
              </span>
              <p className={`mt-3 text-sm font-semibold ${unlocked ? "text-magenta" : "text-ink"}`}>{t.short}</p>
              <p className="mt-0.5 text-xs text-ink-soft">{t.points} points</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function HowToEarn({ rewards, content }) {
  const ways = [
    rewards.earnsOnSpend && { icon: ShoppingBag, label: "Shop your ritual", desc: `+${rewards.spendText}` },
    rewards.earnsOnReview && {
      icon: Star, label: "Leave a review",
      desc: `+${rewards.pointsPerReview} point${rewards.pointsPerReview === 1 ? "" : "s"} per verified purchase review`,
    },
    ...(content.extraWays ?? []).filter((w) => w?.title?.trim()).map((w) => ({ icon: PlusCircle, label: w.title, desc: w.text })),
  ].filter(Boolean);
  if (!ways.length) return null;

  return (
    <section className="rounded-[1.5rem] bg-snow p-6 ring-1 ring-line">
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-magenta">How to Earn</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {ways.map(({ icon: Icon, label, desc }) => (
          <div key={label} className="flex items-start gap-3">
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-petal text-magenta">
              <Icon className="h-4 w-4" strokeWidth={1.8} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{label}</p>
              {desc && <p className="mt-0.5 text-xs text-ink-soft">{desc}</p>}
            </div>
          </div>
        ))}
      </div>
      {content.ctaLabel?.trim() && (
        <div className="mt-5 border-t border-line pt-5">
          <a
            href={content.ctaHref || "/shop"}
            className="inline-flex items-center gap-2 rounded-full bg-magenta px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-magenta-deep hover:shadow-[var(--shadow-glow-pink)]"
          >
            {content.ctaLabel} →
          </a>
        </div>
      )}
    </section>
  );
}

/** Intro written from the live programme when the admin leaves it blank. */
function autoIntro(rewards) {
  const earn = [
    rewards.earnsOnSpend && `earn ${rewards.spendText.replace(/^1 point/, "a point")}`,
    rewards.earnsOnReview && `${rewards.pointsPerReview} for each verified review`,
  ].filter(Boolean).join(", plus ");
  const unlock = rewards.tiers.length ? "Unlock exclusive discount codes as your points grow." : "";
  return [earn && `${earn.charAt(0).toUpperCase()}${earn.slice(1)}.`, unlock].filter(Boolean).join(" ");
}

export default function Rewards() {
  const { points, authed, openAuth, rewards } = useUser();
  const { content } = useContent("page.rewards");
  const [view, setView] = useState("rewards");
  const intro = content.intro?.trim() || autoIntro(rewards);

  return (
    <div className="min-h-screen pb-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }} className="mt-12 mb-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-magenta">{rewards.name}</p>
          <h1 className="mt-2 font-serif text-[clamp(2rem,5vw,3.25rem)] leading-tight text-ink">
            {rewards.enabled ? content.title : content.pausedTitle}
          </h1>
          {rewards.enabled && intro && <p className="mt-3 max-w-lg text-base text-ink-soft">{intro}</p>}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.12, ease }}
          className="mb-8 flex gap-1 rounded-2xl bg-snow p-1 ring-1 ring-line"
        >
          <TabBtn active={view === "rewards"} onClick={() => setView("rewards")} icon={Sparkles}>My Rewards</TabBtn>
          <TabBtn active={view === "history"} onClick={() => setView("history")} icon={Package}>Order History</TabBtn>
        </motion.div>

        <AnimatePresence mode="wait">
          {view === "rewards" ? (
            <motion.div key="rewards" {...panelAnim} className="space-y-8">
              {!rewards.enabled ? (
                <div className="flex items-start gap-4 rounded-[1.5rem] bg-snow p-6 ring-1 ring-line">
                  <PauseCircle className="mt-0.5 h-6 w-6 shrink-0 text-magenta" strokeWidth={1.8} />
                  <p className="text-sm leading-relaxed text-ink">{content.pausedText}</p>
                </div>
              ) : (
                <>
                  {authed ? <PointsCard /> : <GuestTeaser name={rewards.name} text={content.guestText} openAuth={openAuth} />}
                  {authed && <UnlockedRewards />}
                  <TiersGrid tiers={rewards.tiers} points={points} authed={authed} />
                  <HowToEarn rewards={rewards} content={content} />
                </>
              )}
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
