export default function Field({ label, children, full, error }) {
  return (
    <label className={`flex flex-col gap-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-sm font-medium text-ink">{label}</span>
      {children}
      {error && <p className="text-xs font-medium text-error">{error}</p>}
    </label>
  );
}
