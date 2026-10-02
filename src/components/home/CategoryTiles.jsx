/* =================================================================== *
 * skin.theory — category tiles
 * -------------------------------------------------------------------
 * The shop-by-category row directly beneath the hero carousel, one artwork
 * card per destination. Edited in the admin (Content → Category Tiles,
 * slot `home.categoryTiles`): tiles can be added, removed, reordered, and
 * each one's picture and link changed. Until a picture is uploaded, a tile
 * named like one of the original six keeps its bundled artwork.
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
import { contentImage, useContent } from "../../lib/api/content.js";
import TileFrame from "./TileFrame.jsx";

import SKIN_CARE from "../../../assests/cate/skin-care.png";
import HAIR_CARE from "../../../assests/cate/hair-care.png";
import BODY_CARE from "../../../assests/cate/body-care.png";
import EYE_EAR from "../../../assests/cate/eye-ear.png";
import OFFER from "../../../assests/cate/offer.png";
import COMBO from "../../../assests/cate/combo.png";

// Bundled artwork for the original six tiles, by (case-insensitive) name.
const BUNDLED = {
  "skin care": SKIN_CARE,
  "hair care": HAIR_CARE,
  "body care": BODY_CARE,
  "eye & ear": EYE_EAR,
  offer: OFFER,
  combo: COMBO,
};

const bundledFor = (label) => BUNDLED[String(label ?? "").trim().toLowerCase()] ?? null;

export default function CategoryTiles() {
  const reduce = useReducedMotion();
  const { content, ready } = useContent("home.categoryTiles");
  const tiles = (content.items ?? [])
    .map((t) => ({
      ...t,
      sticker: t.sticker ? contentImage(t.sticker) : null,
      img: contentImage(t.image, bundledFor(t.label)),
    }))
    .filter((t) => (t.sticker || t.img) && t.href);

  if (ready && tiles.length === 0) return null;

  return (
    /* mt-* is the gap between the hero slider and this row — halved from the
       previous 40/56px to pull the tiles up closer to the banner. It replaces
       the section's old top padding rather than stacking on top of it, so the
       spacing stays predictable instead of compounding. */
    <section aria-label="Shop by category" className="relative mt-5 pb-12 sm:mt-7 sm:pb-16">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        {/* Wrapping flex, not a grid, so a short last row is centred instead
            of hanging off to the left (8 tiles = 6 + 2 on desktop). */}
        <ul className="flex flex-wrap justify-center gap-x-4 gap-y-8 sm:gap-x-6">
          {tiles.map((tile, i) => (
            <motion.li
              key={`${tile.label}-${i}`}
              initial={reduce ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.5, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
              className="w-[calc(50%-0.5rem)] sm:w-[calc((100%-3rem)/3)] lg:w-[calc((100%-7.5rem)/6)]"
            >
              <a
                href={tile.href}
                aria-label={tile.label}
                className="group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-magenta/60"
              >
                {/* Fixed aspect box matching the artwork's own 750×885 ratio —
                    the row's height is therefore known before the PNGs decode,
                    so nothing reflows on load. */}
                <span className="block aspect-[750/885] w-full">
                  {/* Until the saved tiles arrive the box stays empty (same
                      size, so nothing shifts): showing the bundled art first
                      made phones download both sets of pictures. */}
                  {ready && tile.sticker && <TileFrame label={tile.label} sticker={tile.sticker} />}
                  {ready && !tile.sticker && (
                    <img
                      src={tile.img}
                      alt={tile.label}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-contain transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform group-hover:-translate-y-1.5 group-hover:scale-[1.04]"
                    />
                  )}
                </span>
              </a>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}
