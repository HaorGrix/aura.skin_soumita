# Changelog

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
