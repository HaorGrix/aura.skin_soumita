import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, Lock, User, Eye, EyeOff, Sparkles, KeyRound, MailCheck } from "lucide-react";
import { useUser } from "../../context/UserContext.jsx";
import { useToast } from "../ui/Toast.jsx";
import Button from "../ui/Button.jsx";
import { Input } from "../ui/index.js";
import { useFocusTrap } from "../../lib/useFocusTrap.js";
import { useBodyScrollLock } from "../../lib/scrollLock.js";
import { isValidEmail } from "../../lib/email-validation.js";
import { useStoreSettings } from "../../lib/api/settings.js";
import { resetPasswordWithCode, sendPasswordResetCode } from "../../lib/api/customerAuth.js";

/**
 * AuthModal — the single, shared login / sign-up surface. Light and
 * non-intrusive (a small centred card, not a full takeover) so browsing
 * never feels gated. Opened from anywhere via `openAuth(mode, onSuccess)`
 * on the UserContext; on success it runs the optional callback (e.g. the
 * checkout flow continues) and closes itself.
 *
 * Views: login · signup · confirm (after sign-up: "check your email") ·
 * forgot (email → 6-digit code + new password). Accounts are real
 * (lib/api/customerAuth.js): an unknown email or wrong password is refused.
 */
const emailOk = isValidEmail;

export default function AuthModal() {
  const { auth, closeAuth, login, signup } = useUser();
  const { toast } = useToast();
  const { storeName } = useStoreSettings();
  const { open, mode: initialMode, onSuccess } = auth;

  const dialogRef = useRef(null);
  useFocusTrap(dialogRef, open);

  const [mode, setMode] = useState("login"); // login | signup | confirm | forgot
  const [form, setForm] = useState({ name: "", email: "", password: "", code: "", password2: "" });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [codeSent, setCodeSent] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const isSignup = mode === "signup";

  // Sync to the requested mode and reset state each time it opens.
  useEffect(() => {
    if (open) {
      setMode(initialMode === "signup" ? "signup" : "login");
      setForm({ name: "", email: "", password: "", code: "", password2: "" });
      setShowPw(false);
      setError("");
      setNotice("");
      setBusy(false);
      setCodeSent(false);
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

  const switchMode = (next) => { setMode(next); setError(""); setNotice(""); setCodeSent(false); };
  const email = form.email.trim().toLowerCase();

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setError("");
    if (isSignup && !form.name.trim()) return setError("Please tell us your name.");
    if (!emailOk(email)) return setError("Enter a valid email address.");
    if (form.password.length < 6) return setError("Password needs at least 6 characters.");

    setBusy(true);
    if (isSignup) {
      const { error: err, needsConfirmation } = await signup({ name: form.name.trim(), email, password: form.password });
      setBusy(false);
      if (err) return setError(err);
      if (needsConfirmation) return setMode("confirm");
      toast.success(`Welcome to ${storeName}, ${form.name.trim()} 🌸`, "Account created");
    } else {
      const { error: err } = await login({ email, password: form.password });
      setBusy(false);
      if (err) return setError(err);
      toast.success("You're glowing — welcome back ✨", "Signed in");
    }
    onSuccess?.();
    closeAuth();
  }

  async function sendCode(e) {
    e?.preventDefault();
    if (busy) return;
    setError("");
    if (!emailOk(email)) return setError("Enter the email you signed up with.");
    setBusy(true);
    const { error: err } = await sendPasswordResetCode(email);
    setBusy(false);
    if (err) return setError(err);
    setCodeSent(true);
    setNotice(`If ${email} has an account, a 6-digit code is on its way. It works for 15 minutes.`);
  }

  async function resetPassword(e) {
    e.preventDefault();
    if (busy) return;
    setError("");
    if (!/^\d{6}$/.test(form.code.trim())) return setError("Enter the 6-digit code from the email.");
    if (form.password.length < 6) return setError("New password needs at least 6 characters.");
    if (form.password !== form.password2) return setError("The two passwords don't match.");
    setBusy(true);
    const { error: err } = await resetPasswordWithCode({ email, code: form.code.trim(), password: form.password });
    setBusy(false);
    if (err) return setError(err);
    toast.success("Your password is changed and you're signed in.", "Password reset");
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
            aria-label={mode === "signup" ? "Create account" : mode === "forgot" ? "Reset password" : mode === "confirm" ? "Check your email" : "Log in"}
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
              {mode === "forgot" ? <KeyRound className="h-5 w-5" strokeWidth={1.8} />
                : mode === "confirm" ? <MailCheck className="h-5 w-5" strokeWidth={1.8} />
                : <Sparkles className="h-5 w-5" strokeWidth={1.8} />}
            </span>
            <h2 className="mt-4 font-serif text-[1.8rem] leading-tight text-ink">
              {mode === "signup" ? `Create your ${storeName} account`
                : mode === "forgot" ? "Reset your password"
                : mode === "confirm" ? "Check your email"
                : "Welcome back"}
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              {mode === "signup" ? "Save your faves, track orders & earn glow points."
                : mode === "forgot" ? (codeSent ? "Enter the code from the email and choose a new password." : "We'll email you a 6-digit code.")
                : mode === "confirm" ? `We sent a confirmation link to ${email}. Open it to activate your account, then log in.`
                : "Sign in to pick up right where you left off."}
            </p>

            {mode === "confirm" && (
              <div className="mt-6 space-y-3">
                <p className="rounded-xl bg-snow px-4 py-3 text-sm text-ink ring-1 ring-line">
                  Didn&apos;t get it? Check your spam folder, or wait a minute and sign up again with the same email.
                </p>
                <Button type="button" variant="primary" size="md" magnetic={false} className="w-full" onClick={() => switchMode("login")}>
                  Back to log in
                </Button>
              </div>
            )}

            {mode === "forgot" && (
              <form onSubmit={codeSent ? resetPassword : sendCode} noValidate className="mt-6 space-y-3">
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" strokeWidth={1.7} />
                  <Input type="email" value={form.email} onChange={set("email")} placeholder="you@email.com" className="pl-11"
                    autoComplete="email" disabled={codeSent} />
                </div>

                {codeSent && (
                  <>
                    <Input
                      value={form.code}
                      onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
                      placeholder="6-digit code" inputMode="numeric" autoComplete="one-time-code"
                      className="text-center tracking-[0.4em]"
                    />
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" strokeWidth={1.7} />
                      <Input type={showPw ? "text" : "password"} value={form.password} onChange={set("password")}
                        placeholder="New password" autoComplete="new-password" className="pl-11 pr-11" />
                      <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? "Hide password" : "Show password"}
                        className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-ink-soft transition-colors hover:text-magenta">
                        {showPw ? <EyeOff className="h-4 w-4" strokeWidth={1.7} /> : <Eye className="h-4 w-4" strokeWidth={1.7} />}
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" strokeWidth={1.7} />
                      <Input type={showPw ? "text" : "password"} value={form.password2} onChange={set("password2")}
                        placeholder="Repeat new password" autoComplete="new-password" className="pl-11" />
                    </div>
                  </>
                )}

                {notice && <p className="text-sm text-ink-soft">{notice}</p>}
                {error && <p className="text-sm font-medium text-error">{error}</p>}

                <Button type="submit" variant="primary" size="md" magnetic={false} className="w-full" disabled={busy}>
                  {busy ? "Please wait…" : codeSent ? "Set new password" : "Send code"}
                </Button>

                <div className="flex justify-between text-xs">
                  <button type="button" onClick={() => switchMode("login")} className="font-semibold text-magenta hover:underline">
                    Back to log in
                  </button>
                  {codeSent && (
                    <button type="button" onClick={sendCode} disabled={busy} className="font-semibold text-magenta hover:underline disabled:opacity-50">
                      Send a new code
                    </button>
                  )}
                </div>
              </form>
            )}

            {(mode === "login" || mode === "signup") && (<>
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
                  onClick={() => switchMode(t.id)}
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
                  autoComplete={isSignup ? "new-password" : "current-password"}
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

              {!isSignup && (
                <div className="text-right">
                  <button type="button" onClick={() => switchMode("forgot")} className="text-xs font-semibold text-magenta hover:underline">
                    Forgot password?
                  </button>
                </div>
              )}

              {error && (
                <p className="text-sm font-medium text-error">{error}</p>
              )}

              <Button type="submit" variant="primary" size="md" magnetic={false} className="w-full" disabled={busy}>
                {busy ? "Please wait…" : isSignup ? "Create account" : "Log in"}
              </Button>
            </form>

            <p className="mt-4 text-center text-xs text-ink-soft">
              {isSignup ? "Already have an account? " : `New to ${storeName}? `}
              <button
                type="button"
                onClick={() => switchMode(isSignup ? "login" : "signup")}
                className="font-semibold text-magenta hover:underline"
              >
                {isSignup ? "Log in" : "Create one"}
              </button>
            </p>
            </>)}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
