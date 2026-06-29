import { badge } from "../../lib/design-system.js";

/**
 * Badge — product benefit tag.
 * variant: "dewy" | "barrier" | "exfoliation" | "bestseller" | "new" | "sale"
 */
export default function Badge({ variant = "dewy", children, className = "" }) {
  return (
    <span className={`${badge.base} ${badge.variant[variant]} ${className}`}>
      {children}
    </span>
  );
}
