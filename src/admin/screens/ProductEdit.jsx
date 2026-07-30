/* =================================================================== *
 * skin.script admin — product editor
 * -------------------------------------------------------------------
 * Tabbed, because a single 20-field form is where clients give up. The
 * form writes base facts only: price, compare-at, stock threshold, status.
 * Everything the storefront shows as a badge — on sale, discount %, low
 * stock, best seller — is derived by the products_public view from these,
 * which is why the two can never disagree.
 *
 * Stock is the exception: it never moves through this form's Save. It goes
 * through adjust_stock(), which writes the ledger entry and the balance in
 * one transaction.
 * =================================================================== */
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ExternalLink, History } from "lucide-react";
import {
  adjustStock, archiveProduct, createProduct, getProduct, listBrands,
  listCategories, listStockMovements, setStock, slugify, updateProduct,
} from "../../lib/api/admin/catalog.js";
import { useAdmin } from "../context.js";
import { adminNavigate } from "../AdminApp.jsx";
import ImageManager from "../components/ImageManager.jsx";
import {
  Btn, Card, ConfirmModal, Modal, MoneyField, PageHeader, Pill, SaveBar,
  SelectField, Spinner, StockPill, TagsField, TextField, Toggle, money, useAsync,
} from "../components/kit.jsx";

const TABS = ["Details", "Pricing", "Inventory", "Attributes", "Images", "SEO"];

const BLANK = {
  name: "", brand: "", slug: "", subtitle: "", description: "", how_to_use: "",
  category_id: "", price_minor: null, compare_at_minor: null, cost_minor: null,
  sku: "", low_stock_at: 5, max_per_order: 6, backorder_ok: false,
  status: "draft", is_new: false, popularity: 50, tone: "pink",
  concern: [], skin_type: [], ingredients: [], seo_title: "", seo_description: "",
  rating: 4.8, review_count: 0,
};

const TONES = ["pink", "rose", "cyan", "sky", "gold", "peach", "lilac", "sage"];
const SKIN_TYPES = ["Normal", "Dry", "Oily", "Combination", "Sensitive"];

export default function ProductEdit({ id }) {
  const isNew = id === "new";
  const { can } = useAdmin();
  const readOnly = !can("admin");

  const [tab, setTab] = useState("Details");
  const [form, setForm] = useState(isNew ? BLANK : null);
  const [original, setOriginal] = useState(isNew ? BLANK : null);
  const [images, setImages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [stockModal, setStockModal] = useState(false);
  const [productId, setProductId] = useState(isNew ? null : id);
  const [stock, setStockValue] = useState(0);

  const categories = useAsync(() => listCategories(), []);
  const brands = useAsync(() => listBrands(), []);

  const load = async () => {
    if (isNew) return;
    const { data, error } = await getProduct(id);
    if (error) return setError(error.message);
    if (!data) return setError("This product no longer exists.");
    const { product_images, stock: s, ...rest } = data;
    setForm(rest);
    setOriginal(rest);
    setImages(product_images ?? []);
    setStockValue(s ?? 0);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const dirty = useMemo(
    () => form && original && JSON.stringify(form) !== JSON.stringify(original),
    [form, original]
  );

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const setInput = (key) => (e) => set(key)(e.target.value);

  const discountPct = form?.compare_at_minor > form?.price_minor
    ? Math.round((1 - form.price_minor / form.compare_at_minor) * 100)
    : 0;

  async function handleSave() {
    setSaving(true); setError(null);

    if (!form.name?.trim()) { setSaving(false); setTab("Details"); return setError("A product needs a name."); }
    if (form.price_minor == null) { setSaving(false); setTab("Pricing"); return setError("A product needs a price."); }

    const payload = { ...form, slug: form.slug || slugify(`${form.brand}-${form.name}`) };

    const { data, error } = isNew
      ? await createProduct(payload)
      : await updateProduct(productId, payload, { previousSlug: original.slug });

    setSaving(false);
    if (error) return setError(error.message);

    setOriginal(data);
    setForm(data);
    if (isNew) {
      setProductId(data.id);
      // Replace rather than push: going Back from a freshly created product
      // should not land on the "new product" form again.
      window.history.replaceState({}, "", `/admin/products/${data.id}`);
      adminNavigate(`/admin/products/${data.id}`);
    }
  }

  if (error && !form) {
    return (
      <div className="rounded-2xl bg-white p-10 text-center ring-1 ring-line">
        <p className="text-sm text-red-600">{error}</p>
        <Btn variant="secondary" className="mt-4" onClick={() => adminNavigate("/admin/products")}>Back to products</Btn>
      </div>
    );
  }
  if (!form) return <div className="grid place-items-center py-24"><Spinner className="h-7 w-7" /></div>;

  return (
    <>
      <PageHeader
        back={
          <button onClick={() => adminNavigate("/admin/products")} className="mb-2 flex items-center gap-1 text-xs text-ink-soft hover:text-magenta">
            <ArrowLeft className="h-3.5 w-3.5" /> Products
          </button>
        }
        title={isNew ? "New product" : form.name || "Untitled product"}
        subtitle={isNew ? "Fill in the details, then save. It stays a draft until you publish it." : form.brand}
        actions={
          <>
            {!isNew && form.status === "active" && (
              <Btn variant="secondary" size="sm"
                onClick={() => window.open(`/product/${form.slug}`, "_blank")}>
                <ExternalLink className="h-3.5 w-3.5" /> View on store
              </Btn>
            )}
            {!isNew && !readOnly && form.status !== "archived" && (
              <Btn variant="secondary" size="sm" onClick={() => setArchiveOpen(true)}>Archive</Btn>
            )}
          </>
        }
      />

      {/* Status + stock summary, always visible regardless of tab — these are
          the two things a client checks most and shouldn't have to hunt for. */}
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl bg-white px-5 py-3 ring-1 ring-line">
        <SelectField value={form.status} onChange={setInput("status")} className="w-40" disabled={readOnly}
          options={[{ id: "draft", label: "Draft" }, { id: "active", label: "Published" }, { id: "archived", label: "Archived" }]} />
        {!isNew && <StockPill stock={stock} lowAt={form.low_stock_at} />}
        {discountPct > 0 && <Pill tone="magenta">{discountPct}% off</Pill>}
        {form.is_new && <Pill tone="sky">New</Pill>}
      </div>

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            disabled={isNew && (t === "Images" || t === "Inventory")}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm transition-colors disabled:opacity-40 ${
              tab === t ? "border-magenta font-medium text-magenta" : "border-transparent text-ink-soft hover:text-ink"
            }`}>
            {t}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}

      {tab === "Details" && (
        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Product name" required value={form.name} onChange={setInput("name")} disabled={readOnly} className="sm:col-span-2" />
            <div>
              <TextField label="Brand" value={form.brand ?? ""} onChange={setInput("brand")} list="brand-options" disabled={readOnly} />
              <datalist id="brand-options">{(brands.data ?? []).map((b) => <option key={b} value={b} />)}</datalist>
            </div>
            <SelectField label="Category" value={form.category_id ?? ""} onChange={setInput("category_id")}
              placeholder="Choose a category" options={categories.data ?? []} disabled={readOnly} />
            <TextField label="Web address" hint="The /product/… link" value={form.slug ?? ""}
              onChange={setInput("slug")} disabled={readOnly}
              placeholder={slugify(`${form.brand}-${form.name}`)} className="sm:col-span-2" />
            {!isNew && form.slug !== original.slug && (
              <p className="sm:col-span-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Changing the web address keeps the old one working — visitors on the old link are forwarded automatically.
              </p>
            )}
            <TextField label="Short subtitle" value={form.subtitle ?? ""} onChange={setInput("subtitle")} disabled={readOnly} className="sm:col-span-2" />
            <TextField as="textarea" label="Description" value={form.description ?? ""} onChange={setInput("description")} disabled={readOnly} className="sm:col-span-2" />
            <TextField as="textarea" label="How to use" value={form.how_to_use ?? ""} onChange={setInput("how_to_use")} disabled={readOnly} className="sm:col-span-2" />
          </div>
        </Card>
      )}

      {tab === "Pricing" && (
        <Card description="Set a “compare at” price higher than the selling price to show a strike-through and a discount badge on the storefront.">
          <div className="grid gap-4 sm:grid-cols-2">
            <MoneyField label="Selling price" required valueMinor={form.price_minor} onChangeMinor={set("price_minor")} />
            <MoneyField label="Compare at" hint="Optional — the “was” price" valueMinor={form.compare_at_minor} onChangeMinor={set("compare_at_minor")} />
            <MoneyField label="Cost per item" hint="Private — never shown to shoppers" valueMinor={form.cost_minor} onChangeMinor={set("cost_minor")} />
            <TextField label="SKU" value={form.sku ?? ""} onChange={setInput("sku")} disabled={readOnly} />
          </div>

          {discountPct > 0 && (
            <div className="mt-4 rounded-xl bg-petal px-4 py-3 text-sm text-magenta-deep">
              Shoppers will see <strong>{money(form.price_minor)}</strong>{" "}
              <span className="line-through opacity-60">{money(form.compare_at_minor)}</span>{" "}
              with a <strong>{discountPct}% off</strong> badge.
              {form.cost_minor > 0 && (
                <span className="ml-2 text-ink-soft">
                  Margin: {money(form.price_minor - form.cost_minor)}
                </span>
              )}
            </div>
          )}
          {form.compare_at_minor != null && form.compare_at_minor <= form.price_minor && (
            <p className="mt-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">
              “Compare at” must be higher than the selling price, or the store will reject this.
            </p>
          )}
        </Card>
      )}

      {tab === "Inventory" && !isNew && (
        <InventoryTab
          productId={productId} stock={stock} form={form} readOnly={readOnly}
          onSetField={set} onOpenStock={() => setStockModal(true)}
        />
      )}

      {tab === "Attributes" && (
        <Card description="These power the storefront filters. Use the same wording as your other products so the filter lists stay tidy.">
          <div className="grid gap-4 sm:grid-cols-2">
            <TagsField label="Skin concerns" value={form.concern} onChange={set("concern")}
              hint="e.g. Hydration, Acne & Blemishes" />
            <TagsField label="Skin types" value={form.skin_type} onChange={set("skin_type")} suggestions={SKIN_TYPES} />
            <TagsField label="Key ingredients" value={form.ingredients} onChange={set("ingredients")} className="sm:col-span-2" />
            <SelectField label="Card colour" hint="Used when there's no photo" value={form.tone ?? "pink"}
              onChange={setInput("tone")} options={TONES} disabled={readOnly} />
            <TextField label="Featured ranking" type="number" min="0" max="100" hint="0–100. Higher shows earlier."
              value={form.popularity ?? 50} onChange={(e) => set("popularity")(Number(e.target.value))} disabled={readOnly} />
            <div className="sm:col-span-2">
              <Toggle label="Mark as new" hint="Adds a “New” badge and includes it in the Newest sort."
                checked={form.is_new} onChange={set("is_new")} disabled={readOnly} />
            </div>

            {/* Editable for now because reviews still live in the browser's
                localStorage — there's no reviews table for the database to
                aggregate. Once there is, these become derived and read-only. */}
            <div className="sm:col-span-2 mt-2 rounded-xl bg-snow p-4">
              <p className="mb-3 text-xs font-medium text-ink">Star rating</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Rating out of 5" type="number" min="0" max="5" step="0.1"
                  value={form.rating ?? ""} onChange={(e) => set("rating")(Number(e.target.value))} disabled={readOnly} />
                <TextField label="Number of reviews" type="number" min="0"
                  value={form.review_count ?? 0} onChange={(e) => set("review_count")(Number(e.target.value))} disabled={readOnly} />
              </div>
              <p className="mt-2 text-[11px] text-ink-soft">
                Shown on the product card and product page. These are set by hand today — once customer
                reviews are stored in the database they'll be calculated automatically.
              </p>
            </div>
          </div>
        </Card>
      )}

      {tab === "Images" && !isNew && (
        <Card title="Photos" description="Drag to upload. The first image is the one shoppers see first.">
          <ImageManager productId={productId} images={images} disabled={readOnly} onChange={load} />
        </Card>
      )}

      {tab === "SEO" && (
        <Card description="How this product appears in Google results.">
          <div className="grid gap-4">
            <TextField label="Page title" hint={`${(form.seo_title ?? "").length}/60`} maxLength={60}
              value={form.seo_title ?? ""} onChange={setInput("seo_title")} disabled={readOnly} />
            <TextField as="textarea" label="Search description" maxLength={160}
              hint={`${(form.seo_description ?? "").length}/160`}
              value={form.seo_description ?? ""} onChange={setInput("seo_description")} disabled={readOnly} />
          </div>
          <div className="mt-5 rounded-xl bg-snow p-4">
            <p className="text-xs text-ink-soft">Preview</p>
            <p className="mt-1 truncate text-[15px] text-blue-800">{form.seo_title || form.name || "Product name"}</p>
            <p className="text-xs text-emerald-700">skin.script › product › {form.slug || slugify(form.name)}</p>
            <p className="mt-0.5 line-clamp-2 text-xs text-ink-soft">
              {form.seo_description || form.subtitle || form.description || "Add a search description."}
            </p>
          </div>
        </Card>
      )}

      {!readOnly && (
        <SaveBar dirty={dirty} saving={saving} onSave={handleSave} onDiscard={() => setForm(original)}
          message={isNew ? "Save to create this product." : "You have unsaved changes."} />
      )}

      <ConfirmModal
        open={archiveOpen} onClose={() => setArchiveOpen(false)} danger
        title="Archive this product?" confirmLabel="Archive"
        body="It will be removed from the storefront immediately. Past orders keep it, and you can republish at any time — nothing is deleted."
        onConfirm={async () => { await archiveProduct(productId); adminNavigate("/admin/products"); }}
      />

      <StockModal
        open={stockModal} onClose={() => setStockModal(false)} current={stock}
        onApply={async (next, note) => {
          const { error } = await setStock(productId, stock, next, note);
          if (!error) setStockValue(next);
          setStockModal(false);
        }}
      />
    </>
  );
}

function InventoryTab({ productId, stock, form, readOnly, onSetField, onOpenStock }) {
  const movements = useAsync(() => listStockMovements(productId), [productId, stock]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Stock on hand">
        <div className="flex items-end justify-between">
          <div>
            <p className="font-serif text-4xl text-ink">{stock}</p>
            <p className="text-xs text-ink-soft">units available to sell</p>
          </div>
          {!readOnly && <Btn size="sm" onClick={onOpenStock}>Adjust stock</Btn>}
        </div>

        <div className="mt-6 grid gap-4">
          <TextField label="Warn me below" type="number" min="0" value={form.low_stock_at ?? 5}
            onChange={(e) => onSetField("low_stock_at")(Number(e.target.value))} disabled={readOnly}
            hint="Shows the “Only a few left” badge" />
          <TextField label="Max per order" type="number" min="1" value={form.max_per_order ?? 6}
            onChange={(e) => onSetField("max_per_order")(Number(e.target.value))} disabled={readOnly} />
          <Toggle label="Allow backorders" hint="Keep selling after stock hits zero."
            checked={form.backorder_ok} onChange={onSetField("backorder_ok")} disabled={readOnly} />
        </div>
      </Card>

      <Card title="Stock history" description="Every change, and why." actions={<History className="h-4 w-4 text-ink-soft" />}>
        {movements.loading ? (
          <Spinner />
        ) : !movements.data?.length ? (
          <p className="py-6 text-center text-sm text-ink-soft">No movements recorded yet.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {movements.data.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="capitalize text-ink">{m.reason}</p>
                  {m.note && <p className="truncate text-xs text-ink-soft">{m.note}</p>}
                </div>
                <div className="text-right">
                  <span className={`font-medium ${m.delta > 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {m.delta > 0 ? "+" : ""}{m.delta}
                  </span>
                  <p className="text-[11px] text-ink-soft">{new Date(m.created_at).toLocaleDateString()}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function StockModal({ open, onClose, current, onApply }) {
  const [mode, setMode] = useState("add");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const next = mode === "set" ? Number(amount || 0) : current + Number(amount || 0);

  return (
    <Modal open={open} onClose={onClose} title="Adjust stock"
      footer={
        <>
          <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn size="sm" loading={busy} disabled={amount === "" || next < 0}
            onClick={async () => { setBusy(true); await onApply(next, note || null); setBusy(false); setAmount(""); setNote(""); }}>
            Apply
          </Btn>
        </>
      }>
      <div className="space-y-4">
        <SelectField label="What happened" value={mode} onChange={(e) => setMode(e.target.value)}
          options={[
            { id: "add", label: "Received new stock" },
            { id: "set", label: "Counted the shelf — set exact number" },
          ]} />
        <TextField label={mode === "set" ? "Actual count" : "Units received"} type="number"
          value={amount} onChange={(e) => setAmount(e.target.value)} />
        <TextField label="Note" hint="Optional — helps when reviewing history later"
          value={note} onChange={(e) => setNote(e.target.value)} />
        <p className="rounded-lg bg-snow px-3 py-2 text-xs text-ink-soft">
          Stock will go from <strong>{current}</strong> to <strong>{next}</strong>.
          {next < 0 && <span className="ml-1 text-red-600">Stock can’t go below zero.</span>}
        </p>
      </div>
    </Modal>
  );
}
