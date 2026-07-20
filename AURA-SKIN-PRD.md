# PRODUCT REQUIREMENTS DOCUMENT
## aura.skin — Client-Side Skincare E-Commerce Experience
**Single Source of Truth for Engineering, Design & Product**

**Document Owner:** Product Management (TPM)
**Status:** In Review • Version 1.1 • Last Updated: 2026-07-20

---

### About This Document
A Product Requirements Document (PRD) is the single source of truth for a project. It defines what we are building, who it is for, why it matters, and how we will know it succeeded. It aligns Product, Engineering, Design, QA, and business stakeholders on one shared understanding before and during delivery.

This PRD documents **aura.skin**, a premium, mobile-first skincare e-commerce web application that is **entirely client-side**. There is no external database (SQL/NoSQL), no application server, and no third-party commerce backend. All persistence, session, catalog, cart, loyalty, order, and review logic is handled in-browser via React state, `localStorage`, and pure computational modules. This constraint shapes every functional and non-functional requirement below.

#### Status Definitions
* **Draft:** Being written; open questions expected; not ready to build against.
* **In Review:** Feature-complete draft circulated to stakeholders for feedback.
* **Approved:** Signed off in Section 1; scope is locked; ready for delivery.
* **Launched:** Shipped to production; kept as the historical record.

#### How to read priority (MoSCoW)
* **Must:** Required for launch; the release fails without it.
* **Should:** Important but not launch-blocking; include if possible.
* **Could:** Desirable; nice-to-have if time allows.
* **Won't (this time):** Explicitly deferred; recorded so it is not lost.

---

## Table of Contents
1. Document Control
2. Overview & Summary
3. Goals & Success Metrics
4. Target Audience & User Personas
5. Scope, User Stories & Requirements
6. Non-Functional Requirements
7. Technical Considerations
8. Design & UX
9. Release Plan & Milestones
10. Cost, Resourcing & Effort
11. Operations, Support & Maintenance
12. Legal, Privacy & Compliance
13. Risks, Dependencies & Open Questions
14. Appendix & Glossary

---

## 1. Document Control

### 1.1 Version History
| Version | Date | Author | Summary of Changes |
| :--- | :--- | :--- | :--- |
| 0.1 | 2026-06-29 | TPM | Initial draft skeleton |
| 1.0 | 2026-07-20 | TPM | Full PRD generated from code audit of the aura.skin client-side build |
| 1.1 | 2026-07-20 | TPM | Integrated senior technical audit: edge-case FRs (FR-28–FR-32), quantitative database-less NFR targets (§6.2), and in-memory data-flow architecture (§7.6) |

### 1.2 Stakeholders & Sign-off
| Role | Name | Responsibility | Approval (☐/☑) |
| :--- | :--- | :--- | :--- |
| Product Manager | Soumita Paul Shama | Owns the PRD & priorities | ☐ |
| Engineering Lead | [Name] | Technical feasibility & delivery | ☐ |
| Design Lead | [Name] | UX / UI direction & design system | ☐ |
| QA Lead | [Name] | Test strategy & acceptance | ☐ |
| Business Sponsor | [Name] | Strategic alignment & competition entry | ☐ |

### 1.3 Reference Documents
* Product summary / roadmap: `AURA-SKIN-PROJECT-SUMMARY.md`
* Order persistence architecture: `ORDER_PERSISTENCE_ARCHITECTURE.md`, `ORDER_SYNC_DELIVERY.md`
* Tracking implementation: `TRACKING_IMPLEMENTATION_SUMMARY.md`
* Delivery / QA checklist: `DELIVERY_CHECKLIST.md`
* Design system source of truth: `src/index.css`, `src/lib/design-system.js`
* Changelog: `CHANGELOG.md`

---

## 2. Overview & Summary

### 2.1 Problem Statement
Building a credible, high-conversion e-commerce experience traditionally requires a backend: a product database, a session store, an order service, a payments gateway, and a rewards engine. For a **design competition entry, a portfolio-grade demo, or a rapid concept validation**, standing up and paying for that infrastructure is disproportionate to the goal — which is to prove the *front-end experience and product thinking*, not to operate a live store.

The problem this project solves: **deliver a complete, believable, end-to-end premium skincare shopping journey — browse, search, cart, loyalty, guest/auth checkout, order history, and order tracking — with zero server infrastructure, zero database, and zero recurring hosting cost beyond static file delivery.** The challenge is doing this *without* the experience feeling like a toy: state must survive refreshes, inventory must behave like real retail (stock-outs, quantity caps), the loyalty economy must be internally consistent, and order status must never go stale.

This matters *now* because the project is a mobile-first e-commerce design competition entry (aura.skin) where judging weights **Consistency, Scalability, and Component architecture** far above raw visual decoration. A systemically coherent client-only build directly targets those criteria.

### 2.2 Proposed Solution
aura.skin is a **single-page React application** that simulates a full K/J-beauty skincare storefront entirely in the browser:

* A **static catalog** of curated products with a mock inventory layer (stock counts, low-stock urgency, out-of-stock states, per-order quantity caps).
* Three global **React Context stores** (Cart, User, Wishlist) that persist to `localStorage` and stay synchronized across surfaces (navbar badges, drawers, pages) through a single hook each.
* A **pure, frontend-only search engine** (prefix ranking + synonym expansion + Levenshtein fuzzy fallback) powering both the shop grid filter and a predictive search dropdown.
* A **loyalty & coupon economy** with points earned per purchase and per verified review, unlocking milestone discount codes — all validated client-side.
* A **guest-capable, 3-step checkout** with field validation, resumable state, at-purchase inventory re-validation, and a mock payment step.
* **Order history and live-feeling order tracking** where status is *derived from the order timestamp* rather than stored, so it can never go stale.

No network calls, no database, no server. The "backend" is deterministic JavaScript and the browser's own storage.

### 2.3 Background & Context
The project began as a competition entry (aura.skin) optimizing for consistency, scalability, and component quality. Early iterations used a fixed loader and simpler cart; the current build reflects several deliberate refinements captured in the repo's architecture notes: order status was moved from *stored* to *derived* (to avoid staleness), the loader became *adaptive* to real page-load performance, and coupon math was consolidated into a single source of truth after a duplicate implementation drifted. The absence of a backend is a **deliberate architectural stance**, not a limitation to be apologized for — it forces disciplined state design that the judging criteria reward.

### 2.4 Strategic Fit
* **Competition objective:** Maximize scoring against weighted criteria — Consistency (25), Scalability (20), Components (15) — by demonstrating systemic front-end architecture over decoration.
* **Portfolio objective:** Serve as a reference implementation of a serious client-only commerce SPA (state modeling, persistence, derived data, error boundaries, code-splitting).
* **Cost objective:** Zero infrastructure spend; deployable as static assets to any CDN/static host.

### 2.5 Objectives & Business Value
* **O1 — Complete the purchase loop end-to-end** (browse → cart → checkout → order → track) with no backend.
* **O2 — Prove state durability**: cart, wishlist, session, orders, and loyalty survive page reloads and per-user login/logout transitions.
* **O3 — Demonstrate a consistent, scalable component & design-token system** across every page.
* **O4 — Deliver premium perceived performance** on mobile via code-splitting, adaptive loading, and smooth scroll — without heavy runtime cost.

---

## 3. Goals & Success Metrics

### 3.1 Goals (SMART)
* **G1:** Ship a fully navigable SPA covering all 12 routes (home, shop, product, cart, checkout, account, wishlist, rewards, offers, journal, about, contact) with lazy-loaded route bundles by the competition final (2026-06-30).
* **G2:** Guarantee 100% state persistence: after a hard refresh on any page, cart contents, applied coupon eligibility, wishlist, auth session, order history, and loyalty points are fully restored.
* **G3:** Keep the interactive experience smooth: maintain 60fps target animations and a first-contentful render that is not blocked by the full catalog or non-critical route code.
* **G4:** Enforce commerce correctness: no line item can ever exceed available stock or the 10-unit per-order cap, and no coupon can be redeemed twice.

### 3.2 Success Metrics / KPIs
| Metric | Baseline | Target | Measurement Method |
| :--- | :--- | :--- | :--- |
| Route bundle strategy | Monolithic | All non-home routes lazy-loaded | Vite build output / chunk analysis |
| State restoration after refresh | N/A | 100% of cart/wishlist/session/orders/points restored | Manual QA matrix + `localStorage` inspection |
| Interaction smoothness (animations) | — | ~60fps on mid-tier mobile | DevTools Performance profiling |
| Initial intro-to-interactive (returning visit) | 6.0s fixed | ≈2.2s–4.35s adaptive | `useAdaptiveLoader` timing / RUM in-page timing |
| Cart/inventory integrity violations | — | 0 (qty never exceeds stock or MAX_PER_ORDER=10) | Automated reducer tests + QA |
| Coupon double-redemption | — | 0 | Validation unit tests (`lib/coupons.js`) |
| Search relevance (top-result correctness) | — | Correct product surfaced for all seeded queries incl. 1–3 char typos | Search test suite over `lib/search.js` |
| Client JS error rate (unhandled) | — | 0 crashes escape route-level `ErrorBoundary` | ErrorBoundary catch logging in QA |
| Accessibility — reduced motion | — | All motion respects `prefers-reduced-motion` | Axe / manual audit |

### 3.3 Non-Goals / Out of Scope
* Persistent server-side database storage of any kind (see 13.4).
* Real payment processing or PCI-scope card handling (payment step is a validated mock).
* Multi-device cloud synchronization of cart/wishlist/orders (state is per-browser).
* Real email/SMS delivery (order confirmation is simulated UI copy).
* Real authentication / password verification / OAuth (auth is an email-keyed local profile).
* Server-side rendering / SEO indexing beyond a static SPA shell.

---

## 4. Target Audience & User Personas

### 4.1 Primary Persona
| Attribute | Detail |
| :--- | :--- |
| Name / Segment | "Glow-Seeker Riya" — mobile-first skincare shopper |
| Role & Context | 20–34, browses on a phone, discovers K/J-beauty via social; wants a fast, beautiful, trustworthy shopping flow |
| Goals | Find products by concern/ingredient, compare, save favorites, check out quickly (guest or account), earn rewards, track her order |
| Pain Points | Slow/janky mobile stores, forced account creation before checkout, losing her cart on refresh, unclear stock/delivery, stale "where's my order" pages |
| Technical Proficiency | Low–Medium (expects the app to "just work"; never inspects storage) |

### 4.2 Secondary Persona
| Attribute | Detail |
| :--- | :--- |
| Name / Segment | "Evaluator Dev / Judge" — reviews the build critically |
| Role & Context | Design competition judge or senior engineer assessing architecture, consistency, and scalability |
| Goals | Verify systemic thinking: state modeling, component reuse, design tokens, edge-case handling, code-splitting |
| Pain Points | Toy demos that break on refresh, inconsistent components, magic values, stale/incoherent state |
| Technical Proficiency | High (will open DevTools, refresh mid-flow, and probe edge cases) |

---

## 5. Scope, User Stories & Requirements

### 5.1 User Stories
* **As a** shopper, **I want** an animated intro that adapts to how fast the page loaded, **so that** returning visits feel snappy and first visits feel premium.
* **As a** shopper, **I want to** search by product, brand, ingredient, or concern — even with a typo — **so that** I can find what I need without knowing exact spelling.
* **As a** shopper, **I want to** filter and sort the shop grid, **so that** I can narrow to my concern, brand, or price.
* **As a** shopper, **I want to** quick-view a product in a modal, **so that** I can assess it without leaving the grid.
* **As a** shopper, **I want to** view a full product page with a gallery, details tabs, related products, and reviews, **so that** I can decide confidently.
* **As a** shopper, **I want to** add items to a cart that clamps to available stock and a max quantity, **so that** I never order more than exists.
* **As a** shopper, **I want** my cart, wishlist, and session to survive a page refresh, **so that** I never lose my progress.
* **As a** guest, **I want to** check out without creating an account, **so that** I'm not blocked at purchase.
* **As a** returning user, **I want** my cart and wishlist to merge (not overwrite) when I log in, **so that** nothing I collected as a guest is lost.
* **As a** shopper, **I want to** apply a coupon and see the discount and free-shipping effects, **so that** I get my reward.
* **As a** member, **I want to** earn points from purchases and reviews and unlock milestone discount codes, **so that** I'm rewarded for loyalty.
* **As a** shopper, **I want** checkout to resume where I left off after a refresh, **so that** I don't re-enter everything.
* **As a** shopper, **I want** inventory re-checked at the moment I place the order, **so that** I'm not sold something that just went out of stock.
* **As a** customer, **I want to** track my order through clearly-labeled stages, **so that** I know where my delivery is.
* **As a** verified buyer, **I want to** write a review only for products I actually purchased, **so that** reviews stay trustworthy — and I earn points for it.
* **As a** user, **I want** any component failure to be contained, **so that** one broken section doesn't crash the whole app.

### 5.2 Functional Requirements (MoSCoW)
| ID | Requirement | Priority | Acceptance Criteria |
| :--- | :--- | :--- | :--- |
| FR-1 | The system shall route between pages via a client-side hash router with route-level code-splitting (home eager, all others lazy). | Must | Navigating changes `window.location.hash`; non-home routes load as separate Vite chunks with a Suspense fallback; unknown hashes render a 404 page. |
| FR-2 | The system shall present a static curated catalog with a mock inventory layer (stock count, low-stock, out-of-stock). | Must | Each product exposes `stock`; `isLowStock` true when `0 < stock ≤ 5`; `inStock` derived from `stock > 0`; out-of-stock items forced to 0 units. |
| FR-3 | The system shall provide predictive search across name, brand, category, ingredients, and concern with synonym expansion and a fuzzy fallback. | Must | Strict prefix-AND match first; if zero hits, Levenshtein fuzzy fallback runs; results ranked by relevance with popularity tiebreak; dropdown shows facet hints + top-N. |
| FR-4 | The system shall let users filter and sort the shop grid, and quick-view any product in a modal. | Must | Filters/sort update the visible grid without a page reload; quick-view opens a modal with add-to-cart. |
| FR-5 | The system shall render a full product page: gallery, product info, detail tabs, related products, and a reviews section, with a loading skeleton. | Must | PDP renders for a valid product id; invalid id is contained by an `ErrorBoundary`; skeleton shows during lazy load. |
| FR-6 | The system shall maintain a cart (add, set qty, increment/decrement, remove, clear) that clamps every line to `min(stock, MAX_PER_ORDER=10)`. | Must | Reducer rejects quantities above the cap; setting qty to 0 removes the line; navbar badge and drawer reflect count/subtotal live. |
| FR-7 | The system shall persist cart, wishlist, and auth session to `localStorage` and restore them on load. | Must | After a hard refresh on any page, cart items, wishlist ids, and login session are fully restored; storage failures are caught and non-fatal. |
| FR-8 | The system shall merge (not overwrite) guest cart and wishlist into the user's saved data on login, and save+clear them on logout. | Must | On `auth_login`, saved and guest lines merge with quantities clamped; on `auth_logout`, current state is written to the per-user key and the active state cleared. |
| FR-9 | The system shall support a mock authentication flow (email-keyed local profile, optional name) with a global auth modal. | Must | Login/signup create or restore a profile in the users store; session persisted; no password verification (documented mock). |
| FR-10 | The system shall provide a loyalty economy: earn 1 point per 1000 spent and 5 points per verified review; unlock milestone coupons at 25/60/120 points. | Must | Points accrue on order placement and review submission; `couponForPoints` returns all coupons whose threshold is met; milestone tiers are AURA3 (3%), AURA5 (5%), AURA8FS (8% + free shipping). |
| FR-11 | The system shall validate and apply coupons client-side, enforcing single-use, first-order-only, and points-unlock rules. | Must | A used code returns `alreadyUsed`; a first-order code requires auth and zero prior orders; a locked milestone code returns `notUnlocked`; valid codes set discount + optional free shipping. |
| FR-12 | The system shall provide a free-shipping progress indicator and apply free standard shipping above the threshold or via a free-shipping coupon. | Should | Free-shipping bar shows remaining amount; standard shipping becomes 0 at/above threshold or when an applied coupon carries `freeShipping`. |
| FR-13 | The system shall provide a 3-step checkout (Information, Delivery, Payment) that is completable as a guest or authenticated user. | Must | Signed-in users skip the gate; guests can proceed via "Continue as guest"; each step validates before advancing. |
| FR-14 | The system shall validate checkout inputs: email format, 4-digit postal code, valid Bangladeshi phone, and (for card) 16-digit number, expiry, and CVC. | Must | Invalid fields block progression and surface inline errors + a toast; card inputs are auto-formatted. |
| FR-15 | The system shall persist and offer to resume in-progress checkout state across refreshes. | Should | Step, form, delivery, payment method, card draft, and guest flag are saved to `localStorage` and rehydrated on return. |
| FR-16 | The system shall re-validate inventory at the moment of order placement and adjust the cart if items sold out or exceed stock. | Must | Sold-out lines are removed with a toast; over-cap lines are reduced to `maxQtyFor`; the order does not proceed until the cart is valid. |
| FR-17 | The system shall place an order (simulated processing delay), generate an order number, record it to history, award points, and lock any used coupon. | Must | On success: unique `AUR-######` number, order pushed to user history, points awarded via `pointsForOrder`, applied coupon marked used, cart cleared, success screen shown. |
| FR-18 | The system shall derive order status from the order timestamp (never store it) and expose a 4-stage tracker. | Must | Status computed from hours elapsed: Confirmed (<0.5h) → Processing (<24h) → Out for Delivery (<48h) → Delivered; every surface reads from `lib/order-status.js`. |
| FR-19 | The system shall provide an account area: profile, order history, order details modal, loyalty tab, and wishlist tab. | Must | Authenticated users see their orders, points, milestones, and can edit profile (email is immutable to preserve the store key). |
| FR-20 | The system shall gate review writing to verified purchasers who have not already reviewed that product, and award points on submission. | Must | `addReview` returns false unless the product is in the user's purchased set and not already reviewed; success creates a verified review and grants POINTS_PER_REVIEW=5. |
| FR-21 | The system shall contain component failures with route-level error boundaries and never blank the whole app. | Must | Each route is wrapped in `ErrorBoundary`; a thrown render error shows a fallback, not a white screen. |
| FR-22 | The system shall provide a global toast notification system for success/error/info feedback. | Should | A single `ToastProvider` renders stacked, auto-dismissing toasts used by cart, checkout, coupons, and reviews. |
| FR-23 | The system shall provide a floating cart FAB that hides on cart/checkout and when the bag is empty, gated behind the intro loader. | Could | FAB appears after the loader completes, is hidden on cart/checkout routes, and self-hides on an empty cart. |
| FR-24 | The system shall provide an adaptive intro loader that tunes pacing by visit history and measured load performance, respecting reduced motion. | Should | First visit = full 6-line sweep; returning = 4 lines scaled by load time and connection type, clamped ~2.2s–4.35s; reduced-motion collapses animation. |
| FR-25 | The system shall provide loop-proof back navigation using an internal route-history stack. | Could | `smartNavigate`/BackButton resolve a sensible target from recorded routes rather than blindly using browser history. |
| FR-26 | The system shall present all prices in BDT via a single formatting utility. | Should | `formatPrice` is the only price renderer; shipping/threshold constants centralized in `lib/shop-config.js`. |
| FR-27 | The system shall support a "Notify Me" flow for out-of-stock products. | Could | Out-of-stock PDPs/cards expose a NotifyMe modal (captured in-memory / local only). |
| FR-28 | The system shall handle `QuotaExceededError` on `localStorage` writes without throwing unhandled exceptions or breaking active UI states. | Must | When storage exceeds quota (~5MB), the system surfaces a non-blocking toast warning ("Storage full; local preferences saved temporarily"), falls back to in-memory state for the active session, and logs a handled warning. |
| FR-29 | The system shall recover gracefully from unhandled mid-process interruptions during heavy operations (e.g., checkout simulation or image asset rendering). | Must | If a process is interrupted (tab closed or app crash mid-checkout), re-hydration detects stale/incomplete states via an `in_progress` transaction flag, clears the partial payload, and safely resets checkout to Step 1 with a toast notification. |
| FR-30 | The system shall enforce automatic memory & event-listener teardown on unmount for all high-frequency client tasks (rAF, timers, smooth-scroll, custom DOM events). | Must | Navigating between hash routes explicitly cancels active `requestAnimationFrame` handles, disposes of `Lenis` smooth-scroll instances, and detaches window listeners (`auth_login`, `storage`) to prevent heap growth. |
| FR-31 | The system shall synchronize cross-tab state mutations via the browser `storage` event to prevent conflicting carts or fragmented sessions. | Should | When `aura-cart` or `aura-session` is modified in Tab A, Tab B listens to the native `storage` window event and automatically re-hydrates its React Context without requiring a manual page refresh. |
| FR-32 | The system shall enforce client-side computational timeout safeguards (circuit breaker) for fuzzy search and Levenshtein distance calculations. | Must | Fuzzy search over `lib/search.js` must abort if execution time exceeds 50ms on the main thread, automatically falling back to strict prefix matching to prevent UI frame drops. |

### 5.3 User Flows

**Flow A — Discover → Purchase (guest):**
1. Intro loader completes (adaptive pacing).
2. User opens predictive search, types a partial/typo query, sees ranked suggestions + facet hints.
3. Navigates to a product page; reviews gallery, tabs, related products, and reviews.
4. Adds to cart (qty clamped to stock/cap); floating cart FAB + navbar badge update.
5. Opens cart drawer → cart page; sees free-shipping progress; applies a coupon (if eligible).
6. Proceeds to checkout; chooses "Continue as guest".
7. Completes Information → Delivery → Payment with inline validation.
8. Places order → inventory re-validated → processing → success screen with order number.
9. Opens tracking modal; status is derived live from the order timestamp.

**Flow B — Login state merge:**
1. Guest adds items and hearts products.
2. At checkout (or navbar), user logs in.
3. `auth_login` event fires; saved per-user cart/wishlist **merge** with guest data (quantities clamped, ids de-duplicated).
4. Order history, points, and unlocked coupons load from the users store.

**Flow C — Loyalty loop:**
1. User places orders (earn 1pt/1000 spent) and writes verified reviews (earn 5pts each).
2. Points cross a milestone (25/60/120) → milestone coupon unlocks.
3. User applies the unlocked code at checkout; discount + optional free shipping apply.
4. On order placement, the coupon is marked used (single-use enforced).

---

## 6. Non-Functional Requirements

### 6.1 Qualitative NFRs
| Category | Requirement |
| :--- | :--- |
| Performance (initial load) | Route-level code-splitting: only the home route and shared shell load eagerly; all other routes are lazy `import()` chunks behind `Suspense`. Adaptive loader keeps returning-visit intro within ~2.2s–4.35s. |
| Performance (runtime) | Derived values (cart count, subtotal, discount, purchased-id set) are memoized (`useMemo`); search is a pure, allocation-light pipeline with a strict-first / fuzzy-only-on-miss strategy so happy-path typing never pays the Levenshtein cost. Target ~60fps animations. |
| Local state management | Three `Context` providers (Cart via `useReducer`, User and Wishlist via `useState`) are the single source of truth; each is consumed through one hook (`useCart`/`useUser`/`useWishlist`). Cross-store coordination uses `auth_login`/`auth_logout` custom DOM events rather than tight coupling. |
| Memory management | Cart lines are **slimmed** to only serializable UI fields (`slim()`) before persistence to keep the `localStorage` payload small and avoid retaining full catalog objects. Wishlist stores **ids only** (not snapshots) so the catalog stays the single source of truth and memory stays flat regardless of list size. Event listeners are registered/cleaned in `useEffect` teardowns; `requestAnimationFrame`/`setTimeout` handles are cancelled on unmount. |
| Persistence & durability | All durable state written to `localStorage` under namespaced keys (`aura-cart`, `aura-wishlist`, `aura-session`, `aura_users_store`, `aura_checkout_state`, `aura-intro-seen`, plus per-user `cart_<email>` / `wishlist_<email>`). Every read/write is wrapped in try/catch and degrades non-fatally on quota/unavailability. |
| Data integrity | Inventory caps enforced in the reducer and re-validated at purchase; order status is **derived, never stored**, to prevent staleness; coupon math consolidated in one module to prevent drift; profile email is immutable to protect the store key. |
| Error handling | Route-level `ErrorBoundary` around every page; storage and perf-API calls are individually guarded; coupon validation returns typed failure reasons rather than throwing; invalid product ids are contained. `QuotaExceededError` degrades to in-memory state with a non-blocking toast (FR-28); interrupted checkouts are detected via an `in_progress` flag and safely reset on re-hydration (FR-29); cross-tab mutations reconcile through the native `storage` event (FR-31); heavy computations trip a 50ms circuit breaker back to strict matching (FR-32). |
| Availability | As a static SPA, availability equals the static host/CDN's uptime; no server dependency to fail. Works after first load even under flaky connectivity (no runtime fetches for core flows). |
| Security | No secrets, no card capture beyond a validated mock (explicitly labeled "demo, no real charge"); no PII leaves the browser. Standard front-end hygiene (no `dangerouslySetInnerHTML` on user input). |
| Privacy / Compliance | All "personal" data (name, email, address, order history) is stored only in the user's own browser and never transmitted. No cookies-based tracking; no third-party analytics beacon required for core flows. |
| Accessibility | Focus trapping for modals (`useFocusTrap`), `prefers-reduced-motion` respected across loader, search typewriter, and animations; semantic labels on the SVG placeholders; keyboard-operable controls. Target WCAG 2.1 AA for interactive components. |
| Computational constraints | All "compute" (search ranking, discount math, points, status derivation) runs synchronously on the main thread over a small catalog; algorithms are chosen to stay cheap (prefix checks before fuzzy; early-exit thresholds in Levenshtein). |
| Localization | Currency is BDT via a single `formatPrice`; copy is English. Phone validation is Bangladesh-specific. Broader i18n is out of scope. |
| Observability | Client-only: `ErrorBoundary` catches, guarded try/catch blocks, and optional console diagnostics. No server-side logging/tracing exists by design. |

### 6.2 Quantitative Targets (Database-Less Architecture Refinements)
Because there is no database or server, traditional query-latency and uptime SLOs are replaced by **in-browser execution, heap, storage, and event-loop budgets**. These are the measurable targets QA verifies via Chrome DevTools (Performance + Memory Heap Snapshot).

| Category | Requirement | Target Metric / Constraint |
| :--- | :--- | :--- |
| Performance (p95 latency) | In-memory search & filter execution time (replacing DB query latency). | **p95 < 16ms** (runs within a single 60fps frame). Strict prefix checks hit `< 2ms`; Levenshtein fuzzy fallback capped at `< 30ms`. |
| Performance (memory limit) | Peak heap memory usage during client-side operations (catalog browsing, gallery tab switches). | **Heap usage < 80 MB** on mobile browsers. Zero heap growth/accumulation across 50 consecutive route transitions. |
| Memory-leak prevention | Unmount cleanup for listeners, animation frames, and React Context subscriptions. | **0 persistent detached DOM nodes** or un-cleared `setTimeout`/`rAF` handles post-route navigation (verified via heap snapshot). |
| Storage-quota management | Serialization payload cap for local persistence stores (`aura_users_store`, `aura-cart`). | Active cart payload **< 15 KB**; total `localStorage` footprint **< 1.5 MB** across all keys (leaves ~3.5 MB buffer for browser variance). |
| File / media constraints | Client-side mock asset handling & inline data-processing limits. | Maximum dynamic image dimensions **2048×2048px**; dynamic client-side image blobs/pre-loads must not exceed **2 MB total in RAM**. |
| State synchronization | Cross-tab reactivity for multi-tab browsing without a persistence layer/WebSocket. | State re-hydration latency **< 100ms** upon receiving a `window.onstorage` mutation event. |
| Resiliency & circuit-breaking | Main-thread blocking threshold for complex JS computations. | Execution timeout at **50ms**. If computation hits 50ms, the task yields back to the event loop (`setTimeout(…, 0)` or `scheduler.yield()`). |

---

## 7. Technical Considerations

### 7.1 Architecture & Dependencies
* **Framework/runtime:** React 19 + React DOM 19, built with Vite 6, styled with Tailwind CSS v4 (`@tailwindcss/vite`).
* **Motion & scroll:** Framer Motion v12 for animation/`AnimatePresence`; Lenis (`lenis/react`) for smooth scrolling.
* **Icons:** `lucide-react`.
* **Routing:** Custom minimal **hash router** (`useRoute` in `App.jsx`) — no router library.
* **State:** React Context (Cart/User/Wishlist) + `useReducer`/`useState`; persistence via `localStorage`.
* **No backend, no database, no API layer, no auth provider, no payment SDK.**

### 7.2 Data Model & "APIs" (all in-browser)
Because there is no database, "entities" are JS objects persisted to `localStorage`. Key stores:

| Storage Key | Shape | Purpose |
| :--- | :--- | :--- |
| `aura-cart` | `[{ id, brand, name, price, image, tone, category, qty }]` | Active cart (slimmed line items) |
| `cart_<email>` | same as above | Per-user saved cart (merge target on login) |
| `aura-wishlist` | `[productId, ...]` | Active wishlist (ids only) |
| `wishlist_<email>` | `[productId, ...]` | Per-user saved wishlist |
| `aura-session` | `{ email, authed }` | Current login session pointer |
| `aura_users_store` | `{ <email>: { profile, points, myReviews, reviewedIds, orders, usedCoupons } }` | The "user database" — an email-keyed map |
| `aura_checkout_state` | `{ step, form, delivery, payMethod, pay, guest }` | Resumable checkout |
| `aura-intro-seen` | `"1"` | First-vs-returning visit flag for the loader |

**Static data modules (bundled, read-only):** `data/products.js` (catalog + inventory pass, `stockFor`, `maxQtyFor`, `MAX_PER_ORDER`), `data/reviews.js` (curated reviews, `POINTS_PER_REVIEW`, `TAKA_PER_POINT`, `pointsForOrder`, seed orders), `data/product-details.js`, `data/product-images.js`.

**Pure logic modules ("service layer"):** `lib/search.js` (search engine), `lib/coupons.js` (coupon registry + `validate`), `lib/order-status.js` (derived status), `lib/rewards-config.js`, `lib/format.js`, `lib/nav-history.js`, `lib/design-system.js`, and hooks `useAdaptiveLoader`, `useFocusTrap`, `useSmoothScroll`.

**Cross-store contract:** `window` `CustomEvent`s `auth_login` / `auth_logout` (payload `{ email }`) coordinate cart/wishlist merge & persistence with the user session — the only "API" between stores.

### 7.3 Integrations & External Dependencies
| Dependency / Integration | Owner / Team | Type | Status / Notes |
| :--- | :--- | :--- | :--- |
| React 19 / React DOM | Meta (OSS) | Library | In use |
| Vite 6 | OSS | Build tool | In use |
| Tailwind CSS v4 | OSS | Styling | In use |
| Framer Motion v12 | OSS | Animation | In use |
| Lenis | OSS | Smooth scroll | In use |
| lucide-react | OSS | Icons | In use |
| Payment gateway | — | Vendor | **Not integrated** (mock only) |
| Database / backend API | — | Service | **Not integrated by design** |

### 7.4 Constraints & Assumptions
* **Constraint:** No server or database — every feature must be expressible with bundled data + browser storage + pure computation.
* **Constraint:** `localStorage` capacity (~5MB) and synchronous access; payloads must stay small (hence slimmed cart lines and id-only wishlist).
* **Constraint:** State is per-browser and per-origin; it does not roam across devices or browsers.
* **Constraint:** All computation is main-thread and synchronous (no Web Workers currently).
* **Assumption:** Catalog remains small (tens of products), so linear search/filter is comfortably fast.
* **Assumption:** Users tolerate a simulated payment/processing step for a demo/competition context.
* **Assumption:** A single user per browser profile at a time (session is a single pointer).

### 7.5 Analytics & Instrumentation
Client-only; no external analytics required for core flows. Candidate in-app events (for optional local instrumentation): `intro_completed`, `search_performed`, `product_viewed`, `add_to_cart`, `coupon_applied`, `checkout_step_advanced`, `order_placed`, `review_submitted`. Destination would be console/local buffer only unless a privacy-safe analytics layer is later added (see 13.4).

### 7.6 In-Memory Data Flow Architecture (Client-Side "Backend")
Since there is no server persistence layer or SQL/NoSQL database, data flow relies on an **event-driven, in-memory architecture** backed by non-blocking browser-storage hooks.

```
+-----------------------------------------------------------------------------------+
|                                  BROWSER CLIENT                                    |
|                                                                                   |
|  +-------------------+       Dispatch Action       +---------------------------+   |
|  |     React UI      | --------------------------> |   React Context Stores    |   |
|  | (Components/Pages)|                             |  (Cart / User / Wishlist) |   |
|  +-------------------+                             +---------------------------+   |
|            ^                                                     |                 |
|            | State Sync                                          | Synchronous     |
|            |                                                     v Commit          |
|  +-------------------+     window.dispatchEvent     +---------------------------+   |
|  | Event Bus (DOM)   | <--------------------------- | Pure Service / Math Layer |   |
|  |  (auth_login,     |                              | (lib/coupons, search,     |   |
|  |   auth_logout)    |                              |  lib/order-status)        |   |
|  +-------------------+                              +---------------------------+   |
|                                                                  |                 |
|                                                                  | Guarded         |
|                                                                  v try/catch       |
|                                                     +---------------------------+   |
|                                                     | Browser LocalStorage      |   |
|                                                     | (Volatile Persistence)    |   |
|                                                     +---------------------------+   |
+-----------------------------------------------------------------------------------+
```

**Step-by-step data-flow execution lifecycle:**

1. **User action / input trigger:** User initiates an action (e.g., `Add to Cart`, `Apply Coupon`, or `Submit Order`).
2. **Pure logic computation (service layer):** Before updating state, data passes through pure, deterministic JavaScript modules:
   * **Inventory validation:** `data/products.js` verifies stock levels and clamps quantity to `min(stock, MAX_PER_ORDER)`.
   * **Discount calculation:** `lib/coupons.js` evaluates coupon rules, order value, and user eligibility.
3. **In-memory state commit:** The validated payload updates the respective **React Context** via `useReducer` or `useState`. Memory footprints are kept minimal by slimming objects (e.g., storing `productId` rather than full snapshots).
4. **Synchronous persistence (storage layer):** Upon React state update, a side-effect (`useEffect`) serializes the slimmed state to JSON and commits it to `localStorage` under namespaced keys inside a guarded `try/catch` block.
5. **Cross-store event dispatch:** If an action impacts multiple stores (e.g., `Login` impacting Cart, Wishlist, and Profile), a custom window event (`auth_login`) is emitted. Unrelated contexts intercept this event to merge guest states with stored user accounts without tight coupling.
6. **Order-derived pipeline (zero-staleness lifecycle):** When an order is completed, only the timestamp (`createdAt: ISO-8601`), items, and final total are saved. Status queries (`Confirmed` → `Processing` → `Out for Delivery` → `Delivered`) pass through `lib/order-status.js` at runtime using `Date.now() - order.createdAt`, eliminating database polling or stale order states entirely.

---

## 8. Design & UX
* **Design system source of truth:** `src/index.css` (color palette, z-index scale — card/sticky/dropdown/modal/toast, easings) and `src/lib/design-system.js` (surface helpers). Single-source tokens are a core scoring lever for consistency.
* **Component library (reused across pages):** `ui/` primitives — `Button`, `Input`, `Field`, `Badge`, `Skeleton`, `OptionCard`, `MagneticButton`, `ProductCard`, `Toast`, `EmptyState`, `ErrorBoundary`, `PhoneInput`, `PromoHint`, `NotifyMeModal`, `BackButton`.
* **Feature clusters:** `home/` (Hero, FeaturedProducts, ShopByConcern, Rituals, WhyAura, Offers, Journal), `shop/` (Filters, SortMenu, QuickViewModal, PredictiveSearch), `pdp/` (Gallery, ProductInfo, ProductTabs, RelatedProducts, PdpSkeleton), `cart/` (CartDrawer, FreeShippingBar, LineItem, OrderSummary), `reviews/` (ReviewsSection, ReviewCard, WriteReviewModal), `account/` (ProfileTab, OrdersTab, OrderDetailsModal, LoyaltyTab, WishlistTab), and global `auth/AuthModal`, `TrackingModal`, `FloatingCart`, `Navbar`, `Footer`, `Loader`.
* **Key interaction & edge-case states:** out-of-stock and low-stock ("Only N left") urgency; empty cart / empty wishlist / empty search; coupon success vs. typed failure reasons; checkout resume; at-purchase sold-out correction; reduced-motion; route-level error fallback; SVG gradient placeholder when a product has no photo.
* **Wireframes / prototype:** [Figma link — to be attached].

---

## 9. Release Plan & Milestones

### 9.1 Phases / Milestones
| Milestone | Scope | Owner | Target Date |
| :--- | :--- | :--- | :--- |
| Core storefront | Catalog, shop, PDP, cart, persistence | Frontend | Complete |
| Commerce loop | Checkout, coupons, loyalty, orders | Frontend | Complete |
| Order tracking | Derived status + tracking modal | Frontend | Complete |
| Polish & adaptive UX | Adaptive loader, a11y, error boundaries | Frontend | In progress |
| Competition final submission | Full QA pass + delivery checklist | TPM/QA | 2026-06-30 |

### 9.2 Rollout Strategy
* **Deployment:** Static build (`vite build`) to a CDN/static host; no migrations (no database).
* **Feature flags:** Not required at this scale; route-level lazy loading is the primary staging mechanism.
* **Rollback:** Redeploy previous static bundle; client state is unaffected by deploys (lives in each browser).

### 9.3 Effort & Timeline Estimates
| Workstream | Owner | Estimate | Dependencies |
| :--- | :--- | :--- | :--- |
| State stores & persistence | Frontend | Done | — |
| Search & shop filtering | Frontend | Done | Catalog data |
| Checkout & loyalty | Frontend | Done | Cart/User stores |
| Tracking & account | Frontend | Done | Orders model |
| QA & a11y hardening | QA | ~1 wk | Feature freeze |

### 9.4 Launch Readiness Checklist
- [ ] QA sign-off complete (see `DELIVERY_CHECKLIST.md`)
- [ ] State-persistence matrix verified (refresh on every route)
- [ ] Inventory/coupon integrity tests passing
- [ ] Reduced-motion & keyboard/focus audit passing
- [ ] All routes lazy-load and 404 fallback verified
- [ ] Build artifact deployed to static host

---

## 10. Cost, Resourcing & Effort
* **Infrastructure / hosting cost impact:** Effectively **$0 beyond static hosting/CDN** — no servers, no database, no managed services. Bandwidth for static assets only.
* **Third-party / licensing / vendor costs:** None — all runtime dependencies are open-source (React, Vite, Tailwind, Framer Motion, Lenis, lucide-react).
* **Human effort:** Front-end + design; no backend/devops/DBA staffing required.

---

## 11. Operations, Support & Maintenance
* **Owning team post-launch:** Frontend/Design (single team). No on-call/backend rotation needed — there is no server to page on.
* **Runbooks / escalation:** "Incidents" are client bugs; triage via reproduction + `ErrorBoundary` fallbacks. Data loss is scoped to a single browser (localStorage clear).
* **SLA/SLOs:** Availability inherits the static host's SLA. No backend SLOs. Maintenance = dependency updates and static redeploys.
* **Known operational note:** Because state is per-browser, user "support" cannot recover another device's cart/orders — this is inherent to the no-backend design.

---

## 12. Legal, Privacy & Compliance
| Area | Consideration | Owner / Status |
| :--- | :--- | :--- |
| Data privacy | Name, email, shipping address, and order history are stored **only in the user's own browser** (`localStorage`) and never transmitted. Minimal privacy surface; no server-side PII. | Product / Low risk |
| Payment data | Card fields are a **validated mock** ("demo, no real charge") — no card data is stored or transmitted; out of PCI scope. | Eng / Low risk |
| Cookies / tracking | No tracking cookies or third-party beacons required for core flows. | Product / Low risk |
| Security review | Front-end-only threat surface (XSS hygiene, no secret handling). A light review recommended before any future backend is added. | Eng / Pending |
| Accessibility compliance | Target WCAG 2.1 AA; reduced-motion and focus management already implemented. | Design/QA / In progress |

---

## 13. Risks, Dependencies & Open Questions

### 13.1 Risks & Mitigations
| Risk | Likelihood | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| `localStorage` cleared/blocked (private mode, quota) → state loss | M | M | All storage access guarded in try/catch and degrades non-fatally; slimmed payloads reduce quota pressure. |
| State does not roam across devices/browsers (no cloud sync) | H | M | Documented as an explicit non-goal; per-user keys keep single-device experience coherent. |
| Perceived "fake" backend if edge cases break (stale status, stock drift) | M | H | Status derived not stored; inventory re-validated at purchase; coupon math single-sourced. |
| Main-thread compute grows with catalog size | L | M | Cheap algorithms + early exits; move to Web Worker/index if catalog scales (future). |
| Loss of a single source of truth via duplicated logic (historical coupon drift) | L | H | Consolidate logic in `lib/` modules; PR review guards against re-duplication. |
| Judges refresh mid-flow and find broken persistence | M | H | Persistence matrix in launch checklist; every route + store covered. |

### 13.2 Open Questions
| Question | Owner | Status |
| :--- | :--- | :--- |
| Should "Notify Me" submissions persist locally or remain ephemeral? | Product | Open |
| Do we add a privacy-safe local analytics buffer for the demo? | Product | Open |
| Should checkout resume auto-prompt or restore silently? | Design | Open |

### 13.3 Decision Log
| Date | Decision | Rationale | Decided By |
| :--- | :--- | :--- | :--- |
| 2026-06 | Order status is **derived from timestamp**, never stored | A stored status goes stale as time passes; derivation keeps every surface consistent | Eng |
| 2026-06 | Cart/wishlist **merge** on login instead of overwrite | Guest-collected items must survive login mid-purchase | Eng |
| 2026-06 | Coupon math consolidated into `lib/coupons.js` | A second implementation was drifting; one source of truth only | Eng |
| 2026-06 | Adaptive loader replaces fixed 6s intro | Returning visits should feel snappy; first visits premium | Design/Eng |
| 2026-06 | Wishlist stores **ids only**, cart lines **slimmed** | Keep catalog the source of truth; minimize memory/storage | Eng |
| 2026-07 | No backend/database — deliberate architectural stance | Targets competition scoring (consistency/scalability) at zero infra cost | Product |

### 13.4 Future Scope / Out of Scope (Deferred)
The following are **explicitly out of scope for this release** and recorded as future considerations:
* **Persistent user database storage** (server-side SQL/NoSQL) for accounts, orders, and reviews.
* **Cloud synchronization** of cart, wishlist, and order history across devices and browsers.
* **Real authentication** (password hashing, OAuth/social login, email verification, password reset).
* **Real payment processing** (gateway integration, PCI compliance, refunds).
* **Transactional email/SMS** for order confirmation and shipping updates.
* **Real inventory service** with live stock decrements and reservation.
* **Admin/CMS** for catalog and content management.
* **Server-side rendering / SEO** and shareable product deep links beyond the hash router.
* **Server-side analytics, observability, and alerting.**
* **Internationalization** beyond BDT/English.
* **Web Worker / indexed search** for large catalogs.

---

## 14. Appendix & Glossary
* **Competitive Analysis:** Positioned against mobile-first K/J-beauty storefronts; differentiator is a fully client-side, systemically consistent experience optimized for design-competition scoring (consistency, scalability, component quality).
* **Glossary:**
  * *Client-side only:* All logic and persistence run in the browser; no server or database.
  * *Derived status:* Order stage computed from elapsed time since placement, not stored.
  * *Slimmed line item:* A cart entry reduced to only the serializable fields the UI needs.
  * *Milestone coupon:* A loyalty discount code unlocked when points cross a threshold (25/60/120).
  * *Merge-on-login:* Guest cart/wishlist combined with (not overwritten by) the user's saved data.
  * *MAX_PER_ORDER:* The hard per-line quantity cap (10 units), independent of deeper stock.
  * *SoT (Source of Truth):* The single authoritative module/store for a piece of data (e.g., `lib/order-status.js` for status, `lib/coupons.js` for coupon math).
  * *Adaptive loader:* Intro whose pacing tunes to visit history and measured page-load performance.

---

*End of document. Generated from a direct audit of the aura.skin source (React 19 / Vite 6 / Tailwind v4, no backend or database).*
