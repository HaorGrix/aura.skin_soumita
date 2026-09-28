# Changelog

## Unreleased
### Added
- Every image uploaded in the admin panel (product photos, hero/CMS banners, testimonials, journal images) is now compressed in the browser before upload: resized to at most 2000 px (2400 px for banners) and saved as WebP. A typical 1–2 MB photo becomes 85–150 KB; large phone photos that used to be rejected for size are now accepted.
- A one-off script compresses the product photos already in Supabase Storage to WebP and repoints product galleries and order history at the smaller files (`scripts/compress-storage-images.mjs`, dry run by default). With `--delete-originals` it also removes each replaced original from Storage after saving a local backup, bringing product photo storage from 1.15 GB back under the free plan's 1 GB limit.

### Changed
- The shop's backend (database, staff login, product images, edge functions) now runs self-hosted on the shop's own server instead of Supabase cloud, so there are no plan quotas or cloud usage limits. All data, staff accounts and images were copied and checked identical before the switch; nightly database and file backups are kept for 14 days. Password-reset and staff-invite emails now come from noreply@skintheorybd.shop. Setup and restore steps are in deploy/SELF-HOSTING.md.

### Removed
- Shoppers no longer receive an email sign-in link. Order History now lists the orders placed on that device, and reviews written there are saved to the shopper's own account in that browser. Server-side order history is no longer shown on the storefront, so no customer's orders can be looked up by someone else. Staff sign-in, staff invites and the admin "Forgot password" email are unchanged.

### Fixed
- Order History shows the products in each order again. It looked products up in the old bundled catalog, so items sold from the live catalog were silently missing and could not be reviewed.

### Changed
- Product and homepage images bundled with the site now ship as WebP capped at 2000 px, cutting them from 57 MB to 19 MB (built site: 61 MB → 27 MB), so product grids and the homepage load noticeably faster.

## [2026-07-01]
### Changed
- Refactored `UserContext.jsx` to dynamically bind loyalty points and order history to the logged-in user's email using `aura_users_store` in `localStorage`.
- Removed `GLOW10` promo code from `shop-config.js`, retaining only `BLOOM5`.

## [2026-06-30]
### Changed
- Relocated the text animation marquee from immediately below the Hero section to the top announcement bar above the navigation menu in [Navbar.jsx](file:///e:/claude%20for%20antigravity/skincare%20web/src/components/Navbar.jsx).
- Removed the marquee from the [Affirmations.jsx](file:///e:/claude%20for%20antigravity/skincare%20web/src/components/home/Affirmations.jsx) component below the Hero section.

### 2026-09-01
- Implemented mobile touch drag-and-drop support for ImageManager.
- Fixed global mega-menu search to use live Supabase products.
- Fixed predictive search to accurately filter short queries using prefix logic.
- Fixed product search card linking to invalid slugs.
- Resolved mobile scroll conflicts on Swiper and drag-and-drop components by implementing a 400ms long-press delay and adjusting touch thresholds.
- Fixed critical mobile UI freeze during image uploads by removing HEIC from the `accept` attribute, forcing native OS off-thread JPEG conversion instead of relying on main-thread WASM conversion.
- Optimized ImageManager with Optimistic UI updates for instant drag-and-drop reordering feedback and non-blocking local Object URL previews for uploads and replacements.
