/* =================================================================== *
 * aura.skin — per-route SEO metadata (client-side)
 * -------------------------------------------------------------------
 * The app is client-rendered, so document.title, meta description,
 * canonical, Open Graph tags and robots are set PER ROUTE at runtime
 * (see applySeo(), called from App.jsx on every route change).
 *
 * JS-executing crawlers (Googlebot) get accurate per-page metadata.
 * Non-JS scrapers (some social unfurlers) still see the static tags in
 * index.html — closing that gap fully needs prerendering/SSG, tracked
 * as a separate follow-up.
 * =================================================================== */
import { PRODUCTS } from "../data/products.js";

const BRAND = "aura.skin";

/* Static routes → title + description. `noindex` marks private/utility
 * pages that should never appear in search results. */
const ROUTE_META = {
  home:     { title: `${BRAND} — Glow within. Bloom daily.`, description: "Real K- & J-Beauty skincare from authorised distributors. Barrier-first formulas for glass skin — plus honest advice on what to skip." },
  shop:     { title: `Shop all skincare — ${BRAND}`, description: "Browse authentic K- & J-Beauty cleansers, toners, serums, moisturisers and SPF. Filter by skin type, concern, brand and price." },
  cart:     { title: `Your bag — ${BRAND}`, description: "Review the items in your shopping bag.", noindex: true },
  checkout: { title: `Checkout — ${BRAND}`, description: "Complete your order securely.", noindex: true },
  account:  { title: `Your account — ${BRAND}`, description: "Your orders, loyalty points and saved items.", noindex: true },
  wishlist: { title: `Your wishlist — ${BRAND}`, description: "The skincare you've saved for later.", noindex: true },
  contact:  { title: `Contact us — ${BRAND}`, description: "Questions about your order or a product? Reach the aura.skin team — we're happy to help you glow." },
  about:    { title: `About ${BRAND} — clean K & J-Beauty`, description: "Our barrier-first philosophy: gentle, effective K- & J-Beauty from authorised distributors, with honest advice for every skin." },
  rewards:  { title: `Aura Rewards — earn points & perks — ${BRAND}`, description: "Earn glow points on every order and review, then unlock member-only discounts and free shipping." },
  offers:   { title: `Deals & offers — ${BRAND}`, description: "Shop hand-picked K- & J-Beauty markdowns — up to 75% off select cult favourites while stocks last." },
  journal:  { title: `The Journal — skincare guides — ${BRAND}`, description: "Routines, ingredient explainers and glass-skin guides from the aura.skin Journal." },
  "404":    { title: `Page not found — ${BRAND}`, description: "The page you're looking for has moved or no longer exists.", noindex: true },
};

/* Resolve title/description for a route. Product pages pull the real product
 * name from the catalog so each PDP gets a unique, descriptive title. */
function metaFor(route) {
  if (route.name === "product") {
    const p = PRODUCTS.find((x) => x.id === route.id);
    if (p) {
      const concerns = (p.concern || []).join(", ") || "Skincare";
      const skin = (p.skinType || []).join(", ").toLowerCase() || "all";
      return {
        title: `${p.brand} ${p.name} — ${BRAND}`,
        description: `Shop ${p.brand} ${p.name} at ${BRAND}. ${concerns} for ${skin} skin — authentic, authorised stock.`.slice(0, 300),
      };
    }
    // Unknown slug → treat like a 404 for indexing purposes.
    return { title: `Product — ${BRAND}`, description: "Shop authentic K- & J-Beauty skincare.", noindex: true };
  }
  return ROUTE_META[route.name] ?? ROUTE_META["404"];
}

/* --- tiny head helpers: create-or-update, so we never duplicate tags --- */
function upsertMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}
function upsertLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}
function setRobots(noindex) {
  const el = document.head.querySelector('meta[name="robots"]');
  if (noindex) {
    if (el) el.setAttribute("content", "noindex, follow");
    else upsertMeta("name", "robots", "noindex, follow");
  } else if (el) {
    el.remove(); // indexable pages carry no robots tag (default = index, follow)
  }
}

/** Apply per-route SEO. Called from App.jsx whenever the route changes.
 *  Canonical + og:url use origin + pathname only (query/hash stripped) so
 *  filtered views like /shop?concern=X consolidate to /shop and never spawn
 *  duplicate indexable URLs. */
export function applySeo(route) {
  if (typeof document === "undefined") return;
  const m = metaFor(route);
  const url = window.location.origin + window.location.pathname;

  document.title = m.title;
  upsertMeta("name", "description", m.description);
  upsertLink("canonical", url);
  upsertMeta("property", "og:title", m.title);
  upsertMeta("property", "og:description", m.description);
  upsertMeta("property", "og:url", url);
  setRobots(!!m.noindex);
}
