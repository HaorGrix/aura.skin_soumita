/* =================================================================== *
 * skin.script admin — staff & roles (owner only)
 * -------------------------------------------------------------------
 * Role changes here update `profiles.role`; a database trigger mirrors it
 * into the user's JWT claim, which is what RLS actually reads. So a demoted
 * admin loses write access on their next token refresh, not just visually.
 *
 * There is no "invite" button because creating auth users needs the
 * service_role key, which must never reach the browser. The flow is:
 * the person signs up on the storefront, then the owner grants them a role
 * here. That's stated on-screen rather than left as a mystery.
 * =================================================================== */
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { listStaff, setStaffActive, setStaffRole } from "../../lib/api/admin/settings.js";
import { useAdmin } from "../context.js";
import {
  Btn, Card, ConfirmModal, DataTable, PageHeader, Pill, SelectField, useAsync,
} from "../components/kit.jsx";

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
  const list = useAsync(() => listStaff(), []);

  return (
    <>
      <PageHeader
        title="Staff & roles"
        subtitle="Who can access this admin panel, and what they're allowed to do."
      />

      <Card className="mb-5">
        <div className="flex gap-3">
          <ShieldCheck className="h-5 w-5 shrink-0 text-ink-soft" strokeWidth={1.75} />
          <div className="text-sm text-ink-soft">
            <p className="font-medium text-ink">Adding someone</p>
            <p className="mt-0.5">
              Ask them to create a normal account on the store first, using the email they'll work with.
              Once they've done that they appear in this list, and you can give them a role.
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
                </p>
                <p className="text-xs text-ink-soft">{r.email}</p>
              </div>
            ) },
          { key: "role", header: "Role", render: (r) => (
              <Pill tone={ROLE_TONE[r.role]}>{r.role}</Pill>
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
          { key: "is_active", header: "Access", align: "right", render: (r) => (
              r.id === profile?.id ? (
                <span className="text-xs text-ink-soft">—</span>
              ) : (
                <Btn size="sm" variant={r.is_active ? "secondary" : "primary"}
                  onClick={() => setConfirm(r)}>
                  {r.is_active ? "Revoke" : "Restore"}
                </Btn>
              )
            ) },
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
    </>
  );
}
