/* =================================================================== *
 * skin.theory admin — product editor
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
import { ArrowLeft, ExternalLink, History, Plus, Star, Trash2 } from "lucide-react";
import {
  adjustStock, archiveProduct, createProduct, deleteProduct, deleteVariant,
  getProduct, listBrandRows, categoryOptions, listCategoryTree, listStockMovements,
  listVariants, setStock, setVariantStock, slugify, updateProduct, upsertBrand, upsertVariant,
} from "../../lib/api/admin/catalog.js";
import { useAdmin } from "../context.js";
import { adminNavigate } from "../AdminApp.jsx";
import { useStoreSettings } from "../../lib/api/settings.js";
import ImageManager, { VideoField } from "../components/ImageManager.jsx";
import {
  Btn, Card, ConfirmModal, Modal, MoneyField, MultiSelectField, PageHeader, Pill, SaveBar,
  SearchableCreatableSelect, SelectField, Spinner, StockPill, TagsField, TextField, Toggle, money, useAsync,
} from "../components/kit.jsx";

const TABS = ["Details", "Pricing", "Variants", "Inventory", "Attributes", "Images", "SEO"];

const BLANK = {
  name: "", brand: "", brand_id: null, slug: "", subtitle: "", description: "", how_to_use: "",
  category_id: "", price_minor: null, compare_at_minor: null, cost_minor: null,
  sku: "", low_stock_at: 5, max_per_order: 6, backorder_ok: false,
  status: "draft", is_new: false, popularity: 50, tone: "pink",
  concern: [], skin_type: [], ingredients: [], seo_title: "", seo_description: "",
  rating: 4.8, review_count: 0,
  is_staff_pick: false, is_limited_edition: false, is_best_seller_manual: false,
};

const TONES = ["pink", "rose", "cyan", "sky", "gold", "peach", "lilac", "sage"];
const SKIN_TYPES = ["Normal", "Dry", "Oily", "Combination", "Sensitive", "All Skin Types"];

export default function ProductEdit({ id }) {
  const isNew = id === "new";
  const { can } = useAdmin();
  const { storeName } = useStoreSettings();
  const readOnly = !can("admin");
  // Explicit client decision: delete is open to Editor and up, same as
  // every other staff-facing admin action here — not gated above the
  // normal edit boundary. The type-the-exact-name confirmation below is
  // what actually protects against an accidental delete, not the role.
  const canDelete = can("editor");

  // Deep-link into a specific tab — used by the Products list's variant rows
  // (?tab=variants) so clicking a size opens straight into the tab that
  // actually edits sizes, instead of always landing on Details. Independent
  // of AdminApp's route parsing (which only reads the pathname): the query
  // string still rides along in the URL from adminNavigate(), this just
  // reads it directly for the one-time initial tab.
  const [tab, setTab] = useState(() =>
    new URLSearchParams(window.location.search).get("tab") === "variants" ? "Variants" : "Details"
  );
  const [form, setForm] = useState(isNew ? BLANK : null);
  const [original, setOriginal] = useState(isNew ? BLANK : null);
  const [images, setImages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [stockModal, setStockModal] = useState(false);
  const [productId, setProductId] = useState(isNew ? null : id);
  const [stock, setStockValue] = useState(0);
  // Starting stock for a NEW product only — never part of `form`/WRITABLE,
  // since stock is ledger-backed everywhere else (adjust_stock(), never a
  // raw column write). Applied as one "restock" movement right after
  // createProduct() succeeds, in handleSave() below. Empty string, not 0,
  // so an admin who leaves it blank doesn't read as "explicitly set to
  // zero" in the stock history.
  const [initialStock, setInitialStock] = useState("");
  const [variants, setVariants] = useState([]);

  // The same tree the storefront's mega menu renders from, so whatever is
  // picked here lines up with the shop filters automatically — no SQL, and no
  // second list to keep in step.
  const categories = useAsync(() => listCategoryTree(), []);
  const brands = useAsync(() => listBrandRows(), []);

  /** Create a brand inline from the picker and refresh the option list so
   *  it's there immediately — for THIS form (selecting it) and for anyone
   *  who opens the Brands screen right after. */
  async function handleCreateBrand(name) {
    const { data, error } = await upsertBrand({ name });
    if (error) return { error };
    brands.reload();
    return { id: data.id, name: data.name };
  }

  // Whether this product has more than one size. Once it does, the price
  // and stock shown on the Pricing/Inventory tabs are only ONE of several —
  // editing them there would look like it changes "the" price while
  // silently leaving every other size at its old value. Those tabs disable
  // themselves and point to Variants instead; see the render below.
  const hasMultipleVariants = variants.length > 1;

  const loadVariants = async () => {
    if (isNew) return;
    const { data } = await listVariants(id);
    setVariants(data ?? []);
  };

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
    await loadVariants();
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
    // Without this, an empty category_id ("") reaches Postgres as-is and
    // fails with "invalid input syntax for type uuid: ''" — a raw DB error
    // shown to the admin instead of a plain-English reason to fix it.
    if (!form.category_id) { setSaving(false); setTab("Details"); return setError("Category is required."); }
    if (form.price_minor == null) { setSaving(false); setTab("Pricing"); return setError("A product needs a price."); }

    const payload = { ...form, slug: form.slug || slugify(`${form.brand}-${form.name}`) };

    const { data, error } = isNew
      ? await createProduct(payload)
      : await updateProduct(productId, payload, { previousSlug: original.slug });

    if (error) { setSaving(false); return setError(error.message); }

    // Starting stock, applied as a real ledger movement right after the
    // product exists — same adjust_stock() path the Inventory tab's "Adjust
    // stock" uses, just triggered automatically instead of requiring a
    // separate trip back into this same product. A failure here shouldn't
    // hide that the PRODUCT itself saved fine (it did) — surfaced as its
    // own message, product left open on the (now-unlocked) Inventory tab
    // rather than blocking navigation.
    const startingStock = isNew && initialStock !== "" ? Number(initialStock) : 0;
    let stockError = null;
    if (startingStock > 0) {
      const { error: stockErr } = await adjustStock(data.id, startingStock, "restock", "Starting stock at creation");
      stockError = stockErr;
    }

    setSaving(false);
    setOriginal(data);
    setForm(data);
    if (isNew) {
      setProductId(data.id);
      setStockValue(stockError ? 0 : startingStock);
      // Replace rather than push: going Back from a freshly created product
      // should not land on the "new product" form again.
      adminNavigate(`/admin/products/${data.id}`, { replace: true });
      if (stockError) {
        setTab("Inventory");
        setError(`Product saved, but starting stock couldn't be set: ${stockError.message}. Set it from the Inventory tab.`);
      } else {
        // Everything fillable pre-save (Details, Pricing, Attributes, SEO,
        // stock) is done — Images is genuinely the only thing that COULDN'T
        // happen until this product had a real id, so it's the natural next
        // stop rather than leaving the admin on Pricing wondering what's
        // left. Landing here (not back on the product list) is what actually
        // saves the "reopen the product to add photos" round trip.
        setTab("Images");
      }
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
            {!isNew && canDelete && (
              <Btn variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Btn>
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
        {form.is_best_seller_manual && <Pill tone="magenta">Bestseller</Pill>}
        {form.is_staff_pick && <Pill tone="sky">Staff Pick</Pill>}
        {form.is_limited_edition && <Pill tone="sky">Limited Edition</Pill>}
      </div>

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            disabled={isNew && (t === "Images" || t === "Inventory" || t === "Variants")}
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
            <SearchableCreatableSelect
              label="Brand" required
              value={form.brand_id ?? null}
              options={brands.data ?? []}
              onChange={set("brand_id")}
              onCreate={handleCreateBrand}
              disabled={readOnly}
            />
            <SelectField
              label="Category" required
              hint="Grouped by section — pick the sub-category"
              value={form.category_id ?? ""} onChange={setInput("category_id")}
              placeholder="Choose a category"
              options={categoryOptions(categories.data)}
              disabled={readOnly}
            />
            <TextField label="Web address" hint="The /product/… link" value={form.slug ?? ""}
              onChange={setInput("slug")} disabled={readOnly}
              placeholder={slugify(`${form.brand}-${form.name}`)} className="sm:col-span-2" />
            {!isNew && form.slug !== original.slug && (
              <p className="sm:col-span-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Changing the web address keeps the old one working — visitors on the old link are forwarded automatically.
              </p>
            )}
            <TextField label="Short subtitle" value={form.subtitle ?? ""} onChange={setInput("subtitle")} disabled={readOnly} className="sm:col-span-2" />
            <TextField as="textarea" label="Description" hint="Shown on the product page as “The story.” Leave blank to show an auto-generated summary instead." value={form.description ?? ""} onChange={setInput("description")} disabled={readOnly} className="sm:col-span-2" />
            <TextField as="textarea" label="Brand philosophy" hint="Shown on the product page as “Our philosophy.” Leave blank to show the default philosophy blurb instead." value={form.philosophy ?? ""} onChange={setInput("philosophy")} disabled={readOnly} className="sm:col-span-2" />
            <TextField as="textarea" label="How to use" value={form.how_to_use ?? ""} onChange={setInput("how_to_use")} disabled={readOnly} className="sm:col-span-2" />
          </div>
        </Card>
      )}

      {tab === "Pricing" && (
        <Card description="Set a “compare at” price higher than the selling price to show a strike-through and a discount badge on the storefront.">
          {hasMultipleVariants && (
            <p className="mb-4 rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
              This product has {variants.length} sizes, each with its own price — edit them in the{" "}
              <button type="button" onClick={() => setTab("Variants")} className="font-semibold underline">Variants tab</button>{" "}
              instead. The fields below only ever reflect one size and would be misleading here.
            </p>
          )}
          {/* pointer-events-none was previously the ONLY thing blocking edits
              here for a multi-variant product — it stops mouse clicks but
              not keyboard focus+typing or any programmatic value set, so an
              admin could silently reprice the DEFAULT variant through a tab
              whose whole point is "don't edit price here, it's ambiguous
              which size you mean." Every field below now also carries a
              real `disabled`, same as SKU already had; the wrapper class
              stays for the uniform greyed-out look. */}
          <div className={`grid gap-4 sm:grid-cols-2 ${hasMultipleVariants ? "pointer-events-none opacity-50" : ""}`}>
            <MoneyField label="Selling price" required valueMinor={form.price_minor} onChangeMinor={set("price_minor")} disabled={readOnly || hasMultipleVariants} />
            <MoneyField label="Compare at" hint="Optional — the “was” price" valueMinor={form.compare_at_minor} onChangeMinor={set("compare_at_minor")} disabled={readOnly || hasMultipleVariants} />
            <MoneyField label="Cost per item" hint="Private — never shown to shoppers" valueMinor={form.cost_minor} onChangeMinor={set("cost_minor")} disabled={readOnly || hasMultipleVariants} />
            <TextField label="SKU" value={form.sku ?? ""} onChange={setInput("sku")} disabled={readOnly || hasMultipleVariants} />
            {/* New product only — stock is ledger-backed everywhere else
                (never a plain column write), so this doesn't set
                form.stock; Save applies it as one real "restock" movement
                right after the product row exists. An existing product
                keeps using the Inventory tab's "Adjust stock", which
                shows the full history this single number can't. */}
            {isNew && (
              <TextField
                label="Starting stock" type="number" min="0" step="1"
                hint="Optional — leave blank to start at 0 and stock it later"
                value={initialStock}
                onChange={(e) => setInitialStock(e.target.value)}
                disabled={readOnly}
              />
            )}
          </div>

          {!hasMultipleVariants && discountPct > 0 && (
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

      {/* New product only — these three are plain columns on `products`
          (WRITABLE, no ledger, no productId dependency), the same as
          Attributes/SEO below. They only ever lived on the Inventory tab
          because that's where they're grouped for an EXISTING product;
          nothing about them actually needs the product to exist yet, so
          gating them behind a save-then-reopen round trip was never load-
          bearing — unlike Stock on hand/history right below, which is a
          real ledger and genuinely can't exist before the product does. */}
      {tab === "Pricing" && isNew && (
        <Card className="mt-4" title="Inventory settings">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Warn me below" type="number" min="0" value={form.low_stock_at ?? 5}
              onChange={(e) => set("low_stock_at")(Number(e.target.value))} disabled={readOnly}
              hint="Shows the “Only a few left” badge" />
            <TextField label="Max per order" type="number" min="1" value={form.max_per_order ?? 6}
              onChange={(e) => set("max_per_order")(Number(e.target.value))} disabled={readOnly} />
          </div>
          <div className="mt-4">
            <Toggle label="Allow backorders" hint="Keep selling after stock hits zero."
              checked={form.backorder_ok} onChange={set("backorder_ok")} disabled={readOnly} />
          </div>
        </Card>
      )}

      {tab === "Variants" && !isNew && (
        <VariantsTab
          productId={productId} variants={variants} readOnly={readOnly}
          onReload={loadVariants} onProductReload={load}
        />
      )}

      {tab === "Inventory" && !isNew && (
        hasMultipleVariants ? (
          <Card title="Stock is per size now" description="This product has more than one size — each has its own stock count.">
            <p className="mb-4 text-sm text-ink-soft">
              Manage stock for each size in the Variants tab. The number shown at the top of this
              page is just the default size, kept for the storefront's product card.
            </p>
            <Btn size="sm" onClick={() => setTab("Variants")}>Go to Variants</Btn>
          </Card>
        ) : (
          <InventoryTab
            productId={productId} stock={stock} form={form} readOnly={readOnly}
            onSetField={set} onOpenStock={() => setStockModal(true)}
          />
        )
      )}

      {tab === "Attributes" && (
        <Card description="These power the storefront filters. Use the same wording as your other products so the filter lists stay tidy.">
          <div className="grid gap-4 sm:grid-cols-2">
            <TagsField label="Skin concerns" value={form.concern} onChange={set("concern")}
              hint="e.g. Hydration, Acne & Blemishes" />
            <MultiSelectField label="Skin types" hint="'All Skin Types' matches every skin-type filter on the storefront"
              value={form.skin_type} onChange={set("skin_type")} options={SKIN_TYPES} disabled={readOnly} />
            <TagsField label="Key ingredients" value={form.ingredients} onChange={set("ingredients")} className="sm:col-span-2" />
            <SelectField label="Card colour" hint="Used when there's no photo" value={form.tone ?? "pink"}
              onChange={setInput("tone")} options={TONES} disabled={readOnly} />
            <TextField label="Featured ranking" type="number" min="0" max="100" hint="0–100. Higher shows earlier."
              value={form.popularity ?? 50} onChange={(e) => set("popularity")(Number(e.target.value))} disabled={readOnly} />
            <div className="sm:col-span-2 rounded-xl bg-snow p-4">
              <p className="mb-1 text-xs font-medium text-ink">Badges</p>
              <p className="mb-3 text-[11px] text-ink-soft">
                Sale and the discount % badge are automatic from the price fields above — no toggle needed.
                Low Stock and Out of Stock are automatic from real inventory (Inventory tab) and can't be set
                by hand, so they aren't listed here.
              </p>
              <div className="grid gap-3">
                <Toggle label="Mark as new" hint="Adds a “New” badge and includes it in the Newest sort."
                  checked={form.is_new} onChange={set("is_new")} disabled={readOnly} />
                <Toggle label="Bestseller" hint="Adds the Bestseller badge even before this product has real sales. It still shows automatically once sales earn it — this can only add the badge, never hide it."
                  checked={form.is_best_seller_manual} onChange={set("is_best_seller_manual")} disabled={readOnly} />
                <Toggle label="Staff Pick" hint="Adds a Staff Pick badge on the storefront."
                  checked={form.is_staff_pick} onChange={set("is_staff_pick")} disabled={readOnly} />
                <Toggle label="Limited Edition" hint="Adds a Limited Edition badge on the storefront."
                  checked={form.is_limited_edition} onChange={set("is_limited_edition")} disabled={readOnly} />
              </div>
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
        <>
          <Card title="Photos" description="Drag to upload. The first image is the one shoppers see first.">
            <ImageManager productId={productId} images={images} disabled={readOnly} onChange={load} />
          </Card>
          <Card
            className="mt-4"
            title="Video"
            description="Optional. Shows as a Photos | Video toggle on the product page, same as the gallery photos."
          >
            <VideoField productId={productId} videoPath={form.video_url} disabled={readOnly} onChange={load} />
          </Card>
        </>
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
            <p className="text-xs text-emerald-700">{storeName} › product › {form.slug || slugify(form.name)}</p>
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

      {deleteOpen && (
        <DeleteProductModal
          product={form}
          deleting={deleting}
          error={deleteError}
          onClose={() => { if (!deleting) { setDeleteOpen(false); setDeleteError(null); } }}
          onConfirm={async () => {
            setDeleting(true);
            setDeleteError(null);
            const { error } = await deleteProduct(productId);
            setDeleting(false);
            if (error) { setDeleteError(error.message ?? "Delete failed. Try again."); return; }
            adminNavigate("/admin/products");
          }}
        />
      )}

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

/**
 * VariantsTab — add/remove size options, each with its own price, compare-at,
 * stock and SKU.
 *
 * Deletes are immediate (each is one DB row, and the database itself refuses
 * to remove the last one — deferring that to a batch save would just delay
 * finding out it's blocked). Price/label/SKU edits are batched behind one
 * "Save changes" button, same shape as the rest of the admin. Stock moves
 * through its own ledger-backed modal, exactly like the single-variant
 * Inventory tab — never a plain field edit.
 */
function VariantsTab({ productId, variants, readOnly, onReload, onProductReload }) {
  const [rows, setRows] = useState(variants);
  const [newRows, setNewRows] = useState([]); // not yet saved — no id
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [stockTarget, setStockTarget] = useState(null); // variant being restocked

  useEffect(() => { setRows(variants); setNewRows([]); }, [variants]);

  const dirty = useMemo(
    () => newRows.length > 0 || JSON.stringify(rows) !== JSON.stringify(variants),
    [rows, newRows, variants]
  );

  const updateRow = (id, key, value) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  const updateNewRow = (i, key, value) =>
    setNewRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));

  function makeDefault(id) {
    // The database only enforces "exactly one default" on save (the
    // clear-other-defaults trigger fires per row) — mirror that locally so
    // the radio state feels immediate rather than waiting for a round trip.
    setRows((rs) => rs.map((r) => ({ ...r, is_default: r.id === id })));
  }

  async function handleSave() {
    setSaving(true); setError(null);
    for (const r of rows) {
      if (!r.size_label?.trim()) { setSaving(false); return setError("Every size needs a name."); }
      if (r.price_minor == null) { setSaving(false); return setError(`${r.size_label} needs a price.`); }
      const { error } = await upsertVariant(r);
      if (error) { setSaving(false); return setError(error.message); }
    }
    for (const r of newRows) {
      if (!r.size_label?.trim()) { setSaving(false); return setError("Every size needs a name."); }
      if (r.price_minor == null) { setSaving(false); return setError(`${r.size_label || "New size"} needs a price.`); }
      const { error } = await upsertVariant({ ...r, product_id: productId });
      if (error) { setSaving(false); return setError(error.message); }
    }
    setSaving(false);
    await onReload();
    await onProductReload(); // the default variant may have changed price/stock mirrored onto the product
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}

      <Card description="Each size has its own price, compare-at price and stock. The one marked Default is what shoppers see first on the product card and in Shop.">
        <div className="space-y-3">
          {rows.map((v) => (
            <VariantRow
              key={v.id} v={v} readOnly={readOnly}
              canDelete={rows.length + newRows.length > 1}
              onChange={(key, value) => updateRow(v.id, key, value)}
              onMakeDefault={() => makeDefault(v.id)}
              onDelete={() => setDeleting(v)}
              onAdjustStock={() => setStockTarget(v)}
            />
          ))}
          {newRows.map((v, i) => (
            <VariantRow
              key={`new-${i}`} v={v} readOnly={readOnly} isNew
              canDelete
              onChange={(key, value) => updateNewRow(i, key, value)}
              onMakeDefault={() => {}} // a brand-new row can't be default until it's saved and has an id
              onDelete={() => setNewRows((rs) => rs.filter((_, idx) => idx !== i))}
            />
          ))}
        </div>

        {!readOnly && (
          <Btn
            variant="secondary" size="sm" className="mt-4"
            onClick={() => setNewRows((rs) => [
              ...rs,
              { size_label: "", price_minor: null, compare_at_price_minor: null, sku: "", stock_quantity: 0, is_default: false, sort_order: rows.length + rs.length },
            ])}
          >
            <Plus className="h-3.5 w-3.5" /> Add size
          </Btn>
        )}
      </Card>

      {!readOnly && (
        <SaveBar dirty={dirty} saving={saving} onSave={handleSave}
          onDiscard={() => { setRows(variants); setNewRows([]); setError(null); }}
          message="You have unsaved size changes." />
      )}

      <ConfirmModal
        open={!!deleting} onClose={() => setDeleting(null)} danger
        title={`Remove "${deleting?.size_label}"?`} confirmLabel="Remove"
        body="This size will no longer be sold. Past orders that included it keep their own record — nothing there changes."
        onConfirm={async () => {
          const { error } = await deleteVariant(deleting.id);
          if (error) return setError(error.message);
          await onReload();
          await onProductReload();
        }}
      />

      <VariantStockModal
        variant={stockTarget} onClose={() => setStockTarget(null)}
        onApply={async (next, note) => {
          await setVariantStock(stockTarget.id, stockTarget.stock_quantity, next, note);
          setStockTarget(null);
          await onReload();
          await onProductReload();
        }}
      />
    </div>
  );
}

function VariantRow({ v, readOnly, isNew, canDelete, onChange, onMakeDefault, onDelete, onAdjustStock }) {
  return (
    <div className="rounded-xl bg-snow p-4 ring-1 ring-line">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TextField label="Size" required placeholder="e.g. 150ml"
          value={v.size_label ?? ""} onChange={(e) => onChange("size_label", e.target.value)} disabled={readOnly} />
        <MoneyField label="Price" required valueMinor={v.price_minor} onChangeMinor={(m) => onChange("price_minor", m)} />
        <MoneyField label="Compare at" hint="Optional" valueMinor={v.compare_at_price_minor} onChangeMinor={(m) => onChange("compare_at_price_minor", m)} />
        <TextField label="SKU" value={v.sku ?? ""} onChange={(e) => onChange("sku", e.target.value)} disabled={readOnly} />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {!isNew ? (
            <>
              <StockPill stock={v.stock_quantity ?? 0} />
              {!readOnly && (
                <Btn size="sm" variant="secondary" onClick={onAdjustStock}>Adjust stock</Btn>
              )}
            </>
          ) : (
            <Pill tone="sky">New — stock starts at 0, adjust after saving</Pill>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isNew && (
            v.is_default ? (
              <Pill tone="magenta"><Star className="h-2.5 w-2.5 fill-current" /> Default</Pill>
            ) : !readOnly && (
              <Btn size="sm" variant="ghost" onClick={onMakeDefault}>Make default</Btn>
            )
          )}
          {!readOnly && (
            <Btn size="sm" variant="ghost" className="text-red-600" disabled={!canDelete} onClick={onDelete}
              title={!canDelete ? "A product needs at least one size" : undefined}>
              <Trash2 className="h-3.5 w-3.5" />
            </Btn>
          )}
        </div>
      </div>
    </div>
  );
}

function VariantStockModal({ variant, onClose, onApply }) {
  const [mode, setMode] = useState("add");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { setAmount(""); setNote(""); setMode("add"); }, [variant]);

  if (!variant) return null;
  const current = variant.stock_quantity ?? 0;
  const next = mode === "set" ? Number(amount || 0) : current + Number(amount || 0);

  return (
    <Modal open onClose={onClose} title={`Adjust stock — ${variant.size_label}`}
      footer={
        <>
          <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn size="sm" loading={busy} disabled={amount === "" || next < 0}
            onClick={async () => { setBusy(true); await onApply(next, note || null); setBusy(false); }}>
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
        <TextField label="Note" hint="Optional" value={note} onChange={(e) => setNote(e.target.value)} />
        <p className="rounded-lg bg-white px-3 py-2 text-xs text-ink-soft">
          Stock will go from <strong>{current}</strong> to <strong>{next}</strong>.
          {next < 0 && <span className="ml-1 text-red-600">Stock can’t go below zero.</span>}
        </p>
      </div>
    </Modal>
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

/** Permanent-delete confirmation — deliberately stronger than the generic
 *  ConfirmModal: it requires typing the exact product name (a real
 *  "type to confirm" gate, not just a click), and it surfaces a failed
 *  delete inline instead of closing anyway. */
function DeleteProductModal({ product, deleting, error, onClose, onConfirm }) {
  const [typed, setTyped] = useState("");
  const canConfirm = typed.trim() === (product?.name ?? "").trim() && typed.trim().length > 0;

  return (
    <Modal open onClose={onClose} title="Permanently delete this product?"
      footer={
        <>
          <Btn variant="secondary" size="sm" onClick={onClose} disabled={deleting}>Cancel</Btn>
          <Btn variant="danger" size="sm" loading={deleting} disabled={!canConfirm} onClick={onConfirm}>
            <Trash2 className="h-3.5 w-3.5" /> Delete permanently
          </Btn>
        </>
      }>
      <p className="text-sm text-ink-soft">
        This permanently deletes <strong className="text-ink">{product?.name}</strong> — its variants, photos,
        video, stock history and reviews go with it. <strong className="text-ink">This cannot be undone.</strong>
      </p>
      <p className="mt-3 text-sm text-ink-soft">
        Past orders that included this product are not affected: their line items keep the product's name, price
        and image exactly as they were at the time of purchase — only the link back to this product page is removed.
      </p>
      <TextField
        className="mt-4"
        label={<>Type <strong>{product?.name}</strong> to confirm</>}
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        disabled={deleting}
      />
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </Modal>
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
