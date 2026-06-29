/* =================================================================== *
 * aura.skin — REVIEWS + LOYALTY DATA
 * -------------------------------------------------------------------
 * Curated, realistic reviews from Bangladeshi/Indian shoppers, mapped
 * to real catalog product ids. These seed the public review lists; the
 * generator in product-details.js tops each PDP up to ~6 reviews so no
 * product ever looks empty (scales to the full catalog).
 *
 * Also: the mock signed-in user's ORDER HISTORY — only products that
 * appear here are eligible for a "verified review + 1 point".
 * =================================================================== */
import { PRODUCTS } from "./products.js";

/* Fast id → product lookup for order history / thumbnails. */
export const productById = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));

/* Loyalty milestones (single source of truth for points → rewards). */
export const MILESTONES = [
  { points: 50, code: "AURA3", reward: "3% discount coupon", short: "3% off" },
  { points: 100, code: "AURA5", reward: "5% discount coupon", short: "5% off" },
  { points: 200, code: "AURA8FS", reward: "Free shipping + 8% discount", short: "8% off + free shipping" },
];

export const POINTS_PER_REVIEW = 1;

/* ------------------------------------------------------------------ *
 * Curated reviews (24) — distributed across products.
 * ------------------------------------------------------------------ */
export const CURATED_REVIEWS = [
  // COSRX Snail 96 Essence
  { id: "c1", productId: "cosrx-advanced-snail-96-mucin-power-essence", name: "Nusrat Jahan", stars: 5, title: "Bouncy skin in 2 weeks 🐌", body: "Ordered during the campaign and delivery to Dhaka took 4 days. My dehydrated cheeks finally feel plump and the redness around my nose calmed down. A little tacky if you layer too much, so I use 2 drops only.", daysAgo: 6, helpful: 41, hasPhoto: true },
  { id: "c2", productId: "cosrx-advanced-snail-96-mucin-power-essence", name: "Arjun Mehta", stars: 4, title: "Works, but go slow", body: "Genuine product, holographic sticker matched. Took almost 3 weeks to notice the glow so be patient. Dropping a star only because the pump can get a bit clogged near the end.", daysAgo: 19, helpful: 12, hasPhoto: false },

  // Anua Heartleaf 77 Toner
  { id: "c3", productId: "anua-heartleaf-77-soothing-toner", name: "Sadia Islam", stars: 5, title: "Holy grail for sensitive skin", body: "I have super reactive skin and this is the only toner that never stings. I do the 7-skin method with it at night. Packaging arrived sealed and bubble-wrapped properly. Repurchasing for sure.", daysAgo: 3, helpful: 58, hasPhoto: true },
  { id: "c4", productId: "anua-heartleaf-77-soothing-toner", name: "Rohan Kapoor", stars: 4, title: "Calming and lightweight", body: "Soothes my post-shave irritation really well. Absorbs fast, no sticky feel. Wish the 250ml bottle had a pump though — pouring it gets messy.", daysAgo: 27, helpful: 9, hasPhoto: false },

  // BOJ Relief Sun
  { id: "c5", productId: "beauty-of-joseon-relief-sun-rice-probiotics-spf50", name: "Tahsin Rahman", stars: 5, title: "Best sunscreen I've used in BD heat", body: "No white cast on my medium-brown skin, no stinging in the eyes even when I sweat. Feels like an essence. Perfect under the harsh Dhaka sun. Already on my third tube.", daysAgo: 9, helpful: 73, hasPhoto: true },
  { id: "c6", productId: "beauty-of-joseon-relief-sun-rice-probiotics-spf50", name: "Priya Sharma", stars: 4, title: "Lovely finish, reapply needed", body: "Dewy, comfortable, zero cast. Only thing — it does pill a little if I layer it over a heavy moisturizer, so I wait a few minutes. Otherwise a staple.", daysAgo: 33, helpful: 21, hasPhoto: false },

  // The Ordinary Niacinamide
  { id: "c7", productId: "the-ordinary-niacinamide-10-zinc-1", name: "Mahmudul Hasan", stars: 4, title: "Controlled my oily T-zone", body: "Visibly smaller pores after a month and way less midday shine. It can feel slightly sticky so I use it only at night. Great value for the price.", daysAgo: 14, helpful: 30, hasPhoto: false },
  { id: "c8", productId: "the-ordinary-niacinamide-10-zinc-1", name: "Ananya Das", stars: 3, title: "Good but pilled on me", body: "Helped with my acne marks slightly. Honestly it pills under sunscreen which is annoying. Works better alone on alternate nights. Authentic packaging though.", daysAgo: 48, helpful: 17, hasPhoto: false },

  // CeraVe Moisturizing Cream
  { id: "c9", productId: "cerave-moisturizing-cream", name: "Farhana Akter", stars: 5, title: "Saved my winter barrier", body: "My cheeks were flaking in the AC all day and this thick cream fixed it within a week. A tub lasts months. The jar packaging isn't the most hygienic but I use a spatula.", daysAgo: 11, helpful: 26, hasPhoto: true },
  { id: "c10", productId: "cerave-moisturizing-cream", name: "Aditya Verma", stars: 4, title: "Rich, maybe too rich for summer", body: "Brilliant for dry skin in winter. In Mumbai summer it felt heavy, so I switched to the lotion. Ceramides are legit though, barrier feels stronger.", daysAgo: 40, helpful: 8, hasPhoto: false },

  // SKIN1004 Centella Ampoule
  { id: "c11", productId: "skin1004-madagascar-centella-ampoule", name: "Zarin Tasnim", stars: 5, title: "Calmed my cystic flare-up", body: "Whenever a painful pimple shows up I pat this on and it shrinks faster. Super minimal ingredient list, perfect for my sensitive acne-prone skin. Genuine SKIN1004 batch code.", daysAgo: 7, helpful: 49, hasPhoto: false },
  { id: "c12", productId: "skin1004-madagascar-centella-ampoule", name: "Sneha Reddy", stars: 4, title: "Gentle and effective", body: "Lightweight, sinks in fast, no fragrance. Took a while to ship but worth it. Would love a bigger size option for the price.", daysAgo: 22, helpful: 11, hasPhoto: false },

  // Isntree Watery Sun Gel
  { id: "c13", productId: "isntree-hyaluronic-acid-watery-sun-gel-spf50", name: "Imran Khan", stars: 5, title: "Watery, weightless, no cast", body: "Feels like nothing on the skin and disappears instantly. Perfect for oily skin in humid weather. The discount made it an easy buy. Reapplying over makeup is tricky though.", daysAgo: 5, helpful: 34, hasPhoto: true },
  { id: "c14", productId: "isntree-hyaluronic-acid-watery-sun-gel-spf50", name: "Mitu Akter", stars: 4, title: "Great daily SPF", body: "No greasiness, no breakouts after a month. Slight cast in flash photos but invisible in daylight. Good hydration too.", daysAgo: 29, helpful: 6, hasPhoto: false },

  // Laneige Lip Sleeping Mask
  { id: "c15", productId: "laneige-lip-sleeping-mask", name: "Ishita Gupta", stars: 5, title: "Wake up to soft lips ✨", body: "Chapped lips gone overnight. The berry scent is gorgeous and a tiny scoop lasts forever. Pricey but a pot will easily last a year. Worth every taka.", daysAgo: 8, helpful: 52, hasPhoto: true },
  { id: "c16", productId: "laneige-lip-sleeping-mask", name: "Sabbir Ahmed", stars: 4, title: "Does the job", body: "Genuinely heals flaky lips. The little applicator wasn't included in my box though. Still good, just use a clean finger.", daysAgo: 36, helpful: 7, hasPhoto: false },

  // Anua Niacinamide TXA
  { id: "c17", productId: "anua-niacinamide-10-txa-4-serum", name: "Nabila Karim", stars: 5, title: "Fading my dark spots", body: "Old acne marks are visibly lighter after 6 weeks of nightly use. Non-irritating unlike strong vit C serums. The dropper bottle feels premium too.", daysAgo: 12, helpful: 38, hasPhoto: false },

  // BOJ Glow Serum
  { id: "c18", productId: "beauty-of-joseon-glow-serum-propolis-niacinamide", name: "Debasmita Roy", stars: 5, title: "That lit-from-within glow", body: "Honey-like texture, gives an instant healthy sheen. My dull skin looks brighter in the morning. Slightly sticky so I follow with moisturizer to seal it.", daysAgo: 16, helpful: 24, hasPhoto: true },

  // COSRX Low pH Cleanser
  { id: "c19", productId: "cosrx-low-ph-good-morning-gel-cleanser", name: "Tanvir Ahmed", stars: 4, title: "Gentle morning cleanse", body: "Doesn't strip my skin, no tight feeling after. Mild tea-tree smell. A little goes a long way. Would buy again at this price.", daysAgo: 21, helpful: 13, hasPhoto: false },

  // Missha First Essence
  { id: "c20", productId: "missha-time-revolution-the-first-treatment-essence", name: "Kavya Nair", stars: 5, title: "Texture refiner ✨", body: "My skin feels smoother and more even after a month. A true dupe-worthy essence at a fraction of luxury prices. Big bottle lasts ages. Faint fermented smell that fades fast.", daysAgo: 18, helpful: 31, hasPhoto: false },

  // The Ordinary HA
  { id: "c21", productId: "the-ordinary-hyaluronic-acid-2-b5", name: "Shahriar Kabir", stars: 4, title: "Good hydration base", body: "Layered on damp skin it plumps nicely. On very dry winter days I need a cream on top or it can feel slightly tacky. Solid for the money.", daysAgo: 25, helpful: 10, hasPhoto: false },

  // Anua Cleansing Oil
  { id: "c22", productId: "anua-heartleaf-pore-control-cleansing-oil", name: "Lubna Yasmin", stars: 5, title: "Melts sunscreen effortlessly", body: "First cleanse game changed. Emulsifies clean, no greasy film, no clogged pores afterwards. My blackheads on the nose reduced noticeably. Pump is sturdy.", daysAgo: 10, helpful: 28, hasPhoto: true },

  // COSRX Snail 92 Cream
  { id: "c23", productId: "cosrx-advanced-snail-92-all-in-one-cream", name: "Rifat Hossain", stars: 4, title: "Nice gel-cream", body: "Lightweight and hydrating, great for combo skin. Pairs perfectly with the snail essence. The tube can be hard to squeeze the last bit out.", daysAgo: 31, helpful: 9, hasPhoto: false },

  // Laneige Water Sleeping Mask
  { id: "c24", productId: "laneige-water-sleeping-mask", name: "Pooja Patel", stars: 5, title: "Overnight hydration boost", body: "Skin looks dewy and bouncy every morning I use it. Cooling gel texture feels lovely. A bit pricey but two-three times a week is enough so it lasts.", daysAgo: 23, helpful: 19, hasPhoto: false },
];

/* ------------------------------------------------------------------ *
 * Mock signed-in user's ORDER HISTORY (drives "verified review" gating).
 * Only these product ids can earn a point.
 * ------------------------------------------------------------------ */
export const SEED_ORDERS = [
  {
    orderId: "AUR-24193",
    date: "2026-06-12",
    status: "Delivered",
    items: [
      "cosrx-advanced-snail-96-mucin-power-essence",
      "anua-heartleaf-77-soothing-toner",
      "beauty-of-joseon-relief-sun-rice-probiotics-spf50",
    ],
  },
  {
    orderId: "AUR-23981",
    date: "2026-05-28",
    status: "Delivered",
    items: [
      "the-ordinary-niacinamide-10-zinc-1",
      "skin1004-madagascar-centella-ampoule",
      "laneige-lip-sleeping-mask",
    ],
  },
  {
    orderId: "AUR-23640",
    date: "2026-05-09",
    status: "Delivered",
    items: ["cerave-moisturizing-cream", "isntree-hyaluronic-acid-watery-sun-gel-spf50"],
  },
];
