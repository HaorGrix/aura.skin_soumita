/* =================================================================== *
 * skin.theory admin — shipping methods & zone-based pricing
 * -------------------------------------------------------------------
 * 0038_shipping_methods.sql. A method with exactly one zone (no
 * matching_districts) behaves as a flat price everywhere that reads this
 * data — Checkout never special-cases it, so this screen doesn't either:
 * "Add a zone" on a fresh method just creates that one flat-rate zone.
 *
 * Deleting a method cascades to its zones (FK ON DELETE CASCADE) and
 * detaches any past order from it (ON DELETE SET NULL) — a past order's
 * own shipping_minor/shipping_address is untouched either way, so this
 * screen never needs to block a delete the way Brands/Categories do.
 * =================================================================== */
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import {
  deleteShippingMethod, deleteShippingZone, listShippingMethods,
  reorderShippingMethods, upsertShippingMethod, upsertShippingZone,
} from "../../lib/api/admin/shipping.js";
import { useAdmin } from "../context.js";
import {
  Btn, Card, ConfirmModal, MoneyField, Modal, PageHeader, Spinner, TagsField, TextField, Toggle, money,
} from "../components/kit.jsx";

export default function Shipping() {
  const { can } = useAdmin();
  const readOnly = !can("admin");

  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [editingMethod, setEditingMethod] = useState(null); // {} new | method obj
  const [editingZone, setEditingZone] = useState(null);     // { methodId, zone: {} | zone obj }
  const [deletingMethod, setDeletingMethod] = useState(null);
  const [deletingZone, setDeletingZone] = useState(null);

  const load = async () => {
    const { data, error } = await listShippingMethods();
    if (error) return setError(error.message);
    setRows(data);
  };
  useEffect(() => { load(); }, []);

  if (error && !rows) return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>;
  if (!rows) return <div className="grid place-items-center py-24"><Spinner className="h-7 w-7" /></div>;

  async function moveMethod(id, direction) {
    const index = rows.findIndex((r) => r.id === id);
    const swapWith = index + direction;
    if (swapWith < 0 || swapWith >= rows.length) return;
    const next = rows.slice();
    [next[index], next[swapWith]] = [next[swapWith], next[index]];
    setRows(next);
    const { error } = await reorderShippingMethods(next);
    if (error) setError(error.message);
  }

  return (
    <>
      <PageHeader
        title="Shipping"
        subtitle="Delivery options shown at checkout, priced flat or by zone."
        actions={!readOnly && (
          <Btn onClick={() => setEditingMethod({})}>
            <Plus className="h-4 w-4" /> Add method
          </Btn>
        )}
      />

      {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}

      <div className="space-y-4">
        {rows.map((m, i) => (
          <Card key={m.id}>
            <div className="flex items-start gap-3">
              <div className="flex flex-col pt-0.5">
                <button onClick={() => moveMethod(m.id, -1)} disabled={readOnly || i === 0}
                  className="rounded p-0.5 text-ink-soft hover:text-magenta disabled:opacity-25" aria-label="Move up">
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => moveMethod(m.id, 1)} disabled={readOnly || i === rows.length - 1}
                  className="rounded p-0.5 text-ink-soft hover:text-magenta disabled:opacity-25" aria-label="Move down">
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-ink">{m.name}</p>
                  {!m.is_active && <span className="rounded-full bg-snow px-2 py-0.5 text-[11px] font-medium text-ink-soft ring-1 ring-line">Disabled</span>}
                </div>
                {m.description && <p className="mt-0.5 text-xs text-ink-soft">{m.description}</p>}

                <ul className="mt-3 divide-y divide-line rounded-xl bg-snow/60 ring-1 ring-line">
                  {m.zones.map((z) => (
                    <li key={z.id} className="flex items-center gap-3 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-ink">{z.zone_name}</p>
                        {z.matching_districts.length > 0 && (
                          <p className="truncate text-[11px] text-ink-soft">Matches: {z.matching_districts.join(", ")}</p>
                        )}
                      </div>
                      <span className="text-xs font-semibold text-ink">{money(z.price_minor)}</span>
                      {!readOnly && (
                        <>
                          <Btn size="sm" variant="secondary" onClick={() => setEditingZone({ methodId: m.id, zone: z })}>Edit</Btn>
                          <Btn size="sm" variant="ghost" onClick={() => setDeletingZone(z)} className="text-red-600 hover:text-red-700">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Btn>
                        </>
                      )}
                    </li>
                  ))}
                  {m.zones.length === 0 && (
                    <li className="px-3 py-3 text-center text-xs text-ink-soft">
                      No price set — this method won't be offered at checkout until it has at least one zone.
                    </li>
                  )}
                </ul>

                {!readOnly && (
                  <button
                    onClick={() => setEditingZone({ methodId: m.id, zone: {} })}
                    className="mt-2 text-xs font-medium text-magenta hover:underline"
                  >
                    + Add {m.zones.length > 0 ? "zone" : "price"}
                  </button>
                )}
              </div>

              {!readOnly && (
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Toggle
                    checked={m.is_active}
                    onChange={async (v) => {
                      setRows((r) => r.map((row) => (row.id === m.id ? { ...row, is_active: v } : row)));
                      const { error } = await upsertShippingMethod({ ...m, is_active: v });
                      if (error) setError(error.message);
                    }}
                  />
                  <div className="flex gap-2">
                    <Btn size="sm" variant="secondary" onClick={() => setEditingMethod(m)}>Edit</Btn>
                    <Btn size="sm" variant="ghost" onClick={() => setDeletingMethod(m)} className="text-red-600 hover:text-red-700">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Btn>
                  </div>
                </div>
              )}
            </div>
          </Card>
        ))}
        {rows.length === 0 && (
          <Card><p className="py-10 text-center text-sm text-ink-soft">No shipping methods yet — add one to enable checkout.</p></Card>
        )}
      </div>

      {editingMethod && (
        <MethodModal
          method={editingMethod}
          onClose={() => setEditingMethod(null)}
          onSaved={() => { setEditingMethod(null); load(); }}
        />
      )}
      {editingZone && (
        <ZoneModal
          methodId={editingZone.methodId}
          zone={editingZone.zone}
          onClose={() => setEditingZone(null)}
          onSaved={() => { setEditingZone(null); load(); }}
        />
      )}

      <ConfirmModal
        open={!!deletingMethod} onClose={() => setDeletingMethod(null)} danger
        title={`Delete “${deletingMethod?.name}”?`}
        confirmLabel="Delete permanently"
        body="This removes the method and all of its zones. Past orders that used it keep their own recorded shipping fee and address — they aren't affected."
        onConfirm={async () => {
          const { error } = await deleteShippingMethod(deletingMethod.id);
          if (error) setError(error.message);
          else load();
        }}
      />
      <ConfirmModal
        open={!!deletingZone} onClose={() => setDeletingZone(null)} danger
        title={`Delete “${deletingZone?.zone_name}”?`}
        confirmLabel="Delete permanently"
        body="This removes just this price/zone from the method."
        onConfirm={async () => {
          const { error } = await deleteShippingZone(deletingZone.id);
          if (error) setError(error.message);
          else load();
        }}
      />
    </>
  );
}

function MethodModal({ method, onClose, onSaved }) {
  const [name, setName] = useState(method.name ?? "");
  const [description, setDescription] = useState(method.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const isNew = !method.id;

  return (
    <Modal open onClose={onClose} title={isNew ? "New shipping method" : `Edit “${method.name}”`}
      footer={
        <>
          <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn size="sm" loading={busy} onClick={async () => {
            setBusy(true); setError(null);
            const { error } = await upsertShippingMethod({ id: method.id, name, description, is_active: method.is_active ?? true });
            setBusy(false);
            if (error) setError(error.message);
            else onSaved();
          }}>Save</Btn>
        </>
      }>
      {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}
      <div className="space-y-4">
        <TextField label="Name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Home Delivery" />
        <TextField label="Description" hint="Shown to the customer at checkout" as="textarea"
          value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Delivered to your door." />
      </div>
      {isNew && (
        <p className="mt-3 text-[11px] text-ink-soft">
          After saving, add a price — a flat rate, or multiple zones with different prices.
        </p>
      )}
    </Modal>
  );
}

function ZoneModal({ methodId, zone, onClose, onSaved }) {
  const [zoneName, setZoneName] = useState(zone.zone_name ?? "Flat rate");
  const [priceMinor, setPriceMinor] = useState(zone.price_minor ?? null);
  const [districts, setDistricts] = useState(zone.matching_districts ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const isNew = !zone.id;

  return (
    <Modal open onClose={onClose} title={isNew ? "New price / zone" : `Edit “${zone.zone_name}”`}
      footer={
        <>
          <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn size="sm" loading={busy} onClick={async () => {
            setBusy(true); setError(null);
            const { error } = await upsertShippingZone({
              id: zone.id, method_id: methodId, zone_name: zoneName, price_minor: priceMinor, matching_districts: districts,
            });
            setBusy(false);
            if (error) setError(error.message);
            else onSaved();
          }}>Save</Btn>
        </>
      }>
      {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}
      <div className="space-y-4">
        <TextField label="Zone name" required value={zoneName} onChange={(e) => setZoneName(e.target.value)}
          hint='Use "Flat rate" if this method only ever has one price' placeholder="Inside Dhaka" />
        <MoneyField label="Price" required valueMinor={priceMinor} onChangeMinor={setPriceMinor} />
        <TagsField
          label="Matches these districts/areas"
          hint="Leave blank for a flat-rate / catch-all price. Matched against whatever the customer types as their city."
          value={districts}
          onChange={setDistricts}
        />
      </div>
    </Modal>
  );
}
