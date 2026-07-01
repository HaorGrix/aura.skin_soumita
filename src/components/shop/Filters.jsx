import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check, X } from "lucide-react";
import {
  SKIN_TYPES,
  CONCERNS,
  BRANDS,
  CATEGORIES,
  PRICE_RANGES,
  AVAILABILITY,
  SORTS,
} from "../../data/products.js";

/* The filter groups, in display order */
const GROUPS = [
  { key: "availability", label: "Availability", options: AVAILABILITY },
  { key: "skinType", label: "Skin Type", options: SKIN_TYPES },
  { key: "concern", label: "Concern", options: CONCERNS },
  { key: "brand", label: "Brand", options: BRANDS },
  { key: "category", label: "Category", options: CATEGORIES },
  { key: "price", label: "Price", options: PRICE_RANGES.map((r) => ({ id: r.id, label: r.label })) },
];

export const EMPTY_FILTERS = {
  availability: [],
  skinType: [],
  concern: [],
  brand: [],
  category: [],
  price: [],
};

export function countActive(filters) {
  return Object.values(filters).reduce((n, arr) => n + arr.length, 0);
}

/* A single collapsible facet group with checkboxes */
function FacetGroup({ group, selected, onToggle, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const opts = group.options.map((o) => (typeof o === "string" ? { id: o, label: o } : o));

  return (
    <div className="border-b border-line py-4 dark:border-white/10">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
        aria-expanded={open}
        aria-controls={`facet-${group.key}`}
      >
        <span className="text-sm font-semibold text-ink dark:text-white">
          {group.label}
          {selected.length > 0 && (
            <span className="ml-2 rounded-full bg-magenta px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {selected.length}
            </span>
          )}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-ink-soft transition-transform duration-300 dark:text-white/60 ${open ? "rotate-180" : ""}`}
          strokeWidth={1.8}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            id={`facet-${group.key}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            {/* Self-contained scroll box — long facets (Brand, Concern,
                Category…) scroll internally; short ones sit at natural height.
                overscroll-contain stops the scroll from hijacking the page. */}
            <div className="mt-3 flex flex-col gap-1 pr-1 lg:max-h-52 lg:overflow-y-auto lg:overscroll-contain scrollbar-thin">
              {opts.map((o) => {
                const checked = selected.includes(o.id);
                return (
                  <li key={o.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg px-1 py-1.5 text-sm text-ink-soft transition-colors hover:text-ink dark:text-white/65 dark:hover:text-white">
                      <span
                        className={`grid h-[18px] w-[18px] place-items-center rounded-[6px] border transition-all ${
                          checked
                            ? "border-magenta bg-magenta text-white"
                            : "border-ink/25 dark:border-white/25"
                        }`}
                      >
                        {checked && <Check className="h-3 w-3" strokeWidth={3} />}
                      </span>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={() => onToggle(group.key, o.id)}
                      />
                      {o.label}
                    </label>
                  </li>
                );
              })}
            </div>
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

/* Single-select sort facet — mirrors FacetGroup's collapsible visual
   language but with radio semantics. Used inside the mobile drawer so
   shoppers can pick a sort without closing it. */
function SortFacet({ value, onChange }) {
  const [open, setOpen] = useState(true);
  const current = SORTS.find((s) => s.id === value) ?? SORTS[0];

  return (
    <div className="border-b border-line py-4 dark:border-white/10">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
        aria-expanded={open}
        aria-controls="sort-facet-options"
      >
        <span className="text-sm font-semibold text-ink dark:text-white">
          Sort by
          <span className="ml-2 text-[11px] font-medium text-ink-soft dark:text-white/55">
            {current.label}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 text-ink-soft transition-transform duration-300 dark:text-white/60 ${open ? "rotate-180" : ""}`}
          strokeWidth={1.8}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            id="sort-facet-options"
            role="radiogroup"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-3 flex flex-col gap-1 pr-1">
              {SORTS.map((s) => {
                const active = s.id === value;
                return (
                  <li key={s.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg px-1 py-1.5 text-sm text-ink-soft transition-colors hover:text-ink dark:text-white/65 dark:hover:text-white">
                      <span
                        className={`grid h-[18px] w-[18px] place-items-center rounded-full border transition-all ${
                          active
                            ? "border-magenta"
                            : "border-ink/25 dark:border-white/25"
                        }`}
                      >
                        {active && <span className="h-2.5 w-2.5 rounded-full bg-magenta" />}
                      </span>
                      <input
                        type="radio"
                        name="sort"
                        className="sr-only"
                        checked={active}
                        onChange={() => onChange(s.id)}
                      />
                      {s.label}
                    </label>
                  </li>
                );
              })}
            </div>
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * FilterPanel — the body of filters, reused in the desktop sidebar and the
 * mobile bottom sheet. Pass `sort` + `onSortChange` to surface the Sort
 * picker at the top (used by the mobile drawer; desktop has its own toolbar
 * SortMenu and omits these props).
 */
export function FilterPanel({ filters, onToggle, onClear, sort, onSortChange }) {
  const active = countActive(filters);
  return (
    <div>
      <div className="flex items-center justify-between pb-2">
        <h3 className="font-serif text-xl text-ink dark:text-white">Filters</h3>
        {active > 0 && (
          <button
            onClick={onClear}
            className="text-xs font-medium text-magenta hover:underline"
          >
            Clear all ({active})
          </button>
        )}
      </div>
      {onSortChange && <SortFacet value={sort} onChange={onSortChange} />}
      {GROUPS.map((g, i) => (
        <FacetGroup
          key={g.key}
          group={g}
          selected={filters[g.key]}
          onToggle={onToggle}
          defaultOpen={i < 3}
        />
      ))}
    </div>
  );
}

/* Active selections as removable chips (shown above the grid) */
export function ActiveChips({ filters, onToggle, onClear }) {
  const labelFor = (key, id) => {
    if (key === "price") return PRICE_RANGES.find((r) => r.id === id)?.label ?? id;
    if (key === "availability") return AVAILABILITY.find((a) => a.id === id)?.label ?? id;
    return id;
  };
  const chips = Object.entries(filters).flatMap(([key, arr]) =>
    arr.map((id) => ({ key, id }))
  );
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map(({ key, id }) => (
        <button
          key={`${key}-${id}`}
          onClick={() => onToggle(key, id)}
          aria-label={`Remove ${labelFor(key, id)} filter`}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-ink ring-1 ring-line transition-colors hover:ring-magenta dark:bg-white/5 dark:text-white dark:ring-white/10"
        >
          {labelFor(key, id)}
          <X className="h-3 w-3 text-ink-soft" strokeWidth={2.4} />
        </button>
      ))}
      <button
        onClick={onClear}
        className="text-xs font-medium text-magenta hover:underline"
      >
        Clear all
      </button>
    </div>
  );
}
