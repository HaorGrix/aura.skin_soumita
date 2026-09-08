/* =================================================================== *
 * The single, shared definition of "is this pathname inside the admin?"
 * -------------------------------------------------------------------
 * Both routers need this exact check — App.jsx's useRoute() to decide
 * whether to mount AdminApp at all, and AdminApp.jsx's own dev-time
 * safeguard to confirm it's still where it thinks it is. It lives in its
 * own file, not inside AdminApp.jsx, because AdminApp is lazy-loaded on
 * purpose (storefront visitors never download a byte of the admin panel) —
 * a static import from App.jsx would pull the whole admin bundle back into
 * the main chunk. Keep this file free of any other admin import.
 *
 * Case-sensitive on purpose: every real link this app ever generates for
 * the admin is lowercase "/admin", and matching case-insensitively would
 * risk treating an unrelated, coincidentally-cased storefront path (none
 * exist today, but nothing rules one out later) as admin territory.
 * =================================================================== */
export function isAdminPath(pathname) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}
