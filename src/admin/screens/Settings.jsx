/* =================================================================== *
 * skin.script admin — store settings
 * -------------------------------------------------------------------
 * Replaces the hardcoded constants in lib/shop-config.js. Changing the
 * free-shipping threshold or a shipping rate here is a database write, not
 * a rebuild — which is the whole point of the panel.
 * =================================================================== */
import { useEffect, useMemo, useState } from "react";
import { getSettings, saveSettings } from "../../lib/api/admin/settings.js";
import {
  Card, MoneyField, PageHeader, SaveBar, Spinner, TextField, Toggle,
} from "../components/kit.jsx";

export default function Settings() {
  const [form, setForm] = useState(null);
  const [original, setOriginal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    getSettings().then(({ data, error }) => {
      if (error) return setError(error.message);
      setForm(data); setOriginal(data);
    });
  }, []);

  const dirty = useMemo(
    () => form && original && JSON.stringify(form) !== JSON.stringify(original),
    [form, original]
  );
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const setInput = (k) => (e) => set(k)(e.target.value);

  async function handleSave() {
    setSaving(true); setError(null); setNotice(null);
    const { data, error } = await saveSettings(form);
    setSaving(false);
    if (error) return setError(error.message);
    setOriginal(data); setForm(data);
    setNotice("Settings saved.");
  }

  if (error && !form) return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>;
  if (!form) return <div className="grid place-items-center py-24"><Spinner className="h-7 w-7" /></div>;

  return (
    <>
      <PageHeader title="Store settings" subtitle="Commercial rules that apply across the whole store." />

      {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}
      {notice && <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">{notice}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Shipping" description="What customers pay for delivery.">
          <div className="grid gap-4">
            <MoneyField label="Free shipping over" hint="Set to 0 to always charge shipping"
              valueMinor={form.free_shipping_threshold_minor} onChangeMinor={set("free_shipping_threshold_minor")} />
            <MoneyField label="Standard shipping" valueMinor={form.standard_shipping_minor} onChangeMinor={set("standard_shipping_minor")} />
            <MoneyField label="Express shipping" valueMinor={form.express_shipping_minor} onChangeMinor={set("express_shipping_minor")} />
          </div>
        </Card>

        <Card title="Tax & currency">
          <div className="grid gap-4">
            <TextField label="Tax rate" type="number" step="0.0001" min="0" max="1"
              hint="As a decimal — 0.05 means 5%. Use 0 for tax-inclusive pricing."
              value={form.tax_rate ?? 0} onChange={(e) => set("tax_rate")(Number(e.target.value))} />
            <TextField label="Currency code" value={form.currency_code ?? ""} onChange={setInput("currency_code")} />
            <TextField label="Currency symbol" value={form.currency_symbol ?? ""} onChange={setInput("currency_symbol")} />
          </div>
        </Card>

        <Card title="Loyalty" description="How customers earn points.">
          <div className="grid gap-4">
            <TextField label="Points per taka spent" type="number" step="0.001"
              hint="0.01 means 1 point per ৳100"
              value={form.points_per_taka ?? 0} onChange={(e) => set("points_per_taka")(Number(e.target.value))} />
            <TextField label="Points per review" type="number" min="0"
              value={form.points_per_review ?? 0} onChange={(e) => set("points_per_review")(Number(e.target.value))} />
          </div>
        </Card>

        <Card title="Contact details" description="Shown on the Contact page and in the footer.">
          <div className="grid gap-4">
            <TextField label="Store name" value={form.store_name ?? ""} onChange={setInput("store_name")} />
            <TextField label="Support email" type="email" value={form.support_email ?? ""} onChange={setInput("support_email")} />
            <TextField label="Support phone" value={form.support_phone ?? ""} onChange={setInput("support_phone")} />
          </div>
        </Card>

        <Card title="Inventory defaults">
          <TextField label="Warn when stock falls below" type="number" min="0"
            hint="Applies to new products. Existing ones keep their own threshold."
            value={form.low_stock_threshold ?? 5} onChange={(e) => set("low_stock_threshold")(Number(e.target.value))} />
        </Card>

        <Card title="Store status">
          <Toggle label="Maintenance mode"
            hint="Puts the storefront behind a holding page. Your admin panel stays reachable."
            checked={form.maintenance_mode} onChange={set("maintenance_mode")} />
          {form.maintenance_mode && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Shoppers can't browse or order while this is on.
            </p>
          )}
        </Card>
      </div>

      <SaveBar dirty={dirty} saving={saving} onSave={handleSave} onDiscard={() => setForm(original)} />
    </>
  );
}
