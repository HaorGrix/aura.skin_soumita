/* =================================================================== *
 * skin.theory — magic-link verification modal
 * -------------------------------------------------------------------
 * NOT the general AuthModal. This exists for exactly two entry points,
 * both inside OrdersTab.jsx (order history and the per-item "write a
 * review" action, which live on the same screen) — nothing imports this
 * from anywhere else, and it should stay that way: no general popup,
 * nothing during browsing or checkout.
 *
 * Passwordless by design: enters an email, gets a real signed magic link
 * (lib/api/customerAuth.js — Supabase's own signInWithOtp, not a custom
 * token scheme), and that's the entire flow. Nothing here ever reads or
 * displays another identity's data — it only ever sends mail to whatever
 * address the visitor typed, and the resulting session decides visibility
 * on its own (0029_magic_link_order_access.sql), not this component.
 * =================================================================== */
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MailCheck, KeyRound } from "lucide-react";
import Button from "../ui/Button.jsx";
import { Input } from "../ui/index.js";
import { useFocusTrap } from "../../lib/useFocusTrap.js";
import { useBodyScrollLock } from "../../lib/scrollLock.js";
import { isValidEmail } from "../../lib/email-validation.js";
import { requestMagicLink } from "../../lib/api/customerAuth.js";

export default function MagicLinkModal({ open, onClose }) {
  const dialogRef = useRef(null);
  useFocusTrap(dialogRef, open);
  useBodyScrollLock(open);

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (open) { setEmail(""); setError(""); setSending(false); setSent(false); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function submit(e) {
    e.preventDefault();
    if (!isValidEmail(email)) return setError("Please enter a valid email address.");
    setSending(true); setError("");
    const { error: sendErr } = await requestMagicLink(email);
    setSending(false);
    // Deliberately the SAME confirmation whether or not that email has ever
    // ordered — Supabase itself declines to tell the caller, precisely so
    // this screen can't be used to check who's a customer. A real send
    // failure (network, rate limit) is the only thing shown differently.
    if (sendErr && !/rate limit/i.test(sendErr.message)) {
      setError("Couldn't send the link right now. Please try again.");
      return;
    }
    setSent(true);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[var(--z-modal)] grid place-items-center bg-ink/40 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            ref={dialogRef}
            role="dialog" aria-modal="true" aria-label="Verify your email"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            className="relative w-full max-w-md rounded-[1.75rem] bg-white p-7 shadow-lift ring-1 ring-line sm:p-8"
          >
            <button
              onClick={onClose} aria-label="Close dialog"
              className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full text-ink-soft transition-colors hover:bg-snow hover:text-magenta"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>

            {sent ? (
              <>
                <span className="grid h-12 w-12 place-items-center rounded-full bg-petal text-magenta">
                  <MailCheck className="h-5 w-5" strokeWidth={1.8} />
                </span>
                <h2 className="mt-4 font-serif text-[1.8rem] leading-tight text-ink">Check your email</h2>
                <p className="mt-2 text-sm text-ink-soft">
                  If <strong className="text-ink">{email}</strong> has ordered with us before, a login link
                  is on its way. Open it on this device to continue — the link works once and expires soon,
                  so if it doesn't arrive in a few minutes, request a fresh one.
                </p>
                <Button variant="secondary" className="mt-6 w-full" onClick={onClose}>Got it</Button>
              </>
            ) : (
              <>
                <span className="grid h-12 w-12 place-items-center rounded-full bg-petal text-magenta">
                  <KeyRound className="h-5 w-5" strokeWidth={1.8} />
                </span>
                <h2 className="mt-4 font-serif text-[1.8rem] leading-tight text-ink">Verify it's you</h2>
                <p className="mt-2 text-sm text-ink-soft">
                  If you've ordered before, enter the same email you used at checkout, and we'll send you a
                  login link.
                </p>

                <form onSubmit={submit} noValidate className="mt-6 space-y-3">
                  <Input
                    type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com" autoFocus
                  />
                  {error && <p className="text-sm font-medium text-error">{error}</p>}
                  <Button type="submit" className="w-full" disabled={sending}>
                    {sending ? "Sending…" : "Send login link"}
                  </Button>
                </form>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
