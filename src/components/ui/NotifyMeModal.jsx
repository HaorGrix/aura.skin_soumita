import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, BellRing, Check, Mail } from "lucide-react";
import Button from "./Button.jsx";
import { Input } from "./index.js";

/**
 * NotifyMeModal — back-in-stock waitlist (mock). Reused by ProductCard, the PDP
 * and Quick View. Collects an email, shows a cute confirmation, then an animated
 * success state. No backend — pure UI + mock success.
 */
export default function NotifyMeModal({ product, open, onClose }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Reset whenever a fresh modal opens.
  useEffect(() => {
    if (open) {
      setEmail("");
      setSent(false);
    }
  }, [open, product?.id]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    if (open) {
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!product || !mounted) return null;
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[var(--z-modal)] flex items-end justify-center p-0 sm:items-center sm:p-6">
          <motion.div
            className="absolute inset-0 bg-ink/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`Notify me when ${product.name} is back`}
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 280, damping: 30 }}
            className="relative z-10 w-full max-w-md overflow-hidden rounded-t-[1.75rem] bg-white p-6 text-center shadow-lift ring-1 ring-line sm:rounded-[1.75rem] sm:p-8 dark:bg-[var(--color-ink-deep)] dark:ring-white/10"
          >
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-snow text-ink/70 transition-colors hover:text-magenta dark:bg-white/5 dark:text-white/70"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>

            <AnimatePresence mode="wait">
              {!sent ? (
                <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {/* Glowing bell */}
                  <motion.span
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 18 }}
                    className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-petal text-magenta shadow-[var(--shadow-glow-pink)] dark:bg-magenta/15"
                  >
                    <BellRing className="h-6 w-6" strokeWidth={1.9} />
                  </motion.span>

                  <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-magenta">
                    {product.brand}
                  </p>
                  <h2 className="mt-1 font-serif text-2xl leading-snug text-ink dark:text-white">
                    Notify me when it’s back
                  </h2>
                  <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-ink-soft dark:text-white/70">
                    We’ll notify you the moment <span className="font-medium text-ink dark:text-white">{product.name}</span> is
                    back in stock, radiant soul. In the meantime, take a sip of water and stay glowing! ✨
                  </p>

                  <div className="relative mt-5">
                    <Mail
                      className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft dark:text-white/45"
                      strokeWidth={1.8}
                    />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && valid && setSent(true)}
                      placeholder="you@example.com"
                      className="pl-11 rounded-full py-3"
                    />
                  </div>

                  <Button
                    variant="primary"
                    size="md"
                    magnetic={false}
                    onClick={() => valid && setSent(true)}
                    className={`mt-3 w-full ${!valid ? "pointer-events-none opacity-50" : ""}`}
                  >
                    <BellRing className="h-4 w-4" strokeWidth={2} /> Notify me
                  </Button>
                  <p className="mt-3 text-[11px] text-ink-soft dark:text-white/40">
                    One gentle email when it restocks. No spam, promise. 🌿
                  </p>
                </motion.div>
              ) : (
                <motion.div key="done" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="py-4">
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 16 }}
                    className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success/15 text-success"
                  >
                    <Check className="h-8 w-8" strokeWidth={2.6} />
                  </motion.span>
                  <h2 className="mt-4 font-serif text-2xl text-ink dark:text-white">You’re on the list! 🎉</h2>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-soft dark:text-white/70">
                    We’ll ping <span className="font-medium text-ink dark:text-white">{email}</span> the second{" "}
                    {product.name} is back. Stay radiant ✨
                  </p>
                  <Button variant="secondary" size="md" magnetic={false} onClick={onClose} className="mt-5 w-full">
                    Keep shopping
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
