/* =================================================================== *
 * aura.skin — History-API navigation (clean URLs, no hash)
 * -------------------------------------------------------------------
 * Replaces the old hash router. The app's router (useRoute in App.jsx)
 * reads window.location.pathname and re-parses on browser `popstate` and
 * this module's synthetic `aura:navigate` event.
 *
 * `navigate()` is the single programmatic entry point. `installLinkInterceptor`
 * promotes every internal <a href="/..."> to an SPA navigation WITHOUT
 * rewriting each anchor into a framework <Link> — so components keep their
 * plain <a> tags and only the href STRING changes (#/x → /x).
 * =================================================================== */

const EVENT = "aura:navigate";

/** Programmatic SPA navigation. `replace` swaps the current history entry
 *  (used for non-stacking updates like Shop's filter sync). */
export function navigate(to, { replace = false } = {}) {
  if (typeof to !== "string" || !to) return;
  if (replace) window.history.replaceState(null, "", to);
  else window.history.pushState(null, "", to);
  // pushState/replaceState never emit an event — tell the router to re-parse.
  window.dispatchEvent(new Event(EVENT));
}

/** Subscribe a handler to real (popstate) + synthetic (navigate) URL changes.
 *  Returns an unsubscribe fn — mirrors the addEventListener cleanup contract so
 *  it drops straight into a useEffect return. */
export function onRouteChange(handler) {
  window.addEventListener("popstate", handler);
  window.addEventListener(EVENT, handler);
  return () => {
    window.removeEventListener("popstate", handler);
    window.removeEventListener(EVENT, handler);
  };
}

/* Install ONCE (main.jsx). A single delegated click listener converts internal
 * absolute-path links into SPA navigations. It deliberately ignores, letting
 * the browser do its native thing:
 *   • modified clicks (Cmd/Ctrl/Shift/Alt → new tab/window) and non-left buttons
 *   • target="_blank", download, rel="external"
 *   • cross-origin links and non-"/" schemes (mailto:, tel:, http://…)
 *   • in-page fragments (#section) — native smooth-scroll still handles those
 * so existing behaviour is preserved everywhere it should be. Handlers that
 * call e.preventDefault() (e.g. BackButton, smartNavigate links) are skipped
 * via the defaultPrevented guard, so there's never a double navigation. */
export function installLinkInterceptor() {
  if (typeof document === "undefined" || window.__auraLinkInterceptor) return;
  window.__auraLinkInterceptor = true;

  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    if (a.target === "_blank" || a.hasAttribute("download")) return;
    if ((a.getAttribute("rel") || "").toLowerCase().includes("external")) return;

    const href = a.getAttribute("href");
    if (!href || href[0] === "#") return;           // in-page anchor → native scroll
    if (a.origin !== window.location.origin) return; // external / other origin
    if (href[0] !== "/") return;                     // mailto:, tel:, protocol-relative, etc.

    e.preventDefault();
    navigate(a.pathname + a.search + a.hash);
  });
}
