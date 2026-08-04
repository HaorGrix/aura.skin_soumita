/* =================================================================== *
 * skin.script admin — shared UI kit
 * -------------------------------------------------------------------
 * Every admin screen is assembled from these. They deliberately reuse the
 * storefront's design tokens (--color-magenta, --color-line, --color-ink…
 * from index.css) so the panel reads as the same product, but they run on
 * a light surface: admins work in daylight, the storefront is dark-first.
 *
 * Nothing here talks to Supabase — these are presentation only.
 * =================================================================== */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Check, ChevronLeft, ChevronRight, Loader2, Search, X } from "lucide-react";
import { CURRENCY } from "../../lib/format.js";

/* ---------------------------------------------------------------- *
 * Money — the admin edits taka, the database stores paisa. These two
 * helpers are the ONLY conversion points, so a stray ×100 can't drift in.
 * ---------------------------------------------------------------- */
export const minorToMajor = (m) => (m == null ? "" : (Number(m) / 100).toFixed(2).replace(/\.00$/, ""));
export const majorToMinor = (v) => (v === "" || v == null ? null : Math.round(Number(v) * 100));
export const money = (minor) =>
  minor == null ? "—" : `${CURRENCY.symbol}${(Number(minor) / 100).toLocaleString("en-BD", { maximumFractionDigits: 0 })}`;

export function Spinner({ className = "h-5 w-5" }) {
  return <Loader2 className={`${className} animate-spin text-magenta`} aria-hidden />;
}

export function PageHeader({ title, subtitle, actions, back }) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {back}
        <h1 className="font-serif text-3xl text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Card({ title, description, children, className = "", actions }) {
  return (
    <section className={`rounded-2xl bg-white ring-1 ring-line ${className}`}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-ink">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-ink-soft">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Btn({ variant = "primary", size = "md", className = "", loading, children, ...props }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2.5 text-sm", lg: "px-5 py-3 text-sm" };
  const variants = {
    primary: "bg-magenta text-white hover:bg-magenta-deep",
    secondary: "bg-white text-ink ring-1 ring-line hover:bg-snow",
    ghost: "text-ink-soft hover:bg-snow hover:text-ink",
    danger: "bg-red-600 text-white hover:bg-red-700",
  };
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------- *
 * Form fields
 * ---------------------------------------------------------------- */

export function Label({ children, hint, required }) {
  return (
    <span className="mb-1.5 flex items-baseline gap-2">
      <span className="text-xs font-medium text-ink">
        {children}
        {required && <span className="ml-0.5 text-magenta">*</span>}
      </span>
      {hint && <span className="text-[11px] text-ink-soft">{hint}</span>}
    </span>
  );
}

const inputCls =
  "w-full rounded-xl bg-white px-3.5 py-2.5 text-sm text-ink ring-1 ring-line outline-none transition-shadow placeholder:text-ink-soft/50 focus:ring-2 focus:ring-magenta/50 disabled:bg-snow disabled:text-ink-soft";

export function TextField({ label, hint, required, error, className = "", as = "input", ...props }) {
  const Tag = as;
  return (
    <label className={`block ${className}`}>
      {label && <Label hint={hint} required={required}>{label}</Label>}
      <Tag className={`${inputCls} ${as === "textarea" ? "min-h-24 resize-y" : ""} ${error ? "ring-red-400" : ""}`} {...props} />
      {error && <span className="mt-1 flex items-center gap-1 text-[11px] text-red-600"><AlertCircle className="h-3 w-3" />{error}</span>}
    </label>
  );
}

/**
 * Select field. Accepts either a flat option list or grouped options:
 *
 *   options={[{ label: "Skin Care", options: [{ id, name }, …] }, …]}
 *
 * Grouping matters for categories — "Facewash" exists under both Skin Care
 * and K-Beauty, so a flat list would show two identical entries with no way
 * to tell them apart. <optgroup> is also the native control, so it stays
 * keyboard- and screen-reader-friendly for free.
 */
export function SelectField({ label, hint, options = [], placeholder, className = "", ...props }) {
  const renderOption = (o) => (
    <option key={o.id ?? o.value ?? o} value={o.id ?? o.value ?? o}>
      {o.label ?? o.name ?? o}
    </option>
  );

  return (
    <label className={`block ${className}`}>
      {label && <Label hint={hint}>{label}</Label>}
      <select className={inputCls} {...props}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o, i) =>
          Array.isArray(o?.options) ? (
            <optgroup key={o.id ?? o.label ?? i} label={o.label ?? o.name}>
              {o.options.map(renderOption)}
            </optgroup>
          ) : (
            renderOption(o)
          )
        )}
      </select>
    </label>
  );
}

/** Money input. Displays taka, emits paisa — so no screen ever does the
 *  ×100 itself and no screen can forget to. */
export function MoneyField({ label, hint, valueMinor, onChangeMinor, required, error, className = "" }) {
  return (
    <label className={`block ${className}`}>
      {label && <Label hint={hint} required={required}>{label}</Label>}
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-soft">
          {CURRENCY.symbol}
        </span>
        <input
          type="number" min="0" step="1" inputMode="decimal"
          className={`${inputCls} pl-8 ${error ? "ring-red-400" : ""}`}
          value={minorToMajor(valueMinor)}
          onChange={(e) => onChangeMinor(majorToMinor(e.target.value))}
        />
      </div>
      {error && <span className="mt-1 text-[11px] text-red-600">{error}</span>}
    </label>
  );
}

export function Toggle({ label, hint, checked, onChange, disabled }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-1">
      <button
        type="button" role="switch" aria-checked={!!checked} disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-magenta" : "bg-line"} disabled:opacity-50`}
      >
        <span className={`block h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
      </button>
      <span>
        <span className="block text-xs font-medium text-ink">{label}</span>
        {hint && <span className="block text-[11px] text-ink-soft">{hint}</span>}
      </span>
    </label>
  );
}

/** Comma-separated text ↔ string[] — for concern/skin_type/ingredients,
 *  which are plain text arrays on the products table. */
export function TagsField({ label, hint, value = [], onChange, suggestions = [], className = "" }) {
  const listId = useRef(`tags-${Math.random().toString(36).slice(2)}`).current;
  return (
    <label className={`block ${className}`}>
      {label && <Label hint={hint ?? "Separate with commas"}>{label}</Label>}
      <input
        className={inputCls}
        list={suggestions.length ? listId : undefined}
        value={(value ?? []).join(", ")}
        onChange={(e) =>
          onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))
        }
      />
      {suggestions.length > 0 && (
        <datalist id={listId}>{suggestions.map((s) => <option key={s} value={s} />)}</datalist>
      )}
    </label>
  );
}

/** Fixed-option multi-select, rendered as toggle pills — for fields like
 *  skin_type where free text invites typos/duplicates ("Oily" vs "oily" vs
 *  "Olly") and the real option set is small and known up front. Unlike
 *  TagsField's comma-separated text, every value here is guaranteed to be
 *  one of `options`, so filter logic elsewhere can match on it exactly. */
export function MultiSelectField({ label, hint, value = [], onChange, options = [], disabled, className = "" }) {
  const toggle = (opt) => {
    if (disabled) return;
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);
  };
  return (
    <div className={className}>
      {label && <Label hint={hint}>{label}</Label>}
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const on = value.includes(opt);
          return (
            <button
              key={opt} type="button" disabled={disabled} onClick={() => toggle(opt)} aria-pressed={on}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                on
                  ? "border-magenta bg-magenta text-white"
                  : "border-line text-ink-soft hover:border-magenta/50 hover:text-ink"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- *
 * Status pill
 * ---------------------------------------------------------------- */
const TONES = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  sky: "bg-sky-50 text-sky-700 ring-sky-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
  grey: "bg-snow text-ink-soft ring-line",
  magenta: "bg-petal text-magenta-deep ring-rose/40",
};

export function Pill({ tone = "grey", children, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${TONES[tone] ?? TONES.grey} ${className}`}>
      {children}
    </span>
  );
}

export function StockPill({ stock, lowAt = 5 }) {
  if (stock === 0) return <Pill tone="red">Out of stock</Pill>;
  if (stock <= lowAt) return <Pill tone="amber">Low · {stock}</Pill>;
  return <Pill tone="green">{stock} in stock</Pill>;
}

/* ---------------------------------------------------------------- *
 * DataTable — server-paginated. Every list screen uses this one, so
 * pagination/selection/empty/loading behave identically everywhere.
 * ---------------------------------------------------------------- */
export function DataTable({
  columns, rows, loading, error, empty = "Nothing here yet.",
  page = 0, pageSize = 25, total = 0, onPage,
  selectable, selected = [], onSelect, rowKey = (r) => r.id, onRowClick,
}) {
  const allSelected = rows?.length > 0 && selected.length === rows.length;
  const toggleAll = () => onSelect(allSelected ? [] : rows.map(rowKey));
  const toggleOne = (id) =>
    onSelect(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);

  const lastPage = Math.max(0, Math.ceil(total / pageSize) - 1);

  return (
    <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-line">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-line bg-snow/60">
            <tr>
              {selectable && (
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} className="accent-magenta" aria-label="Select all" />
                </th>
              )}
              {columns.map((c) => (
                <th key={c.key} className={`px-4 py-3 text-xs font-semibold text-ink-soft ${c.align === "right" ? "text-right" : ""} ${c.className ?? ""}`}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={columns.length + (selectable ? 1 : 0)} className="px-4 py-12 text-center">
                <Spinner className="mx-auto h-6 w-6" />
              </td></tr>
            )}
            {!loading && error && (
              <tr><td colSpan={columns.length + (selectable ? 1 : 0)} className="px-4 py-10 text-center text-sm text-red-600">
                {error.message ?? String(error)}
              </td></tr>
            )}
            {!loading && !error && (!rows || rows.length === 0) && (
              <tr><td colSpan={columns.length + (selectable ? 1 : 0)} className="px-4 py-14 text-center text-sm text-ink-soft">
                {empty}
              </td></tr>
            )}
            {!loading && !error && rows?.map((row) => {
              const id = rowKey(row);
              return (
                <tr
                  key={id}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`border-b border-line/60 last:border-0 ${onRowClick ? "cursor-pointer hover:bg-snow/70" : ""}`}
                >
                  {selectable && (
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.includes(id)} onChange={() => toggleOne(id)} className="accent-magenta" aria-label={`Select ${id}`} />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td key={c.key} className={`px-4 py-3 ${c.align === "right" ? "text-right" : ""} ${c.cellClassName ?? ""}`}>
                      {c.render ? c.render(row) : row[c.key]}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {total > pageSize && (
        <div className="flex items-center justify-between border-t border-line px-4 py-3 text-xs text-ink-soft">
          <span>
            {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total}
          </span>
          <div className="flex gap-1">
            <Btn size="sm" variant="secondary" disabled={page === 0} onClick={() => onPage(page - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </Btn>
            <Btn size="sm" variant="secondary" disabled={page >= lastPage} onClick={() => onPage(page + 1)}>
              Next <ChevronRight className="h-3.5 w-3.5" />
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = "Search…", className = "" }) {
  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
      <input
        className={`${inputCls} pl-9`}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/* ---------------------------------------------------------------- *
 * SaveBar — sticky, appears only when dirty, and warns before the tab
 * closes with unsaved work. The single most-missed thing in hand-rolled
 * admin panels: clients lose edits and blame the site.
 * ---------------------------------------------------------------- */
export function SaveBar({ dirty, saving, onSave, onDiscard, message }) {
  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (!dirty) return null;
  return (
    <div className="sticky bottom-4 z-[var(--z-sticky)] mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-ink px-5 py-3 text-white shadow-lg">
      <span className="text-sm">{message ?? "You have unsaved changes."}</span>
      <div className="flex gap-2">
        <Btn variant="ghost" size="sm" className="text-white/80 hover:bg-white/10 hover:text-white" onClick={onDiscard}>
          Discard
        </Btn>
        <Btn size="sm" loading={saving} onClick={onSave}>
          <Check className="h-4 w-4" /> Save changes
        </Btn>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- *
 * Modal — portalled to body at z-modal so it clears the storefront's
 * FloatingCart FAB (z-140), per the project's z-index discipline.
 * ---------------------------------------------------------------- */
export function Modal({ open, onClose, title, children, footer, wide }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-start justify-center overflow-y-auto bg-ink/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`my-10 w-full ${wide ? "max-w-4xl" : "max-w-lg"} rounded-2xl bg-white shadow-xl`}
        onClick={(e) => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-label={title}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-ink-soft hover:bg-snow hover:text-ink" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

/** Confirm dialog for destructive actions. Returns via callback, not a
 *  promise, so it composes with React state the obvious way. */
export function ConfirmModal({ open, onClose, onConfirm, title, body, confirmLabel = "Confirm", danger }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} onClose={onClose} title={title}
      footer={
        <>
          <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn variant={danger ? "danger" : "primary"} size="sm" loading={busy}
            onClick={async () => { setBusy(true); await onConfirm(); setBusy(false); onClose(); }}>
            {confirmLabel}
          </Btn>
        </>
      }>
      <p className="text-sm text-ink-soft">{body}</p>
    </Modal>
  );
}

export function StatCard({ label, value, sub, tone = "magenta" }) {
  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-line">
      <p className="text-xs font-medium text-ink-soft">{label}</p>
      <p className={`mt-1.5 font-serif text-3xl ${tone === "magenta" ? "text-ink" : ""}`}>{value}</p>
      {sub && <p className="mt-1 text-[11px] text-ink-soft">{sub}</p>}
    </div>
  );
}

/** Async data hook — every screen fetches the same way, so loading and
 *  error states are consistent and a refetch is always `reload()`. */
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true, count: 0 });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    Promise.resolve(fn()).then((res) => {
      if (!alive) return;
      setState({ data: res?.data ?? null, error: res?.error ?? null, count: res?.count ?? 0, loading: false });
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { ...state, reload: () => setNonce((n) => n + 1) };
}
