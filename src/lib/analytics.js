/* =================================================================== *
 * skin.theory — Meta Pixel (client-side, DB-driven)
 * -------------------------------------------------------------------
 * The pixel ID + enabled toggle live in store_settings (see
 * src/lib/api/settings.js), set from /admin/settings. This module never
 * hardcodes an ID — it's called from App.jsx once settings load, and does
 * nothing until a real ID is present AND the toggle is on, so a fresh
 * install or a disabled pixel never fires a broken/empty script.
 * =================================================================== */

const PIXEL_ID_RE = /^[0-9]{6,20}$/;
let injectedId = null;

/** Standard Meta Pixel base code, adapted to run from a JS string instead
 *  of inline HTML — same fbq() stub, same events.js load. */
function loadPixelScript() {
  if (window.fbq) return;
  const fbq = function () {
    fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments);
  };
  window.fbq = fbq;
  if (!window._fbq) window._fbq = fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);
}

/** Inject the Meta Pixel and fire PageView, once per pixel ID per session.
 *  Safe to call repeatedly (e.g. on every settings refresh) — re-injecting
 *  the same ID is a no-op, and switching to a new ID re-inits cleanly. */
export function injectMetaPixel(pixelId) {
  if (typeof document === "undefined") return;
  if (!pixelId || !PIXEL_ID_RE.test(pixelId)) return;
  if (injectedId === pixelId) return;

  loadPixelScript();
  window.fbq("init", pixelId);
  window.fbq("track", "PageView");
  injectedId = pixelId;
}

/** Fire a standard Meta Pixel event (ViewContent, AddToCart, InitiateCheckout,
 *  Purchase, …). A silent no-op until the base pixel has actually injected —
 *  callers (Product page, cart, checkout) can mount before/without a pixel
 *  being configured, and must never queue events for a script that never
 *  loads. */
export function trackEvent(name, params) {
  if (typeof window === "undefined") return;
  if (!injectedId || !window.fbq) return;
  window.fbq("track", name, params);
}

/** Test seam. */
export function resetMetaPixelState() {
  injectedId = null;
}
