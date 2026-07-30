/* In-app route history — the browser stack can't answer "where did I come from?"
 * for this SPA. Hash navigation never leaves the document, so `document.referrer`
 * is frozen at the original page load, and `history.state.idx` is a React Router
 * construct that doesn't exist here (our router is the hash parser in App.jsx).
 *
 * So we keep our own stack. It lives in sessionStorage to survive a reload but
 * die with the tab. */

import { navigate } from "./navigate.js";

const KEY = "skinscript-nav-stack";
const MAX = 20;

/* Routes that form the purchase funnel. Backing into these from a catalog page
 * is what created the Shop → Cart → Shop → Cart trap: "Continue Shopping"
 * PUSHES a fresh Shop entry rather than popping, so the previous entry really
 * is the cart, and a blind history.back() is correct-but-useless. */
const TRANSACTIONAL = new Set(["cart", "checkout"]);

/* Where a shopper is browsing, as opposed to buying. */
const CATALOG = new Set(["shop", "product", "offers", "journal", "wishlist"]);

function read() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function write(stack) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(stack.slice(-MAX)));
  } catch {
    /* non-fatal */
  }
}

/** Record a visit. Consecutive duplicates are collapsed so re-renders and
 *  same-route query changes don't inflate the stack. */
export function recordRoute(name) {
  if (!name) return;
  const stack = read();
  if (stack[stack.length - 1] === name) return;
  stack.push(name);
  write(stack);
}

/** The most recent visited route that isn't `current`. */
export function previousRoute(current) {
  const stack = read();
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i] !== current) return stack[i];
  }
  return null;
}

/**
 * Resolve a loop-proof back target for the route we're currently on.
 *
 * If the previous entry is part of the purchase funnel and we're now browsing
 * the catalog, going "back" would drop the shopper into the bag they just chose
 * to leave — so we send them home instead. Returns a hash, never null.
 */
export function backTargetFor(current) {
  const previous = previousRoute(current);

  if (!previous) return "/";
  if (TRANSACTIONAL.has(previous) && CATALOG.has(current)) return "/";

  return previous === "home" ? "/" : `/${previous}`;
}

/**
 * Navigate to `targetHash` WITHOUT growing the history stack when we'd simply
 * be returning to where we came from.
 *
 * This is the fix at the source. "Continue shopping" used a plain <a href>, so
 * leaving the bag PUSHED a second Shop entry: Shop → Cart → Shop. The browser's
 * own back button then walked into the cart, and the cart's link pushed Shop
 * again — an unbounded stack the user can never escape by going back.
 *
 * When the target is already the entry behind us, pop to it instead of pushing
 * a duplicate. The stack stays flat and native Back behaves the way a shopper
 * expects.
 */
export function smartNavigate(targetPath, targetRoute, currentRoute) {
  if (previousRoute(currentRoute) === targetRoute && window.history.length > 1) {
    window.history.back();
    return;
  }
  navigate(targetPath);
}
