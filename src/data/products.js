/* =================================================================== *
 * skin.script — MOCK CATALOG + FILTER FACETS
 * -------------------------------------------------------------------
 * Authentic K/J-Beauty brands. Each product carries the metadata the
 * Shop page filters/sorts on. `tone` drives the ProductCard gradient
 * fallback; products with a real photo set `image` (resolved from the
 * bundled /assests registry via imageFor).
 * =================================================================== */
import { imageFor, galleryFor } from "./product-images.js";

const MAX_GALLERY = 6;

const TONE = {
  pink: "#ffeef4",
  rose: "#ffd9e4",
  cyan: "#d6f5ec",
  sky: "#dbeffb",
  gold: "#f6eccf",
  peach: "#ffe6d6",
  lilac: "#ece4fb",
  sage: "#e3efe0",
};

function placeholderFor({ brand, category, name, tone }) {
  const title = `${brand} ${category}`.trim();
  const shortName = name.length > 42 ? `${name.slice(0, 39)}...` : name;
  const bg = tone ?? TONE.pink;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" role="img" aria-label="${title}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="52%" stop-color="${bg}" />
          <stop offset="100%" stop-color="#ffe1ec" />
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="30%" r="55%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="800" height="1000" rx="72" fill="url(#bg)" />
      <circle cx="564" cy="228" r="168" fill="url(#glow)" />
      <circle cx="224" cy="744" r="248" fill="#e1306c" fill-opacity="0.08" />
      <circle cx="508" cy="644" r="184" fill="#00c4b4" fill-opacity="0.08" />
      <rect x="72" y="92" width="198" height="34" rx="17" fill="#0a0a0b" fill-opacity="0.12" />
      <text x="72" y="184" fill="#0a0a0b" font-family="Instrument Serif, Georgia, serif" font-size="58">skin.script</text>
      <text x="72" y="262" fill="#0a0a0b" font-family="Inter, Arial, sans-serif" font-size="40" font-weight="600">${category}</text>
      <text x="72" y="320" fill="#5b5b62" font-family="Inter, Arial, sans-serif" font-size="28">${shortName}</text>
      <path d="M144 576c72-94 176-140 310-140 136 0 214 44 304 128" fill="none" stroke="#e1306c" stroke-opacity="0.28" stroke-width="18" stroke-linecap="round" />
      <path d="M176 640c62 48 138 72 230 72s162-24 228-74" fill="none" stroke="#00c4b4" stroke-opacity="0.22" stroke-width="16" stroke-linecap="round" />
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg.replace(/\s+/g, " ").trim())}`;
}

// Benefit → badge mapping (badge variants come from the design system).
// "best" and "dewy" are intentionally dropped — `BADGE["best"]` and `BADGE["dewy"]`
// now resolve to undefined, so any product still referencing those keys simply
// renders no badge (kept the keys in product rows to avoid touching 100+ entries).
const BADGE = {
  barrier: { variant: "barrier", label: "Barrier Repair" },
  exfoliation: { variant: "exfoliation", label: "Gentle Exfoliation" },
  new: { variant: "new", label: "New" },
  sale: { variant: "sale", label: "Sale" },
};

const slug = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

let _seed = 7;
const rng = () => {
  // tiny deterministic PRNG so reviews/ratings are stable across renders
  _seed = (_seed * 1103515245 + 12345) & 0x7fffffff;
  return _seed / 0x7fffffff;
};

function p(brand, name, opts) {
  const {
    category,
    skinType = ["Normal"],
    concern = [],
    price,
    compareAt,
    badge,
    tone = "pink",
    ingredients = [],
    isNew = false,
    popularity = 50,
    inStock = true, // false → out-of-stock edge state
    image, // exact file name in /assests (single photo)
    img, // string | string[] of filename substrings → auto-collected gallery
    front, // exact filename (or substring) of the real bottle shot → pinned first
    rating: ratingOverride,
    reviews: reviewsOverride,
  } = opts;
  const rating = ratingOverride ?? +(4.4 + rng() * 0.6).toFixed(1); // 4.4 – 5.0
  const reviews = reviewsOverride ?? 180 + Math.floor(rng() * 14000);
  // salesCount: deterministic units-sold proxy, correlated with popularity
  // (high popularity → higher sales ceiling). OOS items get 0.
  const salesCount = inStock ? Math.round(popularity * 42 + rng() * 800) : 0;

  // Build the real photo gallery (front + texture + ingredient + angle shots).
  const keys = img ? (Array.isArray(img) ? img : [img]) : [];
  let gallery = galleryFor(...keys).slice(0, MAX_GALLERY);

  // Pin the real product (bottle/tube) shot to the front of the gallery.
  if (front) {
    const f = imageFor(front) ?? galleryFor(front)[0];
    if (f) gallery = [f, ...gallery.filter((u) => u !== f)].slice(0, MAX_GALLERY);
  }

  // Single exact image (no gallery keys) → one-photo product.
  if (gallery.length === 0 && image) {
    const u = imageFor(image);
    if (u) gallery = [u];
  }

  const mainImage = gallery[0] ?? placeholderFor({ brand, category, name, tone: TONE[tone] });
  const finalGallery = gallery.length > 0 ? gallery : [mainImage];

  return {
    id: `${slug(brand)}-${slug(name)}`,
    brand,
    name,
    category,
    skinType,
    concern,
    price,
    compareAt,
    badge: badge ? BADGE[badge] : undefined,
    tone: TONE[tone],
    image: mainImage,
    gallery: finalGallery, // real images for the PDP gallery; placeholder if missing
    ingredients,
    isNew,
    popularity, // drives "Featured"
    salesCount,  // drives "Best Selling" sort (correlated with popularity)
    inStock,
    stock: 0,       // units on hand — assigned by the inventory pass below
    isLowStock: false, // derived from `stock` by the inventory pass below
    rating,
    reviews,
  };
}

/* ------------------------------------------------------------------ *
 * Catalog
 * -------------------------------------------------------------------
 * Trimmed to a lean 3-per-category sample (27 total) so this mock/
 * fallback file — still imported directly by Cart's recommendations,
 * Wishlist, FeaturedProducts, SEO metadata and a few others — stays in
 * sync with the live Supabase catalog after the same trim there
 * (supabase/migrations/0008_trim_catalog_to_sample.sql). The full
 * hand-authored entries below are left as-is; only the final array is
 * filtered, so re-adding a product later is just deleting its slug
 * from this set.
 * ------------------------------------------------------------------ */
const KEEP_SLUGS = new Set([
  "anua-heartleaf-70-intense-calming-cream",
  "anua-heartleaf-77-soothing-toner",
  "anua-peach-70-niacinamide-serum",
  "beauty-of-joseon-dayscreen-moisturizer-spf30-green-tea-ha-ceramide",
  "beauty-of-joseon-revive-eye-serum-ginseng-retinal",
  "beauty-of-joseon-revive-under-eye-patch-ginseng-retinal",
  "cerave-pm-facial-moisturizing-lotion",
  "cosrx-acne-pimple-master-patch",
  "cosrx-advanced-snail-96-mucin-power-essence",
  "cosrx-aha-bha-clarifying-treatment-toner",
  "cosrx-aloe-soothing-sun-cream-spf50",
  "cosrx-bha-blackhead-power-liquid",
  "cosrx-salicylic-acid-daily-gentle-cleanser",
  "dr-althea-345-relief-cream",
  "isntree-hyaluronic-acid-watery-sun-gel-spf50",
  "isntree-hyper-niacinamide-20-serum",
  "isntree-hyper-vitamin-c-23-serum",
  "isntree-mugwort-calming-clay-mask",
  "isntree-real-rose-calming-mask",
  "missha-artemisia-calming-essence",
  "missha-blackhead-off-cleansing-oil",
  "missha-super-off-cleansing-oil-dust-off",
  "missha-time-revolution-the-first-treatment-essence",
  "skin1004-centella-teca-soothing-toner",
  "skin1004-hyalu-cica-sleeping-pack",
  "the-ordinary-azelaic-acid-suspension-10",
  "the-ordinary-multi-peptide-eye-serum",
]);

const PRODUCTS_RAW = [
  // —— Beauty of Joseon ——
  p("Beauty of Joseon", "Relief Sun: Rice + Probiotics SPF50+", { category: "Sunscreen", skinType: ["Dry", "Combination", "Sensitive"], concern: ["Sun Protection", "Hydration"], price: 18, badge: "best", tone: "gold", ingredients: ["Rice", "Niacinamide"], popularity: 99, image: "Relief-Sun-Duo-Original-Aqua-Fresh_Beauty-of-Joseon_8190145-52106365010292.jpg" }),
//   p("Beauty of Joseon", "Glow Serum: Propolis + Niacinamide", { category: "Serum", skinType: ["Oily", "Combination"], concern: ["Brightening", "Pores"], price: 17, badge: "dewy", tone: "gold", ingredients: ["Propolis", "Niacinamide"], popularity: 95 }),
  p("Beauty of Joseon", "Dynasty Cream", { category: "Moisturizer", skinType: ["Dry", "Normal"], concern: ["Hydration", "Anti-Aging"], price: 24, tone: "peach", ingredients: ["Rice", "Ginseng"], popularity: 88, image: "30ml_121dcc02-3503-478c-8a5a-90d071553381.jpg" }),
//   p("Beauty of Joseon", "Ginseng Essence Water", { category: "Essence", skinType: ["Dry", "Normal", "Combination"], concern: ["Hydration", "Anti-Aging"], price: 20, badge: "dewy", tone: "gold", ingredients: ["Ginseng"], popularity: 84 }),
  p("Beauty of Joseon", "Revive Eye Serum: Ginseng + Retinal", { category: "Eye Care", skinType: ["Normal", "Dry"], concern: ["Anti-Aging"], price: 22, tone: "lilac", ingredients: ["Ginseng", "Retinal"], isNew: true, badge: "new", popularity: 80, image: "15_0420__50ml__v2_b09abffc-c810-4633-998e-d1ae98c36f9d.jpg" }),
//   p("Beauty of Joseon", "Glow Deep Serum: Rice + Alpha Arbutin", { category: "Serum", skinType: ["Combination", "Oily"], concern: ["Brightening"], price: 18, tone: "rose", ingredients: ["Rice", "Alpha Arbutin"], popularity: 86 }),
  // New Beauty of Joseon (real bottle photography)
  p("Beauty of Joseon", "Calming Barrier Serum: Green Tea-HA + Panthenol", { category: "Serum", skinType: ["Sensitive", "Dry", "Combination"], concern: ["Soothing", "Barrier Repair"], price: 17, badge: "dewy", tone: "sage", ingredients: ["Green Tea", "Panthenol"], isNew: true, popularity: 83, image: "001_61356454-461b-424d-8ef7-32589fb88d92.png" }),
  p("Beauty of Joseon", "Dayscreen Moisturizer SPF30: Green Tea-HA + Ceramide", { category: "Sunscreen", skinType: ["Normal", "Combination", "Dry"], concern: ["Sun Protection", "Hydration"], price: 18, tone: "sage", ingredients: ["Green Tea", "Ceramides"], popularity: 80, image: "01_0409__-Global.jpg" }),
  p("Beauty of Joseon", "Glow Sun Stick: Propolis + Niacinamide SPF50+", { category: "Sunscreen", skinType: ["Normal", "Dry"], concern: ["Sun Protection", "Brightening"], price: 19, badge: "best", tone: "gold", ingredients: ["Propolis", "Niacinamide"], popularity: 87, image: "01_0529.jpg" }),
  p("Beauty of Joseon", "Matte Sun Stick: Mugwort + Camelia SPF50+", { category: "Sunscreen", skinType: ["Oily", "Combination"], concern: ["Sun Protection", "Soothing"], price: 19, tone: "sage", ingredients: ["Mugwort", "Camellia"], popularity: 81, image: "Matte-Sun-Stick-Mugwort-Camelia-SPF-50-PA-_Beauty-of-Joseon_70290488-52106202841460.jpg" }),
  p("Beauty of Joseon", "Revive Under Eye Patch: Ginseng + Retinal", { category: "Eye Care", skinType: ["Normal", "Dry"], concern: ["Anti-Aging"], price: 26, tone: "peach", ingredients: ["Ginseng", "Retinal"], popularity: 78, image: "Revive-Under-Eye-Patch-Ginseng-Retinal_Beauty-of-Joseon_75154760-52559748202868.jpg" }),
  p("Beauty of Joseon", "Pore Firming Serum: Red Bean PDRN + Peptide", { category: "Serum", skinType: ["Combination", "Oily"], concern: ["Pores", "Anti-Aging"], price: 22, badge: "new", isNew: true, tone: "rose", ingredients: ["PDRN", "Peptide"], popularity: 82, image: "01_0527__-US.jpg" }),

  // —— COSRX —— (real product photography from /assests/cosrx)
  p("COSRX", "Advanced Snail 96 Mucin Power Essence", { category: "Essence", skinType: ["Dry", "Combination", "Sensitive"], concern: ["Hydration", "Barrier Repair"], price: 19, badge: "best", tone: "cyan", ingredients: ["Snail Mucin"], popularity: 98, image: "25scNVLFzyDVLOmIq6u8gi9sPZ2KIdOuxR7l1XQu.png" }),
  p("COSRX", "Advanced Snail 92 All-in-One Cream", { category: "Moisturizer", skinType: ["Dry", "Normal"], concern: ["Hydration", "Barrier Repair"], price: 23, tone: "cyan", ingredients: ["Snail Mucin"], popularity: 85, image: "NyPtX5dZn4iZVRVaKax3VsHngZNmPzjOWCfX3N0c.png" }),
  p("COSRX", "Low pH Good Morning Gel Cleanser", { category: "Cleanser", skinType: ["Oily", "Combination", "Sensitive"], concern: ["Pores", "Soothing"], price: 13, badge: "best", tone: "sage", ingredients: ["BHA", "Tea Tree"], popularity: 90, image: "oCqZwi7VTHOHugVbrBElW7IvENExXflbjsSRmgHg.png" }),
  p("COSRX", "AHA/BHA Clarifying Treatment Toner", { category: "Toner", skinType: ["Oily", "Combination"], concern: ["Exfoliation", "Pores"], price: 16, badge: "exfoliation", tone: "sky", ingredients: ["AHA", "BHA"], popularity: 78, image: "COSRX-AHABHA-Clarifying-Treatment-Toner-150ml-thumbnail.webp" }),
//   p("COSRX", "The Vitamin C 23 Serum", { category: "Serum", skinType: ["Normal", "Combination"], concern: ["Brightening", "Anti-Aging"], price: 27, tone: "gold", ingredients: ["Vitamin C"], popularity: 82 }),
  p("COSRX", "Acne Pimple Master Patch", { category: "Treatment", skinType: ["Oily", "Combination"], concern: ["Acne & Blemishes"], price: 6, compareAt: 8, badge: "sale", tone: "sky", ingredients: ["Hydrocolloid"], popularity: 91, image: "fkjkbWBlsrynF3yixdWgXB05XGNOz9Y620QStIy3.png" }),
  p("COSRX", "Centella Blemish Cream", { category: "Treatment", skinType: ["Sensitive", "Oily"], concern: ["Acne & Blemishes", "Soothing"], price: 15, tone: "sage", ingredients: ["Centella"], popularity: 74, image: "aiM6b9wOY1exy3utP29CGFvHhk6W375V1ORT0ENy.png" }),
  // New COSRX (real bottle photography)
  p("COSRX", "Advanced Snail Peptide Eye Cream", { category: "Eye Care", skinType: ["Normal", "Dry"], concern: ["Anti-Aging", "Hydration"], price: 24, tone: "gold", ingredients: ["Snail Mucin", "Peptide"], popularity: 80, image: "2sKW2HE9a5ixzJHVIksbM8OHqhWNjhcSSpomDjXU.webp" }),
  p("COSRX", "BHA Blackhead Power Liquid", { category: "Treatment", skinType: ["Oily", "Combination"], concern: ["Pores", "Exfoliation"], price: 18, badge: "best", tone: "sky", ingredients: ["BHA"], popularity: 86, image: "39cIbCyhCkT8z8pdOSRJ6PflFtzrKHqZrJTscTe9.png" }),
  p("COSRX", "AHA 7 Whitehead Power Liquid", { category: "Treatment", skinType: ["Combination", "Normal"], concern: ["Exfoliation", "Brightening"], price: 18, badge: "exfoliation", tone: "rose", ingredients: ["AHA"], popularity: 79, image: "COkgEYIH6DjdkKrksg4UL1vUx4SqTvb5gUrzO2Tv.png" }),
  p("COSRX", "Centella Water Alcohol-Free Toner", { category: "Toner", skinType: ["Sensitive", "Combination"], concern: ["Soothing"], price: 17, tone: "sage", ingredients: ["Centella"], popularity: 81, image: "GZ8O1KYYXAoQxGbEeSP4rMDhS3tK1bu5XYNoXPRC.png" }),
  p("COSRX", "Two in One Poreless Power Liquid", { category: "Treatment", skinType: ["Oily", "Combination"], concern: ["Pores"], price: 19, tone: "cyan", ingredients: ["BHA"], popularity: 77, image: "KaxLH4589CXuFFeF4O8wtwUSFTDlgjbfVPGoucLC.png" }),
  p("COSRX", "Oil-Free Ultra-Moisturizing Lotion (Birch Sap)", { category: "Moisturizer", skinType: ["Oily", "Combination"], concern: ["Hydration"], price: 18, tone: "sky", ingredients: ["Birch Sap"], popularity: 76, image: "MKr5r8wBlkJImpxHKGnntj5GVlJ9RoH59a92NUoF.png" }),
  p("COSRX", "Salicylic Acid Daily Gentle Cleanser", { category: "Cleanser", skinType: ["Oily", "Combination"], concern: ["Acne & Blemishes", "Pores"], price: 13, tone: "rose", ingredients: ["BHA"], popularity: 84, image: "SRqT3OKsQcG74OWFY9S5UZ19d8D8ZOVqLAFWk0oh.png" }),
  p("COSRX", "Hyaluronic Acid Intensive Cream", { category: "Moisturizer", skinType: ["Dry", "Normal"], concern: ["Hydration", "Barrier Repair"], price: 21, badge: "barrier", tone: "sky", ingredients: ["Hyaluronic Acid"], popularity: 78, image: "pWUatchbXg6YfxURMHD5cuXmZDgnLQPuJhl5vUme.png" }),
  p("COSRX", "Hyaluronic Acid Hydra Power Essence", { category: "Essence", skinType: ["Dry", "Normal", "Sensitive"], concern: ["Hydration"], price: 20, badge: "dewy", tone: "sky", ingredients: ["Hyaluronic Acid"], popularity: 80, image: "tiY00YSmh9QZzuzMVtq4nSYTXREXwn8GPO5wz0Gr.png" }),
  p("COSRX", "Galactomyces 95 Tone Balancing Essence", { category: "Essence", skinType: ["Combination", "Normal"], concern: ["Brightening"], price: 21, tone: "gold", ingredients: ["Galactomyces"], popularity: 79, image: "uvyd2uEys4FhMgcSaQwhwgeyDDmxfNBsxm4N8o3h.png" }),
  p("COSRX", "Aloe Soothing Sun Cream SPF50+", { category: "Sunscreen", skinType: ["Sensitive", "Normal"], concern: ["Sun Protection", "Soothing"], price: 16, badge: "best", tone: "sage", ingredients: ["Aloe"], popularity: 83, image: "COSRX-Aloe-Soothing-Sun-Cream-SPF50-PA-50ml-thumbnail.webp" }),
  p("COSRX", "Clear Fit Master Patch", { category: "Treatment", skinType: ["Oily", "Combination"], concern: ["Acne & Blemishes"], price: 5, tone: "sky", ingredients: ["Hydrocolloid"], popularity: 82, image: "COSRX-Clear-Fit-Master-Patch-18-Patches-thumbnail.webp" }),

  // —— Anua —— (real photography + multi-shot galleries from /assests/anua)
  p("Anua", "Heartleaf 77% Soothing Toner", { category: "Toner", skinType: ["Sensitive", "Oily", "Combination"], concern: ["Soothing", "Pores"], price: 19, badge: "best", tone: "sage", ingredients: ["Heartleaf"], popularity: 97, img: "toner-heartleaf-77-soothing-toner", front: "Anua-Heartleaf-77-Soothing-Toner-250ml.png" }),
  p("Anua", "Heartleaf Pore Control Cleansing Oil", { category: "Cleanser", skinType: ["Oily", "Combination"], concern: ["Pores"], price: 21, badge: "best", tone: "sage", ingredients: ["Heartleaf"], popularity: 93, img: "cleanser-heartleaf-pore-control-cleansing-oil", front: "Anua-Heartleaf-Pore-Control-Cleansing-Oil-200ml.png" }),
  p("Anua", "Peach 70% Niacinamide Serum", { category: "Serum", skinType: ["Combination", "Normal"], concern: ["Brightening", "Pores"], price: 22, badge: "dewy", tone: "peach", ingredients: ["Niacinamide", "Peach"], popularity: 87, img: "Anua-Peach-70-Niacinamide-Serum" }),
//   p("Anua", "Birch 70% Moisture Sleeping Mask", { category: "Mask", skinType: ["Dry", "Normal"], concern: ["Hydration"], price: 23, tone: "lilac", ingredients: ["Birch Sap"], isNew: true, badge: "new", popularity: 79 }),
//   p("Anua", "Rice 70% Glow Milky Toner", { category: "Toner", skinType: ["Dry", "Normal"], concern: ["Brightening", "Hydration"], price: 20, badge: "dewy", tone: "pink", ingredients: ["Rice"], popularity: 83 }),
  p("Anua", "Heartleaf 80% Moisture Soothing Ampoule", { category: "Serum", skinType: ["Sensitive", "Dry", "Combination"], concern: ["Soothing", "Hydration"], price: 22, badge: "dewy", tone: "sage", ingredients: ["Heartleaf"], popularity: 90, img: "heartleaf-80-moisture-soothing-ampoule", front: "anua-global-ampoule-serum-heartleaf-80-moisture-soothing-ampoule-1239193699.jpg" }),
  p("Anua", "Niacinamide 10% + TXA 4% Serum", { category: "Serum", skinType: ["Combination", "Normal", "Oily"], concern: ["Brightening"], price: 24, badge: "dewy", tone: "gold", ingredients: ["Niacinamide", "Tranexamic Acid"], popularity: 86, img: "niacinamide-10-txa-4-serum", front: "Anua-Niacinamide-10-TXA-4-Dark-spot-correcting-Serum.png" }),
  p("Anua", "Heartleaf LHA Moisture Peeling Gel", { category: "Treatment", skinType: ["Oily", "Combination"], concern: ["Exfoliation", "Pores"], price: 20, badge: "exfoliation", tone: "sky", ingredients: ["LHA", "Heartleaf"], popularity: 78, img: "heartleaf-lha-moisture-peeling-gel", front: "anua-global-cleanser-heartleaf-lha-moisture-peeling-gel-1239193740.jpg" }),
  p("Anua", "Heartleaf 70% Intense Calming Cream", { category: "Moisturizer", skinType: ["Sensitive", "Dry"], concern: ["Soothing", "Barrier Repair"], price: 23, badge: "barrier", tone: "sage", ingredients: ["Heartleaf", "Panthenol"], popularity: 84, img: "heartleaf-70-intense-calming-cream", front: "anua-global-moisturizer-heartleaf-70-intense-calming-cream-1239193697.jpg" }),
  p("Anua", "Heartleaf Quercetinol Pore Deep Cleansing Foam", { category: "Cleanser", skinType: ["Oily", "Combination"], concern: ["Pores", "Soothing"], price: 16, badge: "best", tone: "sage", ingredients: ["Heartleaf", "Quercetin"], popularity: 85, img: "heartleaf-quercetinol-pore-deep-cleansing-foam", front: "Anua-Heartleaf-Quercetinol-Pore-Deep-Cleansing-Foam-150ml-.jpg" }),
  p("Anua", "Heartleaf 70% Daily Lotion", { category: "Moisturizer", skinType: ["Combination", "Normal", "Oily"], concern: ["Hydration", "Soothing"], price: 21, tone: "sage", ingredients: ["Heartleaf"], popularity: 80, img: "heartleaf-70-daily-lotion", front: "anua-us-moisturizer-heartleaf-70-daily-lotion-1239193746.jpg" }),
  p("Anua", "Heartleaf Centella Red Spot Cream", { category: "Treatment", skinType: ["Sensitive", "Oily"], concern: ["Acne & Blemishes", "Soothing"], price: 18, badge: "barrier", tone: "sage", ingredients: ["Centella", "Heartleaf"], popularity: 81, img: "heartleaf-centella-red-spot-cream", front: "anua-us-moisturizer-heartleaf-centella-red-spot-cream-1239193703.jpg" }),
  p("Anua", "Invisible Matte Finish Sunscreen SPF50+", { category: "Sunscreen", skinType: ["Oily", "Combination"], concern: ["Sun Protection", "Pores"], price: 20, badge: "best", tone: "sky", ingredients: ["Heartleaf", "Niacinamide"], popularity: 88, img: "invisible-matte-finish-sunscreen", front: "anua-us-sunscreen-invisible-matte-finish-sunscreen-1241027758.jpg" }),
  p("Anua", "Niacinamide 5% + TXA Brightening Pad", { category: "Treatment", skinType: ["Combination", "Normal"], concern: ["Brightening", "Exfoliation"], price: 22, tone: "gold", ingredients: ["Niacinamide", "Tranexamic Acid"], popularity: 79, img: "niacinamide-5-txa-brightening-pad", front: "anua-us-toner-niacinamide-5-txa-brightening-pad-1239193731.jpg" }),
  p("Anua", "Niacinamide + Tranexamic Acid Brightening Booster Toner", { category: "Toner", skinType: ["Combination", "Normal"], concern: ["Brightening", "Hydration"], price: 20, badge: "dewy", tone: "gold", ingredients: ["Niacinamide", "Tranexamic Acid"], popularity: 82, img: "niacinamide-tranexamic-acid-brightening-booster-toner", front: "anua-us-toner-niacinamide-tranexamic-acid-brightening-booster-toner-1239193696.jpg" }),
  // New Anua additions (rich galleries available)
  p("Anua", "Nano Retinol 0.3% + Niacin Renewing Serum", { category: "Serum", skinType: ["Normal", "Combination"], concern: ["Anti-Aging", "Brightening"], price: 26, badge: "new", isNew: true, tone: "lilac", ingredients: ["Retinol", "Niacinamide"], popularity: 83, img: "nano-retinol-0-3-niacin-renewing-serum", front: "anua-us-ampoule-serum-nano-retinol-0-3-niacin-renewing-serum-1239193724.jpg" }),
  p("Anua", "BHA 2% Gentle Exfoliating Toner", { category: "Toner", skinType: ["Oily", "Combination"], concern: ["Exfoliation", "Pores"], price: 19, badge: "exfoliation", tone: "sky", ingredients: ["BHA"], popularity: 80, img: ["bha-2-gentle-exfoliating-toner", "Anua-BHA-2-Gentle-Exfoliating-Toner"], front: "Anua-BHA-2-Gentle-Exfoliating-Toner-150ml.jpg" }),
  p("Anua", "Azelaic Acid 10% Hyaluron Redness Soothing Serum", { category: "Serum", skinType: ["Sensitive", "Combination"], concern: ["Soothing", "Acne & Blemishes"], price: 25, badge: "new", isNew: true, tone: "rose", ingredients: ["Azelaic Acid", "Hyaluronic Acid"], popularity: 82, img: ["azelaic-acid-10-hyaluron", "Anua-Azelaic-Acid-10"], front: "Anua-Azelaic-Acid-10-Hyaluron-Redness-Soothing-Serum-30ml.png" }),
  p("Anua", "PDRN 100 Hyaluronic Acid Booster Toner", { category: "Toner", skinType: ["Dry", "Sensitive", "Normal"], concern: ["Hydration", "Barrier Repair"], price: 24, badge: "dewy", isNew: true, tone: "sky", ingredients: ["PDRN", "Hyaluronic Acid"], popularity: 84, img: "pdrn-100-hyaluronic-acid-booster-toner", front: "anua-us-toner-pdrn-100-hyaluronic-acid-booster-toner-1239193704.jpg" }),
  p("Anua", "Heartleaf 70% Soothing Collagen Mask (4ea)", { category: "Mask", skinType: ["Sensitive", "Normal", "Dry"], concern: ["Soothing", "Hydration"], price: 17, tone: "sage", ingredients: ["Heartleaf", "Collagen"], popularity: 76, img: "heartleaf-70-soothing-collagen-mask", front: "anua-us-sheet-mask-heartleaf-70-soothing-collagen-mask-1239193713.jpg" }),
  p("Anua", "Mineral Weightless Finish Sunscreen SPF50+", { category: "Sunscreen", skinType: ["Sensitive", "Combination"], concern: ["Sun Protection", "Soothing"], price: 22, badge: "best", tone: "cyan", ingredients: ["Zinc", "Centella"], popularity: 81, img: "mineral-weightless-finish-sunscreen", front: "anua-us-sunscreen-mineral-weightless-finish-sunscreen-1241027757.jpg" }),
  p("Anua", "Invisible Glow Finish Sun Stick SPF50+", { category: "Sunscreen", skinType: ["Normal", "Dry"], concern: ["Sun Protection", "Brightening"], price: 18, badge: "dewy", tone: "gold", ingredients: ["Niacinamide"], popularity: 79, img: "invisible-glow-finish-sunstick", front: "anua-us-sunscreen-invisible-glow-finish-sunstick-1241027759.jpg" }),
  p("Anua", "Heartleaf 77% Clear Pad (70ea)", { category: "Treatment", skinType: ["Oily", "Combination", "Sensitive"], concern: ["Soothing", "Exfoliation"], price: 23, tone: "sage", ingredients: ["Heartleaf"], popularity: 80, img: ["heartleaf-77-toner-pad", "heartleaf-77-clear-pad"], front: "anua-global-toner-heartleaf-77-clear-pad-1239193736.jpg" }),
  p("Anua", "Heartleaf Low pH Deep Cleansing Water", { category: "Cleanser", skinType: ["Sensitive", "Normal", "Combination"], concern: ["Soothing", "Pores"], price: 17, tone: "sage", ingredients: ["Heartleaf"], popularity: 78, img: "heartleaf-low-ph-deep-cleansing-water", front: "anua-us-cleanser-heartleaf-low-ph-deep-cleansing-water-1239193737.jpg" }),

  // —— The Ordinary —— (real product photography from /assests/ordinary)
  p("The Ordinary", "Niacinamide 10% + Zinc 1%", { category: "Serum", skinType: ["Oily", "Combination"], concern: ["Pores", "Acne & Blemishes"], price: 6, badge: "best", tone: "sky", ingredients: ["Niacinamide", "Zinc"], popularity: 96, image: "rdn-niacinamide-10pct-zinc-1pct-30ml.png" }),
  p("The Ordinary", "Hyaluronic Acid 2% + B5", { category: "Serum", skinType: ["Dry", "Normal", "Sensitive"], concern: ["Hydration"], price: 9, badge: "best", tone: "sky", ingredients: ["Hyaluronic Acid"], popularity: 92, image: "ord-hyaluronic-acid-2pct-B5-30ml-Clr-Acu.png" }),
//   p("The Ordinary", "Granactive Retinoid 2% Emulsion", { category: "Serum", skinType: ["Normal", "Combination"], concern: ["Anti-Aging"], price: 10, tone: "lilac", ingredients: ["Retinoid"], popularity: 81 }),
//   p("The Ordinary", "AHA 30% + BHA 2% Peeling Solution", { category: "Treatment", skinType: ["Oily", "Combination"], concern: ["Exfoliation", "Brightening"], price: 8, badge: "exfoliation", tone: "rose", ingredients: ["AHA", "BHA"], popularity: 89 }),
  p("The Ordinary", "Natural Moisturizing Factors + HA", { category: "Moisturizer", skinType: ["Dry", "Sensitive", "Normal"], concern: ["Hydration", "Barrier Repair"], price: 8, tone: "sky", ingredients: ["Hyaluronic Acid", "Amino Acids"], popularity: 84, image: "rdn-natural-moisturizing-factors-ha-30ml.png" }),
//   p("The Ordinary", "Caffeine Solution 5% + EGCG", { category: "Eye Care", skinType: ["Normal", "Combination"], concern: ["Anti-Aging"], price: 8, tone: "sage", ingredients: ["Caffeine"], popularity: 77 }),
  // New The Ordinary (real bottle photography)
  p("The Ordinary", "Glycolic Acid 7% Exfoliating Toner", { category: "Toner", skinType: ["Oily", "Combination"], concern: ["Exfoliation", "Brightening"], price: 13, badge: "exfoliation", tone: "rose", ingredients: ["AHA"], popularity: 85, image: "ord-glyc-acid-7pct-100ml-Aug-UPC.png" }),
  p("The Ordinary", "Salicylic Acid 2% Solution", { category: "Treatment", skinType: ["Oily", "Combination"], concern: ["Acne & Blemishes", "Pores"], price: 7, tone: "sky", ingredients: ["BHA"], popularity: 83, image: "rdn-salicylic-acid-2pct-solution-30ml.png" }),
  p("The Ordinary", "Azelaic Acid Suspension 10%", { category: "Treatment", skinType: ["Sensitive", "Combination"], concern: ["Brightening", "Soothing"], price: 12, tone: "rose", ingredients: ["Azelaic Acid"], popularity: 82, image: "rdn-azelaic-acid-suspension-10pct-100ml.png" }),
  p("The Ordinary", "Multi-Peptide + HA Serum (Buffet)", { category: "Serum", skinType: ["Normal", "Combination", "Dry"], concern: ["Anti-Aging", "Hydration"], price: 15, badge: "best", tone: "sky", ingredients: ["Peptide", "Hyaluronic Acid"], popularity: 86, image: "rdn-multi-peptide-ha-serum-30ml.png" }),
  p("The Ordinary", "Multi-Peptide Copper Peptides 1% Serum", { category: "Serum", skinType: ["Normal", "Dry"], concern: ["Anti-Aging"], price: 30, badge: "new", isNew: true, tone: "cyan", ingredients: ["Copper Peptides"], popularity: 80, image: "rdn-multi-peptide-copper-peptides-1pct-serum-30ml.png" }),
  p("The Ordinary", "Alpha Arbutin 2% + HA", { category: "Serum", skinType: ["Combination", "Normal"], concern: ["Brightening"], price: 9, tone: "rose", ingredients: ["Alpha Arbutin", "Hyaluronic Acid"], popularity: 84, image: "FY25-D41247-ORD-Web-Alp-Arb-2pct-30ml-1x1-EN-1.jpg" }),
  p("The Ordinary", "Multi-Peptide Eye Serum", { category: "Eye Care", skinType: ["Normal", "Combination"], concern: ["Anti-Aging"], price: 12, tone: "lilac", ingredients: ["Peptide", "Caffeine"], popularity: 79, image: "FY25-D41247-ORD-Web-PDP-Mlt-Pptd-Eye-1x1-EN-1.jpg" }),

  // —— The Body Shop ——
//   p("The Body Shop", "Vitamin E Moisture Cream", { category: "Moisturizer", skinType: ["Normal", "Dry"], concern: ["Hydration"], price: 19, tone: "lilac", ingredients: ["Vitamin E"], popularity: 70 }),
//   p("The Body Shop", "Tea Tree Skin Clearing Facial Wash", { category: "Cleanser", skinType: ["Oily", "Combination"], concern: ["Acne & Blemishes", "Pores"], price: 12, tone: "sage", ingredients: ["Tea Tree"], popularity: 72 }),
//   p("The Body Shop", "Drops of Youth Concentrate", { category: "Serum", skinType: ["Normal", "Combination"], concern: ["Anti-Aging"], price: 30, tone: "sage", ingredients: ["Edelweiss"], popularity: 66 }),
//   p("The Body Shop", "Aloe Soothing Day Cream", { category: "Moisturizer", skinType: ["Sensitive", "Normal"], concern: ["Soothing", "Hydration"], price: 18, tone: "sage", ingredients: ["Aloe"], popularity: 68 }),

  // —— SKIN1004 (Centella) —— (real photography from /assests/centella)
  p("SKIN1004", "Madagascar Centella Ampoule", { category: "Serum", skinType: ["Sensitive", "Oily", "Combination"], concern: ["Soothing", "Acne & Blemishes"], price: 20, badge: "best", tone: "sage", ingredients: ["Centella"], popularity: 90, img: "ampoule-serum-centella-ampoule" }),
//   p("SKIN1004", "Centella Hyalu-Cica Water-Fit Sun Serum SPF50+", { category: "Sunscreen", skinType: ["Sensitive", "Combination"], concern: ["Sun Protection", "Soothing"], price: 19, badge: "dewy", tone: "cyan", ingredients: ["Centella", "Hyaluronic Acid"], popularity: 85 }),
  p("SKIN1004", "Centella Tone Brightening Capsule Ampoule", { category: "Serum", skinType: ["Combination", "Normal"], concern: ["Brightening"], price: 22, tone: "gold", ingredients: ["Centella", "Niacinamide"], isNew: true, badge: "new", popularity: 76, img: "brightening-capsule-ampoule" }),
  p("SKIN1004", "Centella Teca Soothing Toner", { category: "Toner", skinType: ["Sensitive", "Combination", "Normal"], concern: ["Soothing", "Hydration"], price: 20, badge: "barrier", tone: "sage", ingredients: ["Centella", "TECA"], popularity: 84, img: "centella-teca-soothing-toner", front: "skin1004-210ml-centella-teca-soothing-toner-1217895427.png" }),
  p("SKIN1004", "Centella Teca Ampoule", { category: "Serum", skinType: ["Sensitive", "Combination"], concern: ["Soothing", "Barrier Repair"], price: 24, badge: "barrier", tone: "sage", ingredients: ["Centella", "TECA"], popularity: 83, img: "centella-teca-ampoule", front: "skin1004-50ml-centella-teca-ampoule-1217895426.png" }),
  p("SKIN1004", "Centella Teca Cream", { category: "Moisturizer", skinType: ["Sensitive", "Dry"], concern: ["Barrier Repair", "Soothing"], price: 25, tone: "sage", ingredients: ["Centella", "TECA"], popularity: 80, img: "centella-teca-cream", front: "skin1004-75ml-centella-teca-cream-1217895425.png" }),
  p("SKIN1004", "Centella Soothing Cream", { category: "Moisturizer", skinType: ["Sensitive", "Normal"], concern: ["Soothing", "Hydration"], price: 22, tone: "sage", ingredients: ["Centella"], popularity: 78, img: "cream-centella-soothing-cream" }),
  p("SKIN1004", "Centella Light Cleansing Oil", { category: "Cleanser", skinType: ["Oily", "Combination", "Sensitive"], concern: ["Pores"], price: 18, tone: "sage", ingredients: ["Centella"], popularity: 81, img: "centella-light-cleansing-oil" }),
  p("SKIN1004", "Centella Ampoule Foam", { category: "Cleanser", skinType: ["Sensitive", "Combination"], concern: ["Soothing", "Pores"], price: 15, tone: "sage", ingredients: ["Centella"], popularity: 77, img: "centella-ampoule-foam" }),
  p("SKIN1004", "Centella Quick Calming Pad (70ea)", { category: "Treatment", skinType: ["Sensitive", "Oily", "Combination"], concern: ["Soothing", "Exfoliation"], price: 24, tone: "sage", ingredients: ["Centella"], popularity: 79, img: "centella-quick-calming-pad" }),
  p("SKIN1004", "Hyalu-Cica Blue Serum", { category: "Serum", skinType: ["Dry", "Sensitive", "Combination"], concern: ["Hydration", "Soothing"], price: 23, badge: "dewy", tone: "sky", ingredients: ["Centella", "Hyaluronic Acid"], isNew: true, popularity: 82, img: "hyalu-cica-blue-serum" }),
  p("SKIN1004", "Hyalu-Cica Brightening Toner", { category: "Toner", skinType: ["Combination", "Normal"], concern: ["Brightening", "Hydration"], price: 20, tone: "sky", ingredients: ["Centella", "Hyaluronic Acid"], popularity: 76, img: "hyalu-cica-brightening-toner" }),
  p("SKIN1004", "Hyalu-Cica Sleeping Pack", { category: "Mask", skinType: ["Dry", "Normal"], concern: ["Hydration"], price: 20, tone: "sky", ingredients: ["Centella", "Hyaluronic Acid"], popularity: 74, img: "hyalu-cica-sleeping-pack" }),
  p("SKIN1004", "Centella Tone Brightening Boosting Toner", { category: "Toner", skinType: ["Combination", "Normal"], concern: ["Brightening"], price: 19, tone: "gold", ingredients: ["Centella", "Niacinamide"], popularity: 75, img: "tone-brightening-boosting-toner" }),
  p("SKIN1004", "Azelaic Acid 10% Ampoule", { category: "Serum", skinType: ["Sensitive", "Oily", "Combination"], concern: ["Acne & Blemishes", "Soothing"], price: 25, badge: "new", isNew: true, tone: "rose", ingredients: ["Azelaic Acid", "Centella"], popularity: 80, img: "azelaic-acid-10-ampoule", front: "skin1004-30ml-azelaic-acid-10-ampoule-1228179732.png" }),
  p("SKIN1004", "Retinol 0.2% Boosting Shot Ampoule", { category: "Serum", skinType: ["Normal", "Combination"], concern: ["Anti-Aging"], price: 26, tone: "lilac", ingredients: ["Retinol", "Centella"], popularity: 77, img: "retinol-0-2-boosting-shot-ampoule" }),

  // —— Simple ——
//   p("Simple", "Kind to Skin Moisturizer", { category: "Moisturizer", skinType: ["Sensitive", "Normal"], concern: ["Hydration", "Soothing"], price: 11, tone: "sky", ingredients: ["Pro-Vitamin B5"], popularity: 65 }),
//   p("Simple", "Micellar Cleansing Water", { category: "Cleanser", skinType: ["Sensitive", "Normal", "Combination"], concern: ["Soothing"], price: 9, tone: "sky", ingredients: ["Triple Purified Water"], popularity: 71 }),
//   p("Simple", "Refreshing Facial Wash Gel", { category: "Cleanser", skinType: ["Normal", "Combination"], concern: ["Soothing"], price: 8, tone: "sage", ingredients: ["Pro-Vitamin B5"], popularity: 60 }),

  // —— Round Lab ——
//   p("Round Lab", "1025 Dokdo Toner", { category: "Toner", skinType: ["Sensitive", "Dry", "Normal"], concern: ["Hydration", "Barrier Repair"], price: 21, badge: "barrier", tone: "sky", ingredients: ["Deep Sea Water"], popularity: 86 }),
//   p("Round Lab", "Birch Juice Moisturizing Sunscreen SPF50+", { category: "Sunscreen", skinType: ["Dry", "Normal"], concern: ["Sun Protection", "Hydration"], price: 22, badge: "dewy", tone: "sage", ingredients: ["Birch Sap"], popularity: 82 }),
//   p("Round Lab", "Soybean Nourishing Cream", { category: "Moisturizer", skinType: ["Dry", "Normal"], concern: ["Hydration", "Barrier Repair"], price: 24, tone: "gold", ingredients: ["Soybean"], popularity: 73 }),

  // —— Torriden ——
//   p("Torriden", "DIVE-IN Low Molecular Hyaluronic Acid Serum", { category: "Serum", skinType: ["Dry", "Sensitive", "Combination"], concern: ["Hydration", "Barrier Repair"], price: 18, badge: "best", tone: "sky", ingredients: ["Hyaluronic Acid"], popularity: 88 }),
//   p("Torriden", "Balanceful Cica Toner", { category: "Toner", skinType: ["Sensitive", "Combination"], concern: ["Soothing", "Hydration"], price: 17, tone: "sage", ingredients: ["Centella"], popularity: 75 }),
//   p("Torriden", "DIVE-IN Cleansing Foam", { category: "Cleanser", skinType: ["Normal", "Sensitive"], concern: ["Hydration"], price: 14, tone: "cyan", ingredients: ["Hyaluronic Acid"], popularity: 67 }),

  // —— Some By Mi ——
//   p("Some By Mi", "AHA BHA PHA 30 Days Miracle Toner", { category: "Toner", skinType: ["Oily", "Combination"], concern: ["Exfoliation", "Acne & Blemishes"], price: 16, badge: "exfoliation", tone: "rose", ingredients: ["AHA", "BHA", "PHA"], popularity: 84 }),
//   p("Some By Mi", "Snail Truecica Miracle Repair Serum", { category: "Serum", skinType: ["Sensitive", "Combination"], concern: ["Barrier Repair", "Acne & Blemishes"], price: 21, badge: "barrier", tone: "cyan", ingredients: ["Snail Mucin", "Centella"], popularity: 80 }),
//   p("Some By Mi", "Yuja Niacin Brightening Sleeping Mask", { category: "Mask", skinType: ["Normal", "Combination"], concern: ["Brightening"], price: 19, tone: "gold", ingredients: ["Yuja", "Niacinamide"], popularity: 72 }),

  // —— Laneige ——
//   p("Laneige", "Water Sleeping Mask", { category: "Mask", skinType: ["Dry", "Normal", "Combination"], concern: ["Hydration"], price: 29, badge: "best", tone: "sky", ingredients: ["Probiotics"], popularity: 89 }),
//   p("Laneige", "Cream Skin Toner & Moisturizer", { category: "Toner", skinType: ["Dry", "Sensitive"], concern: ["Hydration", "Barrier Repair"], price: 28, tone: "pink", ingredients: ["Ceramides"], popularity: 81 }),
//   p("Laneige", "Lip Sleeping Mask", { category: "Treatment", skinType: ["Dry", "Normal"], concern: ["Hydration"], price: 24, badge: "best", tone: "rose", ingredients: ["Berry Complex"], popularity: 94 }),

  // —— Innisfree ——
//   p("Innisfree", "Green Tea Seed Hyaluronic Serum", { category: "Serum", skinType: ["Combination", "Normal"], concern: ["Hydration"], price: 27, tone: "sage", ingredients: ["Green Tea"], popularity: 78 }),
//   p("Innisfree", "Black Tea Youth Enhancing Ampoule", { category: "Serum", skinType: ["Normal", "Dry"], concern: ["Anti-Aging"], price: 39, tone: "gold", ingredients: ["Black Tea"], popularity: 70 }),
//   p("Innisfree", "Volcanic Pore Cleansing Foam", { category: "Cleanser", skinType: ["Oily", "Combination"], concern: ["Pores"], price: 12, tone: "sage", ingredients: ["Volcanic Clay"], popularity: 69 }),

  // —— Medicube / Mixsoon-style extras for depth ——
//   p("Medicube", "Zero Pore Pad 2.0", { category: "Treatment", skinType: ["Oily", "Combination"], concern: ["Pores", "Exfoliation"], price: 30, badge: "exfoliation", tone: "sky", ingredients: ["BHA", "PHA"], popularity: 83 }),
//   p("Medicube", "Collagen Niacinamide Jelly Cream", { category: "Moisturizer", skinType: ["Normal", "Dry"], concern: ["Anti-Aging", "Brightening"], price: 34, tone: "peach", ingredients: ["Collagen", "Niacinamide"], isNew: true, badge: "new", popularity: 79 }),
//   p("Mixsoon", "Bean Essence", { category: "Essence", skinType: ["Sensitive", "Combination"], concern: ["Hydration", "Barrier Repair"], price: 22, badge: "barrier", tone: "sage", ingredients: ["Soybean"], popularity: 77 }),
//   p("Mixsoon", "Glacier Water Cream", { category: "Moisturizer", skinType: ["Oily", "Combination"], concern: ["Hydration", "Soothing"], price: 24, tone: "cyan", ingredients: ["Glacier Water"], popularity: 71 }),
//   p("Numbuzin", "No.3 Skin Softening Serum", { category: "Serum", skinType: ["Dry", "Normal"], concern: ["Brightening", "Hydration"], price: 26, badge: "dewy", tone: "pink", ingredients: ["Niacinamide", "Galactomyces"], popularity: 85 }),
//   p("Numbuzin", "No.5 Vitamin-Niacinamide Concentrated Serum", { category: "Serum", skinType: ["Combination", "Normal"], concern: ["Brightening"], price: 28, tone: "gold", ingredients: ["Vitamin C", "Niacinamide"], popularity: 80 }),
  p("Dr. Althea", "345 Relief Cream", { category: "Moisturizer", skinType: ["Sensitive", "Dry"], concern: ["Barrier Repair", "Soothing"], price: 25, badge: "barrier", tone: "lilac", ingredients: ["Ceramides", "Madecassoside"], popularity: 76, image: "dr-althea-345-relief-cream-50ml-1.jpg" }),
  p("Isntree", "Hyaluronic Acid Toner Plus", { category: "Toner", skinType: ["Dry", "Sensitive", "Normal"], concern: ["Hydration"], price: 18, tone: "sky", ingredients: ["Hyaluronic Acid"], popularity: 82, image: "isntree-hyaluronic-acid-toner-plus-200ml.jpg" }),
//   p("Isntree", "Onion Newpair Spot Serum", { category: "Serum", skinType: ["Oily", "Combination"], concern: ["Acne & Blemishes"], price: 23, tone: "rose", ingredients: ["Onion Extract"], popularity: 70 }),
//   p("Purito", "Daily Go-To Sunscreen SPF50+", { category: "Sunscreen", skinType: ["Sensitive", "Combination"], concern: ["Sun Protection"], price: 16, badge: "best", tone: "sky", ingredients: ["Centella"], popularity: 86 }),

  // —— NEW (asset-driven sync) ——
  p("CeraVe", "Hydrating Facial Cleanser", { category: "Cleanser", skinType: ["Dry", "Normal", "Sensitive"], concern: ["Hydration", "Barrier Repair"], price: 14, tone: "sky", ingredients: ["Ceramides", "Hyaluronic Acid"], popularity: 74, image: "cerave-hydrating-cleanser-normal-to-dry-236ml-1.jpg" }),
  p("CeraVe", "Foaming Facial Cleanser", { category: "Cleanser", skinType: ["Oily", "Combination"], concern: ["Pores"], price: 15, tone: "sky", ingredients: ["Ceramides", "Niacinamide"], popularity: 76, image: "cerave-foaming-facial-cleanser-normal-to-oily-355ml.jpg" }),
  p("CeraVe", "Hydrating Cream-to-Foam Cleanser", { category: "Cleanser", skinType: ["Dry", "Normal"], concern: ["Hydration"], price: 15, tone: "sky", ingredients: ["Ceramides"], popularity: 68, image: "cerave-hydrating-cream-to-foam-cleanser-for-normal-to-dry-skin-87ml.jpg" }),
  p("CeraVe", "Acne Foaming Cream Cleanser", { category: "Cleanser", skinType: ["Oily", "Combination"], concern: ["Acne & Blemishes"], price: 16, tone: "sky", ingredients: ["Benzoyl Peroxide"], popularity: 72, image: "cerave-acne-foaming-cream-cleanser-150ml-1.jpg" }),
  p("CeraVe", "Blemish Control Cleanser", { category: "Cleanser", skinType: ["Oily", "Combination"], concern: ["Acne & Blemishes", "Exfoliation"], price: 16, tone: "sky", ingredients: ["Salicylic Acid"], popularity: 70, image: "cerave-blemish-control-cleanser-for-blemish-prone-skin-236mlo.jpg" }),
  p("CeraVe", "Renewing SA Cleanser", { category: "Cleanser", skinType: ["Combination", "Normal"], concern: ["Exfoliation", "Pores"], price: 16, tone: "rose", ingredients: ["Salicylic Acid", "Ceramides"], popularity: 71, image: "cerave-renewing-sa-cleanser-237ml-1.jpg" }),
  p("CeraVe", "Daily Moisturizing Lotion", { category: "Moisturizer", skinType: ["Normal", "Dry"], concern: ["Hydration", "Barrier Repair"], price: 16, tone: "sky", ingredients: ["Ceramides", "Hyaluronic Acid"], popularity: 78, image: "cerave-daily-moisturizing-lotion-for-normal-to-dry-skin-355ml.jpg" }),
  p("CeraVe", "Moisturizing Cream", { category: "Moisturizer", skinType: ["Dry", "Sensitive"], concern: ["Hydration", "Barrier Repair"], price: 18, badge: "barrier", tone: "sky", ingredients: ["Ceramides", "Hyaluronic Acid"], popularity: 80, image: "cerave-moisturizing-cream-dry-to-very-dry-340g.jpg" }),
  p("CeraVe", "AM Facial Moisturizing Lotion SPF30", { category: "Sunscreen", skinType: ["Normal", "Combination"], concern: ["Sun Protection", "Hydration"], price: 16, tone: "gold", ingredients: ["Ceramides", "Niacinamide"], popularity: 75, image: "cerave-am-facial-moisturizing-lotion-with-sunscreen-spf-30-89ml.jpg" }),
  p("CeraVe", "PM Facial Moisturizing Lotion", { category: "Moisturizer", skinType: ["Normal", "Combination"], concern: ["Hydration", "Barrier Repair"], price: 16, tone: "sky", ingredients: ["Ceramides", "Niacinamide"], popularity: 73, image: "cerave-pm-facial-moisturizing-lotion-89ml.jpg" }),
  p("CeraVe", "Eye Repair Cream", { category: "Eye Care", skinType: ["Normal", "Dry"], concern: ["Anti-Aging", "Hydration"], price: 16, tone: "lilac", ingredients: ["Ceramides", "Niacinamide"], popularity: 69, image: "cerave-eye-repair-cream-for-dark-circles-puffiness-14ml.jpg" }),
  p("Isntree", "Hyaluronic Acid Toner", { category: "Toner", skinType: ["Dry", "Sensitive", "Normal"], concern: ["Hydration"], price: 16, tone: "sky", ingredients: ["Hyaluronic Acid"], popularity: 80, image: "isntree-hyaluronic-acid-toner-200-ml.jpg" }),
  p("Isntree", "Hyaluronic Acid Water Essence", { category: "Essence", skinType: ["Dry", "Normal"], concern: ["Hydration"], price: 20, badge: "dewy", tone: "sky", ingredients: ["Hyaluronic Acid"], popularity: 76, image: "isntree-hyaluronic-acid-water-essence-50ml.jpg" }),
  p("Isntree", "Hyaluronic Acid Moist Cream", { category: "Moisturizer", skinType: ["Dry", "Normal"], concern: ["Hydration", "Barrier Repair"], price: 22, tone: "sky", ingredients: ["Hyaluronic Acid"], popularity: 74, image: "isntree-hyaluronic-acid-moist-cream-100ml.jpg" }),
  p("Isntree", "Hyaluronic Acid Aqua Gel Cream", { category: "Moisturizer", skinType: ["Oily", "Combination"], concern: ["Hydration"], price: 20, tone: "cyan", ingredients: ["Hyaluronic Acid"], popularity: 72, image: "isntree-hyaluronic-acid-aqua-gel-cream-100ml.jpg" }),
  p("Isntree", "Ultra Low Molecular Hyaluronic Acid Serum", { category: "Serum", skinType: ["Dry", "Sensitive", "Combination"], concern: ["Hydration", "Barrier Repair"], price: 24, badge: "best", tone: "sky", ingredients: ["Hyaluronic Acid"], popularity: 82, image: "isntree-ultra-low-molecular-hyaluronic-acid-serum-50ml.jpg" }),
  p("Isntree", "C-Niacin Toning Ampoule", { category: "Serum", skinType: ["Combination", "Normal"], concern: ["Brightening"], price: 26, badge: "dewy", tone: "gold", ingredients: ["Vitamin C", "Niacinamide"], popularity: 78, image: "12-isntree-c-niacin-toning-ampoule-50ml.jpg" }),
  p("Isntree", "C-Niacin Toning Cream", { category: "Moisturizer", skinType: ["Combination", "Normal"], concern: ["Brightening", "Hydration"], price: 24, tone: "gold", ingredients: ["Vitamin C", "Niacinamide"], popularity: 71, image: "isntree-cniacin-toning-cream-50ml.jpg" }),
  p("Isntree", "Hyper Vitamin C 23 Serum", { category: "Serum", skinType: ["Normal", "Combination"], concern: ["Brightening", "Anti-Aging"], price: 28, tone: "gold", ingredients: ["Vitamin C"], popularity: 79, image: "isntree-hyper-vitamin-c-23-serum-20ml.jpg" }),
  p("Isntree", "Hyper Retinol EX 10 Serum", { category: "Serum", skinType: ["Normal", "Combination"], concern: ["Anti-Aging"], price: 30, badge: "new", isNew: true, tone: "lilac", ingredients: ["Retinol"], popularity: 77, image: "isntree-hyper-retinol-ex-10-serum-20ml.jpg" }),
  p("Isntree", "Hyper Niacinamide 20 Serum", { category: "Serum", skinType: ["Oily", "Combination"], concern: ["Brightening", "Pores"], price: 26, tone: "gold", ingredients: ["Niacinamide"], popularity: 75, image: "isntree-hyper-niacinamide-20-serum-20ml-1.jpg" }),
  p("Isntree", "Chestnut AHA 8% Clear Essence", { category: "Treatment", skinType: ["Combination", "Normal"], concern: ["Exfoliation", "Brightening"], price: 22, badge: "exfoliation", tone: "rose", ingredients: ["AHA"], popularity: 73, image: "isntree-chestnut-aha-8-clear-essence-100ml.jpg" }),
  p("Isntree", "Chestnut BHA 2% Clear Liquid", { category: "Treatment", skinType: ["Oily", "Combination"], concern: ["Pores", "Exfoliation"], price: 22, badge: "exfoliation", tone: "sky", ingredients: ["BHA"], popularity: 74, image: "isntree-chestnut-bha-2-clear-liquid-100ml-1-scaled-1.jpg" }),
  p("Isntree", "Green Tea Fresh Toner", { category: "Toner", skinType: ["Oily", "Combination"], concern: ["Soothing", "Pores"], price: 18, tone: "sage", ingredients: ["Green Tea"], popularity: 72, image: "isntree-green-tea-fresh-toner-200ml.jpg" }),
  p("Isntree", "Green Tea Fresh Serum", { category: "Serum", skinType: ["Combination", "Oily"], concern: ["Soothing", "Hydration"], price: 22, tone: "sage", ingredients: ["Green Tea"], popularity: 70, image: "isntree-green-tea-fresh-serum.jpg" }),
  p("Isntree", "Green Tea Fresh Emulsion", { category: "Moisturizer", skinType: ["Combination", "Oily"], concern: ["Soothing", "Hydration"], price: 20, tone: "sage", ingredients: ["Green Tea"], popularity: 67, image: "isntree-green-tea-fresh-emulsion-120ml.jpg" }),
  p("Isntree", "Green Tea Fresh Cleanser", { category: "Cleanser", skinType: ["Oily", "Combination"], concern: ["Pores", "Soothing"], price: 14, tone: "sage", ingredients: ["Green Tea"], popularity: 68, image: "isntree-green-tea-fresh-cleanser-120ml.jpg" }),
  p("Isntree", "Aloe Soothing Toner", { category: "Toner", skinType: ["Sensitive", "Normal"], concern: ["Soothing", "Hydration"], price: 16, tone: "sage", ingredients: ["Aloe"], popularity: 66, image: "isntree-aloe-soothing-toner-200ml.jpg" }),
  p("Isntree", "Onion Newpair Essence Toner", { category: "Toner", skinType: ["Oily", "Combination"], concern: ["Acne & Blemishes", "Soothing"], price: 18, tone: "rose", ingredients: ["Onion Extract"], popularity: 71, image: "isntree-onion-newpair-essence-toner-200ml.jpg" }),
  p("Isntree", "Onion Newpair Gel Cream", { category: "Moisturizer", skinType: ["Oily", "Combination"], concern: ["Acne & Blemishes", "Soothing"], price: 20, tone: "rose", ingredients: ["Onion Extract"], popularity: 69, image: "isntree-onion-newpair-gel-cream-50ml.jpg" }),
  p("Isntree", "Onion Newpair Cleansing Foam", { category: "Cleanser", skinType: ["Oily", "Combination"], concern: ["Acne & Blemishes", "Pores"], price: 14, tone: "rose", ingredients: ["Onion Extract"], popularity: 67, image: "isntree-onion-newpair-cleansing-foam-150ml-1.jpg" }),
  p("Isntree", "Hyaluronic Acid Low pH Cleansing Foam", { category: "Cleanser", skinType: ["Dry", "Sensitive", "Normal"], concern: ["Hydration"], price: 14, tone: "sky", ingredients: ["Hyaluronic Acid"], popularity: 70, image: "isntree-hyaluronic-acid-lowph-cleansing-foam-150ml.jpg" }),
  p("Isntree", "Yam Root Vegan Milk Cleanser", { category: "Cleanser", skinType: ["Dry", "Sensitive"], concern: ["Hydration", "Soothing"], price: 16, tone: "gold", ingredients: ["Yam Root"], popularity: 65, image: "isntree-yam-root-vegan-milk-cleanser-220ml.jpg" }),
  p("Isntree", "Hyaluronic Acid Watery Sun Gel SPF50+", { category: "Sunscreen", skinType: ["Combination", "Oily"], concern: ["Sun Protection", "Hydration"], price: 20, badge: "best", tone: "sky", ingredients: ["Hyaluronic Acid"], popularity: 81, image: "isntree-hyaluronic-acid-watery-sun-gel-spf50-pa-50ml.jpg" }),
  p("Isntree", "Hyaluronic Acid Daily Sun Gel SPF30", { category: "Sunscreen", skinType: ["Normal", "Combination"], concern: ["Sun Protection", "Hydration"], price: 18, tone: "sky", ingredients: ["Hyaluronic Acid"], popularity: 72, image: "isntree-hyaluronic-acid-daily-sun-gel-spf30-pa-50ml.jpg" }),
  p("Isntree", "Hyaluronic Acid Natural Sun Cream SPF50+", { category: "Sunscreen", skinType: ["Sensitive", "Dry"], concern: ["Sun Protection"], price: 20, tone: "sky", ingredients: ["Hyaluronic Acid"], popularity: 73, image: "isntree-hyaluronic-acid-natural-suncream-spf50-pa-50ml.jpg" }),
  p("Isntree", "Hyaluronic Acid Airy Sun Stick SPF50+", { category: "Sunscreen", skinType: ["Normal", "Combination"], concern: ["Sun Protection"], price: 18, tone: "sky", ingredients: ["Hyaluronic Acid"], popularity: 71, image: "isntree-hyaluronic-acid-airy-sun-stick-22g.jpg" }),
  p("Isntree", "Mugwort Calming Clay Mask", { category: "Mask", skinType: ["Oily", "Combination", "Sensitive"], concern: ["Soothing", "Pores"], price: 20, tone: "sage", ingredients: ["Mugwort"], popularity: 70, image: "isntree-mugwort-calming-clay-mask-100ml.jpg" }),
  p("Isntree", "Real Rose Calming Mask", { category: "Mask", skinType: ["Sensitive", "Normal"], concern: ["Soothing", "Hydration"], price: 20, tone: "rose", ingredients: ["Rose"], popularity: 64, image: "isntree-real-rose-calming-mask-100ml.jpg" }),
  p("Missha", "Time Revolution The First Treatment Essence", { category: "Essence", skinType: ["Normal", "Dry", "Combination"], concern: ["Hydration", "Anti-Aging"], price: 30, badge: "best", tone: "gold", ingredients: ["Fermented Yeast"], popularity: 84, image: "time-revolution-the-first-essence-lotion-5x.jpg" }),
  p("Missha", "Time Revolution Night Repair Ampoule", { category: "Serum", skinType: ["Normal", "Dry"], concern: ["Anti-Aging", "Hydration"], price: 38, tone: "gold", ingredients: ["Bifida Ferment"], popularity: 80, image: "missha-time-revolution-night-repair-ampoule-5x-75ml.jpg" }),
  p("Missha", "Time Revolution Primestem Eye Cream", { category: "Eye Care", skinType: ["Normal", "Dry"], concern: ["Anti-Aging"], price: 34, tone: "lilac", ingredients: ["Peptide"], popularity: 70, image: "missha-time-revolution-primestem-100-eye-cream-25ml.jpg" }),
  p("Missha", "Artemisia Calming Essence", { category: "Essence", skinType: ["Sensitive", "Combination"], concern: ["Soothing", "Hydration"], price: 22, badge: "barrier", tone: "sage", ingredients: ["Mugwort"], popularity: 76, image: "missha-artemisia-calming-essence-150ml-1.jpg" }),
  p("Missha", "Premium Cica Aloe Soothing Gel", { category: "Moisturizer", skinType: ["Sensitive", "Oily", "Combination"], concern: ["Soothing", "Hydration"], price: 16, tone: "sage", ingredients: ["Centella", "Aloe"], popularity: 74, image: "missha-premium-cica-aloe-soothing-gel-300ml.jpg" }),
  p("Missha", "Chogongjin Cleansing Cream", { category: "Cleanser", skinType: ["Dry", "Normal"], concern: ["Hydration"], price: 18, tone: "gold", ingredients: ["Herbal Complex"], popularity: 66, image: "missha-chogongjin-cleansing-cream-170ml.jpg" }),
  p("Missha", "Blackhead Off Cleansing Oil", { category: "Cleanser", skinType: ["Oily", "Combination"], concern: ["Pores"], price: 18, tone: "gold", ingredients: ["Charcoal"], popularity: 69, image: "missha-blackhead-off-cleansing-oil-305ml.jpg" }),
  p("Missha", "Super Off Cleansing Oil (Dust Off)", { category: "Cleanser", skinType: ["Normal", "Combination"], concern: ["Pores"], price: 18, tone: "sky", ingredients: ["Apple Seed Oil"], popularity: 67, image: "missha-super-dust-off-cleansing-oil-305ml.jpg" }),
  p("Missha", "All Around Safe Block Essence Sun Milk SPF50+", { category: "Sunscreen", skinType: ["Normal", "Combination"], concern: ["Sun Protection"], price: 16, badge: "best", tone: "sky", ingredients: ["Pine Leaf"], popularity: 78, image: "missha-all-around-safe-block-essence-sun-milk-spf-50-pa-70ml.jpg" }),
  p("Missha", "All Around Safe Block Aqua Sun SPF50+", { category: "Sunscreen", skinType: ["Oily", "Combination"], concern: ["Sun Protection", "Hydration"], price: 16, tone: "sky", ingredients: ["Hyaluronic Acid"], popularity: 72, image: "missha-all-around-safe-block-aqua-sun-spf50-pa-50ml.jpg" }),
  p("Missha", "Airy Fit Sheet Mask", { category: "Mask", skinType: ["Normal", "Combination", "Dry"], concern: ["Hydration", "Soothing"], price: 3, tone: "sage", ingredients: ["Green Tea"], popularity: 75, img: "airy-fit-sheet-mask", front: "missha-airy-fit-sheet-mask-green-tea-19gm.jpg" }),
  p("Dr. Althea", "147 Barrier Cream", { category: "Moisturizer", skinType: ["Sensitive", "Dry"], concern: ["Barrier Repair", "Soothing"], price: 24, badge: "barrier", tone: "lilac", ingredients: ["Ceramides", "Panthenol"], popularity: 70, image: "dr-althea-147-barrier-cream-50ml.jpg" }),
  p("Dr. Althea", "Gentle Vitamin C Serum", { category: "Serum", skinType: ["Sensitive", "Normal"], concern: ["Brightening"], price: 24, tone: "gold", ingredients: ["Vitamin C"], popularity: 72, image: "dr-althea-gentle-vitamin-c-serum-30ml.jpg" }),
  p("Dr. Althea", "Vitamin C Boosting Serum", { category: "Serum", skinType: ["Normal", "Combination"], concern: ["Brightening", "Anti-Aging"], price: 26, badge: "dewy", tone: "gold", ingredients: ["Vitamin C"], popularity: 73, image: "dr-althea-vitamin-c-boosting-serum-30ml-1.jpg" }),
  p("Dr. Althea", "Pure Grinding Cleansing Balm", { category: "Cleanser", skinType: ["Normal", "Combination"], concern: ["Pores"], price: 22, tone: "peach", ingredients: ["Shea Butter"], popularity: 65, image: "dr-althea-pure-grinding-cleansing-balm-50ml.jpg" }),
  p("Anua", "Azelaic Acid 3% Cica Skin Clarifying Toner", { category: "Toner", skinType: ["Sensitive", "Combination", "Oily"], concern: ["Acne & Blemishes", "Soothing"], price: 21, badge: "new", isNew: true, tone: "rose", ingredients: ["Azelaic Acid", "Centella"], popularity: 73, image: "Anua-Azelaic-Acid-3-Cica-Skin-Clarifying-Toner-250ml.png" }),
  p("Anua", "Heartleaf Pore Control Cleansing Oil Mild", { category: "Cleanser", skinType: ["Sensitive", "Dry", "Combination"], concern: ["Pores", "Soothing"], price: 21, tone: "sage", ingredients: ["Heartleaf"], popularity: 75, img: "heartleaf-pore-cleansing-oil-mild", front: "Anua-Heartleaf-Pore-Control-Cleansing-Oil-Mild-200ml.png" }),
  p("Anua", "Heartleaf Silky Moisture Sunscreen SPF50+", { category: "Sunscreen", skinType: ["Dry", "Normal"], concern: ["Sun Protection", "Hydration"], price: 20, badge: "dewy", tone: "sage", ingredients: ["Heartleaf"], popularity: 74, image: "Anua-Heartleaf-Silky-Moisture-Sunscreen-50ml.png" }),
  p("Anua", "Zero Cast Moisturizing Finish Sunscreen SPF50+", { category: "Sunscreen", skinType: ["Normal", "Combination"], concern: ["Sun Protection"], price: 20, tone: "sky", ingredients: ["Panthenol"], popularity: 72, image: "Anua-Zero-Cast-Moisturizing-Finish-Sunscreen-50ml.png" }),
  p("Anua", "Peach 77 Niacin Essence Toner", { category: "Toner", skinType: ["Combination", "Normal"], concern: ["Brightening", "Hydration"], price: 21, badge: "dewy", tone: "peach", ingredients: ["Peach", "Niacinamide"], popularity: 76, image: "Anua-Peach-77-Niacin-Essence-Toner-250mlnormal-ZgBnpc2u1nCyaU12sAQcIseMpqlIJ3.jpg" }),
  p("Anua", "Peach Niacin Spread Cleansing Foam", { category: "Cleanser", skinType: ["Combination", "Normal"], concern: ["Brightening", "Pores"], price: 16, tone: "peach", ingredients: ["Peach", "Niacinamide"], popularity: 70, image: "Anua-Peach-Niacin-Spread-Cleansing-Foam-150ml.png" }),
  p("Anua", "Rice Enzyme Brightening Cleansing Powder", { category: "Cleanser", skinType: ["Normal", "Combination", "Sensitive"], concern: ["Brightening", "Exfoliation"], price: 18, tone: "gold", ingredients: ["Rice", "Enzyme"], popularity: 71, image: "Anua-Rice-Enzyme-Brightening-Cleansing-Powder-40g.png" }),
  p("Anua", "Golden Honmoon Barrier Collagen Mask (4ea)", { category: "Mask", skinType: ["Normal", "Dry", "Sensitive"], concern: ["Anti-Aging", "Hydration"], price: 20, badge: "new", isNew: true, tone: "gold", ingredients: ["Collagen"], popularity: 72, img: "golden-honmoon-barrier-collagen-mask", front: "anua-us-golden-honmoon-barrier-collagen-mask-4ea-1218701051.jpg" }),
  p("SKIN1004", "Madagascar Centella Cream", { category: "Moisturizer", skinType: ["Sensitive", "Dry"], concern: ["Soothing", "Hydration"], price: 23, tone: "sage", ingredients: ["Centella"], popularity: 74, image: "skin1004-cream-centella-cream-38642822906102.png" }),
];

export const PRODUCTS = PRODUCTS_RAW.filter((p) => KEEP_SLUGS.has(p.id));

/* ------------------------------------------------------------------ *
 * Mock inventory layer — dummy promos + stock-outs for a realistic store.
 * Sale fields are DERIVED from `compareAt` here in ONE place (single source
 * of truth) so cards & filters never recompute discounts ad-hoc.
 * ------------------------------------------------------------------ */
/* product id → percent off (sets a struck `compareAt` above the active price).
 * Values are hand-tuned into three coherent tiers so the homepage promo banners
 * ("30% off", "Up to 50% off", "Up to 75% off") each land on a real, matching
 * set of products. Tiers map to DISCOUNT_TIERS below:
 *   • 30 tier  → 25–39%   • 50 tier → 40–50%   • 75 tier → 51–80%
 * Every id here is verified in-stock (not in OUT_OF_STOCK) so a markdown never
 * points at a sold-out product. */
const PROMO = {
  // —— 30% tier (25–39%) ——
  "cosrx-advanced-snail-96-mucin-power-essence": 30,
  "the-ordinary-niacinamide-10-zinc-1": 33,
  "anua-niacinamide-10-txa-4-serum": 28,
  "cerave-moisturizing-cream": 35,
  "beauty-of-joseon-relief-sun-rice-probiotics-spf50": 30,
  "skin1004-madagascar-centella-ampoule": 25,
  "isntree-hyaluronic-acid-watery-sun-gel-spf50": 30,

  // —— 50% tier (40–50%) ——
  "missha-time-revolution-the-first-treatment-essence": 45,
  "cosrx-low-ph-good-morning-gel-cleanser": 50,
  "anua-heartleaf-77-soothing-toner": 40,
  "the-ordinary-hyaluronic-acid-2-b5": 50,
  "missha-all-around-safe-block-essence-sun-milk-spf50": 45,
  "dr-althea-345-relief-cream": 42,
  "isntree-hyper-vitamin-c-23-serum": 48,

  // —— 75% tier (51–80%) — deep clearance ——
  "missha-airy-fit-sheet-mask": 70,
  "cosrx-clear-fit-master-patch": 60,
  "the-ordinary-natural-moisturizing-factors-ha": 55,
  "isntree-real-rose-calming-mask": 65,
  "missha-premium-cica-aloe-soothing-gel": 72,
  "anua-heartleaf-70-soothing-collagen-mask-4ea": 60,
  "dr-althea-pure-grinding-cleansing-balm": 75,
};
// Kept sample products (beauty-of-joseon-revive-eye-serum-ginseng-retinal,
// cosrx-aha-bha-clarifying-treatment-toner, cosrx-bha-blackhead-power-liquid)
// were previously listed here — removed so the client-side pre-checks in
// Checkout.jsx (stockFor/maxQtyFor) don't block a sample product's checkout
// before place_order() ever gets a chance to check the real DB stock.
const OUT_OF_STOCK = new Set([]);

/* Hand-tuned low-stock units — drives the "Only N left" urgency state and the
 * per-line quantity cap. Anything unlisted gets a healthy popularity-derived
 * count; OUT_OF_STOCK items are forced to 0. `stock` is the single source of
 * truth — `inStock` is derived from it below. */
const LOW_STOCK = {
  "cosrx-advanced-snail-96-mucin-power-essence": 3,
  "the-ordinary-niacinamide-10-zinc-1": 2,
  "beauty-of-joseon-relief-sun-rice-probiotics-spf50": 5,
  "anua-heartleaf-77-soothing-toner": 4,
  "cerave-moisturizing-cream": 1,
  "missha-time-revolution-the-first-treatment-essence": 6,
};

/* A line can never exceed this, even when stock is deep — standard retail
 * per-order cap that keeps the stepper sane. */
export const MAX_PER_ORDER = 10;

/** Live units available for a product id (0 when sold out / unknown). */
export function stockFor(id) {
  return PRODUCTS.find((p) => p.id === id)?.stock ?? 0;
}

/** How many units of `id` a single cart line may hold. */
export function maxQtyFor(id) {
  return Math.min(stockFor(id), MAX_PER_ORDER);
}

/* ------------------------------------------------------------------ *
 * Curated sales — hand-tuned, believable lifetime-units-sold numbers
 * for the hero products (real K/J-beauty bestsellers like Snail 96 +
 * Niacinamide get the biggest figures). Anything not listed here falls
 * back to a popularity-derived value so the whole catalog still has a
 * monotonic salesCount the Best Selling sort can rank against.
 * ------------------------------------------------------------------ */
const CURATED_SALES = {
  "cosrx-advanced-snail-96-mucin-power-essence": 12450,
  "the-ordinary-niacinamide-10-zinc-1": 11680,
  "anua-heartleaf-77-soothing-toner": 9210,
  "the-ordinary-hyaluronic-acid-2-b5": 8460,
  "beauty-of-joseon-relief-sun-rice-probiotics-spf50": 8730,
  "cosrx-acne-pimple-master-patch": 7890,
  "skin1004-madagascar-centella-ampoule": 6920,
  "anua-heartleaf-pore-control-cleansing-oil": 6450,
  "beauty-of-joseon-glow-serum-propolis-niacinamide": 6240,
  "cosrx-low-ph-good-morning-gel-cleanser": 5870,
  "cerave-moisturizing-cream": 5610,
  "missha-time-revolution-the-first-treatment-essence": 5230,
  "beauty-of-joseon-glow-sun-stick-propolis-niacinamide-spf50": 4890,
  "anua-niacinamide-10-txa-4-serum": 4520,
  "isntree-hyaluronic-acid-watery-sun-gel-spf50": 4310,
  "cerave-hydrating-facial-cleanser": 4120,
  "cosrx-advanced-snail-92-all-in-one-cream": 3880,
  "the-ordinary-aha-30-bha-2-peeling-solution": 3650,
  "beauty-of-joseon-dynasty-cream": 3210,
  "anua-heartleaf-80-moisture-soothing-ampoule": 3050,
  "skin1004-centella-hyalu-cica-water-fit-sun-serum-spf50": 2890,
  "cosrx-aloe-soothing-sun-cream-spf50": 2640,
  "anua-niacinamide-tranexamic-acid-brightening-booster-toner": 2410,
};

for (const item of PRODUCTS) {
  const pct = PROMO[item.id];
  if (pct) item.compareAt = +(item.price / (1 - pct / 100)).toFixed(2);

  // —— Inventory —— `stock` (units) is the source of truth; `inStock` derives.
  if (OUT_OF_STOCK.has(item.id) || item.inStock === false) {
    item.stock = 0;
  } else if (LOW_STOCK[item.id] != null) {
    item.stock = LOW_STOCK[item.id];
  } else {
    // Deterministic healthy count, correlated with popularity (12–60 units).
    item.stock = 12 + Math.round((item.popularity / 100) * 48);
  }
  item.inStock = item.stock > 0;
  item.isLowStock = item.stock > 0 && item.stock <= 5;

  item.isOnSale = !!item.compareAt && item.compareAt > item.price;
  item.discountPercent = item.isOnSale ? Math.round((1 - item.price / item.compareAt) * 100) : 0;
  item.originalPrice = item.compareAt ?? null;
  // salesCount — curated hero numbers first; everything else falls back to a
  // popularity-driven value so the whole catalog ranks monotonically and no
  // unlisted product accidentally outranks a curated bestseller.
  if (item.inStock === false) {
    item.salesCount = 0;
  } else if (CURATED_SALES[item.id] != null) {
    item.salesCount = CURATED_SALES[item.id];
  } else {
    item.salesCount = Math.round(item.popularity * 15 + item.reviews / 20);
  }
}

/* Tag the top 10 IN-STOCK products by salesCount with the Best Seller badge.
 * Computing it here (not in product rows) means the badge is always truthful:
 * it follows whichever items are actually the highest sellers right now. */
const BEST_SELLER_BADGE = { variant: "bestseller", label: "Best Seller" };
const TOP_SELLER_COUNT = 10;
const topSellerIds = new Set(
  [...PRODUCTS]
    .filter((p) => p.inStock !== false)
    .sort((a, b) => b.salesCount - a.salesCount)
    .slice(0, TOP_SELLER_COUNT)
    .map((p) => p.id)
);
for (const item of PRODUCTS) {
  if (topSellerIds.has(item.id)) item.badge = BEST_SELLER_BADGE;
}

/* ================================================================== *
 * IMAGE QUALITY FILTER — Remove gradient-fallback products
 * ================================================================== *
 *
 * By default, products without real image URLs render SVG gradients
 * (via placeholderFor). This filter removes them to show ONLY authentic
 * product photography, ensuring visual consistency.
 *
 * BEHAVIOR:
 * • Detects placeholders by checking if image starts with "data:image/svg+xml"
 * • Removes all products that would render SVG fallbacks
 * • Remaining products render with real photography only
 * • Search/filters/facets update automatically (no code changes needed)
 *
 * TO DISABLE: Set FILTER_PRODUCTS_WITHOUT_IMAGES = false
 * ================================================================== */

const FILTER_PRODUCTS_WITHOUT_IMAGES = true; // Set to false to include placeholders

if (FILTER_PRODUCTS_WITHOUT_IMAGES) {
  const PRODUCTS_WITH_IMAGES = PRODUCTS.filter((product) => {
    // Products using SVG gradient fallback have image starting with "data:image/svg+xml"
    // (generated by placeholderFor when gallery is empty).
    // We want to keep only those with real image URLs.
    const isPlaceholder = product.image?.startsWith("data:image/svg+xml");
    return !isPlaceholder;
  });

  const placeholderCount = PRODUCTS.length - PRODUCTS_WITH_IMAGES.length;
  const coveragePercent = Math.round((PRODUCTS_WITH_IMAGES.length / PRODUCTS.length) * 100);

  if (placeholderCount > 0) {
    // Log only in development (will appear in console during local dev)
    if (typeof import.meta !== "undefined" && import.meta.env?.MODE === "development") {
      console.log(
        `✓ Image Filter Applied: ${PRODUCTS_WITH_IMAGES.length}/${PRODUCTS.length} products have real photos (${coveragePercent}%)\n` +
        `  Removed: ${placeholderCount} products with gradient fallbacks`
      );
    }
  }

  // Replace the original PRODUCTS with filtered version
  // (Maintains same reference; consuming code sees no difference)
  PRODUCTS.length = 0;
  PRODUCTS.push(...PRODUCTS_WITH_IMAGES);
}

/* ------------------------------------------------------------------ *
 * Facets — drive the filter UI
 * ------------------------------------------------------------------ */
export const AVAILABILITY = [
  { id: "inStock", label: "In Stock" },
  { id: "onSale", label: "On Sale" },
  { id: "isNew", label: "New Arrivals" },
];
export const SKIN_TYPES = ["Dry", "Oily", "Combination", "Sensitive", "Normal"];

export const CONCERNS = [
  "Hydration",
  "Barrier Repair",
  "Brightening",
  "Acne & Blemishes",
  "Pores",
  "Anti-Aging",
  "Soothing",
  "Exfoliation",
  "Sun Protection",
];

export const CATEGORIES = [
  "Cleanser",
  "Toner",
  "Essence",
  "Serum",
  "Moisturizer",
  "Sunscreen",
  "Mask",
  "Eye Care",
  "Treatment",
  "Oil",
];

export const BRANDS = [...new Set(PRODUCTS.map((p) => p.brand))].sort();

export const PRICE_RANGES = [
  { id: "u15", label: "Under ৳1800", min: 0, max: 15 },
  { id: "15-25", label: "৳1800 – ৳3000", min: 15, max: 25 },
  { id: "25-40", label: "৳3000 – ৳4800", min: 25, max: 40 },
  { id: "40+", label: "৳4800+", min: 40, max: Infinity },
];

/* Discount tiers — power the homepage promo banners AND the sidebar "Discount"
 * facet. A product matches a tier when its computed `discountPercent` falls in
 * [min, max]. Ranges are inclusive and non-overlapping, so each banner surfaces
 * a distinct, accurate edit (clicking "Up to 50% off" can never show a 15%
 * item). `min ≥ 25` on every tier means non-discounted products (percent 0) are
 * excluded automatically — a tier implies "on sale". */
export const DISCOUNT_TIERS = [
  { id: "30", label: "30% Off", min: 25, max: 39 },
  { id: "50", label: "Up to 50% Off", min: 40, max: 50 },
  { id: "75", label: "Up to 75% Off", min: 51, max: 80 },
];

export const SORTS = [
  { id: "featured", label: "Featured" },
  { id: "best", label: "Best Selling" },
  { id: "price-asc", label: "Price: Low to High" },
  { id: "price-desc", label: "Price: High to Low" },
  { id: "rating", label: "Top Rated" },
  { id: "newest", label: "Newest" },
];

/* ------------------------------------------------------------------ *
 * Query engine — filter + search + sort. The pure search primitives
 * (tokenize, matchesSearch, fuzzyMatches, relevanceScore) live in
 * `lib/search.js` and are shared with the predictive-search dropdown.
 * ------------------------------------------------------------------ */
import {
  tokenize,
  matchesSearch,
  fuzzyMatches,
  relevanceScore,
} from "../lib/search.js";
export { matchesSearch };

export function queryProducts(all, { search = "", filters = {}, sort = "featured" }) {
  const q = search.trim().toLowerCase();
  const terms = tokenize(q);
  const { skinType = [], concern = [], brand = [], category = [], price = [], availability = [], discount = [] } =
    filters;

  const priceRanges = PRICE_RANGES.filter((r) => price.includes(r.id));
  const discountTiers = DISCOUNT_TIERS.filter((t) => discount.includes(t.id));

  // Non-search predicates — used to gate both strict + fuzzy passes.
  const passesFilters = (item) => {
    if (availability.includes("inStock") && item.inStock === false) return false;
    if (availability.includes("onSale") && !item.isOnSale) return false;
    if (availability.includes("isNew") && !item.isNew) return false;
    // "All Skin Types" on the product means it matches ANY skin-type filter
    // the shopper picks — a product tagged only that must still show up
    // under Oily, Dry, every one of them, not just an exact string match.
    if (
      skinType.length &&
      !item.skinType.includes("All Skin Types") &&
      !item.skinType.some((s) => skinType.includes(s))
    ) return false;
    if (concern.length && !item.concern.some((c) => concern.includes(c))) return false;
    if (brand.length && !brand.includes(item.brand)) return false;
    if (category.length && !category.includes(item.category)) return false;
    if (priceRanges.length && !priceRanges.some((r) => item.price >= r.min && item.price < r.max)) return false;
    // Discount tier — matches only products whose discountPercent lands in a
    // selected tier's [min, max]. Non-sale items (percent 0) never qualify.
    if (
      discountTiers.length &&
      !discountTiers.some((t) => item.discountPercent >= t.min && item.discountPercent <= t.max)
    )
      return false;
    return true;
  };

  // Strict pass first (fast). Fall through to fuzzy ONLY when the strict
  // search returns nothing, so happy-path typing pays zero fuzzy cost.
  let list = all.filter((item) => {
    if (terms.length && !matchesSearch(item, terms)) return false;
    return passesFilters(item);
  });
  if (terms.length && list.length === 0) {
    list = all.filter((item) => fuzzyMatches(item, terms) && passesFilters(item));
  }

  const sorters = {
    featured: (a, b) => b.popularity - a.popularity,
    // Best Selling — order strictly by synthetic units sold (highest first).
    // OOS items get salesCount=0 so they sink to the bottom of this view.
    best: (a, b) => b.salesCount - a.salesCount,
    "price-asc": (a, b) => a.price - b.price,
    "price-desc": (a, b) => b.price - a.price,
    rating: (a, b) => b.rating - a.rating,
    newest: (a, b) => Number(b.isNew) - Number(a.isNew) || b.popularity - a.popularity,
  };
  const chosen = sorters[sort] ?? sorters.featured;

  // Active search → rank by relevance (name-prefix first, then contains, then
  // keyword/ingredient hits). The chosen sort is only a tiebreak, so typing
  // "a" still floats "Aloe…"/"Advanced…" above products that merely contain a.
  if (terms.length) {
    return [...list].sort(
      (a, b) => relevanceScore(b, q, terms) - relevanceScore(a, q, terms) || chosen(a, b)
    );
  }

  const ordered = [...list].sort(chosen);

  // Image-first bubble-up is a polish for the default "Featured" landing
  // view only. Any deliberate sort (Best Selling, Price, Rating, Newest…)
  // OR an active filter must honour the chosen order exactly — otherwise a
  // real top-10 bestseller without a photo could sink below lesser products
  // that happen to have an image.
  const hasFilters =
    skinType.length ||
    concern.length ||
    brand.length ||
    category.length ||
    price.length ||
    availability.length ||
    discount.length;
  if (hasFilters || sort !== "featured") return ordered;

  // Generic catalog → float image-backed products to the top (stable).
  return ordered.sort((a, b) => (b.image ? 1 : 0) - (a.image ? 1 : 0));
}
