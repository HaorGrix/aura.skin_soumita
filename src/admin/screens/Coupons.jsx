/* =================================================================== *
 * skin.theory admin — coupons
 * -------------------------------------------------------------------
 * Two kinds share this screen, told apart by `required_points`:
 *   • Manual codes the client creates.
 *   • Loyalty codes that unlock at a points milestone, set here and
 *     shown on the Rewards page.
 * =================================================================== */
import { useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import {
  DISCOUNT_KINDS, couponRedemptions, deactivateCoupon, deleteCoupon, listCoupons, saveCoupon, suggestCode,
} from "../../lib/api/admin/promos.js";
import { useAdmin } from "../context.js";
import {
  Btn, Card, ConfirmModal, DataTable, Modal, MoneyField, PageHeader, Pill,
  SearchInput, SelectField, TextField, Toggle, money, toLocalInputValue, toUtcIso, useAsync,
} from "../components/kit.jsx";

const BLANK = {
  code: "", kind: "percent", value_percent: 10, value_minor: null,
  also_free_shipping: false, min_subtotal_minor: 0, max_discount_minor: null,
  starts_at: "", ends_at: "", usage_limit: null, usage_limit_per_customer: 1,
  first_order_only: false, is_active: true, required_points: null,
};

export default function Coupons() {
  const { can } = useAdmin();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [deactivating, setDeactivating] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  const list = useAsync(() => listCoupons({ search }), [search]);

  function isExpired(c) {
    return c.ends_at && new Date(c.ends_at) < new Date();
  }
  function isExhausted(c) {
    return c.usage_limit != null && c.used_count >= c.usage_limit;
  }

  return (
    <>
      <PageHeader
        title="Coupons"
        subtitle="Discount codes shoppers type at checkout."
        actions={can("editor") && (
          <Btn onClick={async () => setEditing({ ...BLANK, code: await suggestCode("SAVE") })}>
            <Plus className="h-4 w-4" /> New coupon
          </Btn>
        )}
      />

      <div className="mb-4 max-w-md">
        <SearchInput value={search} onChange={setSearch} placeholder="Find a code…" />
      </div>

      {deleteError && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{deleteError}</p>
      )}

      <DataTable
        loading={list.loading} error={list.error} rows={list.data}
        onRowClick={can("editor") ? setEditing : undefined}
        empty="No coupons yet. Create one to run your first promotion."
        columns={[
          { key: "code", header: "Code", render: (c) => (
              <div className="flex items-center gap-2">
                <span className="font-mono font-medium text-ink">{c.code}</span>
                {c.required_points != null && (
                  <Pill tone="magenta"><Sparkles className="h-2.5 w-2.5" /> Loyalty</Pill>
                )}
              </div>
            ) },
          { key: "value", header: "Discount", render: (c) =>
              c.kind === "percent" ? `${c.value_percent}% off`
              : c.kind === "fixed" ? `${money(c.value_minor)} off`
              : "Free shipping" },
          { key: "used", header: "Used", render: (c) => (
              <span className="text-ink-soft">
                {c.used_count}{c.usage_limit != null ? ` / ${c.usage_limit}` : ""}
              </span>
            ) },
          { key: "ends_at", header: "Expires", render: (c) => (
              <span className="text-ink-soft">{c.ends_at ? new Date(c.ends_at).toLocaleDateString() : "Never"}</span>
            ) },
          { key: "state", header: "Status", render: (c) =>
              !c.is_active ? <Pill tone="grey">Off</Pill>
              : isExpired(c) ? <Pill tone="red">Expired</Pill>
              : isExhausted(c) ? <Pill tone="amber">Fully used</Pill>
              : <Pill tone="green">Active</Pill> },
        ]}
      />

      {editing && (
        <CouponModal
          coupon={editing} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); list.reload(); }}
          onDeactivate={() => { setDeactivating(editing); }}
          onDelete={() => { setDeleteError(null); setDeleting(editing); }}
          readOnly={!can("editor")}
        />
      )}

      <ConfirmModal
        open={!!deactivating} onClose={() => setDeactivating(null)} danger
        title="Turn this coupon off?" confirmLabel="Turn off"
        body="Shoppers won't be able to use it any more. The record of discounts already given stays intact, and you can switch it back on later."
        onConfirm={async () => { await deactivateCoupon(deactivating.id); setEditing(null); list.reload(); }}
      />

      <ConfirmModal
        open={!!deleting} onClose={() => setDeleting(null)} danger
        title={`Delete ${deleting?.code}?`} confirmLabel="Delete"
        body="This removes the coupon entirely. Only possible while it has never been used — once used, turn it off instead."
        onConfirm={async () => {
          const { error } = await deleteCoupon(deleting.id);
          if (error) { setDeleteError(error.message); return; }
          setDeleteError(null); setEditing(null); list.reload();
        }}
      />
    </>
  );
}

function CouponModal({ coupon, onClose, onSaved, onDeactivate, onDelete, readOnly }) {
  const [form, setForm] = useState(coupon);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const isLoyalty = coupon.required_points != null;
  const isNew = !coupon.id;
  const canDelete = !isNew && !readOnly && !coupon.used_count;
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const redemptions = useAsync(
    () => (coupon.id ? couponRedemptions(coupon.id, 10) : Promise.resolve({ data: [] })),
    [coupon.id]
  );

  async function handleSave() {
    if (!form.code?.trim()) return setError("Give the coupon a code.");
    if (form.kind === "percent" && !(form.value_percent > 0)) return setError("Enter a percentage above zero.");
    if (form.kind === "fixed" && !(form.value_minor > 0)) return setError("Enter an amount above zero.");
    if (form.starts_at && form.ends_at && new Date(form.ends_at) <= new Date(form.starts_at))
      return setError("The end date must be after the start date.");

    setBusy(true); setError(null);
    const { error } = await saveCoupon(form);
    setBusy(false);
    if (error) setError(error.message);
    else onSaved();
  }

  return (
    <Modal open onClose={onClose} wide title={isNew ? "New coupon" : `Coupon ${coupon.code}`}
      footer={
        <>
          {!isNew && !readOnly && (
            <div className="mr-auto flex gap-2">
              <Btn variant="ghost" size="sm" className="text-red-600" onClick={onDeactivate}>
                Turn off
              </Btn>
              {canDelete && (
                <Btn variant="ghost" size="sm" className="text-red-600" onClick={onDelete}>
                  Delete
                </Btn>
              )}
            </div>
          )}
          <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
          {!readOnly && <Btn size="sm" loading={busy} onClick={handleSave}>Save coupon</Btn>}
        </>
      }>
      {isLoyalty && (
        <p className="mb-4 rounded-xl bg-petal px-4 py-2.5 text-xs text-magenta-deep">
          This is a loyalty reward{coupon.required_points != null ? `, unlocked at ${coupon.required_points} points` : ""}.
          {" "}If this code is also shown on the Rewards page, keep its points threshold in sync with what's promised there.
        </p>
      )}
      {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Code" hint="What shoppers type at checkout" required
          value={form.code} disabled={readOnly || isLoyalty}
          onChange={(e) => set("code")(e.target.value.toUpperCase())} className="font-mono" />

        <SelectField label="Discount type" value={form.kind} disabled={readOnly}
          onChange={(e) => set("kind")(e.target.value)} options={DISCOUNT_KINDS} />

        {form.kind === "percent" && (
          <TextField label="Percentage off" type="number" min="1" max="100" required
            value={form.value_percent ?? ""} disabled={readOnly}
            onChange={(e) => set("value_percent")(Number(e.target.value))} />
        )}
        {form.kind === "fixed" && (
          <MoneyField label="Amount off" required valueMinor={form.value_minor} onChangeMinor={set("value_minor")} />
        )}

        <MoneyField label="Minimum spend" hint="0 for no minimum"
          valueMinor={form.min_subtotal_minor} onChangeMinor={set("min_subtotal_minor")} />

        {form.kind === "percent" && (
          <MoneyField label="Cap the discount at" hint="Optional — protects margin on big carts"
            valueMinor={form.max_discount_minor} onChangeMinor={set("max_discount_minor")} />
        )}

        <TextField label="Starts" type="datetime-local" value={toLocalInputValue(form.starts_at)}
          disabled={readOnly} onChange={(e) => set("starts_at")(toUtcIso(e.target.value))} />
        <TextField label="Expires" type="datetime-local" hint="Leave empty for no expiry — your local time"
          value={toLocalInputValue(form.ends_at)} disabled={readOnly}
          onChange={(e) => set("ends_at")(toUtcIso(e.target.value))} />

        <TextField label="Total uses allowed" type="number" min="1" hint="Leave empty for unlimited"
          value={form.usage_limit ?? ""} disabled={readOnly}
          onChange={(e) => set("usage_limit")(e.target.value === "" ? null : Number(e.target.value))} />
        <TextField label="Uses per customer" type="number" min="1"
          value={form.usage_limit_per_customer ?? 1} disabled={readOnly}
          onChange={(e) => set("usage_limit_per_customer")(Number(e.target.value))} />

        <TextField label="Required points" type="number" min="0"
          hint="Leave blank for a regular coupon — set this to make it a Rewards loyalty tier"
          value={form.required_points ?? ""} disabled={readOnly}
          onChange={(e) => set("required_points")(e.target.value === "" ? null : Number(e.target.value))} />

        <div className="space-y-2 sm:col-span-2">
          {form.kind === "percent" && (
            <Toggle label="Also give free shipping" checked={form.also_free_shipping}
              onChange={set("also_free_shipping")} disabled={readOnly} />
          )}
          <Toggle label="First order only" hint="Only valid on a customer's very first order."
            checked={form.first_order_only} onChange={set("first_order_only")} disabled={readOnly || isLoyalty} />
          <Toggle label="Active" hint="Turn off to stop the code working without deleting it."
            checked={form.is_active} onChange={set("is_active")} disabled={readOnly} />
        </div>
      </div>

      {!isNew && (
        <Card title="Recent uses" className="mt-6 ring-0">
          {!redemptions.data?.length ? (
            <p className="py-3 text-center text-xs text-ink-soft">Nobody has used this code yet.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {redemptions.data.map((r) => (
                <li key={r.id} className="flex justify-between gap-3 py-2">
                  <span className="text-ink-soft">{r.orders?.number} · {r.orders?.email}</span>
                  <span>− {money(r.discount_minor)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </Modal>
  );
}
