import { useEffect } from "react";
import Lenis from "lenis";

/**
 * useSmoothScroll — attaches an isolated Lenis instance to a scroll container
 * (e.g. one column of the desktop dual-pane) so its wheel/trackpad scrolling
 * gets the same eased momentum as the page. Pair the element with
 * `data-lenis-prevent` so the ROOT page Lenis leaves it alone.
 *
 * `enabled` should be false where the element isn't actually a scroll container
 * (e.g. mobile, where the panes collapse and the page itself scrolls).
 *
 * Requirements: `ref` points at the overflow container, and that container has
 * exactly ONE child element wrapping its content (Lenis measures the child).
 */
export function useSmoothScroll(ref, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const wrapper = ref.current;
    const content = wrapper?.firstElementChild;
    if (!wrapper || !content) return;

    const lenis = new Lenis({
      wrapper,
      content,
      duration: 1.05,
      easing: (t) => 1 - Math.pow(1 - t, 3), // easeOutCubic — quick start, soft stop
      smoothWheel: true,
      overscroll: false, // don't chain past this pane
      autoRaf: true, // Lenis drives its own RAF loop (reliable, no double-drive)
    });

    wrapper.__lenis = lenis; // handle for debugging / programmatic scrollTo

    return () => {
      lenis.destroy();
      delete wrapper.__lenis;
    };
  }, [ref, enabled]);
}
