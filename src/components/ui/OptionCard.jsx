export default function OptionCard({ on, icon: Icon, title, desc, trailing, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all ${
        on
          ? "border-magenta bg-petal/50"
          : "border-line hover:border-magenta/40"
      }`}
    >
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${on ? "bg-magenta text-white" : "bg-snow text-ink-soft"}`}>
        {Icon && <Icon className="h-5 w-5" strokeWidth={1.7} />}
      </span>
      <div className="flex-1">
        <p className="font-semibold text-ink">{title}</p>
        <p className="text-sm text-ink-soft">{desc}</p>
      </div>
      {trailing != null && (
        <span className="font-semibold text-ink">{trailing}</span>
      )}
      <span className={`grid h-5 w-5 place-items-center rounded-full border ${on ? "border-magenta" : "border-ink/25"}`}>
        {on && <span className="h-2.5 w-2.5 rounded-full bg-magenta" />}
      </span>
    </button>
  );
}
