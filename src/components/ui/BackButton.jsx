import { ChevronLeft } from "lucide-react";
import { backTargetFor } from "../../lib/nav-history.js";
import { navigate } from "../../lib/navigate.js";

/**
 * BackButton — inline, in-flow back link.
 *
 * Deliberately NOT history.back(). "Continue Shopping" pushes a fresh Shop entry
 * instead of popping, so the real browser stack reads Shop → Cart → Shop, and
 * one step back lands the shopper in the bag they just chose to leave — then
 * "Continue Shopping" pushes Shop again, forever. We resolve the target from our
 * own route stack (lib/nav-history.js) and fall back to home when the only place
 * "back" could go is the funnel we just escaped.
 *
 * `route` — the current route name, so the loop check knows where it stands.
 */
export default function BackButton({ route, label = "Back", className = "" }) {
  const goBack = () => {
    const target = backTargetFor(route);
    // Navigate, don't history.back(): the entry behind us is the loop.
    if (window.location.pathname === target) navigate("/");
    else navigate(target);
  };

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label={label}
      className={`mb-4 inline-flex items-center gap-1 text-sm font-medium text-ink-soft transition-colors hover:text-magenta ${className}`}
    >
      <ChevronLeft className="h-4 w-4" strokeWidth={1.8} />
      {label}
    </button>
  );
}
