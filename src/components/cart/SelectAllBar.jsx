import { Check } from "lucide-react";
import { useCart } from "../../context/CartContext.jsx";

/** "Select all" row above the bag lines, with how many are ticked. */
export default function SelectAllBar({ className = "" }) {
  const { items, selectedItems, allSelected, selectAll, removeSelected } = useCart();
  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={allSelected}
        onClick={() => selectAll(!allSelected)}
        className="-ml-1 inline-flex min-h-10 items-center gap-2.5 pl-1.5 pr-2 text-sm font-medium text-ink"
      >
        <span className={`grid h-5 w-5 place-items-center rounded-md ring-1 transition-colors ${
          allSelected ? "bg-magenta text-white ring-magenta" : "bg-white text-transparent ring-ink/25"
        }`}>
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
        Select all
      </button>
      <span className="flex items-center gap-3 text-xs text-ink-soft">
        {selectedItems.length} of {items.length} selected
        {selectedItems.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Remove ${selectedItems.length} selected item${selectedItems.length === 1 ? "" : "s"} from your bag?`)) removeSelected();
            }}
            className="min-h-10 font-medium text-ink-soft underline-offset-2 hover:text-error hover:underline"
          >
            Remove
          </button>
        )}
      </span>
    </div>
  );
}
