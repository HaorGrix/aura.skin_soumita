/* =================================================================== *
 * skin.theory admin — choose a new password
 * -------------------------------------------------------------------
 * Shown when Supabase emits PASSWORD_RECOVERY, i.e. the user arrived from a
 * reset link. That event comes with a VALID session, so without this screen
 * they'd be dropped straight onto the dashboard and never actually set the
 * password they came to set — and the account would still have none.
 * =================================================================== */
import { useState } from "react";
import { Check, KeyRound } from "lucide-react";
import { friendlyAuthError, signOut, updatePassword } from "../../lib/api/admin/auth.js";
import { Btn, Card, TextField } from "../components/kit.jsx";
import { useStoreSettings } from "../../lib/api/settings.js";

export default function SetPassword({ email, onDone, onAfterPassword, heading, doneCopy }) {
  const { storeName } = useStoreSettings();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("The two passwords don't match.");

    setBusy(true);
    const { error } = await updatePassword(password);
    if (!error && onAfterPassword) {
      const after = await onAfterPassword();
      if (after?.error) {
        setBusy(false);
        return setError(after.error.message || "Password saved, but activating the account failed. Contact an owner.");
      }
    }
    setBusy(false);
    if (error) return setError(friendlyAuthError(error));

    setDone(true);
  }

  return (
    <div className="grid min-h-screen place-items-center bg-snow px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="font-serif text-3xl text-ink">{storeName}</p>
          <p className="text-[11px] uppercase tracking-widest text-ink-soft">Admin</p>
        </div>

        <Card>
          {done ? (
            <div className="text-center">
              <Check className="mx-auto h-8 w-8 text-emerald-600" strokeWidth={1.5} />
              <p className="mt-3 text-sm font-medium text-ink">Password updated</p>
              <p className="mt-1 text-xs text-ink-soft">
                {doneCopy || "You can use it to sign in from now on."}
              </p>
              <Btn className="mt-4 w-full" onClick={onDone}>Continue to the dashboard</Btn>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <p className="text-sm font-medium text-ink">{heading || "Choose a new password"}</p>
                {email && <p className="mt-0.5 text-xs text-ink-soft">for {email}</p>}
              </div>

              <TextField
                label="New password" type="password" autoComplete="new-password" required
                hint="At least 8 characters"
                value={password} onChange={(e) => { setPassword(e.target.value); setError(null); }}
              />
              <TextField
                label="Confirm new password" type="password" autoComplete="new-password" required
                value={confirm} onChange={(e) => { setConfirm(e.target.value); setError(null); }}
              />

              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

              <Btn type="submit" className="w-full" loading={busy}>
                <KeyRound className="h-4 w-4" /> Save password
              </Btn>

              <button
                type="button"
                onClick={async () => { await signOut(); window.location.href = "/admin"; }}
                className="w-full text-center text-[11px] text-ink-soft hover:text-magenta"
              >
                Cancel and sign out
              </button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
