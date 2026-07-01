# aura.skin 🌸

A premium, mobile-first skincare e-commerce experience — built as a submission
for the **HaorGrix Team Challenge**. Frontend-only, fully client-rendered, and
engineered to read like a production storefront rather than a static mockup.

**Glow within. Bloom daily.** ✨

---

## 🚀 Project Overview

aura.skin is a component-driven React SPA that simulates a complete skincare
retail experience — discovery, search, PDP, cart, checkout, accounts, and a
loyalty program — without a backend. The brief for this challenge rewards
**systemic consistency and scalability over one-off decoration** (see
[Judging Criteria](#judging-alignment)), so the codebase is structured
accordingly:

- A single design-token source (`src/index.css`) drives every color, shadow,
  easing, and z-index in the app — no ad-hoc values scattered across
  components.
- A derived-data pipeline (`src/data/products.js`) computes `isOnSale`,
  `discountPercent`, `inStock`, `salesCount`, and badge eligibility **once**,
  so the product card, quick view, and PDP can never drift out of sync.
- State is split by concern (`CartContext`, `UserContext`,
  `WishlistContext`) instead of one monolithic store, keeping each domain
  independently testable and replaceable.

The result is a UI that scales the same way a real production frontend
would: by extending shared systems, not duplicating logic per screen.

## 💅 Tech Stack

| Concern         | Choice                                       |
| ---------------- | --------------------------------------------- |
| Framework        | React 19 + Vite 6                             |
| Styling          | Tailwind CSS v4 (`@tailwindcss/vite`, token-based `@theme`) |
| Motion           | Framer Motion v12                             |
| Smooth scroll    | Lenis (root + isolated dual-pane instances)   |
| State            | React Context API (Cart / User / Wishlist)    |
| Icons            | lucide-react                                  |
| Fonts            | Instrument Serif (display) + Inter (body)     |
| Routing          | Custom hash router (no external dependency)   |
| Persistence      | `localStorage` (cart, auth, wishlist, intro state) |

No backend, no router library, no state management library — every moving
part is hand-rolled and scoped to exactly what the app needs.

## 🏗️ Key Technical Decisions

**Custom hash routing.** Rather than pulling in `react-router` for a
frontend-only competition entry, `App.jsx` implements a minimal `#/...` hash
router. This keeps the bundle lean, sidesteps server-rewrite configuration
entirely (the app is a single static `index.html`), and preserves full SPA
state (cart, scroll position, theme) across navigations without a page
reload — while Lenis maintains buttery scroll performance independent of the
routing layer.

**Accessibility (A11y) is structural, not decorative.** Every icon-only
control across the Navbar, search overlay, filters, and modals carries an
explicit `aria-label`; disclosure UI (filter drawer, sort menu, mobile nav)
wires `aria-expanded`/`aria-controls` to its trigger. `CartDrawer` and
`AuthModal` implement a custom, dependency-free **focus trap**
(`src/lib/useFocusTrap.js`) — captures the triggering element on open, traps
Tab/Shift+Tab inside the dialog, and restores focus on close, all without
interfering with Framer Motion's exit animations.

**Performance — CLS-conscious by default.** Product imagery ships with
explicit `width`/`height`, `loading="lazy"` below the fold, and a `bg-snow`
placeholder layer to prevent flash-of-empty-content. The intro loader
(`src/lib/useAdaptiveLoader.js`) replaces a naive fixed `setTimeout` with a
pacing model that reads real `window.load` timing and
`navigator.connection.effectiveType`: first-time visitors get a full
6-affirmation welcome sweep, returning visitors get a shorter, connection-
aware intro clamped to 2.2–4.35s — so the brand moment never penalizes a
shopper who's already seen it.

**Resilience.** A top-level `ErrorBoundary` isolates render failures so a
broken subtree (e.g. a malformed product entry) degrades gracefully instead
of white-screening the whole storefront.

## 📐 Design Philosophy

Every screen — Home, Shop, PDP, Cart, Checkout, Account, Rewards — shares the
same outer grid contract (`mx-auto max-w-7xl px-5 sm:px-8`) and the same
top-of-page clearance beneath the fixed navbar, so navigating between pages
never produces a visual jolt. Overlays (drawer, modal, dropdown, toast) are
pinned to a single canonical z-index scale rather than magic numbers, which
eliminates an entire category of stacking bugs by construction. The intent
throughout is **consistency as a feature**: a shopper — or a judge — should
never be able to tell which screen was built first.

## 📈 Scalability Note

The design system is built to grow without rework:

- **Central tokens** (`src/index.css` `@theme`) — colors, easings, shadows,
  and the z-index scale are declared once and consumed everywhere as
  Tailwind utilities or CSS variables. Adding a new surface means picking an
  existing token, not inventing a value.
- **Modular component boundaries** — `components/ui` holds primitives
  (Button, Input, Field, OptionCard, ErrorBoundary) that every feature
  folder (`cart`, `auth`, `shop`, `pdp`, `account`, `reviews`) composes from,
  rather than each feature reimplementing its own button or modal shell.
- **One inventory source of truth** — derived product fields are computed in
  a single post-process loop, so new surfaces (a future recommendations
  rail, a comparison view) read the same data every other screen already
  trusts.

## ✨ Core Features

- Mobile-first responsive layout across the full funnel (Home → Shop → PDP →
  Cart → Checkout)
- Predictive search with tokenized prefix matching, a synonym map, and a
  fuzzy fallback for typo tolerance (`src/lib/search.js`)
- Faceted filtering + sorting on the Shop grid, with independent Lenis
  scroll panes for filters and results
- Cart drawer (ASOS-style: no scrim, no body-scroll lock) and a full
  Cart/Checkout flow
- Account dashboard with Profile, Orders, Loyalty Rewards, and Wishlist tabs
- Loyalty/points system with milestone-based coupon unlocks
- Verified-purchase-gated review authoring
- Dark mode (class-based, persisted to `localStorage`)
- Full `prefers-reduced-motion` support throughout

## 🔧 How to Run

```bash
npm install
npm run dev
```

Then open the printed local URL (usually `http://localhost:5173`).

```bash
npm run build     # production bundle
npm run preview   # preview the production build locally
```

## 📁 Project Structure

```
src/
├─ App.jsx                  # Hash router, Lenis root, theme + loader orchestration
├─ index.css                # Tailwind v4 design tokens — single source of truth
├─ context/
│  ├─ CartContext.jsx       # Cart state (items, count, subtotal)
│  ├─ UserContext.jsx       # Auth, profile, loyalty points, coupons
│  └─ WishlistContext.jsx   # Saved items
├─ data/
│  └─ products.js           # Catalog + derived-field post-process pipeline
├─ lib/
│  ├─ search.js             # Tokenized prefix search + synonym map + fuzzy fallback
│  ├─ useFocusTrap.js        # Lightweight modal/drawer focus trap
│  ├─ useAdaptiveLoader.js  # Connection/perf-aware intro pacing
│  └─ useSmoothScroll.js    # Lenis instance hook
├─ components/
│  ├─ ui/                   # Shared primitives (Button, Input, ErrorBoundary, ...)
│  ├─ cart/                 # CartDrawer, LineItem, FreeShippingBar
│  ├─ auth/                 # AuthModal
│  ├─ shop/                 # PredictiveSearch, Filters, ProductCard grid
│  ├─ pdp/                  # Gallery, ProductInfo
│  ├─ account/              # ProfileTab, OrdersTab, LoyaltyTab, WishlistTab
│  ├─ reviews/               # WriteReviewModal
│  └─ home/                 # Hero, FeaturedProducts, Rituals, Journal, ...
└─ pages/
   ├─ Home.jsx, Shop.jsx, Product.jsx
   ├─ Cart.jsx, Checkout.jsx
   ├─ Account.jsx, Rewards.jsx, Wishlist.jsx
   ├─ About.jsx, Contact.jsx
   └─ NotFound.jsx
```

## Judging Alignment

Built against a rubric that weights **Consistency, Scalability, and
Component design** above raw visual flourish — the architectural choices
above (token-driven styling, derived-data single source of truth, shared
primitives) are direct responses to that weighting, not incidental cleanup.

## Notes

- **Reduced motion** is respected everywhere (`prefers-reduced-motion`).
- Dark mode toggles via the moon/sun icon in the Navbar and persists to
  `localStorage`.
- This is a frontend-only build — cart, auth, wishlist, reviews, and loyalty
  state all persist to `localStorage`; there is no server.
