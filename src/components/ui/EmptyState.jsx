import { motion } from "framer-motion";
import Button from "./Button.jsx";

/**
 * EmptyState — soulful, on-brand empty/zero-result view.
 * Use for empty cart, empty wishlist, no search results, etc.
 */
export default function EmptyState({
  emoji = "🌸",
  title = "Nothing here yet",
  message = "When you add something, it’ll bloom right here.",
  actionLabel,
  onAction,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto flex max-w-sm flex-col items-center px-6 py-16 text-center"
    >
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="grid h-20 w-20 place-items-center rounded-full bg-petal text-4xl ring-1 ring-rose/30"
      >
        {emoji}
      </motion.div>
      <h3 className="mt-6 font-serif text-2xl text-ink">{title}</h3>
      <p className="mt-2 text-sm text-ink-soft">{message}</p>
      {actionLabel && (
        <Button variant="primary" size="md" className="mt-7" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </motion.div>
  );
}
