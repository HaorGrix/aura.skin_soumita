/* =================================================================== *
 * skin.theory admin — store settings
 * -------------------------------------------------------------------
 * Replaces the hardcoded constants in lib/shop-config.js. Changing the
 * free-shipping threshold or a shipping rate here is a database write, not
 * a rebuild — which is the whole point of the panel.
 * =================================================================== */
import { useEffect, useMemo, useState } from "react";
import { getSettings, saveSettings } from "../../lib/api/admin/settings.js";
import {
  Card, MoneyField, PageHeader, SaveBar, Spinner, TextField, Toggle,
  toLocalInputValue, toUtcIso,
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

  const pixelIdError = useMemo(() => {
    const id = form?.meta_pixel_id?.trim();
    if (!id) return null;
    return /^\d{6,20}$/.test(id) ? null : "Must be a numeric ID (digits only, 6-20 characters).";
  }, [form?.meta_pixel_id]);

  async function handleSave() {
    if (pixelIdError) return setError(pixelIdError);
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
        <Card title="Shipping" description="Applies across every delivery method — per-method/zone prices live under Shipping in the sidebar.">
          <div className="grid gap-4">
            <MoneyField label="Free shipping over" hint="Set to 0 to always charge shipping"
              valueMinor={form.free_shipping_threshold_minor} onChangeMinor={set("free_shipping_threshold_minor")} />
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

        <Card title="Contact details" description="Store name is used site-wide. Support email/phone here are used only as the fallback contact mention in the legal pages (Privacy, Terms, Cookies, Shipping & Returns) — the Contact page's own Email/Phone/Social/Hours/Address cards are edited separately under Content → Contact Page.">
          <div className="grid gap-4">
            <TextField label="Store name" value={form.store_name ?? ""} onChange={setInput("store_name")} />
            <TextField label="Support email" type="email" hint="Fallback contact mention on legal pages only — not the Contact page." value={form.support_email ?? ""} onChange={setInput("support_email")} />
            <TextField label="Support phone" hint="Fallback contact mention on legal pages only — not the Contact page." value={form.support_phone ?? ""} onChange={setInput("support_phone")} />
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

        <Card title="Announcement bar" description="The strip shown above the header on every page.">
          <div className="grid gap-4">
            <Toggle label="Show announcement bar"
              checked={form.announcement_enabled} onChange={set("announcement_enabled")} />
            <TextField label="Announcement text" value={form.announcement_text ?? ""}
              onChange={setInput("announcement_text")}
              hint="Keep it to one short line — it's shown centered in a slim strip." />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Link label (optional)" value={form.announcement_link_label ?? ""}
                onChange={setInput("announcement_link_label")}
                hint="Shown after the text, e.g. Shop now. Leave both link fields blank for plain, unclickable text." />
              <TextField label="Link target (optional)" value={form.announcement_link_href ?? ""}
                onChange={setInput("announcement_link_href")}
                hint="A page on this site (/shop) or a full https:// URL." />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Show from (optional)" type="datetime-local" hint="Your local time. Leave blank to show as soon as it's on."
                value={toLocalInputValue(form.announcement_starts_at)}
                onChange={(e) => set("announcement_starts_at")(toUtcIso(e.target.value))} />
              <TextField label="Hide after (optional)" type="datetime-local" hint="Your local time. Leave blank to show indefinitely."
                value={toLocalInputValue(form.announcement_ends_at)}
                onChange={(e) => set("announcement_ends_at")(toUtcIso(e.target.value))} />
            </div>
          </div>
        </Card>

        <Card title="Meta Pixel" description="Enables Facebook/Instagram ad tracking and retargeting.">
          <div className="grid gap-4">
            <Toggle label="Enable pixel tracking"
              hint="Off means the base pixel never loads, even if an ID is saved below."
              checked={form.meta_pixel_enabled} onChange={set("meta_pixel_enabled")} />
            <TextField label="Pixel ID" value={form.meta_pixel_id ?? ""} onChange={setInput("meta_pixel_id")}
              hint="Numeric ID from Meta Events Manager, e.g. 123456789012345."
              error={pixelIdError} />
          </div>
        </Card>
      </div>

      <SaveBar dirty={dirty} saving={saving} onSave={handleSave} onDiscard={() => setForm(original)} />
    </>
  );
}
