import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpDown, Check, ChevronDown } from "lucide-react";
import { SORTS } from "../../data/products.js";

/** SortMenu — accessible dropdown that reports the chosen sort id. */
export default function SortMenu({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = SORTS.find((s) => s.id === value) ?? SORTS[0];

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-medium text-ink ring-1 ring-line transition-colors hover:ring-magenta/50 dark:bg-white/5 dark:text-white dark:ring-white/10"
      >
        <ArrowUpDown className="h-4 w-4 text-magenta" strokeWidth={1.8} />
        <span className="hidden sm:inline text-ink-soft dark:text-white/60">Sort:</span>
        {current.label}
        <ChevronDown
          className={`h-4 w-4 text-ink-soft transition-transform dark:text-white/60 ${open ? "rotate-180" : ""}`}
          strokeWidth={1.8}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-[1rem] bg-white p-1.5 shadow-lift ring-1 ring-line dark:bg-[var(--color-ink-lift)] dark:ring-white/10"
          >
            {SORTS.map((s) => {
              const active = s.id === value;
              return (
                <li key={s.id} role="option" aria-selected={active}>
                  <button
                    onClick={() => {
                      onChange(s.id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-[0.7rem] px-3 py-2 text-sm transition-colors ${
                      active
                        ? "bg-petal text-magenta dark:bg-white/10 dark:text-rose"
                        : "text-ink-soft hover:bg-snow hover:text-ink dark:text-white/65 dark:hover:bg-white/5 dark:hover:text-white"
                    }`}
                  >
                    {s.label}
                    {active && <Check className="h-4 w-4" strokeWidth={2.4} />}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
