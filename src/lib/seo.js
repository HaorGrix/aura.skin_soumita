/* =================================================================== *
 * skin.theory — per-route SEO metadata (client-side)
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

/* Static routes → title + description, parameterised by the live store
 * name (store_settings.store_name) so a rebrand from /admin/settings
 * updates every page title without a code change. `noindex` marks
 * private/utility pages that should never appear in search results. */
function routeMeta(brand) {
  return {
    home:     { title: "The Theory Behind Timeless Skin", description: "Real K- & J-Beauty skincare from authorised distributors. Barrier-first formulas for glass skin — plus honest advice on what to skip." },
    shop:     { title: `Shop all skincare — ${brand}`, description: "Browse authentic K- & J-Beauty cleansers, toners, serums, moisturisers and SPF. Filter by skin type, concern, brand and price." },
    cart:     { title: `Your bag — ${brand}`, description: "Review the items in your shopping bag.", noindex: true },
    checkout: { title: `Checkout — ${brand}`, description: "Complete your order securely.", noindex: true },
    account:  { title: `Your account — ${brand}`, description: "Your orders, loyalty points and saved items.", noindex: true },
    wishlist: { title: `Your wishlist — ${brand}`, description: "The skincare you've saved for later.", noindex: true },
    contact:  { title: `Contact us — ${brand}`, description: `Questions about your order or a product? Reach the ${brand} team — we're happy to help you glow.` },
    about:    { title: `About ${brand} — clean K & J-Beauty`, description: "Our barrier-first philosophy: gentle, effective K- & J-Beauty from authorised distributors, with honest advice for every skin." },
    rewards:  { title: `${brand} Rewards — earn points & perks — ${brand}`, description: "Earn glow points on every order and review, then unlock member-only discounts and free shipping." },
    offers:   { title: `Deals & offers — ${brand}`, description: "Shop hand-picked K- & J-Beauty markdowns — up to 75% off select cult favourites while stocks last." },
    journal:  { title: `The Journal — skincare guides — ${brand}`, description: `Routines, ingredient explainers and glass-skin guides from the ${brand} Journal.` },
    shipping: { title: `Shipping & Returns — ${brand}`, description: "Delivery zones, rates, Cash on Delivery, and how to return or exchange an order." },
    privacy:  { title: `Privacy Policy — ${brand}`, description: `What ${brand} collects, why, and how you stay in control of your data.` },
    terms:    { title: `Terms of Service — ${brand}`, description: `The terms that apply when you shop with ${brand}.` },
    cookies:  { title: `Cookie Policy — ${brand}`, description: `What ${brand} stores in your browser, and why.` },
    "404":    { title: `Page not found — ${brand}`, description: "The page you're looking for has moved or no longer exists.", noindex: true },
  };
}

/* Resolve title/description for a route. Product pages pull the real product
 * name from the catalog so each PDP gets a unique, descriptive title. */
function metaFor(route, brand) {
  if (route.name === "journal-article") {
    // Article content loads async client-side, so there's no catalog to
    // pull a real title from synchronously (unlike PRODUCTS below) — a
    // generic Journal-branded title/description here still beats falling
    // through to the 404 meta, and applySeo re-runs on every route change
    // so a follow-up pass (once fetched) could refine this later if needed.
    return {
      title: `The Journal — ${brand}`,
      description: `Routines, ingredient explainers and glass-skin guides from the ${brand} Journal.`,
    };
  }
  if (route.name === "product") {
    // The real per-product title/description is set separately by
    // applyProductSeo() below, called from Product.jsx once it has
    // actually fetched the product from the live catalog — this used to
    // look the slug up in the static data/products.js sample, which was
    // trimmed to a handful of stale slugs (0008_trim_catalog_to_sample.sql)
    // and so silently missed almost every real product, sending EVERY PDP
    // to the noindexed "unknown slug" branch below. This route-level
    // fallback now only covers the brief window before that live fetch
    // resolves (or a genuinely nonexistent slug) — noindexed either way,
    // since neither case has a real product to describe yet.
    return { title: `Product — ${brand}`, description: "Shop authentic K- & J-Beauty skincare.", noindex: true };
  }
  const routes = routeMeta(brand);
  return routes[route.name] ?? routes["404"];
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

/* Shared tag-writing step — both applySeo() and applyProductSeo() end here.
 * Canonical + og:url use origin + pathname only (query/hash stripped) so
 * filtered views like /shop?concern=X consolidate to /shop and never spawn
 * duplicate indexable URLs. */
function writeSeoTags(m) {
  if (typeof document === "undefined") return;
  const url = window.location.origin + window.location.pathname;

  document.title = m.title;
  upsertMeta("name", "description", m.description);
  upsertLink("canonical", url);
  upsertMeta("property", "og:title", m.title);
  upsertMeta("property", "og:description", m.description);
  upsertMeta("property", "og:url", url);
  setRobots(!!m.noindex);
}

/** Apply per-route SEO. Called from App.jsx whenever the route OR the live
 *  store name changes, so a rebrand from /admin/settings retitles the
 *  current page immediately, with no reload. */
export function applySeo(route, brand) {
  writeSeoTags(metaFor(route, brand));
}

/** Apply the REAL per-product title/description, once Product.jsx has
 *  actually fetched it from the live catalog (getProductBySlug/buildPdp) —
 *  see the "product" branch of metaFor() above for why this can't be done
 *  synchronously from the route alone. `product` is the buildPdp() shape
 *  (brand/name/concern/skinType). Call this right after the fetch resolves;
 *  a null/undefined product is a no-op (the route-level fallback already
 *  covers "still loading" and "genuinely not found" correctly on its own). */
export function applyProductSeo(product, brand) {
  if (!product) return;
  const concerns = (product.concern || []).join(", ") || "Skincare";
  const skin = (product.skinType || []).join(", ").toLowerCase() || "all";
  writeSeoTags({
    title: `${product.brand} ${product.name} — ${brand}`,
    description: `Shop ${product.brand} ${product.name} at ${brand}. ${concerns} for ${skin} skin — authentic, authorised stock.`.slice(0, 300),
  });
}
