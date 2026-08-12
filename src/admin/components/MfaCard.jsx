/* =================================================================== *
 * skin.theory admin — two-factor authentication (TOTP)
 * -------------------------------------------------------------------
 * Recommended for owner-level accounts specifically: an owner's password
 * alone gates every other account (role changes, invites, revocation), so
 * it's the single highest-value credential to protect with a second factor.
 * Uses Supabase Auth's built-in TOTP enrollment — no third-party service,
 * no secret this app stores itself.
 * =================================================================== */
import { useEffect, useState } from "react";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { supabase } from "../../lib/api/client.js";
import { Btn, Card, TextField } from "./kit.jsx";

export default function MfaCard() {
  const [factors, setFactors] = useState(null);
  const [enrolling, setEnrolling] = useState(null); // { id, qr, secret }
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function refresh() {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors(data);
  }
  useEffect(() => { refresh(); }, []);

  const verified = factors?.totp?.find((f) => f.status === "verified");

  async function startEnroll() {
    setError(null);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    if (error) return setError(error.message);
    setEnrolling({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function confirmEnroll(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: enrolling.id });
    if (challengeError) { setBusy(false); return setError(challengeError.message); }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: enrolling.id, challengeId: challenge.id, code: code.trim(),
    });
    setBusy(false);
    if (verifyError) return setError("That code didn't work — check your authenticator app and try again.");

    setEnrolling(null);
    setCode("");
    refresh();
  }

  async function disable() {
    if (!verified) return;
    if (!window.confirm("Turn off two-factor authentication for your account?")) return;
    setBusy(true);
    await supabase.auth.mfa.unenroll({ factorId: verified.id });
    setBusy(false);
    refresh();
  }

  if (!factors) return null;

  return (
    <Card className="mb-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-3">
          {verified
            ? <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" strokeWidth={1.75} />
            : <ShieldOff className="h-5 w-5 shrink-0 text-amber-600" strokeWidth={1.75} />}
          <div className="text-sm text-ink-soft">
            <p className="font-medium text-ink">Two-factor authentication</p>
            <p className="mt-0.5">
              {verified
                ? "Enabled on your account — an authenticator code is required alongside your password."
                : "Strongly recommended for owner-level accounts. A stolen or guessed password alone won't be enough to sign in."}
            </p>
          </div>
        </div>
        {!enrolling && (
          verified
            ? <Btn size="sm" variant="secondary" onClick={disable} loading={busy}>Turn off</Btn>
            : <Btn size="sm" onClick={startEnroll}>Set up 2FA</Btn>
        )}
      </div>

      {enrolling && (
        <form onSubmit={confirmEnroll} className="mt-4 space-y-3 border-t border-line pt-4">
          <p className="text-xs text-ink-soft">
            Scan this QR code with an authenticator app (Google Authenticator, 1Password, Authy), then
            enter the 6-digit code it shows.
          </p>
          {/* eslint-disable-next-line jsx-a11y/img-redundant-alt */}
          <img src={enrolling.qr} alt="2FA QR code" className="h-40 w-40 rounded-lg ring-1 ring-line" />
          <p className="break-all font-mono text-[11px] text-ink-soft">Manual key: {enrolling.secret}</p>
          <TextField
            label="6-digit code" inputMode="numeric" maxLength={6} required
            value={code} onChange={(e) => { setCode(e.target.value); setError(null); }}
          />
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <Btn type="button" variant="secondary" onClick={() => { setEnrolling(null); setCode(""); setError(null); }}>Cancel</Btn>
            <Btn type="submit" loading={busy}>Confirm</Btn>
          </div>
        </form>
      )}
      {error && !enrolling && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
    </Card>
  );
}
