import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon } from "lucide-react";

const RITUALS = {
  morning: {
    label: "Morning glow",
    accent: "var(--color-gold-soft)",
    steps: [
      { emoji: "🧼", title: "Cleanse", text: "A low-pH gel cleanser to wake skin gently.", pick: "COSRX Low pH Gel Cleanser" },
      { emoji: "💦", title: "Tone", text: "Flood with hydration using a soothing toner.", pick: "Anua Heartleaf 77% Toner" },
      { emoji: "✨", title: "Treat", text: "Brighten and protect with a vitamin serum.", pick: "Beauty of Joseon Glow Serum" },
      { emoji: "☀️", title: "Protect", text: "Seal it all with a dewy SPF50+ finish.", pick: "BoJ Relief Sun SPF50+" },
    ],
  },
  evening: {
    label: "Evening repair",
    accent: "var(--color-cyan-soft)",
    steps: [
      { emoji: "🫧", title: "Double cleanse", text: "Melt the day with an oil, then a gentle wash.", pick: "Anua Heartleaf Cleansing Oil" },
      { emoji: "💧", title: "Essence", text: "Layer snail mucin for bouncy, plump skin.", pick: "COSRX Snail 96 Essence" },
      { emoji: "🌙", title: "Treat", text: "Repair and renew while you sleep.", pick: "Torriden DIVE-IN Serum" },
      { emoji: "🛡️", title: "Lock in", text: "A rich cream to wake up glowing.", pick: "Beauty of Joseon Dynasty Cream" },
    ],
  },
};

export default function Rituals() {
  const [time, setTime] = useState("morning");
  const ritual = RITUALS[time];

  return (
    <section id="rituals" className="py-10 sm:py-14">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex flex-col items-center text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-magenta">
            Your daily ritual
          </p>
          <h2 className="mt-2 font-serif text-[clamp(1.9rem,4.5vw,3.25rem)] leading-tight text-ink dark:text-white">
            A <span className="italic text-gradient-glow">ritual</span> for every hour
          </h2>

          {/* AM/PM toggle */}
          <div className="mt-7 flex rounded-full bg-snow p-1 ring-1 ring-line dark:bg-white/5 dark:ring-white/10">
            {[
              { id: "morning", label: "Morning", Icon: Sun },
              { id: "evening", label: "Evening", Icon: Moon },
            ].map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setTime(id)}
                className="relative inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium"
              >
                {time === id && (
                  <motion.span
                    layoutId="ritual-toggle"
                    className="absolute inset-0 rounded-full bg-magenta"
                    transition={{ type: "spring", stiffness: 360, damping: 30 }}
                  />
                )}
                <span className={`relative z-10 inline-flex items-center gap-2 ${time === id ? "text-white" : "text-ink-soft dark:text-white/60"}`}>
                  <Icon className="h-4 w-4" strokeWidth={1.8} /> {label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={time}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
          >
            {ritual.steps.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="group relative flex flex-col overflow-hidden rounded-[1.5rem] bg-white p-6 ring-1 ring-line transition-shadow duration-500 hover:shadow-lift dark:bg-white/[0.03] dark:ring-white/10"
              >
                <span
                  aria-hidden
                  className="absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-70 blur-2xl"
                  style={{ background: `radial-gradient(circle, ${ritual.accent}, transparent 70%)` }}
                />
                <div className="relative flex items-center justify-between">
                  <span className="text-4xl">{step.emoji}</span>
                  <span className="font-serif text-2xl text-magenta/30">0{i + 1}</span>
                </div>
                <h3 className="relative mt-4 font-serif text-xl text-ink dark:text-white">
                  {step.title}
                </h3>
                <p className="relative mt-1.5 text-sm leading-relaxed text-ink-soft dark:text-white/65">
                  {step.text}
                </p>
                <p className="relative mt-auto border-t border-line pt-3 text-xs font-medium text-ink-soft dark:border-white/10 dark:text-white/50">
                  ✨ Try: <span className="text-ink dark:text-white">{step.pick}</span>
                </p>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
