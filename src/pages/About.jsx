import { motion } from "framer-motion";
import {
  BadgeCheck,
  Boxes,
  HeartHandshake,
  Leaf,
  Recycle,
  ShieldCheck,
  Sparkles,
  Truck,
} from "lucide-react";
import Button from "../components/ui/Button.jsx";
import Footer from "../components/Footer.jsx";

const STANDARDS = [
  {
    icon: ShieldCheck,
    title: "Authenticity first",
    text: "Every product is sourced through authorized distributors or verified brand channels before it reaches your shelf.",
  },
  {
    icon: Sparkles,
    title: "Ritual over clutter",
    text: "We curate by concern, skin type, and ingredient role so customers can build calm routines instead of chaotic carts.",
  },
  {
    icon: Leaf,
    title: "Skin-kind formulas",
    text: "Our edits prioritize barrier support, gentle actives, fragrance-aware options, and transparent ingredient education.",
  },
  {
    icon: Recycle,
    title: "Lower-waste choices",
    text: "Refill-friendly packaging, recyclable materials, and fewer impulse bundles guide the long-term roadmap.",
  },
];

const TIMELINE = [
  ["01", "Discover", "We study K/J-Beauty drops, ingredient stories, and real customer concerns."],
  ["02", "Verify", "Brand source, batch logic, product claims, and routine fit are checked before launch."],
  ["03", "Guide", "Products are presented with plain-language benefits, usage order, and skin-type context."],
];

const METRICS = [
  { value: "30+", label: "curated brands" },
  { value: "179", label: "catalog SKUs" },
  { value: "24", label: "seeded reviews" },
  { value: "48h", label: "dispatch goal" },
];

export default function About() {
  return (
    <>
      <main className="min-h-screen bg-snow pt-28 text-ink dark:bg-[#050506] dark:text-white sm:pt-36">
        <section className="mx-auto grid max-w-7xl gap-10 px-5 pb-14 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-magenta">
              About aura.skin
            </p>
            <h1 className="mt-4 max-w-3xl font-serif text-[clamp(2.65rem,7vw,5.75rem)] leading-[0.95] tracking-[-0.015em]">
              Clean beauty, curated with a quiet kind of confidence.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-ink-soft dark:text-white/68 sm:text-lg">
              aura.skin is a premium K/J-Beauty storefront for people who want
              effective routines without noise. We pair authentic skincare with
              gentle guidance, verified reviews, and a loyalty loop that rewards
              care instead of overbuying.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button as="a" href="#/shop" size="lg">
                Shop rituals
              </Button>
              <Button as="a" href="#/contact" variant="secondary" size="lg">
                Contact care
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.75, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="relative overflow-hidden rounded-[1.75rem] bg-ink p-6 text-white shadow-lift ring-1 ring-white/10 dark:bg-white/[0.04]"
          >
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-magenta/25 blur-3xl" />
            <div className="absolute -bottom-16 left-8 h-44 w-44 rounded-full bg-cyan/20 blur-3xl" />
            <div className="relative grid gap-4">
              <div className="rounded-[1.25rem] bg-white/10 p-5 ring-1 ring-white/10">
                <BadgeCheck className="h-8 w-8 text-cyan-soft" strokeWidth={1.7} />
                <p className="mt-5 font-serif text-3xl leading-tight">
                  Authorized beauty, not marketplace guesswork.
                </p>
                <p className="mt-3 text-sm leading-relaxed text-white/65">
                  The experience is built around trust signals: stock state,
                  verified-purchase reviews, clear discounts, and ingredient
                  education that stays readable on mobile.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {METRICS.map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-[1rem] bg-white/[0.07] p-4 ring-1 ring-white/10"
                  >
                    <p className="font-serif text-3xl text-gold">{metric.value}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-white/50">
                      {metric.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </section>

        <section className="border-y border-line bg-white py-14 dark:border-white/10 dark:bg-white/[0.025] sm:py-20">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-magenta">
                Our standards
              </p>
              <h2 className="mt-3 font-serif text-[clamp(2rem,5vw,3.5rem)] leading-tight">
                A storefront designed around trust, clarity, and repeat care.
              </h2>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {STANDARDS.map((item, i) => (
                <motion.article
                  key={item.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.35 }}
                  transition={{ duration: 0.45, delay: i * 0.06 }}
                  className="rounded-[1.25rem] bg-snow p-6 ring-1 ring-line dark:bg-[#101014] dark:ring-white/10"
                >
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-petal text-magenta dark:bg-white/[0.08] dark:text-rose">
                    <item.icon className="h-5 w-5" strokeWidth={1.8} />
                  </span>
                  <h3 className="mt-5 font-serif text-2xl">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft dark:text-white/62">
                    {item.text}
                  </p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-8 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-magenta">
              How we curate
            </p>
            <h2 className="mt-3 font-serif text-[clamp(2rem,5vw,3.4rem)] leading-tight">
              From ingredient story to shelf-ready ritual.
            </h2>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-ink-soft dark:text-white/65 sm:text-base">
              The shop is structured so a first-time visitor can move from
              concern to product to routine with minimal friction, while a
              returning shopper can search, filter, and restock quickly.
            </p>
          </div>

          <div className="grid gap-4">
            {TIMELINE.map(([step, title, text]) => (
              <div
                key={step}
                className="grid gap-4 rounded-[1.25rem] bg-white p-5 ring-1 ring-line dark:bg-white/[0.035] dark:ring-white/10 sm:grid-cols-[auto_1fr]"
              >
                <span className="grid h-12 w-12 place-items-center rounded-full bg-ink font-serif text-xl text-white dark:bg-white dark:text-ink">
                  {step}
                </span>
                <div>
                  <h3 className="font-serif text-2xl">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft dark:text-white/62">
                    {text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8">
          <div className="grid gap-4 rounded-[1.75rem] bg-gradient-to-br from-petal via-white to-cyan-soft/35 p-6 ring-1 ring-line dark:from-white/[0.06] dark:via-white/[0.025] dark:to-cyan/10 dark:ring-white/10 sm:p-8 lg:grid-cols-3">
            {[
              [Boxes, "Scalable catalog", "Product data drives badges, stock, sale math, reviews, and related recommendations."],
              [HeartHandshake, "Care-led commerce", "Rewards are tied to verified reviews and useful feedback, not low-quality engagement."],
              [Truck, "Ready for ops", "Shipping, contact, coupon, and account flows are structured for future backend integration."],
            ].map(([Icon, title, text]) => (
              <div key={title} className="rounded-[1.25rem] bg-white/70 p-5 ring-1 ring-white/70 dark:bg-black/20 dark:ring-white/10">
                <Icon className="h-6 w-6 text-magenta" strokeWidth={1.8} />
                <h3 className="mt-4 font-serif text-2xl">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft dark:text-white/62">
                  {text}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
