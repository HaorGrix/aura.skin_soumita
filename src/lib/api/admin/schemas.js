/* =================================================================== *
 * skin.theory admin — CMS slot definitions
 * -------------------------------------------------------------------
 * The contract between an editable region of the storefront and the admin
 * form that edits it. Adding a new editable block = adding an entry here
 * plus reading it in the component. No new admin screen, no new table.
 *
 * Field types the editor knows how to render:
 *   text | textarea | number | boolean | image | media | route | link | color | date | list
 *
 * `route` is a dropdown of known top-level pages; `link` is free text that
 * additionally accepts deep paths and off-site URLs. Prefer `route` when the
 * target really is one of the main pages — the dropdown can't be typo'd.
 *
 * `media` (unlike `image`) accepts video too — uploads go to the `site-media`
 * bucket (0011_hero_carousel_media.sql), not product-images. Use it for CMS
 * fields that should support both, like the Hero Carousel's banners.
 *
 * NOTE on `home.hero`: Hero.jsx currently holds its headline as a WORD ARRAY
 * (`["Glass","skin,","every","day."]`) because the entrance animation
 * staggers per word. The CMS stores a plain string and the component splits
 * it at render — so the client types a sentence, not an array, and the
 * animation is untouched.
 * =================================================================== */

export const SLOTS = [
  {
    slot: "global.announcement",
    label: "Announcement Bar",
    group: "Global",
    help: "The thin strip above the header. Leave the text empty to hide it.",
    fields: [
      { key: "enabled", label: "Show the bar", type: "boolean", default: false },
      { key: "text", label: "Message", type: "text", max: 90, default: "" },
      { key: "linkLabel", label: "Link text", type: "text", max: 24, default: "" },
      { key: "linkHref", label: "Link target", type: "route", default: "/shop" },
      { key: "startsAt", label: "Show from", type: "date", default: "" },
      { key: "endsAt", label: "Hide after", type: "date", default: "" },
    ],
  },
  {
    slot: "home.hero",
    label: "Homepage Hero",
    group: "Homepage",
    help: "The first thing a visitor sees. The headline animates word by word — just type a normal sentence.",
    // Every default below is the EXACT copy that was hardcoded in Hero.jsx
    // before the CMS existed. That's deliberate: wiring a component to the
    // CMS must be visually invisible until the client actually edits it. A
    // "nicer" default here silently rewrites the live site on deploy.
    // The first two words of line 2 get the italic glow treatment.
    fields: [
      { key: "eyebrow", label: "Eyebrow", type: "text", max: 40, default: "For every skin · K & J-Beauty" },
      { key: "line1", label: "Headline line 1", type: "text", max: 24, default: "Glow within." },
      { key: "line2", label: "Headline line 2", type: "text", max: 40, default: "Glass skin, every day." },
      { key: "body", label: "Supporting text", type: "textarea", max: 240,
        default: "Real K- and J-Beauty, straight from authorised distributors. Barrier-first formulas for the skin you actually have, plus honest advice about what you can skip. ✨" },
      { key: "ctaLabel", label: "Button label", type: "text", max: 24, default: "Start Your Ritual" },
      { key: "ctaHref", label: "Button target", type: "route", default: "/shop" },
      { key: "image", label: "Background image", type: "image", aspect: "3:4", default: "" },
      { key: "imageAlt", label: "Image description", type: "text", max: 120, default: "" },
    ],
  },
  {
    slot: "home.heroCarousel",
    label: "Homepage Hero Carousel",
    group: "Homepage",
    help: "The sliding banner strip right below the header. Each banner is an image or a short video, stored in the site-media bucket. Remove every banner and the strip disappears from the homepage.",
    fields: [
      {
        key: "items", label: "Banners", type: "list", max: 8,
        itemFields: [
          { key: "media", label: "Media (image or video)", type: "media" },
          // `link`, not `route`: a hero banner routinely points somewhere the
          // fixed route list can't express — a single product, a filtered
          // Shop URL, or an off-site campaign page. Free text with route
          // suggestions covers all three; `route` covered only the first.
          { key: "ctaHref", label: "Clicking this banner opens", type: "link",
            help: "A page on this site (/shop, /product/abc) or a full external link (https://…)" },
          { key: "eyebrow", label: "Eyebrow", type: "text", max: 40 },
          { key: "title", label: "Title", type: "text", max: 60 },
          { key: "subtitle", label: "Subtitle", type: "textarea", max: 160 },
          { key: "ctaLabel", label: "Button label", type: "text", max: 24 },
        ],
        default: [],
      },
    ],
  },
  {
    slot: "home.offers",
    label: "Offer Banners",
    group: "Homepage",
    help: "The promotional tiles on the homepage. Each one links into Shop with a discount filter applied.",
    fields: [
      { key: "heading", label: "Section heading", type: "text", max: 48, default: "Offers" },
      { key: "subheading", label: "Section subheading", type: "text", max: 120, default: "" },
      {
        key: "items", label: "Banners", type: "list", max: 6,
        itemFields: [
          { key: "title", label: "Title", type: "text", max: 40 },
          { key: "subtitle", label: "Subtitle", type: "text", max: 80 },
          { key: "badge", label: "Tag", type: "text", max: 20 },
          { key: "href", label: "Links to", type: "route" },
          { key: "image", label: "Image", type: "image" },
        ],
        default: [],
      },
    ],
  },
  {
    slot: "home.concerns",
    label: "Shop by Concern",
    group: "Homepage",
    help: "The concern tiles. Images are shown uncropped, so any aspect ratio is fine.",
    fields: [
      { key: "heading", label: "Section heading", type: "text", max: 48, default: "Shop by concern" },
      {
        key: "items", label: "Concerns", type: "list", max: 12,
        itemFields: [
          { key: "label", label: "Concern", type: "text", max: 30 },
          { key: "image", label: "Image", type: "image" },
        ],
        default: [],
      },
    ],
  },
  {
    slot: "home.why",
    label: "Why skin.theory",
    group: "Homepage",
    fields: [
      { key: "heading", label: "Heading", type: "text", max: 48, default: "" },
      {
        key: "items", label: "Points", type: "list", max: 6,
        itemFields: [
          { key: "title", label: "Title", type: "text", max: 36 },
          { key: "body", label: "Description", type: "textarea", max: 160 },
        ],
        default: [],
      },
    ],
  },
  {
    slot: "page.about",
    label: "About Page",
    group: "Pages",
    help: "Controls the headline and hero paragraph at the top of the About page. The stats, pillars, and values sections further down are fixed layout, not editable here yet.",
    fields: [
      {
        key: "title",
        label: "Page headline (H1) — the big heading at the top of the About page. Add a | (pipe) to italicize everything after it, e.g. \"Transparency|in Every Drop.\" — the part after the pipe renders in italic magenta, matching the original design. No pipe = the whole headline renders plain.",
        type: "text", max: 60, default: "Transparency|in Every Drop.",
      },
      {
        key: "intro",
        label: "Hero paragraph — shown under the headline. Use {storeName} anywhere you want the live store name inserted",
        type: "textarea", max: 400,
        default: "We believe skincare is not just a market — it's a trust contract between a brand and a person's skin. Every decision we make at {storeName} flows from one question: \"Would we use this ourselves?\"",
      },
      { key: "body", label: "Extra text (not currently shown on the page — reserved)", type: "textarea", max: 2000, default: "" },
      { key: "image", label: "Feature image (not currently shown on the page — reserved)", type: "image", default: "" },
    ],
  },
  {
    slot: "page.contact",
    label: "Contact Page",
    group: "Pages",
    help: "Controls the headline, intro, and the Email / Phone / Social / Hours / Address details shown on the Contact page.",
    fields: [
      {
        key: "title", label: "Page headline (H1) — the big heading at the top of the Contact page",
        type: "text", max: 60, default: "Need routine help, order care, or a brand question?",
      },
      {
        key: "intro", label: "Intro paragraph — shown under the headline",
        type: "textarea", max: 400,
        default: "Send a note to the care desk. The form handles routine requests, order questions, collaboration notes, and ingredient guidance in one tidy place.",
      },
      {
        key: "email", label: "Support email", type: "text", default: "care@skinscript.com",
        help: "Shown in the Email card on the Contact page, and used as its mailto: link.",
      },
      {
        key: "phone", label: "Support phone", type: "text", default: "+880 1700 000 000",
        help: "Shown in the Phone card on the Contact page. Also used as its tel: link — include the country code (e.g. +8801XXXXXXXXX) so the link dials correctly.",
      },
      {
        key: "socialHandle", label: "Social handle", type: "text", default: "@skin.theory1",
        help: "Shown in the Social card on the Contact page (e.g. @yourhandle).",
      },
      {
        key: "socialUrl", label: "Social link URL", type: "text", default: "https://www.instagram.com/skintheorybd",
        help: "Where the Social card links to. Leave blank to show the handle without a clickable link.",
      },
      {
        key: "hours", label: "Opening hours", type: "text", max: 80,
        default: "Saturday to Thursday, 10:00 AM - 7:00 PM",
      },
      {
        key: "address", label: "Address / location line", type: "textarea", max: 200,
        default: "Dhaka care studio, online-first delivery across Bangladesh",
      },
    ],
  },
  {
    slot: "footer.columns",
    label: "Footer",
    group: "Global",
    help: "Controls the footer's blurb, link columns, and social icons across the whole site. The store name and current year in the bottom copyright line are always live — the text below just fills in the rest of that line.",
    fields: [
      {
        key: "blurb", label: "Footer blurb — short description under the store name",
        type: "textarea", max: 200,
        default: "K- and J-Beauty, sourced honestly and sold without the theatre. Bangladesh-based, shipping nationwide.",
      },
      {
        key: "links", label: "Footer links", type: "list", max: 16,
        itemFields: [
          { key: "column", label: "Column heading (e.g. Shop, About, Help) — links with the same heading are grouped together", type: "text", max: 20 },
          { key: "label", label: "Link text", type: "text", max: 30 },
          { key: "href", label: "Links to", type: "route" },
        ],
        default: [
          { column: "Shop", label: "All Products", href: "/shop" },
          { column: "Shop", label: "Best Sellers", href: "/shop?sort=best" },
          { column: "Shop", label: "New Arrivals", href: "/shop?sort=newest" },
          { column: "About", label: "Our Story", href: "/about" },
          { column: "About", label: "Offers", href: "/offers" },
          { column: "About", label: "Journal", href: "/journal" },
          { column: "Help", label: "Shipping & Returns", href: "/shipping" },
          { column: "Help", label: "Track Order", href: "/account?tab=orders" },
          { column: "Help", label: "FAQs", href: "/contact" },
          { column: "Help", label: "Contact", href: "/contact" },
        ],
      },
      {
        key: "instagram", label: "Instagram URL", type: "text",
        help: "Leave blank to hide the Instagram icon entirely.",
        default: "https://www.instagram.com/skintheorybd?utm_source=qr&igsh=MXM1N2xtZnB6aWRwYg==",
      },
      {
        key: "facebook", label: "Facebook URL", type: "text",
        help: "Leave blank to hide the Facebook icon entirely.",
        default: "https://www.facebook.com/share/1BaNyk2kD1/",
      },
      {
        key: "tiktok", label: "TikTok URL", type: "text",
        help: "Leave blank to hide the TikTok icon entirely.",
        default: "https://www.tiktok.com/@skin.theory1?_r=1&_t=ZS-98bLhjPjyHn",
      },
      {
        key: "copyright", label: "Copyright tagline — shown after \"© {year} {store name} —\" at the very bottom",
        type: "text", max: 90, default: "Glow within, bloom daily. 🌸",
      },
    ],
  },
  {
    slot: "seo.defaults",
    label: "SEO Defaults",
    group: "Global",
    help: "Used on any page that doesn't set its own title or description.",
    fields: [
      { key: "title", label: "Default page title", type: "text", max: 60, default: "" },
      { key: "description", label: "Default description", type: "textarea", max: 160, default: "" },
      { key: "ogImage", label: "Social share image", type: "image", default: "" },
    ],
  },
];

export const SLOT_GROUPS = [...new Set(SLOTS.map((s) => s.group))];

export function schemaFor(slot) {
  return SLOTS.find((s) => s.slot === slot) ?? null;
}

/**
 * Build an empty payload from a schema, so a never-saved slot still opens
 * with every field present (an undefined field renders as an uncontrolled
 * input and React warns on the first keystroke).
 *
 * Lives here, in the dependency-free schema module, rather than next to the
 * admin's Supabase calls: the storefront reader (lib/api/content.js) needs it
 * for fallbacks on the eager homepage path, and importing it from a module
 * that touches @supabase/supabase-js would drag the SDK into the initial
 * bundle purely to compute some default strings.
 */
export function defaultsFor(schema) {
  if (!schema) return {};
  const out = {};
  for (const f of schema.fields) {
    out[f.key] = f.default ?? (f.multiple ? [] : f.type === "boolean" ? false : "");
  }
  return out;
}
