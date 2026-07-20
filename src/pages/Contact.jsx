import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  Clock,
  Instagram,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Send,
} from "lucide-react";
import Button from "../components/ui/Button.jsx";
import Footer from "../components/Footer.jsx";
import { useToast } from "../components/ui/Toast.jsx";
import { Input } from "../components/ui/index.js";
import PhoneInput from "../components/ui/PhoneInput.jsx";

const FAQS = [
  {
    q: "Are your products authentic?",
    a: "Yes. aura.skin is positioned around authorized sourcing, verified channels, and clear product metadata so customers can buy with confidence.",
  },
  {
    q: "How fast do you dispatch orders?",
    a: "The current storefront promise is 48-hour dispatch for in-stock items, with free shipping progress shown in the cart.",
  },
  {
    q: "Can I get help building a routine?",
    a: "Yes. Send your skin type, top concern, and current products through the form, and the care team can suggest a simple AM/PM ritual.",
  },
  {
    q: "Where do reviews come from?",
    a: "Product pages are read-only. Review writing lives in Account and is gated to verified purchases to keep the loyalty system honest.",
  },
];

const CONTACT_CARDS = [
  { icon: Mail, title: "Email", text: "care@aura.skin", href: "mailto:care@aura.skin" },
  { icon: Phone, title: "Phone", text: "+880 1700 000 000", href: "tel:+8801700000000" },
  { icon: Instagram, title: "Social", text: "@aura.skin", href: "#" },
];

export default function Contact() {
  const { toast } = useToast();
  const [openFaq, setOpenFaq] = useState(0);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    topic: "Routine help",
    message: "",
  });
  const [errors, setErrors] = useState({});
  const [isPhoneValid, setIsPhoneValid] = useState(false);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function validate() {
    const next = {};
    if (!form.name.trim()) next.name = "Name is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "Enter a valid email";
    if (form.message.trim().length < 12) next.message = "Tell us a little more";
    setErrors(next);
    return Object.keys(next).length === 0 && isPhoneValid;
  }

  function submit(e) {
    e.preventDefault();
    const phoneRegex = /^(?:\+8801|8801|01)[3-9]\d{8}$/;
    if (!phoneRegex.test(form.phone?.replace(/\s+/g, ''))) {
      toast.error("Invalid number!");
      return;
    }
    if (!validate()) {
      toast.error("Please check the highlighted fields", "Form needs care");
      return;
    }
    toast.success("We will reply within one business day.", "Message sent");
    setForm({ name: "", email: "", phone: "", topic: "Routine help", message: "" });
  }

  return (
    <>
      <main className="min-h-screen bg-snow pt-40 text-ink sm:pt-44">
        <section className="mx-auto mt-12 grid max-w-7xl gap-10 px-5 pb-14 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-magenta">
              Contact aura.skin
            </p>
            <h1 className="mt-4 max-w-2xl font-serif text-[clamp(2.55rem,7vw,5.4rem)] leading-[0.96]">
              Need routine help, order care, or a brand question?
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg">
              Send a note to the care desk. The form handles routine requests,
              order questions, collaboration notes, and ingredient guidance in
              one tidy place.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {CONTACT_CARDS.map((card) => (
                <a
                  key={card.title}
                  href={card.href}
                  className="rounded-[1.25rem] bg-white p-5 ring-1 ring-line transition-colors hover:text-magenta"
                >
                  <card.icon className="h-5 w-5 text-magenta" strokeWidth={1.8} />
                  <p className="mt-4 text-sm font-semibold">{card.title}</p>
                  <p className="mt-1 text-sm text-ink-soft">{card.text}</p>
                </a>
              ))}
            </div>

            <div className="mt-6 grid gap-3 rounded-[1.25rem] bg-magenta p-5 text-white shadow-[var(--shadow-glow-pink)] ring-1 ring-magenta-deep/30">
              <p className="inline-flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-white" strokeWidth={1.8} />
                Saturday to Thursday, 10:00 AM - 7:00 PM
              </p>
              <p className="inline-flex items-center gap-2 text-sm text-white/80">
                <MapPin className="h-4 w-4 text-white" strokeWidth={1.8} />
                Dhaka care studio, online-first delivery across Bangladesh
              </p>
            </div>
          </motion.div>

          <motion.form
            onSubmit={submit}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.65, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-[1.75rem] bg-white p-5 shadow-soft ring-1 ring-line sm:p-7"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" error={errors.name}>
                <Input
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  className={errors.name ? "ring-magenta" : ""}
                  placeholder="Your name"
                />
              </Field>
              <Field label="Email" error={errors.email}>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  className={errors.email ? "ring-magenta" : ""}
                  placeholder="you@email.com"
                />
              </Field>
              <Field label="Phone">
                <PhoneInput
                  value={form.phone}
                  onChange={(val) => update("phone", val)}
                  onValidityChange={setIsPhoneValid}
                  required
                />
              </Field>
            </div>

            <Field label="Topic">
              <select
                value={form.topic}
                onChange={(e) => update("topic", e.target.value)}
                className="mt-1 w-full rounded-xl bg-snow px-4 py-3 text-sm text-ink ring-1 ring-line outline-none transition-shadow focus:ring-2 focus:ring-magenta/50"
              >
                <option>Routine help</option>
                <option>Order support</option>
                <option>Product question</option>
                <option>Brand collaboration</option>
              </select>
            </Field>

            <Field label="Message" error={errors.message}>
              <textarea
                value={form.message}
                onChange={(e) => update("message", e.target.value)}
                className={`w-full rounded-xl bg-snow px-4 py-3 text-sm text-ink ring-1 outline-none transition-shadow focus:ring-2 focus:ring-magenta/50 min-h-40 resize-y ${errors.message ? "ring-magenta" : "ring-line"}`}
                placeholder="Tell us your skin type, concern, order number, or question."
              />
            </Field>

            <Button type="submit" size="lg" className="mt-2 w-full sm:w-auto" disabled={!isPhoneValid}>
              Send message
              <Send className="h-4 w-4" strokeWidth={1.8} />
            </Button>
          </motion.form>
        </section>

        <section className="border-y border-line bg-white py-14 sm:py-20">
          <div className="mx-auto grid max-w-7xl gap-8 px-5 sm:px-8 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-magenta">
                Quick answers
              </p>
              <h2 className="mt-3 font-serif text-[clamp(2rem,5vw,3.4rem)] leading-tight">
                The questions care usually answers first.
              </h2>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-soft">
                A little clarity before you write in, so the next step feels
                simple.
              </p>
            </div>

            <div className="grid gap-3">
              {FAQS.map((faq, index) => {
                const active = openFaq === index;
                return (
                  <div
                    key={faq.q}
                    className="overflow-hidden rounded-[1.25rem] bg-snow ring-1 ring-line"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaq(active ? -1 : index)}
                      className="flex w-full items-center justify-between gap-4 p-5 text-left"
                    >
                      <span className="font-serif text-xl">{faq.q}</span>
                      <ChevronDown
                        className={`h-5 w-5 shrink-0 text-magenta transition-transform ${active ? "rotate-180" : ""}`}
                        strokeWidth={1.8}
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {active && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                        >
                          <p className="px-5 pb-5 text-sm leading-relaxed text-ink-soft">
                            {faq.a}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
          <div className="grid gap-6 rounded-[1.75rem] bg-gradient-to-br from-petal via-white to-cyan-soft/35 p-6 ring-1 ring-line sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <MessageCircle className="h-7 w-7 text-magenta" strokeWidth={1.8} />
              <h2 className="mt-4 font-serif text-[clamp(1.9rem,4vw,3rem)] leading-tight">
                Building a routine for sensitive skin?
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">
                Start with cleanser, barrier support, and sunscreen. The shop
                filters can narrow by concern, skin type, brand, and stock state.
              </p>
            </div>
            <Button as="a" href="#/shop?concern=Barrier%20Repair" variant="solid" size="lg">
              Browse barrier care
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function Field({ label, error, children }) {
  return (
    <label className="mt-4 block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">
        {label}
      </span>
      {children}
      {error && <span className="mt-1.5 block text-xs font-semibold text-magenta">{error}</span>}
    </label>
  );
}
