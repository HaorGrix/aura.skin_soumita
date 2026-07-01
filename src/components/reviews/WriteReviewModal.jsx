import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, X, Sparkles } from "lucide-react";
import { useUser } from "../../context/UserContext.jsx";
import { useToast } from "../ui/Toast.jsx";
import Button from "../ui/Button.jsx";
import { Input } from "../ui/index.js";

/**
 * WriteReviewModal — verified-buyer review composer. Reused by the PDP and the
 * Account/Order History page. On submit it calls useUser().addReview, which
 * publishes the review and awards a loyalty point.
 */
export default function WriteReviewModal({ product, open, onClose }) {
  const { addReview, points } = useUser();
  const { toast } = useToast();
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  // Reset fields whenever a fresh modal opens.
  useEffect(() => {
    if (open) {
      setStars(0);
      setHover(0);
      setTitle("");
      setBody("");
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

  if (!product) return null;

  const canSubmit = stars > 0 && body.trim().length >= 4;

  function submit() {
    if (!canSubmit) return;
    const ok = addReview({ productId: product.id, stars, title, body });
    if (ok) {
      toast.success(`+1 point earned · ${points + 1} total ✨`, "Review published");
      onClose();
    } else {
      toast.error("You can only review a purchased product once.");
    }
  }

  return (
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
            aria-label={`Write a review for ${product.name}`}
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 280, damping: 30 }}
            className="relative z-10 w-full max-w-lg overflow-hidden rounded-t-[1.75rem] bg-white p-6 shadow-lift ring-1 ring-line sm:rounded-[1.75rem] sm:p-8 dark:bg-[var(--color-ink-deep)] dark:ring-white/10"
          >
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-snow text-ink/70 transition-colors hover:text-magenta dark:bg-white/5 dark:text-white/70"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>

            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-magenta">
              {product.brand}
            </p>
            <h2 className="mt-1 font-serif text-2xl leading-snug text-ink dark:text-white">
              Review · {product.name}
            </h2>
            <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-cyan">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={2} /> Verified purchase — earn 1 loyalty point
            </p>

            {/* Star picker */}
            <div className="mt-5">
              <label className="text-sm font-semibold text-ink dark:text-white">Your rating</label>
              <div className="mt-2 flex items-center gap-1.5" onMouseLeave={() => setHover(0)}>
                {[1, 2, 3, 4, 5].map((n) => {
                  const filled = (hover || stars) >= n;
                  return (
                    <button
                      key={n}
                      type="button"
                      aria-label={`${n} star${n > 1 ? "s" : ""}`}
                      onMouseEnter={() => setHover(n)}
                      onClick={() => setStars(n)}
                      className="transition-transform hover:scale-110"
                    >
                      <Star
                        className="h-8 w-8"
                        fill={filled ? "var(--color-gold)" : "transparent"}
                        stroke={filled ? "var(--color-gold)" : "currentColor"}
                        strokeWidth={1.5}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Title */}
            <div className="mt-4">
              <label className="text-sm font-semibold text-ink dark:text-white">Title <span className="font-normal text-ink-soft">(optional)</span></label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={70}
                placeholder="Sum it up in a few words"
                className="mt-2 py-2.5"
              />
            </div>

            {/* Body */}
            <div className="mt-4">
              <label className="text-sm font-semibold text-ink dark:text-white">Your review</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                maxLength={600}
                placeholder="How did it work for your skin? Texture, results, delivery…"
                className="mt-2 w-full resize-none rounded-xl bg-snow px-4 py-3 text-sm leading-relaxed text-ink ring-1 ring-line outline-none focus:ring-2 focus:ring-magenta/50 dark:bg-white/5 dark:text-white dark:ring-white/10"
              />
            </div>

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                className="rounded-full px-4 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:text-ink dark:text-white/60 dark:hover:text-white"
              >
                Cancel
              </button>
              <Button variant="primary" size="md" magnetic={false} onClick={submit} className={!canSubmit ? "pointer-events-none opacity-50" : ""}>
                Publish review
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
