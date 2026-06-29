import { createContext, useCallback, useContext, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, AlertCircle, ShoppingBag } from "lucide-react";

/**
 * Toast system — drop <ToastProvider> near the app root, then call
 * `const { toast } = useToast()` anywhere:
 *   toast.success("Added to your bag ✨")
 *   toast.error("Something went wrong")
 *   toast.show({ title, message, variant, icon })
 */
const ToastContext = createContext(null);

const ICONS = {
  success: Check,
  error: AlertCircle,
  cart: ShoppingBag,
  info: Check,
};

const ACCENT = {
  success: "text-success ring-success/30 bg-success/10",
  error: "text-error ring-error/30 bg-error/10",
  cart: "text-magenta ring-rose/40 bg-rose/10",
  info: "text-cyan ring-cyan/30 bg-cyan/10",
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback(
    (id) => setToasts((t) => t.filter((x) => x.id !== id)),
    []
  );

  const show = useCallback(
    ({ title, message, variant = "info", duration = 3200 }) => {
      const id = crypto.randomUUID?.() ?? String(Date.now() + Math.random());
      setToasts((t) => [...t, { id, title, message, variant }]);
      if (duration) setTimeout(() => remove(id), duration);
      return id;
    },
    [remove]
  );

  const toast = {
    show,
    success: (message, title = "Done") => show({ title, message, variant: "success" }),
    error: (message, title = "Oops") => show({ title, message, variant: "error" }),
    cart: (message, title = "Added to bag") => show({ title, message, variant: "cart" }),
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* Viewport — bottom-center on mobile, bottom-right on desktop */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[var(--z-toast)] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6">
        <AnimatePresence>
          {toasts.map((t) => {
            const Icon = ICONS[t.variant] ?? Check;
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 24, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.92 }}
                transition={{ type: "spring", stiffness: 420, damping: 30 }}
                className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-[1.25rem] bg-white p-4 shadow-lift ring-1 ring-line dark:bg-[#16161a] dark:ring-white/10"
              >
                <span
                  className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full ring-1 ${ACCENT[t.variant]}`}
                >
                  <Icon className="h-4 w-4" strokeWidth={2.2} />
                </span>
                <div className="min-w-0 flex-1">
                  {t.title && (
                    <p className="text-sm font-semibold text-ink dark:text-white">
                      {t.title}
                    </p>
                  )}
                  {t.message && (
                    <p className="text-sm text-ink-soft dark:text-white/70">
                      {t.message}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => remove(t.id)}
                  aria-label="Dismiss"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink/50 transition-colors hover:bg-line hover:text-ink dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a <ToastProvider>");
  return ctx;
}
