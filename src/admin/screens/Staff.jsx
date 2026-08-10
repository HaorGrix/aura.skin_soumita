/* =================================================================== *
 * skin.script admin — staff & roles (owner only)
 * -------------------------------------------------------------------
 * Role changes here update `profiles.role`; a database trigger mirrors it
 * into the user's JWT claim, which is what RLS actually reads. So a demoted
 * admin loses write access on their next token refresh, not just visually.
 *
 * Inviting is real now: it calls the `invite-staff` edge function, which is
 * the only place the service_role key runs outside a local script — never
 * in this browser bundle. The invited person sets their own password from
 * Supabase's own email; nobody else ever sees it.
 * =================================================================== */
import { useState } from "react";
import { Mail, RefreshCw, ShieldCheck, TestTube2 } from "lucide-react";
import { inviteStaff, listStaff, setStaffActive, setStaffRole } from "../../lib/api/admin/settings.js";
import { useAdmin } from "../context.js";
import {
  Btn, Card, ConfirmModal, DataTable, Modal, PageHeader, Pill, SelectField, TextField, useAsync,
} from "../components/kit.jsx";
import MfaCard from "../components/MfaCard.jsx";

const ROLE_OPTIONS = [
  { id: "support", label: "Support — view orders, update status" },
  { id: "editor",  label: "Editor — content, coupons, view catalog" },
  { id: "admin",   label: "Admin — everything except staff & audit" },
  { id: "owner",   label: "Owner — full control" },
];

const ROLE_TONE = { owner: "magenta", admin: "violet", editor: "sky", support: "grey" };

export default function Staff() {
  const { profile } = useAdmin();
  const [confirm, setConfirm] = useState(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [resendingId, setResendingId] = useState(null);
  const [resendResult, setResendResult] = useState(null); // { email, ok, message }
  const list = useAsync(() => listStaff(), []);

  // Re-sends through the exact same invite-staff function as a fresh invite —
  // Supabase's inviteUserByEmail happily regenerates the link for an
  // account that's still pending (only errors on one that's already
  // active), so this is safe to call as many times as needed. The most
  // common reason to need it: an email security scanner pre-fetched and
  // silently burned the original single-use link before a human clicked it.
  async function resendInvite(row) {
    setResendingId(row.id);
    setResendResult(null);
    const { error } = await inviteStaff(row.email, row.role, row.full_name || "");
    setResendingId(null);
    setResendResult({ email: row.email, ok: !error, message: error?.message || "New invite sent." });
    if (!error) list.reload();
  }

  return (
    <>
      <PageHeader
        title="Staff & roles"
        subtitle="Who can access this admin panel, and what they're allowed to do."
        actions={<Btn onClick={() => setInviteOpen(true)}><Mail className="h-4 w-4" /> Invite staff</Btn>}
      />

      <MfaCard />

      {resendResult && (
        <p className={`mb-5 rounded-lg px-3 py-2 text-sm ${resendResult.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          {resendResult.ok
            ? `New invite sent to ${resendResult.email}.`
            : `Couldn't resend to ${resendResult.email}: ${resendResult.message}`}
        </p>
      )}

      <Card className="mb-5">
        <div className="flex gap-3">
          <ShieldCheck className="h-5 w-5 shrink-0 text-ink-soft" strokeWidth={1.75} />
          <div className="text-sm text-ink-soft">
            <p className="font-medium text-ink">Inviting someone</p>
            <p className="mt-0.5">
              Enter their email and role above. They get an email with a link to set their own password —
              nobody here ever sees, sets, or shares it. They show up in this list right away as
              "invited", and become active once they accept.
            </p>
          </div>
        </div>
      </Card>

      <DataTable
        loading={list.loading} error={list.error} rows={list.data}
        empty="No staff accounts yet."
        columns={[
          { key: "full_name", header: "Name", render: (r) => (
              <div>
                <p className="font-medium text-ink">
                  {r.full_name || "—"}
                  {r.id === profile?.id && <span className="ml-2 text-xs font-normal text-ink-soft">(you)</span>}
                  {r.is_test_account && (
                    <span title="Test/QA account" className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200">
                      <TestTube2 className="h-3 w-3" /> test
                    </span>
                  )}
                </p>
                <p className="text-xs text-ink-soft">{r.email}</p>
              </div>
            ) },
          { key: "role", header: "Role", render: (r) => (
              <Pill tone={ROLE_TONE[r.role]}>{r.role}</Pill>
            ) },
          { key: "status", header: "Status", render: (r) => (
              r.invited_by && !r.is_active && !r.invite_accepted_at
                ? <Pill tone="amber">invited — pending</Pill>
                : r.is_active
                  ? <Pill tone="green">active</Pill>
                  : <Pill tone="grey">revoked</Pill>
            ) },
          { key: "change", header: "Change role", render: (r) => (
              <SelectField
                value={r.role}
                // Demoting yourself out of owner would lock everyone out of
                // this screen, so the control is disabled on your own row.
                disabled={r.id === profile?.id}
                onChange={async (e) => { await setStaffRole(r.id, e.target.value); list.reload(); }}
                options={ROLE_OPTIONS}
              />
            ) },
          { key: "is_active", header: "Access", align: "right", render: (r) => {
              const pending = r.invited_by && !r.is_active && !r.invite_accepted_at;
              if (r.id === profile?.id) return <span className="text-xs text-ink-soft">—</span>;
              if (pending) {
                return (
                  <Btn size="sm" variant="secondary" loading={resendingId === r.id} onClick={() => resendInvite(r)}>
                    <RefreshCw className="h-3.5 w-3.5" /> Resend invite
                  </Btn>
                );
              }
              return (
                <Btn size="sm" variant={r.is_active ? "secondary" : "primary"}
                  onClick={() => setConfirm(r)}>
                  {r.is_active ? "Revoke" : "Restore"}
                </Btn>
              );
            } },
        ]}
      />

      <ConfirmModal
        open={!!confirm} onClose={() => setConfirm(null)} danger={confirm?.is_active}
        title={confirm?.is_active ? "Revoke access?" : "Restore access?"}
        confirmLabel={confirm?.is_active ? "Revoke" : "Restore"}
        body={
          confirm?.is_active
            ? `${confirm?.email} will be signed out of the admin panel and won't be able to get back in. Their record of past actions is kept.`
            : `${confirm?.email} will be able to sign in to the admin panel again.`
        }
        onConfirm={async () => { await setStaffActive(confirm.id, !confirm.is_active); list.reload(); }}
      />

      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} onInvited={() => { setInviteOpen(false); list.reload(); }} />
    </>
  );
}

function InviteModal({ open, onClose, onInvited }) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("editor");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError("Enter a valid email address.");

    setBusy(true);
    const { error } = await inviteStaff(email.trim(), role, fullName.trim());
    setBusy(false);
    if (error) return setError(error.message);

    setEmail(""); setFullName(""); setRole("editor");
    onInvited?.();
  }

  return (
    <Modal open={open} onClose={onClose} title="Invite staff">
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField label="Email" type="email" required autoFocus
          value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }} />
        <TextField label="Name (optional)" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <SelectField label="Role" value={role} onChange={(e) => setRole(e.target.value)} options={ROLE_OPTIONS} />

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

        <p className="text-xs text-ink-soft">
          They'll get an email with a link to set their own password. This never generates, shows, or
          stores a password on your behalf.
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <Btn type="button" variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn type="submit" loading={busy}><Mail className="h-4 w-4" /> Send invite</Btn>
        </div>
      </form>
    </Modal>
  );
}
