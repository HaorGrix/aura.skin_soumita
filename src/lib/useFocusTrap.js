import { useEffect, useRef } from "react";

/**
 * Focusable element selector — covers every interactive element that participates
 * in the natural Tab order, excluding visually-hidden ones (tabindex="-1").
 */
const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),' +
  'select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * useFocusTrap — lightweight focus trap for modal/drawer components.
 *
 * Behaviour:
 *   • On activate  : saves document.activeElement, then moves focus to the
 *                    first focusable child of the container.
 *   • While active : Tab / Shift+Tab cycle within the container; no event
 *                    reaches the background page.
 *   • On deactivate: restores focus to the element that was active before the
 *                    trap turned on (the trigger button, typically).
 *
 * Framer Motion safety: cleanup fires at the state change, before the exit
 * animation finishes. Focus returns to the trigger immediately; the ongoing
 * CSS/transform animation is unaffected because Framer Motion does not read
 * focus state.
 *
 * @param {React.RefObject} containerRef  - ref attached to the trap's root element
 * @param {boolean}         active        - true while the modal/drawer is open
 */
export function useFocusTrap(containerRef, active) {
  const restoreRef = useRef(null);

  useEffect(() => {
    if (!active) return;

    // Capture the element that had focus before this modal opened.
    restoreRef.current = document.activeElement;

    const el = containerRef.current;
    if (!el) return;

    // Move focus into the container — first interactive child wins.
    const focusables = () => Array.from(el.querySelectorAll(FOCUSABLE));
    focusables()[0]?.focus();

    function handleTab(e) {
      if (e.key !== "Tab") return;
      const nodes = focusables();
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (e.shiftKey) {
        // Shift+Tab on first element → wrap to last
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab on last element → wrap to first
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleTab);
    return () => {
      document.removeEventListener("keydown", handleTab);
      // Restore focus to whatever triggered the modal.
      restoreRef.current?.focus();
    };
  }, [active]); // containerRef is a stable React ref — intentionally omitted from deps
}
