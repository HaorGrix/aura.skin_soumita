# Changelog

## Unreleased
### Added
- Key features: every product and combo can have a list of key features (one per line) in Admin → Products → Details, and right in Admin → Combos → New combo. The product page shows them as a "Key features" checklist under the price; with none set, nothing is shown.
- Admin → Rewards: run the whole loyalty programme from the admin — switch it on or off, name it, set how many taka earn a point and how many points a review earns, and add, edit, switch off or delete the reward tiers (points needed, % or ৳ off, free shipping, how it's described). The Rewards page wording is editable under Content → Rewards Page. Turning the programme off stops points being earned, switches reward codes off and hides the Rewards page link, points badges and account tab.
- Track Order page in the menu: customers enter their order number and checkout phone and see the real status set in the admin (placed, processing, shipped, delivered, or cancelled/refunded), courier and tracking number, items and status history. Works for guest orders; never shows the address or email.
- Order receipt (memo) after checkout: every item with size and quantity, subtotal, discount, delivery and total, with Print / save as PDF. The account's order details show the same saved receipt.
- Private coupons: a 'Show to shoppers' switch per coupon. Private codes still work when typed at checkout but are never suggested on the site.
- 'Eye & Ear Care' category right after Body Care in the menu (renamed from Eye Care, with a new Ear Care subcategory) and a matching home page tile.
- The home page category tiles (Skin Care, Hair Care, … Combo) are now edited in the admin under Content → Category Tiles: add, remove or reorder tiles and change each one's picture and link.
- Single-size products get a Size field on the admin Pricing tab (e.g. 50ml), shown on the product card and page.
- Full-screen product photos can be swiped (or moved with arrows) through every photo, with a photo counter.
- The shop's category filter lists every category from the admin, sub-categories under their parent; picking a parent shows everything inside it.
- Combos have their own Admin → Combos section: create a combo (or turn an existing product into one), pick the products inside it and how many of each, see the saving, and remove it again. The product page shows "What's inside" and how much the shopper saves, and the home Combo tile lists every published combo, whatever category it is filed under.
- The shop shows 16 products per page with numbered page buttons (the page is kept in the link), instead of one endless scrolling list.
- Forgot password for shoppers: enter the email, get a 6-digit code by email (valid 15 minutes), choose a new password and you're signed in.
- Category tiles use one fixed design (blue arch, rays, navy name bar): the admin uploads only a cut-out "sticker" and types the name, and the tile is drawn to match the others.
- Order history follows the account: a signed-in shopper sees every order placed with their email (on any phone), with its real status, and their real points balance.
- Reviews are real: a buyer reviews a delivered item from Order History, it appears on the product page straight away and the points are added on the server. New Admin → Reviews screen to see every review and hide or show one.

### Changed
- Out-of-stock products now come after every in-stock product in the shop, whatever the sort or search. Their photos stay in full colour (no grey "Out of Stock" overlay), and the card and product page show a plain "Stock Out" label instead of "Notify Me".
- Coupons are private unless "Show to shoppers" is switched on for them; existing ordinary codes were made private so checkout no longer lists them automatically. Rewards codes still appear to members who have earned them.
- Phones: the bill breakdown (subtotal, discount, delivery, total) is always shown right above the checkout button; tapping a form field no longer zooms the page, and tapping + / Add quickly no longer zooms in; small text across the site is darker.
- Checkout, coupon and bag fields no longer offer the browser's saved names, addresses or codes.
- The Our philosophy and How to use texts collapse behind See more like the story.
- Home page banners, the sale banner, a concern tile, the journal cover and the review pictures load about 95% lighter (same size and shape), so they no longer appear cut off at the bottom while loading on mobile data; review pictures are shown whole instead of cropped.

### Removed
- The "Notify Me" back-in-stock popup: it never saved the request, so nobody was ever notified.
- The "Join the glow letter" newsletter box in the footer. It never saved the email or sent the promised 10% code.
- The About page's "30-Day Money-Back Promise" card and "30-day refund window" stat are gone; they promised refunds the shop's 7-day return policy doesn't offer.
- The home page "What our customers are saying" section no longer shows the four demo pictures from other brands; it reappears as soon as real review pictures are added and featured in Admin → Testimonials.

### Fixed
- UI polish pass across the shop: the product page's "Targets" shows concern names instead of codes; ingredient amounts like "5,000 ppm" no longer split into two (11 products repaired, and the admin ingredient field no longer splits at a thousands comma); out-of-stock products no longer lead the home Best Sellers / New Arrivals rows or the "Complete your ritual" / "You may also love" rows; the phone field only shows its error after the shopper leaves it or submits, not on an untouched form; the contact email typo (gamil.com → gmail.com), address punctuation, contact intro and FAQ answers are corrected (the reviews answer was out of date); the home stats read "Authentic brands" and "48 Hour dispatch"; desktop category tiles and the deal cards centre on a short last row; a journal post without a cover shows a branded placeholder instead of a blank box; Apply, the checkout step marker and the current page number use the brand colour; banner dots have a finger-sized tap area; "Clear bag" lines up with the bag title.
- The old preview copy of the shop (aura-skin-soumita.vercel.app) still ran on the retired database, so it showed no combos and any order placed there was lost. Every page of it now redirects to the same page on www.skintheorybd.shop.
- The Combos page could show "0 products" even with published combos when the combo list failed to load for a visitor; it now loads through one public lookup that works the same for guests, shoppers and staff, retries once, and shows a Retry message instead of an empty page if it still fails.
- The home Combo tile and the hero banner's combo link opened an empty shop ("No matches… yet"): they pointed at a category that never existed (and at the old preview domain), and shoppers weren't allowed to read combo contents, so "What's inside" never showed either. The tile now opens Combos, and shows "Combos are on the way" while there are none.
- The Rewards page showed tiers (SKN3/SKN5/SKN8FS) and earn rates (1 point per ৳1000, 5 per review) that didn't exist; it now shows the real reward codes and the rates actually set.
- Bag page on iPhone: a long product name made the page wider than the screen, cutting off prices, the promo Apply button and the order total. Every page and pop-up was re-checked on 320–390px phones (Safari and Chrome); the product page tabs and "Complete your ritual" strip no longer stick out at the edges.
- The floating cart button no longer drifts by itself on phones (up/down while scrolling, or sideways): it stays exactly where the shopper drags it, a tap opens the bag, and it only moves back inside the screen when the phone is rotated.
- Meta Pixel: events fired as a page first opened (a product page's ViewContent, checkout's InitiateCheckout) were dropped because the pixel hadn't loaded yet; they are now held and sent once it loads. Opening a product no longer counts two page views.
- Uploading product photos could reverse the photo order and swap the main photo (seen on The Ordinary Niacinamide); the order is now saved in one step, a second upload can't start mid-way, and the affected products were repaired.
- Tapping a product in the header search could open a broken page when the search was used before the catalog loaded; it now always opens the real product.
- The placeholder size "Standard" is no longer shown on cards, the bag or receipts.
- Changing the price of many products at once in the admin did nothing (it failed silently). It now reprices every size of the selected products in one step, rounds to whole taka, clears a "compare at" price that would no longer be higher, and shows an error if anything goes wrong.
- Product photos on the shop cards sit on white in their 4:5 frame, without the pink strip that showed under square photos.

- Star ratings are real: products showed made-up ratings (e.g. 4.8★) with no customer reviews behind them. Stars now appear only once a product has approved customer reviews ("No reviews yet" until then), new products no longer start at 4.8, and the About page no longer claims a 4.9★ average.
- The footer's Track Order link opens the tracking page (it opened the account page) and Shipping & Returns opens the shipping page (it opened Offers).
- Shop category filter: picking a category replaces the previous one, and a category picked in the sidebar clears the one chosen from the menu, so the grid always matches the selection. Refreshing a filtered page no longer shows an empty grid.
- Brands and categories added in the admin now appear in the shop filters and search suggestions.
- Search: pressing Enter shows the same results as the suggestions, the search panel closes by itself after Enter or picking a result, and the separate Enter button is gone.
- Products with a single size now show that size; product photos are shown whole instead of cropped; the product page no longer repeats the description, and the story has See more and darker text; carousel arrows are transparent.
- Mobile checkout no longer zooms in on form fields; the floating cart button stays where it is dragged.
- The postcode entered at checkout is now saved with the order (it was always sent empty). The checkout form is cleared after an order instead of pre-filling the next customer's checkout, and the name placeholders are neutral.
- Order history no longer shows ৳0 totals or claims every order is Delivered after two days.
- No more full-screen loading spinner when moving between pages; hero banners open in the same tab instead of reloading the site.
- Visitor tracking: the site's security policy blocked the Meta Pixel, so no visits or purchases were recorded; it now loads and counts every page view. The sitemap uses the www address.
- The "designed & developed by HaorGrix" footer credit is now in the page's HTML itself, so search engines see it as a real followed link instead of one that only appears after JavaScript runs. The live sitemap.xml and robots.txt now list the www address (the deployed copies were stale).

### Security
- Shopper log-in is real: an email that never signed up, or a wrong password, is refused (any email used to be accepted). New accounts confirm their email once with a link, so nobody can open an account in someone else's name.

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
