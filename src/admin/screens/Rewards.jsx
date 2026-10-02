/* =================================================================== *
 * skin.theory admin — Rewards programme
 * -------------------------------------------------------------------
 * One screen for the whole loyalty programme:
 *   • on/off + name          (store_settings.rewards_enabled / _name)
 *   • how points are earned  (points_per_taka, points_per_review)
 *   • reward tiers           (coupons with required_points + reward_label)
 *   • page wording           → Content → Rewards Page (slot page.rewards)
 * Turning the programme off stops points being earned, switches reward
 * codes off at checkout and hides the programme on the storefront
 * (0070_rewards_program_settings.sql). Balances are kept.
 * =================================================================== */
import { useEffect, useMemo, useState } from "react";
import { Gift, Pencil, Plus, Trash2 } from "lucide-react";
import { useAdmin } from "../context.js";
import { getSettings, saveSettings } from "../../lib/api/admin/settings.js";
import { DISCOUNT_KINDS, deleteCoupon, listCoupons, saveCoupon } from "../../lib/api/admin/promos.js";
import {
  Btn, Card, ConfirmModal, Modal, MoneyField, PageHeader, Pill, SaveBar, SelectField, Spinner, TextField, Toggle, money, useAsync,
} from "../components/kit.jsx";

const PROGRAMME_FIELDS = ["rewards_enabled", "rewards_name", "points_per_taka", "points_per_review"];

/** points_per_taka ↔ "৳ spent for 1 point" (what an admin actually thinks in). */
const takaPerPoint = (ppt) => (Number(ppt) > 0 ? Math.round((1 / Number(ppt)) * 100) / 100 : "");
const pointsPerTaka = (tpp) => (Number(tpp) > 0 ? 1 / Number(tpp) : 0);

function tierReward(c) {
  const parts = [];
  if (c.kind === "percent") parts.push(`${Number(c.value_percent)}% off`);
  if (c.kind === "fixed") parts.push(`${money(c.value_minor)} off`);
  if (c.kind === "free_shipping" || c.also_free_shipping) parts.push("free shipping");
  return parts.join(" + ");
}

export default function Rewards() {
  const { can } = useAdmin();
  const readOnly = !can("admin");

  // ── Programme settings ────────────────────────────────────────────
  const [form, setForm] = useState(null);
  const [original, setOriginal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const loadSettings = async () => {
    const { data, error: e } = await getSettings();
    if (e) return setError(`Couldn't load the settings: ${e.message}`);
    const picked = Object.fromEntries(PROGRAMME_FIELDS.map((k) => [k, data?.[k] ?? null]));
    picked.taka_per_point = takaPerPoint(picked.points_per_taka);
    setForm(picked);
    setOriginal(picked);
  };
  useEffect(() => { loadSettings(); }, []);

  const dirty = useMemo(() => form && original && JSON.stringify(form) !== JSON.stringify(original), [form, original]);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    setSaving(true); setError(null);
    const { error: e } = await saveSettings({
      rewards_enabled: !!form.rewards_enabled,
      rewards_name: form.rewards_name?.trim() || null,
      points_per_taka: pointsPerTaka(form.taka_per_point),
      points_per_review: Math.max(0, Math.round(Number(form.points_per_review) || 0)),
    });
    setSaving(false);
    if (e) setError(`Couldn't save: ${e.message}`);
    else await loadSettings();
  }

  // ── Tiers (reward coupons) ────────────────────────────────────────
  const coupons = useAsync(() => listCoupons(), []);
  const tiers = (coupons.data ?? []).filter((c) => c.required_points != null).sort((a, b) => a.required_points - b.required_points);
  const [editing, setEditing] = useState(null); // tier form or null
  const [deleting, setDeleting] = useState(null);

  if (!form) return <div className="grid place-items-center py-24">{error ? <p className="text-sm text-red-600">{error}</p> : <Spinner className="h-7 w-7" />}</div>;

  const earnPreview = [
    Number(form.taka_per_point) > 0 && `1 point for every ৳${form.taka_per_point} spent`,
    Number(form.points_per_review) > 0 && `${form.points_per_review} points per review`,
  ].filter(Boolean).join(" · ") || "Nothing — shoppers currently earn no points.";

  return (
    <>
      <PageHeader
        title="Rewards"
        subtitle="Your loyalty programme: switch it on or off, set how points are earned and what they unlock. Changes show on the website straight away."
      />
      {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Programme" description="Off: no points are earned, reward codes stop working, and the Rewards page, menu link and points badges are hidden. Points already earned are kept.">
          <div className="space-y-4">
            <Toggle label="Rewards programme is on" checked={!!form.rewards_enabled} onChange={set("rewards_enabled")} disabled={readOnly} />
            <TextField label="Programme name" hint="Shown on the Rewards page, menu and account. Leave blank for “<store name> Rewards”."
              value={form.rewards_name ?? ""} onChange={(e) => set("rewards_name")(e.target.value)} maxLength={40} disabled={readOnly} />
          </div>
        </Card>

        <Card title="How points are earned" description={`Currently: ${earnPreview}`}>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Taka spent for 1 point" type="number" min="0" step="1"
              hint="e.g. 100 = 1 point per ৳100 of the order total. 0 or blank = no points for shopping."
              value={form.taka_per_point} onChange={(e) => set("taka_per_point")(e.target.value)} disabled={readOnly} />
            <TextField label="Points per verified review" type="number" min="0" step="1"
              hint="Given when a buyer reviews a delivered item. 0 = none."
              value={form.points_per_review ?? 0} onChange={(e) => set("points_per_review")(e.target.value)} disabled={readOnly} />
          </div>
        </Card>
      </div>

      <Card
        className="mt-5"
        title="Reward tiers"
        description="What points unlock. Each tier is a discount code that works only for shoppers with at least that many points; it shows on the Rewards page in this order."
        actions={!readOnly && <Btn size="sm" onClick={() => setEditing(blankTier())}><Plus className="h-3.5 w-3.5" /> Add tier</Btn>}
      >
        {coupons.loading ? (
          <Spinner className="h-5 w-5" />
        ) : tiers.length === 0 ? (
          <p className="text-sm text-ink-soft">No tiers yet — add one so points unlock something.</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl ring-1 ring-line">
            {tiers.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-petal text-magenta"><Gift className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{t.required_points} points → {t.reward_label || tierReward(t)}</p>
                  <p className="text-xs text-ink-soft">Code <span className="font-mono">{t.code}</span> · {tierReward(t)}</p>
                </div>
                {t.is_active ? <Pill tone="green">On</Pill> : <Pill tone="grey">Off</Pill>}
                {!readOnly && (
                  <span className="flex gap-1">
                    <Btn size="sm" variant="ghost" onClick={() => setEditing({ ...t })} aria-label="Edit tier"><Pencil className="h-3.5 w-3.5" /></Btn>
                    <Btn size="sm" variant="ghost" onClick={() => setDeleting(t)} aria-label="Delete tier"><Trash2 className="h-3.5 w-3.5" /></Btn>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-5" title="Rewards page wording" description="Headline, intro, sign-in message, extra ways to earn, button and the message shown while the programme is off.">
        <a href="/admin/content/page.rewards" className="text-sm font-semibold text-magenta hover:underline">Edit the Rewards page text →</a>
      </Card>

      {!readOnly && <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={() => setForm(original)} />}

      {editing && (
        <TierModal
          tier={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); coupons.reload(); }}
        />
      )}
      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete this tier?"
        body={`Code ${deleting?.code} will be removed. If shoppers already used it, it can't be deleted — switch it off instead.`}
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          const { error: e } = await deleteCoupon(deleting.id);
          setDeleting(null);
          if (e) setError(e.message);
          else coupons.reload();
        }}
      />
    </>
  );
}

function blankTier() {
  return { code: "", required_points: 50, kind: "percent", value_percent: 5, value_minor: null, also_free_shipping: false, reward_label: "", is_active: true, is_public: true };
}

function TierModal({ tier, onClose, onSaved }) {
  const [f, setF] = useState(tier);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  async function save() {
    setError(null);
    const code = String(f.code ?? "").trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,30}$/.test(code)) return setError("Code: 3–30 letters, numbers, - or _.");
    const points = Math.round(Number(f.required_points));
    if (!(points > 0)) return setError("Points needed must be above zero.");
    if (f.kind === "percent" && !(Number(f.value_percent) > 0 && Number(f.value_percent) <= 100)) return setError("Enter a percentage between 1 and 100.");
    if (f.kind === "fixed" && !(f.value_minor > 0)) return setError("Enter an amount above zero.");
    setBusy(true);
    const { error: e } = await saveCoupon({
      id: f.id,
      code,
      required_points: points,
      kind: f.kind,
      value_percent: f.kind === "percent" ? Number(f.value_percent) : null,
      value_minor: f.kind === "fixed" ? f.value_minor : null,
      also_free_shipping: f.kind === "free_shipping" ? false : !!f.also_free_shipping,
      reward_label: f.reward_label?.trim() || null,
      is_active: !!f.is_active,
      // Reward codes are listed for members who have earned them.
      is_public: true,
    });
    setBusy(false);
    if (e) setError(e.message?.includes("duplicate") ? "That code is already used by another coupon." : e.message);
    else onSaved();
  }

  return (
    <Modal open onClose={onClose} title={f.id ? "Edit reward tier" : "New reward tier"}
      footer={<><Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn><Btn size="sm" loading={busy} onClick={save}>Save tier</Btn></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Points needed" type="number" min="1" value={f.required_points ?? ""} onChange={(e) => set("required_points")(e.target.value)} />
        <TextField label="Code" hint="What shoppers type at checkout" value={f.code ?? ""} onChange={(e) => set("code")(e.target.value.toUpperCase())} maxLength={30} />
        <SelectField label="Reward" value={f.kind} onChange={(e) => set("kind")(e.target.value)} options={DISCOUNT_KINDS} />
        {f.kind === "percent" && (
          <TextField label="Percent off" type="number" min="1" max="100" value={f.value_percent ?? ""} onChange={(e) => set("value_percent")(e.target.value)} />
        )}
        {f.kind === "fixed" && (
          <MoneyField label="Amount off" valueMinor={f.value_minor} onChangeMinor={set("value_minor")} />
        )}
        {f.kind !== "free_shipping" && (
          <div className="sm:col-span-2"><Toggle label="Also free shipping" checked={!!f.also_free_shipping} onChange={set("also_free_shipping")} /></div>
        )}
        <TextField className="sm:col-span-2" label="How it's described to shoppers" hint="Optional, e.g. “Free shipping + 8% off”. Blank = written automatically."
          value={f.reward_label ?? ""} onChange={(e) => set("reward_label")(e.target.value)} maxLength={60} />
        <div className="sm:col-span-2"><Toggle label="Tier is on" checked={!!f.is_active} onChange={set("is_active")} /></div>
      </div>
      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}
    </Modal>
  );
}
