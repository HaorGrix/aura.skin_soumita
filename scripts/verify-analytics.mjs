/* =================================================================== *
 * Verification harness for src/lib/analytics.js
 * -------------------------------------------------------------------
 * No test framework is wired into this project, so this is a self-contained
 * Node script that stubs the minimum of `window`/`document` and exercises
 * the real module. It proves the parts that can't be eyeballed:
 *   - GA4 / pixel never load for a blank or malformed ID
 *   - events fired before init are queued and replayed in order on init
 *   - view_item / add_to_cart / begin_checkout / purchase reach gtag in the
 *     GA4 ecommerce shape
 *   - Meta Advanced Matching (setUserData) normalises the buyer fields to
 *     Meta's em/fn/ln/ph/ct/zp/country schema
 *
 * Run:  node scripts/verify-analytics.mjs
 * Exit: 0 all green, 1 on the first failed assertion.
 * =================================================================== */
import assert from "node:assert/strict";

/* ---- Minimal browser stubs (set before importing the module) ------- */
const appended = [];
globalThis.document = {
  head: { appendChild: (el) => appended.push(el) },
  createElement: () => ({ set src(v) { this._src = v; }, get src() { return this._src; } }),
  title: "skin.theory",
};
globalThis.window = { location: { pathname: "/product/1", search: "", href: "https://x/product/1" } };

const {
  injectGa4, trackGa4, trackGa4PageView, resetGa4State,
  injectMetaPixel, setUserData, resetMetaPixelState,
} = await import("../src/lib/analytics.js");

let passed = 0;
const ok = (label) => { passed += 1; console.log("  ok  " + label); };

/* ---- 1. GA4 refuses blank / malformed Measurement IDs -------------- */
resetGa4State();
delete globalThis.window.gtag;
delete globalThis.window.dataLayer;
injectGa4("");
injectGa4("GTM-ABC123");     // a GTM container, not a GA4 stream
injectGa4("12345678");       // numeric property id, not a Measurement ID
assert.equal(globalThis.window.gtag, undefined, "no gtag should load for an invalid id");
ok("GA4 ignores blank / GTM / numeric ids");

/* ---- 2. Events before init are queued, then replayed on init ------- */
trackGa4("view_item", { currency: "BDT", value: 1200 });
assert.equal(globalThis.window.gtag, undefined, "still no gtag before a valid init");

injectGa4("G-ABCDE12345");
assert.equal(typeof globalThis.window.gtag, "function", "gtag loads for a valid id");
const calls = globalThis.window.dataLayer.map((a) => Array.from(a));
// dataLayer carries: ['js', Date], ['config', id, {...}], then the replayed event
assert.ok(calls.some((c) => c[0] === "config" && c[1] === "G-ABCDE12345"), "config sent");
const replayed = calls.find((c) => c[0] === "event" && c[1] === "view_item");
assert.ok(replayed, "queued view_item replayed after init");
assert.equal(replayed[2].value, 1200, "replayed event keeps its params");
ok("GA4 queues pre-init events and replays them on init");

/* ---- 3. Ecommerce events reach gtag in GA4 shape ------------------- */
const grab = (name) => globalThis.window.dataLayer.map((a) => Array.from(a))
  .filter((c) => c[0] === "event" && c[1] === name).pop();

trackGa4("add_to_cart", { currency: "BDT", value: 2400, items: [{ item_id: "7", item_name: "Serum", price: 1200, quantity: 2 }] });
const atc = grab("add_to_cart")[2];
assert.equal(atc.currency, "BDT");
assert.equal(atc.value, 2400);
assert.equal(atc.items[0].item_id, "7");
assert.equal(atc.items[0].quantity, 2);
ok("add_to_cart carries currency, value and items[]");

trackGa4("purchase", { transaction_id: "A-1001", currency: "BDT", value: 5000, coupon: "WELCOME", items: [{ item_id: "7", item_name: "Serum", price: 1200, quantity: 1 }] });
const pur = grab("purchase")[2];
assert.equal(pur.transaction_id, "A-1001", "purchase needs a transaction_id");
assert.equal(pur.coupon, "WELCOME");
ok("purchase carries transaction_id + coupon");

trackGa4PageView();
assert.ok(grab("page_view"), "SPA page_view fires");
ok("page_view fires for route changes");

/* ---- 4. Meta Advanced Matching normalisation ---------------------- */
resetMetaPixelState();
injectMetaPixel("123456789012345");
// Replace the pixel stub with a recorder to inspect what setUserData sends.
const fbqCalls = [];
globalThis.window.fbq = (...args) => fbqCalls.push(args);
setUserData({
  email: "  Soumita@Example.COM ",
  firstName: "Soumita",
  lastName: "Roy",
  phone: "+8801712-345678",
  city: "Dhaka ",
  postal: " 1207 ",
  country: "Bangladesh",
});
const init = fbqCalls.find((c) => c[0] === "init");
assert.ok(init, "setUserData re-inits the pixel with user_data");
const ud = init[2];
assert.equal(ud.em, "soumita@example.com", "email lowercased/trimmed");
assert.equal(ud.ph, "8801712345678", "phone reduced to digits");
assert.equal(ud.ct, "dhaka", "city lowercased, spaces stripped");
assert.equal(ud.zp, "1207", "zip trimmed");
assert.equal(ud.country, "bd", "country mapped to ISO-2");
assert.equal(ud.fn, "soumita");
assert.equal(ud.ln, "roy");
ok("Advanced Matching normalises to Meta's em/fn/ln/ph/ct/zp/country schema");

/* ---- 5. setUserData is a safe no-op when the pixel is off --------- */
resetMetaPixelState();
delete globalThis.window.fbq;
assert.doesNotThrow(() => setUserData({ email: "x@y.z" }), "no-op without a pixel");
ok("Advanced Matching no-ops when the pixel is disabled");

console.log(`\nALL GREEN — ${passed} checks passed.`);
