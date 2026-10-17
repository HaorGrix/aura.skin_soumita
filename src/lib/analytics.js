/* =================================================================== *
 * skin.theory — Meta Pixel + Google Analytics 4 (client-side, DB-driven)
 * -------------------------------------------------------------------
 * Both tags are driven by store_settings (see src/lib/api/settings.js),
 * set from /admin/settings. This module never hardcodes an ID — it's
 * called from App.jsx once settings load, and does nothing until a real
 * ID is present AND the matching toggle is on, so a fresh install or a
 * disabled tag never fires a broken/empty script.
 *
 * Meta side  : PageView, ViewContent, AddToCart, InitiateCheckout, Purchase
 *              + Advanced Matching (setUserData) from the checkout form.
 * GA4 side   : page_view, view_item, add_to_cart, begin_checkout, purchase
 *              in the gtag.js ecommerce shape (client_type=gtag), reported
 *              in the store's display currency so both tools agree on value.
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

/** Meta Advanced Matching — enrich the pixel with the buyer's details once
 *  they're known (at checkout). Re-initialising the pixel with a user_data
 *  object is Meta's supported browser path: fbevents.js normalises and
 *  SHA-256 hashes these values locally before they ever leave the page, so
 *  we pass them raw. No-op until the pixel has inited and silently ignores
 *  blank fields, so a guest who filled only an email still enriches on that.
 *  Keys follow Meta's schema: em, fn, ln, ph, ct (city), zp (zip), country. */
export function setUserData(fields) {
  if (!injectedId || !window.fbq || !fields) return;
  const norm = (v) => String(v).trim().toLowerCase();
  const ud = {};
  if (fields.email) ud.em = norm(fields.email);
  if (fields.firstName) ud.fn = norm(fields.firstName);
  if (fields.lastName) ud.ln = norm(fields.lastName);
  if (fields.phone) ud.ph = String(fields.phone).replace(/\D/g, "");
  if (fields.city) ud.ct = norm(fields.city).replace(/\s+/g, "");
  if (fields.postal) ud.zp = String(fields.postal).trim();
  if (fields.country) {
    const c = norm(fields.country);
    // Meta wants a 2-letter ISO country code; this store ships Bangladesh.
    ud.country = c === "bangladesh" || c === "bd" ? "bd" : c.slice(0, 2);
  }
  if (Object.keys(ud).length) window.fbq("init", injectedId, ud);
}

/** Test seam. */
export function resetMetaPixelState() {
  injectedId = null;
}

/* =================================================================== *
 * Google Analytics 4 (gtag.js) — same lifecycle as the pixel above.
 * Loaded only when a valid Measurement ID is saved AND the GA4 toggle is
 * on. Events fired before gtag is ready are held and replayed on init, so
 * a product page opened directly still records its view_item.
 * =================================================================== */

// G-XXXXXXXXXX: the Measurement ID of a GA4 data stream. Deliberately not a
// numeric property id and not a "GTM-" container — those don't load gtag.js.
const GA4_ID_RE = /^G-[A-Z0-9]{6,12}$/i;
let ga4Id = null;
const pendingGa4 = [];

/** Standard gtag.js loader. Creates window.dataLayer + window.gtag (the same
 *  globals GTM would use, so a future container can read the same events)
 *  and pulls in the gtag runtime once. Re-entrant: a second call is a no-op. */
function loadGtagScript(measurementId) {
  if (window.gtag) return;
  window.dataLayer = window.dataLayer || [];
  // gtag must push the real `arguments` object, not an array — GA relies on
  // its arguments-ness. Keep this as a plain function, never an arrow.
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(measurementId);
  document.head.appendChild(script);
}

/** Load GA4 and send the first page_view, once per Measurement ID. Safe to
 *  call on every settings refresh — the same ID re-configs harmlessly, a new
 *  ID re-inits cleanly. */
export function injectGa4(measurementId) {
  if (typeof document === "undefined") return;
  if (!measurementId || !GA4_ID_RE.test(measurementId)) return;
  if (ga4Id === measurementId) return;

  loadGtagScript(measurementId);
  // send_page_view:true emits the initial page_view; SPA route changes are
  // sent manually via trackGa4PageView (App.jsx), mirroring the pixel.
  window.gtag("config", measurementId, { send_page_view: true });
  ga4Id = measurementId;
  while (pendingGa4.length) {
    const [name, params] = pendingGa4.shift();
    window.gtag("event", name, params);
  }
}

/** Fire a GA4 event (view_item, add_to_cart, begin_checkout, purchase, …) in
 *  the gtag ecommerce shape. Held (up to MAX_PENDING) until GA4 inits; with
 *  no GA4 configured it stays held and nothing is ever sent. */
export function trackGa4(eventName, params) {
  if (typeof window === "undefined") return;
  if (!ga4Id || !window.gtag) {
    if (pendingGa4.length < MAX_PENDING) pendingGa4.push([eventName, params]);
    return;
  }
  window.gtag("event", eventName, params);
}

/** SPA page_view for GA4 — the config's auto page_view only covers the first
 *  load; later client-side route changes are sent here (App.jsx). */
export function trackGa4PageView() {
  if (typeof window === "undefined") return;
  trackGa4("page_view", {
    page_path: window.location.pathname + window.location.search,
    page_location: window.location.href,
    page_title: document.title,
  });
}

/** Test seam. */
export function resetGa4State() {
  ga4Id = null;
  pendingGa4.length = 0;
}
