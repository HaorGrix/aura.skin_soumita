# aura.skin — Project Summary

## 1. Project Overview

A premium, mobile-first K/J-Beauty e-commerce frontend built as a competition entry for the **HaorGrix Team Challenge (final 30 Jun 2026)**. Top judging weights are Consistency (25), Scalability (20), UX clarity (15), Component thinking (15) — so the build prioritizes systemic design over decoration.

Niche: clean K-Beauty skincare. Tagline: **"Glow within. Bloom daily."**

## 2. Tech Stack

- **React 19** + **Vite 6** (route-level code-splitting via `React.lazy`)
- **Tailwind CSS v4** (`@tailwindcss/vite`, theme tokens in `src/index.css`)
- **Framer Motion v12** (motion + `useReducedMotion`)
- **Lenis 1.1** smooth-scroll (root + isolated per-pane instances)
- **lucide-react** icons
- Fonts: **Instrument Serif** (display) + **Inter** (body)
- Hash router (no library) — `#/shop`, `#/product/:id`, `#/cart`, `#/checkout`, `#/account`
- State persisted to `localStorage` (cart, wishlist, user, intro-seen)
- No backend — all mock; ready to swap to real APIs

## 3. Design System

**Tokens (in `src/index.css` `@theme`):**
- Colors: `ink`, `ink-soft`, `line`, `snow`, `petal`, `rose`, `magenta`, `magenta-deep`, `cyan`, `cyan-soft`, `gold`, `gold-soft`
- Fonts: `--font-serif` (Instrument Serif), `--font-sans` (Inter)
- Easing: `--ease-aura`, `--ease-soft`
- Shadows: `--shadow-soft`, `--shadow-lift`, `--shadow-glow-pink`, `--shadow-glow-cyan`
- **Z-index scale** (single source of truth): `--z-card: 1`, `--z-sticky: 30`, `--z-dropdown: 70`, `--z-modal: 150`, `--z-toast: 200` — every overlay routes through these
- Custom utility: `@utility scrollbar-thin` (themed thin scrollbar for isolated scroll containers)
- Dark mode: class-based (`<html class="dark">`), dominant default

## 4. Key Features Built

| Area | What's there |
|---|---|
| **Adaptive Loader** | First visit: 6 affirmations × 900ms. Return: 4 affirmations, `perLine` derived from `performance.now()` window-load + `navigator.connection.effectiveType`, clamped to total [2.2s, 5.5s]. `localStorage["aura-intro-seen"]` flag. |
| **Home** | Hero (video bg + parallax), Affirmations, FeaturedProducts, ShopByConcern (8 local images + gradient halo, `object-contain`), Rituals, Journal (6 K-beauty articles w/ excerpts + Read more), WhyAura, Footer. All sections at uniform `py-14 sm:py-20`. |
| **Shop** | Dual-pane independent scroll on desktop (left filters, right grid) — each pane gets its own Lenis. Mobile: bottom-sheet drawer. Sticky toolbar w/ proper stacking context. |
| **Predictive Search** | 300ms debounced, tokenized word-prefix AND match, synonym map (`facewash→cleanser` etc.), **relevance scoring** (name-prefix > brand-prefix > contains > keyword), **fuzzy fallback** (Levenshtein) only when strict gives 0. Dropdown with facet hints (Brand · / Category ·), product rows w/ thumb+price, popular searches + trending in empty state. Animated typing placeholder. |
| **Filters** | Availability (In Stock / On Sale), Skin Type, Concern, Brand, Category, Price. Per-section internal scroll. Active chips. Hash-query parsing (`?concern=Hydration`). |
| **Sort** | Featured (popularity), **Best Selling** (curated `salesCount` desc, top 10 get Best Seller badge dynamically), Price asc/desc, Top Rated, Newest. Image-first bubble-up ONLY on default "Featured" view. |
| **Product Card** | Quick-add → **ShoppingBag** icon (not `+`), wishlist heart with spring animation, Notify Me (OOS), discount ribbon (`-NN%` magenta), grayscale + Out-of-Stock overlay, struck `originalPrice`. |
| **PDP** | Gallery (mobile-cap aspect, object-cover hero, lightbox, thumbnails, video tab), ProductInfo (variants, qty stepper, magenta sale price, wishlist, sticky mobile add-bar, "Complete the ritual" bundle), Tabs (Description / Ingredients / How to Use / Reviews / Shipping), RelatedProducts. Gallery `object-contain` on Concern tiles only. |
| **Reviews & Loyalty** | 24 curated BD/Indian reviews + seeded generator (~6 per PDP). In-section keyword search + sort (Newest / Most Helpful / Highest Rated). **Authoring lives only in Account page** (anti-farming). Verified-purchase gated. Milestones 50/100/200 → coupons AURA3 (3%), AURA5 (5%), AURA8FS (8% + free ship). Navbar `87 pts` pill. |
| **Cart Drawer** | Slides from right, **no backdrop scrim, no body-scroll lock** — shopper keeps browsing. Esc closes. Persistent line items. Free-shipping bar. Subtotal + checkout. |
| **Wishlist** | Global `WishlistContext`, persistent, heart icon in navbar with count badge, sync across card + PDP + navbar. |
| **NotifyMe modal** | Back-in-stock waitlist (mock) on OOS products. Email validation, success state. Reused by card + PDP + Mobile add-bar. |
| **Account** | My Purchases / Order History (3 mock orders), Aura Rewards card w/ progress bar to next milestone, unlocked coupons with codes, per-item "Write a review · +1 pt" → flips to "Reviewed" badge. |
| **Toast** | Provider-based (success/error/cart/info variants), bottom-center mobile, bottom-right desktop, `z-toast`. |

## 5. Reusable Components

**`src/components/ui/`**
- `Button` — magnetic + variants (primary/secondary/ghost/solid)
- `Badge` — variants (barrier/exfoliation/bestseller/new/sale)
- `ProductCard` — the grid tile (covers in-stock + OOS + sale states)
- `NotifyMeModal` — back-in-stock waitlist
- `Toast` + `ToastProvider`
- `Skeleton`, `ProductCardSkeleton`, `EmptyState`
- `MagneticButton`

**`src/components/shop/`**
- `PredictiveSearch` — input + animated placeholder + dropdown
- `Filters` (`FilterPanel`, `ActiveChips`, `EMPTY_FILTERS`, `countActive`)
- `SortMenu`
- `QuickViewModal`

**`src/components/pdp/`**
- `Gallery` (zoom, lightbox, video tab)
- `ProductInfo` (variants + qty + wishlist + sticky mobile bar)
- `ProductTabs`
- `RelatedProducts`
- `PdpSkeleton`

**`src/components/reviews/`**
- `ReviewCard` (+ `<Stars>` helper)
- `ReviewsSection` (search + sort + list, PDP-mounted)
- `WriteReviewModal` (Account-only authoring)

**`src/components/cart/`**
- `CartDrawer` (slide-from-right, no-scrim)
- `LineItem`, `FreeShippingBar`, `OrderSummary`

**`src/components/`**
- `Loader` (uses `useAdaptiveLoader`)
- `Navbar` (theme toggle, points pill, wishlist count, cart count, mobile menu)
- `Hero`, `Footer`

## 6. Contexts & Libraries

- `CartContext` — items, qty, subtotal, drawer open/close, persisted
- `WishlistContext` — Set of ids, `toggle/has/count`, persisted
- `UserContext` — mock user, points (`87` seed), orders, written reviews, `addReview()` awards 1 pt, milestone helpers
- `lib/search.js` — `tokenize`, `matchesSearch`, `fuzzyMatches`, `relevanceScore`, `suggest`, `useTypewriter`, `SEARCH_HINTS`, `POPULAR_SEARCHES`
- `lib/useAdaptiveLoader.js` — first vs return visit pacing
- `lib/useSmoothScroll.js` — isolated Lenis per scroll container (`autoRaf`)
- `lib/format.js` — `formatPrice`, `discountPct`
- `lib/design-system.js` — class fragments (`surface`, `btn`, `badge`)
- `lib/shop-config.js` — Shop constants

## 7. Data Layer

- `data/products.js` — 179-product catalog, `queryProducts()` engine, `PRODUCTS`/`BRANDS`/`CATEGORIES`/`CONCERNS`/`SKIN_TYPES`/`PRICE_RANGES`/`SORTS`/`AVAILABILITY`. Post-process loop derives `isOnSale`, `discountPercent`, `originalPrice`, `inStock`, `salesCount`. `CURATED_SALES` map (23 hero products w/ realistic numbers) + popularity-driven fallback. Top 10 by salesCount dynamically tagged with **Best Seller** badge.
- `data/product-details.js` — PDP builder: spreads catalog item + adds variants, benefits, ingredients (with emoji+blurb), howTo, philosophy, reviews (curated + generated), ratingBreakdown, shipping
- `data/reviews.js` — 24 curated reviews (BD/Indian voices), `SEED_ORDERS` (3 mock orders), `MILESTONES`, `productById`
- `data/product-images.js` — Vite `import.meta.glob` registry for bundled assets

## 8. Current State

**Working end-to-end:**
- Loader (adaptive timing), Home (all sections), Shop (search + filters + sort + infinite scroll + dual-pane scroll + drawer cart), PDP (gallery + info + tabs + reviews + related), Cart drawer, Checkout (basic), Account, Wishlist persistence, Reviews + Loyalty loop, NotifyMe, Toasts, Dark mode (default), Mobile-first across 320–1440px (verified live)

**Pending (HaorGrix-required + nice-to-haves):**
- **About page** — required, not yet built
- **Contact page** — required, not yet built
- Dedicated Wishlist page (state exists, no UI)
- **Compare products** (bonus credit)
- Checkout polish (forms, validation, success state)
- Coupon code application at checkout (the codes exist, not wired into totals)
- ~40 of 179 catalog products still render gradient (no real image)
- 404 / error route
- Search dropdown: blur-edge cases

## 9. Important Decisions

- **Single source of truth for inventory** — `salesCount`/`isOnSale`/`inStock`/`compareAt`/`discountPercent`/`originalPrice` all derived once in the products.js post-process loop. PDP/QuickView/Card consume the same fields — no parallel math.
- **Z-index design system** — every overlay uses the shared `--z-*` tokens via Tailwind arbitrary values; no more ad-hoc `z-[150]` magic numbers.
- **Adaptive loader** — first-time visitors get the full warm experience; returning visitors get pacing tuned to their actual load speed + connection. Replaces the prior fixed `setTimeout(6000)`.
- **Per-pane Lenis** — desktop Shop has two independent scroll columns (filters + grid), each with its own Lenis instance (`autoRaf: true`) for buttery momentum without body-scroll conflicts.
- **Search engine pipeline** — word-prefix AND match prevents substring bleed (`mis` no longer matches `blemishes`); relevance score ranks within hits; fuzzy Levenshtein fallback fires only when strict gives 0. Synonym map covers natural language (`facewash → cleanser`).
- **Cart drawer = no scrim, no body lock** — shopper keeps browsing/adding while the drawer is open (ASOS/Sephora model). Quick-add icon switched from `+` to `ShoppingBag` for clarity.
- **Reviews authoring gated to Account** — verified-purchase only, no farming for points. PDP reviews tab is read-only.
- **Dynamic Best Seller badge** — top 10 in-stock products by `salesCount` get tagged in the post-process loop. Badge follows the data, not hardcoded.
- **Concern tiles `object-contain`** — preserves whole images on the soft gradient halo (user-added local assets).
- **Image-first bubble-up only on default sort** — explicit sorts (Best Selling, Price, etc.) honour their order exactly; bubble-up doesn't override.
- **Search dropdown layering** — toolbar is `lg:relative lg:z-sticky` so its absolute child (the dropdown at `z-dropdown`) paints above the body grid. Filter checkboxes are `sr-only` absolutes; pane needs `relative` to contain them.

## 10. Next Steps (priority order)

1. **About page** — HaorGrix-required. Brand story, sustainability, team. Reuse Footer/WhyAura pattern.
2. **Contact page** — HaorGrix-required. Form (name/email/message), FAQ accordion, social links, store hours. Reuse `Button`, `Toast`.
3. **Wishlist page** (`#/wishlist`) — render the persisted Set using `ProductCard`. State is already global.
4. **Compare products** (bonus credit) — side-by-side card with shared attributes (price, rating, ingredients, skin type). Add wishlist-style toggle on cards.
5. **Coupon application at checkout** — multiply subtotal by milestone discount; lock to one code at a time.
6. **Checkout polish** — multi-step (Shipping → Payment → Review), inline validation, success page with order summary.
7. **Empty / error / 404 states** — global ErrorBoundary + a styled NotFound page.
8. **Fill remaining product images** — 40 SKUs still render gradient; either add real assets or generate AI placeholders.
9. **Cross-page page transitions** — Framer Motion shared-layout for smooth route shifts.
10. **Performance pass** — split the 553kB main chunk via `manualChunks` (Framer/Lenis/lucide as vendor).

---

_Last updated: feature-complete through Loader + Home + Shop + PDP + Reviews/Loyalty + Cart drawer + Wishlist. Build clean. Live at `npm run dev` → http://localhost:5173/._
