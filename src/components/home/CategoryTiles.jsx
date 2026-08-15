/* =================================================================== *
 * skin.theory — category tiles
 * -------------------------------------------------------------------
 * The shop-by-category row directly beneath the hero carousel. Five
 * destinations, each a single artwork card.
 *
 * The card art carries its own category name, so this component renders NO
 * separate label and no section heading. Two consequences worth keeping in
 * mind when editing:
 *
 *   • The name is pixels, not text — so `alt` is the only thing carrying it
 *     to screen readers and to search engines. It must stay meaningful; an
 *     empty alt here would leave each tile announced as just "link".
 *   • Renaming a category now means re-exporting the artwork, not editing a
 *     string. That's the trade for having the label baked into the design.
 * =================================================================== */
import { motion, useReducedMotion } from "framer-motion";

import SKIN_CARE from "../../../assests/cate/skin-care.png";
import HAIR_CARE from "../../../assests/cate/hair-care.png";
import BODY_CARE from "../../../assests/cate/body-care.png";
import OFFER from "../../../assests/cate/offer.png";
import COMBO from "../../../assests/cate/combo.png";

/* hrefs follow the same `/shop?category=<slug>` convention the mega menu
 * uses, so both entry points filter identically. Unchanged from the previous
 * icon set — only the visuals were swapped.
 *
 * NOTE: `hair-care` and `body-care` are real rows in the categories table,
 * but the catalog has zero products assigned to either yet — both tiles
 * correctly land on an empty (not unfiltered) Shop result until the client
 * adds real inventory in those categories via /admin/products. */
const TILES = [
  { label: "Skin Care", href: "/shop?category=skin-care",       img: SKIN_CARE },
  { label: "Hair Care", href: "/shop?category=hair-care",       img: HAIR_CARE },
  { label: "Body Care", href: "/shop?category=body-care",       img: BODY_CARE },
  { label: "Offer",     href: "/offers",                        img: OFFER },
  { label: "Combo",     href: "/shop?category=skin-care-combo", img: COMBO },
];

export default function CategoryTiles() {
  const reduce = useReducedMotion();

  return (
    /* mt-* is the gap between the hero slider and this row — halved from the
       previous 40/56px to pull the tiles up closer to the banner. It replaces
       the section's old top padding rather than stacking on top of it, so the
       spacing stays predictable instead of compounding. */
    <section aria-label="Shop by category" className="relative mt-5 pb-12 sm:mt-7 sm:pb-16">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-5">
          {TILES.map((tile, i) => (
            <motion.li
              key={tile.label}
              initial={reduce ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.5, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
            >
              <a
                href={tile.href}
                className="group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-magenta/60"
              >
                {/* Fixed aspect box matching the artwork's own 750×885 ratio —
                    the row's height is therefore known before the PNGs decode,
                    so nothing reflows on load. */}
                <span className="block aspect-[750/885] w-full">
                  <img
                    src={tile.img}
                    alt={tile.label}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-contain transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform group-hover:-translate-y-1.5 group-hover:scale-[1.04]"
                  />
                </span>
              </a>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}
