/* =================================================================== *
 * skin.theory admin — sign in
 * -------------------------------------------------------------------
 * Two modes, both backed by real Supabase Auth:
 *   • password  — the normal path
 *   • reset     — email a password-reset link
 *
 * There is deliberately no passwordless "email me a sign-in link" option.
 * With only a handful of staff accounts, a magic link is pure extra attack
 * surface (another way in, another email-interception risk) for
 * convenience nobody was using — password + reset covers every real case.
 *
 * There is also deliberately NO "claim ownership" / self-promotion button.
 * A client-callable endpoint that grants owner rights is an unnecessary
 * attack surface, and it can't create the auth user anyway. Staff accounts
 * come from `node scripts/admin-account.mjs`, which needs the service-role
 * key — the one credential that must never reach a browser.
 * =================================================================== */
import { useState } from "react";
import { KeyRound, RotateCcw, ShieldAlert } from "lucide-react";
import {
  friendlyAuthError, sendPasswordReset, signIn, signOut,
} from "../../lib/api/admin/auth.js";
import { Btn, Card, TextField } from "../components/kit.jsx";
import { useStoreSettings } from "../../lib/api/settings.js";

export default function Login({ session, onSignedIn, linkError }) {
  // An expired/already-used invite or recovery link always needs a fresh
  // one — land straight on the "email me a link" form instead of the
  // password box nobody asked for.
  const [mode, setMode] = useState(linkError ? "reset" : "password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(linkError ? friendlyLinkError(linkError) : null);
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

/** Supabase's own error_description is accurate but terse ("Email link is
 *  invalid or has expired") — this just makes the "what do I do now" part
 *  explicit, since that's the part a plain error string leaves out. */
function friendlyLinkError(linkError) {
  const base = linkError.message || "This link is invalid or has expired.";
  return `${base} This can happen if it was already used, or if too much time passed since it was sent. Request a new one below.`;
}

function Shell({ children }) {
  const { storeName } = useStoreSettings();
  return (
    <div className="grid min-h-screen place-items-center bg-snow px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="font-serif text-3xl text-ink">{storeName}</p>
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
