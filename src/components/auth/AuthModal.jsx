import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, Lock, User, Eye, EyeOff, Sparkles } from "lucide-react";
import { useUser } from "../../context/UserContext.jsx";
import { useToast } from "../ui/Toast.jsx";
import Button from "../ui/Button.jsx";
import { Input } from "../ui/index.js";
import { useFocusTrap } from "../../lib/useFocusTrap.js";
import { useBodyScrollLock } from "../../lib/scrollLock.js";
import { isValidEmail } from "../../lib/email-validation.js";
import { useStoreSettings } from "../../lib/api/settings.js";

/**
 * AuthModal — the single, shared login / sign-up surface. Light and
 * non-intrusive (a small centred card, not a full takeover) so browsing
 * never feels gated. Opened from anywhere via `openAuth(mode, onSuccess)`
 * on the UserContext; on success it runs the optional callback (e.g. the
 * checkout flow continues) and closes itself.
 */
const emailOk = isValidEmail;

export default function AuthModal() {
  const { auth, closeAuth, login, signup } = useUser();
  const { toast } = useToast();
  const { storeName } = useStoreSettings();
  const { open, mode: initialMode, onSuccess } = auth;

  const dialogRef = useRef(null);
  useFocusTrap(dialogRef, open);

  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const isSignup = mode === "signup";

  // Sync to the requested mode and reset state each time it opens.
  useEffect(() => {
    if (open) {
      setMode(initialMode === "signup" ? "signup" : "login");
      setForm({ name: "", email: "", password: "" });
      setShowPw(false);
      setError("");
    }
  }, [open, initialMode]);

  // Lock page scroll while open (shared ref-counted lock).
  useBodyScrollLock(open);

  // Esc to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && closeAuth();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closeAuth]);

  function submit(e) {
    e.preventDefault();
    if (isSignup && !form.name.trim()) return setError("Please tell us your name.");
    if (!emailOk(form.email)) return setError("Enter a valid email address.");
    if (form.password.length < 6) return setError("Password needs at least 6 characters.");

    if (isSignup) {
      signup({ name: form.name.trim(), email: form.email.trim() });
      toast.success(`Welcome to ${storeName}, ${form.name.trim()} 🌸`, "Account created");
    } else {
      login({ email: form.email.trim() });
      toast.success("You're glowing — welcome back ✨", "Signed in");
    }
    onSuccess?.();
    closeAuth();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[var(--z-modal)] grid place-items-center bg-ink/40 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeAuth}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={isSignup ? "Create account" : "Log in"}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            className="relative w-full max-w-md rounded-[1.75rem] bg-white p-7 shadow-lift ring-1 ring-line sm:p-8"
          >
            <button
              onClick={closeAuth}
              aria-label="Close dialog"
              className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full text-ink-soft transition-colors hover:bg-snow hover:text-magenta"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>

            {/* Heading */}
            <span className="grid h-12 w-12 place-items-center rounded-full bg-petal text-magenta">
              <Sparkles className="h-5 w-5" strokeWidth={1.8} />
            </span>
            <h2 className="mt-4 font-serif text-[1.8rem] leading-tight text-ink">
              {isSignup ? `Create your ${storeName} account` : "Welcome back"}
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              {isSignup
                ? "Save your faves, track orders & earn glow points."
                : "Sign in to pick up right where you left off."}
            </p>

            {/* Mode toggle */}
            <div className="mt-6 grid grid-cols-2 gap-1 rounded-full bg-snow p-1 ring-1 ring-line">
              {[
                { id: "login", label: "Log in" },
                { id: "signup", label: "Sign up" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={mode === t.id}
                  onClick={() => { setMode(t.id); setError(""); }}
                  className="relative rounded-full py-2 text-sm font-semibold transition-colors"
                >
                  {mode === t.id && (
                    <motion.span
                      layoutId="auth-pill"
                      className="absolute inset-0 rounded-full bg-magenta shadow-[var(--shadow-glow-pink)]"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className={`relative z-10 ${mode === t.id ? "text-white" : "text-ink-soft"}`}>
                    {t.label}
                  </span>
                </button>
              ))}
            </div>

            {/* Form */}
            {/* noValidate: without it, the browser's OWN native email
                constraint runs first on submit and silently blocks anything
                with no "@" before our onSubmit ever fires — different
                wording per browser, and it never reaches isValidEmail at
                all, so disposable domains / bad-TLD shapes that DO pass the
                loose native check show our message while missing-"@" shapes
                would show the browser's instead. isValidEmail below is the
                single source of truth for every malformed shape. */}
            <form onSubmit={submit} noValidate className="mt-6 space-y-3">
              <AnimatePresence initial={false}>
                {isSignup && (
                  <motion.div
                    key="name"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="relative">
                      <User className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" strokeWidth={1.7} />
                      <Input value={form.name} onChange={set("name")} placeholder="Your name" className="pl-11" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" strokeWidth={1.7} />
                <Input type="email" value={form.email} onChange={set("email")} placeholder="you@email.com" className="pl-11" />
              </div>

              <div className="relative">
                <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" strokeWidth={1.7} />
                <Input
                  type={showPw ? "text" : "password"}
                  value={form.password}
                  onChange={set("password")}
                  placeholder="Password"
                  className="pl-11 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-ink-soft transition-colors hover:text-magenta"
                >
                  {showPw ? <EyeOff className="h-4 w-4" strokeWidth={1.7} /> : <Eye className="h-4 w-4" strokeWidth={1.7} />}
                </button>
              </div>

              {error && (
                <p className="text-sm font-medium text-error">{error}</p>
              )}

              <Button type="submit" variant="primary" size="md" magnetic={false} className="w-full">
                {isSignup ? "Create account" : "Log in"}
              </Button>
            </form>

            <p className="mt-4 text-center text-xs text-ink-soft">
              {isSignup ? "Already have an account? " : `New to ${storeName}? `}
              <button
                type="button"
                onClick={() => { setMode(isSignup ? "login" : "signup"); setError(""); }}
                className="font-semibold text-magenta hover:underline"
              >
                {isSignup ? "Log in" : "Create one"}
              </button>
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
