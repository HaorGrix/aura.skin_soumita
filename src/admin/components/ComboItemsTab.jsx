/* =================================================================== *
 * skin.theory admin — Combo items tab (Products → a combo product)
 * -------------------------------------------------------------------
 * A combo is a normal product: its own price, photos and stock are set on
 * the other tabs. This tab picks what is inside it (combo_items, 0068) so
 * the product page can show "What's inside" and the saving. Put the combo
 * in a combo category (e.g. Skin Care Combo) so the home "Combo" tile and
 * the menu list it.
 * =================================================================== */
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Search, Trash2 } from "lucide-react";
import { listComboItems, listProducts, saveComboItems } from "../../lib/api/admin/catalog.js";
import { Btn, Card, SaveBar, Spinner, money } from "./kit.jsx";

const signature = (items) =>
  JSON.stringify(items.map(({ item_product_id, quantity }) => ({ item_product_id, quantity })));

export default function ComboItemsTab({ productId, comboPriceMinor, readOnly }) {
  const [items, setItems] = useState(null); // [{ item_product_id, quantity, name, brand, price_minor }]
  const [original, setOriginal] = useState("[]");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    const { data, error: loadError } = await listComboItems(productId);
    if (loadError) { setError(`Couldn't load the combo items: ${loadError.message}`); setItems([]); return; }
    const rows = (data ?? []).map((r) => ({
      item_product_id: r.item_product_id,
      quantity: r.quantity,
      name: r.item?.name ?? "(deleted product)",
      brand: r.item?.brand ?? "",
      price_minor: r.item?.price_minor ?? 0,
    }));
    setItems(rows);
    setOriginal(signature(rows));
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [productId]);

  useEffect(() => {
    let alive = true;
    setSearching(true);
    const t = setTimeout(() => {
      listProducts({ search: query, pageSize: query.trim() ? 15 : 20 }).then(({ data, error: e }) => {
        if (!alive) return;
        if (e) setError(`Couldn't load products: ${e.message}`);
        else setResults((data ?? []).filter((p) => p.id !== productId));
        setSearching(false);
      });
    }, query.trim() ? 250 : 0);
    return () => { alive = false; clearTimeout(t); };
  }, [query, productId]);

  if (!items) return <div className="grid place-items-center py-16"><Spinner className="h-6 w-6" /></div>;

  const dirty = signature(items) !== original;
  const separateTotal = items.reduce((sum, it) => sum + it.price_minor * it.quantity, 0);
  const saved = separateTotal - (comboPriceMinor ?? 0);

  const add = (p) => {
    if (items.some((it) => it.item_product_id === p.id)) return;
    setItems([...items, { item_product_id: p.id, quantity: 1, name: p.name, brand: p.brand, price_minor: p.price_minor }]);
  };
  const update = (i, patch) => setItems(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const move = (i, dir) => {
    const next = [...items];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    setItems(next);
  };

  async function save() {
    setSaving(true);
    setError(null);
    const { error: e } = await saveComboItems(productId, items);
    setSaving(false);
    if (e) setError(`Couldn't save the combo items: ${e.message}`);
    else await load();
  }

  return (
    <>
      <Card description="Pick the products inside this combo. The combo's own price, photos and stock are set on the other tabs — shoppers see what's inside and how much they save. File the combo under a combo category (e.g. Skin Care Combo) so the home Combo tile shows it.">
        {error && <p className="mb-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}

        {items.length === 0 ? (
          <p className="rounded-xl bg-snow px-4 py-3 text-sm text-ink-soft">No items yet — add products from the list below.</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl ring-1 ring-line">
            {items.map((it, i) => (
              <li key={it.item_product_id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  <span className="text-ink-soft">{it.brand} — </span>{it.name}
                </span>
                <span className="text-xs text-ink-soft">{money(it.price_minor)} each</span>
                <label className="flex items-center gap-1.5 text-xs text-ink-soft">
                  Qty
                  <input
                    type="number" min="1" max="99" value={it.quantity} disabled={readOnly}
                    onChange={(e) => update(i, { quantity: Math.min(99, Math.max(1, Number(e.target.value) || 1)) })}
                    className="w-14 rounded-lg border border-line px-2 py-1 text-sm"
                  />
                </label>
                {!readOnly && (
                  <span className="flex gap-1">
                    <Btn size="sm" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Btn>
                    <Btn size="sm" variant="ghost" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="Move down">
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Btn>
                    <Btn size="sm" variant="ghost" onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label="Remove">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Btn>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        {items.length > 0 && (
          <p className="mt-3 text-sm text-ink">
            Bought separately: <strong>{money(separateTotal)}</strong> · Combo price: <strong>{money(comboPriceMinor ?? 0)}</strong>
            {saved > 0
              ? <span className="text-success"> · Shoppers save {money(saved)}</span>
              : <span className="text-amber-700"> · The combo price isn't lower than buying the items separately.</span>}
          </p>
        )}

        {!readOnly && (
          <div className="mt-5">
            <p className="mb-1.5 text-xs font-medium text-ink">Add products</p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-soft" />
              <input
                value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, brand or SKU…"
                className="w-full rounded-xl border border-line bg-white py-2 pl-8 pr-3 text-sm outline-none focus:border-magenta"
              />
            </div>
            <div className="mt-1.5 max-h-60 overflow-y-auto rounded-lg bg-white ring-1 ring-line">
              {searching && <p className="px-3 py-2 text-xs text-ink-soft">Loading…</p>}
              {!searching && results.length === 0 && <p className="px-3 py-2 text-xs text-ink-soft">No products match.</p>}
              {!searching && results.map((p) => {
                const added = items.some((it) => it.item_product_id === p.id);
                return (
                  <button
                    key={p.id} type="button" onClick={() => add(p)} disabled={added}
                    className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-xs hover:bg-snow disabled:opacity-40"
                  >
                    <span className="truncate">{p.brand} — {p.name}</span>
                    <span className="shrink-0 text-ink-soft">{added ? "Added" : money(p.price_minor)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </Card>
      {!readOnly && <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={load} />}
    </>
  );
}
