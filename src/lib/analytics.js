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
// Events fired before the pixel is ready (a page opened directly: the
// product page's ViewContent and checkout's InitiateCheckout run before the
// store settings — and so the pixel — have loaded). Sent once it inits.
const MAX_PENDING = 25;
const pendingEvents = [];

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
  while (pendingEvents.length) window.fbq("track", ...pendingEvents.shift());
}

/** Fire a standard Meta Pixel event (ViewContent, AddToCart, InitiateCheckout,
 *  Purchase, …). Before the pixel has loaded the event is held (at most
 *  MAX_PENDING) and sent when it inits; with no pixel configured it simply
 *  stays held and nothing is ever sent. */
export function trackEvent(name, rawParams) {
  if (typeof window === "undefined") return;
  // Money to 2 decimals: 984.0500000000001 → 984.05 in Meta's reports.
  const params = rawParams && typeof rawParams.value === "number"
    ? { ...rawParams, value: Math.round(rawParams.value * 100) / 100 }
    : rawParams;
  if (!injectedId || !window.fbq) {
    if (pendingEvents.length < MAX_PENDING) pendingEvents.push([name, params]);
    return;
  }
  window.fbq("track", name, params);
}

/** Test seam. */
export function resetMetaPixelState() {
  injectedId = null;
}
