/* =================================================================== *
 * skin.script admin — sign in
 * -------------------------------------------------------------------
 * Three modes, all backed by real Supabase Auth:
 *   • password  — the normal path
 *   • link      — one-time email sign-in; the fallback when an account has
 *                 no password yet. Invited users and users created via a
 *                 magic link have none, and the API reports that as the
 *                 SAME "Invalid login credentials" as a wrong password —
 *                 which is why that error message explains the difference.
 *   • reset     — email a password-reset link
 *
 * There is deliberately NO "claim ownership" / self-promotion button. A
 * client-callable endpoint that grants owner rights is an unnecessary
 * attack surface, and it can't create the auth user anyway. Staff accounts
 * come from `node scripts/admin-account.mjs`, which needs the service-role
 * key — the one credential that must never reach a browser.
 * =================================================================== */
import { useState } from "react";
import { KeyRound, Mail, RotateCcw, ShieldAlert } from "lucide-react";
import {
  friendlyAuthError, sendPasswordReset, signIn, signInWithMagicLink, signOut,
} from "../../lib/api/admin/auth.js";
import { Btn, Card, TextField } from "../components/kit.jsx";

export default function Login({ session, onSignedIn }) {
  const [mode, setMode] = useState("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const clear = () => { setError(null); setNotice(null); };

  async function handleSubmit(e) {
    e.preventDefault();
    clear();
    if (!email.trim()) return setError("Enter your email address.");
    setBusy(true);

    if (mode === "password") {
      const { error } = await signIn(email.trim(), password);
      setBusy(false);
      if (error) return setError(friendlyAuthError(error));
      return onSignedIn?.();
    }

    if (mode === "link") {
      const { error } = await signInWithMagicLink(email.trim());
      setBusy(false);
      if (error) return setError(friendlyAuthError(error));
      return setNotice(`Sign-in link sent to ${email.trim()}. Open it on this device — it signs you straight in.`);
    }

    const { error } = await sendPasswordReset(email.trim());
    setBusy(false);
    if (error) return setError(friendlyAuthError(error));
    setNotice(`Reset link sent to ${email.trim()}. Opening it brings you back here to choose a new password.`);
  }

  /* Signed in, but no staff role: a customer who typed /admin, or someone
     whose access was revoked. */
  if (session) {
    return (
      <Shell>
        <Card>
          <div className="text-center">
            <ShieldAlert className="mx-auto h-8 w-8 text-ink-soft" strokeWidth={1.5} />
            <p className="mt-3 text-sm font-medium text-ink">This account isn't staff</p>
            <p className="mt-1 text-xs text-ink-soft">
              You're signed in as {session.user?.email}, but it has no admin role — or its access was revoked.
            </p>
            <p className="mt-3 rounded-lg bg-snow px-3 py-2 text-left text-[11px] text-ink-soft">
              An owner can grant a role under <strong>Staff &amp; roles</strong>. For first-time setup, run:{" "}
              <code className="mt-1 block break-all rounded bg-white px-1.5 py-1 ring-1 ring-line">
                node scripts/admin-account.mjs {session.user?.email}
              </code>
            </p>
            <Btn
              variant="secondary" className="mt-4 w-full"
              onClick={async () => { await signOut(); window.location.href = "/admin"; }}
            >
              Sign in as someone else
            </Btn>
          </div>
        </Card>
      </Shell>
    );
  }

  const copy = {
    password: { title: "Sign in", cta: "Sign in", Icon: KeyRound },
    link:     { title: "Email sign-in link", cta: "Send the link", Icon: Mail },
    reset:    { title: "Reset your password", cta: "Send reset link", Icon: RotateCcw },
  }[mode];

  return (
    <Shell>
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm font-medium text-ink">{copy.title}</p>

          <TextField
            label="Email" type="email" autoComplete="username" required
            value={email} onChange={(e) => { setEmail(e.target.value); clear(); }}
          />

          {mode === "password" && (
            <TextField
              label="Password" type="password" autoComplete="current-password"
              value={password} onChange={(e) => { setPassword(e.target.value); clear(); }}
            />
          )}

          {mode === "link" && (
            <p className="rounded-lg bg-snow px-3 py-2 text-[11px] text-ink-soft">
              We'll email a one-time link that signs you in without a password — useful if this
              account was never given one.
            </p>
          )}

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          {notice && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{notice}</p>}

          <Btn type="submit" className="w-full" loading={busy}>
            <copy.Icon className="h-4 w-4" /> {copy.cta}
          </Btn>
        </form>

        <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 border-t border-line pt-4 text-[11px]">
          {mode !== "password" && (
            <button onClick={() => { setMode("password"); clear(); }} className="text-ink-soft hover:text-magenta">
              Sign in with a password
            </button>
          )}
          {mode !== "link" && (
            <button onClick={() => { setMode("link"); clear(); }} className="text-ink-soft hover:text-magenta">
              Email me a sign-in link
            </button>
          )}
          {mode !== "reset" && (
            <button onClick={() => { setMode("reset"); clear(); }} className="text-ink-soft hover:text-magenta">
              Forgot your password?
            </button>
          )}
        </div>
      </Card>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="grid min-h-screen place-items-center bg-snow px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="font-serif text-3xl text-ink">skin.script</p>
          <p className="text-[11px] uppercase tracking-widest text-ink-soft">Admin</p>
        </div>
        {children}
        <p className="mt-4 text-center text-[11px] text-ink-soft">
          <a href="/" className="hover:text-magenta">← Back to the store</a>
        </p>
      </div>
    </div>
  );
}
