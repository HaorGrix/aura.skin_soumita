/* =================================================================== *
 * skin.theory — "What's inside" for a combo product
 * -------------------------------------------------------------------
 * Lists the products an admin put in the combo (Admin → Products →
 * Combo items) and the saving against buying them separately. Renders
 * nothing for a normal product.
 * =================================================================== */
import { useEffect, useState } from "react";
import { Gift } from "lucide-react";
import { getComboItems } from "../../lib/api/products.js";
import { displaySize, formatPrice } from "../../lib/format.js";

export default function ComboContents({ product }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    let alive = true;
    getComboItems(product.dbId).then(({ data }) => { if (alive) setItems(data ?? []); });
    return () => { alive = false; };
  }, [product.dbId]);

  if (items.length === 0) return null;

  const separate = items.reduce((sum, it) => sum + (it.price ?? 0) * it.quantity, 0);
  const saving = separate - (product.price ?? 0);

  return (
    <section className="mt-10 rounded-[1.5rem] bg-white p-5 ring-1 ring-line sm:p-6" aria-labelledby="combo-inside">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="combo-inside" className="inline-flex items-center gap-2 font-display text-xl text-ink">
          <Gift className="h-5 w-5 text-magenta" strokeWidth={1.8} /> What's inside
        </h2>
        {saving > 0 && (
          <p className="text-sm text-ink-soft">
            Worth {formatPrice(separate)} separately ·{" "}
            <span className="font-semibold text-success">you save {formatPrice(saving)}</span>
          </p>
        )}
      </div>

      <ul className="mt-4 divide-y divide-line">
        {items.map((it) => {
          const size = displaySize(it.sizeLabel);
          return (
            <li key={it.id}>
              <a href={`/product/${it.id}`} className="group flex items-center gap-3 py-3">
                <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-line">
                  {it.image && (
                    <img src={it.image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-contain" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-semibold uppercase tracking-wide text-magenta">{it.brand}</span>
                  <span className="block truncate text-sm font-medium text-ink group-hover:text-magenta">{it.name}</span>
                  <span className="block text-xs text-ink-soft">
                    {size ? `${size} · ` : ""}{it.quantity > 1 ? `${it.quantity} × ` : ""}{formatPrice(it.price)}
                  </span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
