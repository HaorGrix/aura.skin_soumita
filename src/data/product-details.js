/* =================================================================== *
 * skin.theory — PDP DETAIL BUILDER
 * -------------------------------------------------------------------
 * Enriches ANY base catalog product into a full product-detail payload
 * (benefits, ingredient stories, how-to ritual, reviews, variants,
 * gallery). This is what makes the PDP scale to a 2000+ SKU store —
 * one detail page powers every product, no hand-authoring required.
 * =================================================================== */
import { PRODUCTS } from "./products.js";
import { CURATED_REVIEWS } from "./reviews.js";

/* Concern → headline benefit (emoji badge) */
const BENEFIT = {
  Hydration: { emoji: "💧", label: "Deep Hydration" },
  "Barrier Repair": { emoji: "🛡️", label: "Barrier Repair" },
  Brightening: { emoji: "🌟", label: "Glass-Skin Glow" },
  "Acne & Blemishes": { emoji: "🌿", label: "Blemish Care" },
  Pores: { emoji: "🔬", label: "Pore Refining" },
  "Anti-Aging": { emoji: "⏳", label: "Firm & Bounce" },
  Soothing: { emoji: "🍃", label: "Calm & Soothe" },
  Exfoliation: { emoji: "✨", label: "Gentle Exfoliation" },
  "Sun Protection": { emoji: "☀️", label: "SPF50+ Shield" },
};

/* Ingredient stories */
const INGREDIENT = {
  "Snail Mucin": { emoji: "🐌", blurb: "96% snail secretion filtrate repairs and plumps for bouncy, dewy skin." },
  Niacinamide: { emoji: "✨", blurb: "Brightens tone, refines pores and balances oil — the K-beauty all-rounder." },
  Centella: { emoji: "🌿", blurb: "Cica calms redness and strengthens a stressed moisture barrier." },
  Madecassoside: { emoji: "🌿", blurb: "The hero compound in cica — deeply soothing and barrier-restoring." },
  "Hyaluronic Acid": { emoji: "💧", blurb: "Holds up to 1000× its weight in water for cushiony, lasting hydration." },
  Heartleaf: { emoji: "🍃", blurb: "Houttuynia cordata soothes sensitivity and quiets breakouts." },
  Propolis: { emoji: "🍯", blurb: "Bee-derived antioxidant glow for nourished, radiant skin." },
  Rice: { emoji: "🌾", blurb: "Rice extract brightens and softens for that signature glass finish." },
  "Vitamin C": { emoji: "🍊", blurb: "Antioxidant brightening that gradually fades dark spots." },
  Retinoid: { emoji: "🌙", blurb: "Smooths texture and softens fine lines while you sleep." },
  Retinal: { emoji: "🌙", blurb: "A fast-acting retinoid for visibly smoother, firmer skin." },
  Ginseng: { emoji: "🌱", blurb: "Energizing root extract for resilient, youthful-looking skin." },
  "Tea Tree": { emoji: "🌿", blurb: "Naturally clarifying for blemish-prone, congested skin." },
  BHA: { emoji: "✨", blurb: "Oil-soluble exfoliant that unclogs pores from within." },
  AHA: { emoji: "✨", blurb: "Resurfaces dull, uneven texture for a fresh glow." },
  PHA: { emoji: "✨", blurb: "The gentlest acid — exfoliates without stinging sensitive skin." },
  Ceramides: { emoji: "🧱", blurb: "Rebuild the skin barrier and lock moisture in." },
  Probiotics: { emoji: "🦠", blurb: "Support a balanced, resilient skin microbiome." },
  "Birch Sap": { emoji: "🌳", blurb: "Mineral-rich sap that floods skin with weightless moisture." },
  "Green Tea": { emoji: "🍵", blurb: "Antioxidant-rich and calming for stressed skin." },
  Galactomyces: { emoji: "🌾", blurb: "Fermented ferment for radiance and refined texture." },
  "Alpha Arbutin": { emoji: "🤍", blurb: "Targets dark spots for a more even, luminous tone." },
  Zinc: { emoji: "⚪", blurb: "Balances sebum and calms blemish-prone skin." },
  Collagen: { emoji: "🫧", blurb: "Plumps and firms for a bouncy, cushioned feel." },
  Soybean: { emoji: "🫘", blurb: "Nourishing fermented soy for soft, conditioned skin." },
  Aloe: { emoji: "🪴", blurb: "Cooling hydration that instantly soothes." },
  "Amino Acids": { emoji: "💧", blurb: "Natural moisturizing factors that keep skin supple." },
  Caffeine: { emoji: "☕", blurb: "De-puffs and brightens tired-looking under-eyes." },
};

const INGREDIENT_DEFAULT = (name) => ({
  emoji: "🌸",
  blurb: `${name} — a skin-loving active chosen for healthy, glowing results.`,
});

/* How-to ritual by category */
const HOWTO = {
  Cleanser: [
    { emoji: "💦", title: "Wet & lather", text: "Massage a coin-sized amount onto damp skin in gentle circles." },
    { emoji: "🌀", title: "Melt the day", text: "Let it lift away sunscreen, makeup and impurities." },
    { emoji: "🚿", title: "Rinse clean", text: "Rinse with lukewarm water until skin feels fresh, never tight." },
  ],
  Toner: [
    { emoji: "🧴", title: "Dispense", text: "Pour a few drops onto a cotton pad or your palms." },
    { emoji: "🤲", title: "Press in", text: "Pat gently across the face until fully absorbed." },
    { emoji: "🔁", title: "Layer", text: "Repeat 2–3 times for the K-beauty 'skin flooding' glow." },
  ],
  Essence: [
    { emoji: "💧", title: "Warm it", text: "Dispense into clean palms and warm for a second." },
    { emoji: "🤲", title: "Press in", text: "Pat over toned skin — don't rub, just press to absorb." },
    { emoji: "✨", title: "Seal", text: "Follow with serum and moisturizer to lock it in." },
  ],
  Serum: [
    { emoji: "💧", title: "A few drops", text: "Apply 2–3 drops to clean, toned skin." },
    { emoji: "🤲", title: "Press & glide", text: "Gently press across face and neck until absorbed." },
    { emoji: "🌙", title: "Lock it in", text: "Layer moisturizer (and SPF in the AM) on top." },
  ],
  Moisturizer: [
    { emoji: "🫧", title: "Scoop a pearl", text: "Take a pea-sized amount onto your fingertips." },
    { emoji: "🤲", title: "Warm & press", text: "Massage upward and outward in gentle strokes." },
    { emoji: "✨", title: "Finish", text: "Use AM & PM as the final step of hydration (before SPF)." },
  ],
  Sunscreen: [
    { emoji: "🧴", title: "Two-finger rule", text: "Dispense two fingers' length for full-face protection." },
    { emoji: "🤲", title: "Apply evenly", text: "Spread as the last step of your morning routine." },
    { emoji: "🔁", title: "Reapply", text: "Top up every 2 hours under sun exposure." },
  ],
  Mask: [
    { emoji: "🧖", title: "Apply", text: "Smooth an even layer over cleansed skin." },
    { emoji: "⏳", title: "Relax", text: "Leave on as directed and breathe — this is your moment." },
    { emoji: "✨", title: "Reveal", text: "Rinse or pat in the remainder for a dewy finish." },
  ],
  "Eye Care": [
    { emoji: "👁️", title: "Tiny amount", text: "Dot a rice-grain amount under each eye." },
    { emoji: "🤙", title: "Tap gently", text: "Use your ring finger to pat — never tug." },
    { emoji: "🌙", title: "AM & PM", text: "Use morning and night for brighter, smoother eyes." },
  ],
  Treatment: [
    { emoji: "🎯", title: "Spot or layer", text: "Apply to target areas or as directed on clean skin." },
    { emoji: "⏳", title: "Let it work", text: "Allow full absorption before the next step." },
    { emoji: "🌙", title: "Go slow", text: "Start 2–3× a week, then build up as skin adjusts." },
  ],
  Oil: [
    { emoji: "💧", title: "Warm drops", text: "Warm 3–4 drops between your palms." },
    { emoji: "🤲", title: "Press in", text: "Press over skin as the last nourishing step at night." },
    { emoji: "🌙", title: "Glow up", text: "Wake to softer, replenished, glowing skin." },
  ],
};
const HOWTO_DEFAULT = HOWTO.Serum;

// Cosmetic-only rotation for admin-authored steps — there's no way to infer
// a *meaningful* emoji per line of free text the way the category templates
// above hand-pick one per step, so this just cycles through a neutral set
// for visual rhythm instead of showing the same icon on every card.
const HOWTO_CUSTOM_EMOJI = ["✨", "💧", "🤲", "🌙", "🧴", "🔁", "🌿", "☀️"];

/** Turn the admin's free-text "How to use" into the same {emoji, title,
 *  text} step shape the category templates use — same admin-input-wins,
 *  template-as-fallback contract as longDescription/philosophy above.
 *
 *  Two shapes come out of one field, chosen by what the admin actually
 *  typed, so this works whether they write a numbered ritual or a single
 *  paragraph — no separate UI/field needed for either:
 *   - Multiple non-blank lines → each line is one step. An optional
 *     "Title: text" prefix (colon in the first ~40 chars) supplies the
 *     step's title; otherwise it's labelled "Step N".
 *   - Exactly one line (a plain paragraph, no line breaks) → doesn't force
 *     a single lonely card into a 3-column step grid; rendered as prose
 *     instead, matching the Description tab's style.
 *   - Blank/missing → null, so buildPdp() falls back to the category
 *     template untouched.
 */
function parseHowTo(rawText) {
  const lines = (rawText ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return null;

  if (lines.length === 1) {
    return { kind: "prose", text: lines[0] };
  }

  const steps = lines.map((line, i) => {
    const m = line.match(/^([^:：]{1,40})[:：]\s*(.+)$/);
    return {
      emoji: HOWTO_CUSTOM_EMOJI[i % HOWTO_CUSTOM_EMOJI.length],
      title: m ? m[1].trim() : `Step ${i + 1}`,
      text: m ? m[2].trim() : line,
    };
  });
  return { kind: "steps", steps };
}

/* Deterministic PRNG seeded from the product id (stable reviews) */
function seeded(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const REVIEWERS = ["Mehzabin A.", "Rakib H.", "Aparna S.", "Sumaiya K.", "Niloy D.", "Tasnia R.", "Karan J.", "Riya M.", "Faiza N.", "Sourav B.", "Tania H.", "Vikram R."];
const TITLES = ["Glass skin is real ✨", "My holy grail", "Glow up in 2 weeks", "Barrier saved", "Obsessed 🌸", "Repurchasing forever", "So gentle, so good", "Dewy dream"];
const BODIES = [
  "My skin has never looked this dewy. It absorbs beautifully and layers like a dream under makeup.",
  "Calmed my redness within days and didn't break me out at all. The texture is so elegant.",
  "A little goes a long way and the glow is unreal. This is a permanent shelf staple now.",
  "Gentle enough for my reactive skin but I can actually see results. Bouncy, plump, happy skin.",
  "The K-beauty hype is justified. Hydration that lasts all day and a finish that just glows.",
  "Repurchased three times already. My barrier feels stronger and my tone looks brighter.",
];

function buildGenerated(product, rand, count) {
  return Array.from({ length: count }, (_, i) => {
    const stars = rand() > 0.18 ? 5 : 4;
    return {
      id: `${product.id}-g${i}`,
      name: REVIEWERS[Math.floor(rand() * REVIEWERS.length)],
      verified: rand() > 0.12,
      stars,
      title: TITLES[Math.floor(rand() * TITLES.length)],
      body: BODIES[Math.floor(rand() * BODIES.length)],
      daysAgo: 4 + Math.floor(rand() * 150),
      helpful: Math.floor(rand() * 40),
      hasPhoto: rand() > 0.7,
      tone: product.tone,
    };
  });
}

/* Curated (named) reviews for this product + generated fillers → ~6 total,
 * so every PDP looks populated while hero products carry real-feeling copy. */
function reviewsForProduct(product, rand) {
  const curated = CURATED_REVIEWS.filter((r) => r.productId === product.id).map((r) => ({
    ...r,
    verified: true,
    tone: product.tone,
  }));
  const fillers = buildGenerated(product, rand, Math.max(0, 6 - curated.length));
  return [...curated, ...fillers];
}

/* Variant builder — size always, plus a pack option for some categories */
function buildVariants(product) {
  const sizeByCat = {
    Serum: ["30 ml", "50 ml"],
    Essence: ["100 ml", "150 ml"],
    Toner: ["150 ml", "300 ml"],
    Moisturizer: ["50 ml", "100 ml"],
    Sunscreen: ["50 ml", "100 ml"],
    Cleanser: ["150 ml", "200 ml"],
    Oil: ["100 ml", "150 ml"],
    Mask: ["70 ml", "100 ml"],
    "Eye Care": ["30 ml"],
    Treatment: ["Single", "Value Pack"],
  };
  const sizes = sizeByCat[product.category] ?? ["Standard", "Jumbo"];
  const groups = [
    {
      name: "Size",
      options: sizes.map((label, i) => ({
        id: label,
        label,
        // larger size costs more; first option is the base price
        priceDelta: i === 0 ? 0 : Math.round(product.price * 0.6 * 100) / 100,
      })),
    },
  ];
  return groups;
}

/* Build the gallery — one thumbnail per real uploaded image, no more, no
 * fewer, no fixed slots. Each DB image carries its own admin-entered label
 * (ImageManager.jsx); that's used verbatim, never reassigned by position.
 * The static bundled catalog has no per-image labels, so its plain URL
 * strings fall back to "View n". With zero real photos, a single branded
 * placeholder card stands in — never multiple ghost slots with fake
 * labels for images that don't exist. */
function buildGallery(product) {
  const photos = product.gallery ?? [];

  if (photos.length > 0) {
    return photos.map((photo, i) => {
      const isRealImage = typeof photo === "object" && photo !== null;
      // Real DB images show exactly what the admin typed, including blank —
      // never a fabricated label they never entered. The static bundled
      // catalog has no per-image labels to preserve, so it keeps a generic
      // fallback.
      const label = isRealImage ? (photo.label ?? "") : `View ${i + 1}`;
      return {
        id: `${product.id}-g${i}`,
        label,
        tone: product.tone,
        hue: i,
        image: isRealImage ? photo.url : photo,
      };
    });
  }

  return [{ id: `${product.id}-g0`, label: "", tone: product.tone, hue: 0, image: product.image ?? undefined }];
}

function ratingBreakdown(product, rand) {
  // Mostly 5★, weighted to the product's rating
  const five = 0.7 + (product.rating - 4.4) * 0.4;
  const four = 0.2;
  const r5 = Math.round(product.reviews * five);
  const r4 = Math.round(product.reviews * four);
  const r3 = Math.round(product.reviews * 0.06);
  const r2 = Math.round(product.reviews * 0.02);
  const r1 = Math.max(0, product.reviews - r5 - r4 - r3 - r2);
  return { 5: r5, 4: r4, 3: r3, 2: r2, 1: r1 };
}

/* -------- main builder -------- */
export function buildPdp(product) {
  const rand = seeded(product.id);

  const benefits = product.concern
    .map((c) => BENEFIT[c])
    .filter(Boolean)
    .slice(0, 4);

  const ingredients = product.ingredients.map((name) => ({
    name,
    ...(INGREDIENT[name] ?? INGREDIENT_DEFAULT(name)),
  }));

  // Both prefer the real, admin-saved value (products.description /
  // products.philosophy) when one exists — the generated copy below is
  // only ever a fallback for a product nobody has written real copy for
  // yet, same "storefront never breaks" contract every other CMS-backed
  // field in this project honours. Previously these were unconditional,
  // so an admin's real, saved description/philosophy was silently
  // discarded and this generated text shown instead, every time.
  const longDescription =
    product.description?.trim() ||
    `Meet your new glass-skin essential. ${product.brand}'s ${product.name} is a ${product.category.toLowerCase()} ` +
    `crafted for ${product.concern.join(", ").toLowerCase()} — powered by ${product.ingredients.join(", ")}. ` +
    `Lightweight, fast-absorbing and endlessly layerable, it delivers that lit-from-within K-beauty glow while ` +
    `caring for your barrier. Suitable for ${product.skinType.join(", ").toLowerCase()} skin.`;

  const philosophy =
    product.philosophy?.trim() ||
    "Rooted in the K & J-beauty philosophy of gentle, consistent care — fewer harsh actives, more nourishment, " +
    "and rituals that feel like self-love. Clean, cruelty-free, and dermatologist-tested.";

  return {
    // `inStock`, `compareAt`, `isOnSale`, `discountPercent`, `originalPrice`
    // all flow through from the single catalog source of truth.
    ...product,
    benefits,
    ingredients,
    longDescription,
    philosophy,
    howTo: parseHowTo(product.howToUse) ?? { kind: "steps", steps: HOWTO[product.category] ?? HOWTO_DEFAULT },
    // Real DB-backed products (getProductBySlug in lib/api/products.js)
    // already attach `product.variants` — the actual product_variants rows,
    // not a guess. buildVariants() only fires for the bundled static
    // catalog, which has no real variant data and never will.
    variants: product.variants ?? buildVariants(product),
    gallery: buildGallery(product),
    // Real per-product video (0023_product_video.sql) — this used to be
    // hardcoded true, showing a fake "60s ritual demo" tab and video-slot
    // thumbnail on every single product regardless of whether one existed.
    // Now only true when the admin has actually uploaded one.
    hasVideo: !!product.videoUrl,
    videoUrl: product.videoUrl ?? null,
    reviewCount: product.reviews,
    reviews: reviewsForProduct(product, rand),
    ratingBreakdown: ratingBreakdown(product, rand),
    shipping: {
      ships: "Ships within 24 hours from our climate-controlled warehouse.",
      // Delivery text (including the free-shipping threshold) is built live
      // in ProductTabs.jsx from store_settings.free_shipping_threshold_minor —
      // this module has no access to the live admin setting, so it's not
      // baked in here.
      returns: "Loved-it-or-not 30-day returns. Empties welcome — we recycle. ♻️",
    },
  };
}

export function getProductDetail(id) {
  const base = PRODUCTS.find((p) => p.id === id);
  return base ? buildPdp(base) : null;
}

/* "Complete Your Ritual" — related by shared skin type/concern, varied category.
 *
 * `pickRelated` takes the candidate list explicitly so the same scoring works
 * against the live Supabase catalog as against the static array. `getRelated`
 * keeps the old signature for callers still on the bundled data. */
export function pickRelated(all, product, limit = 6) {
  return (all ?? [])
    .filter((p) => p.id !== product.id)
    .map((p) => {
      let score = 0;
      if (p.skinType?.some((s) => product.skinType?.includes(s))) score += 2;
      if (p.concern?.some((c) => product.concern?.includes(c))) score += 2;
      if (p.category !== product.category) score += 1; // prefer complementary steps
      score += (p.popularity ?? 0) / 100;
      return { p, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.p);
}

export function getRelated(product, limit = 6) {
  return pickRelated(PRODUCTS, product, limit);
}
