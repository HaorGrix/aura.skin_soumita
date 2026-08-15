import HeroCarousel from "./hero/HeroCarousel.jsx";

/* Hero = the full-bleed banner carousel, nothing else.
 *
 * Two things this section deliberately does NOT render, both removed for
 * reasons worth keeping written down:
 *
 * 1. No sparkle/particle field. It was positioned by percentage across the
 *    section's full height, and because the hero starts at the very top of the
 *    page (the fixed header overlays it), the particles landing in the pt-40
 *    band showed THROUGH the translucent navbar as stray dots between the logo
 *    and the nav links.
 *
 * 2. No background of its own. It used to paint a radial wash whose final stop
 *    was DARKER than the page gradient sitting behind it, so the hero read as a
 *    boxed-in container with a visible seam along its bottom edge. Letting
 *    Home's full-page wash show straight through is what makes the banners sit
 *    ON the page instead of inside a card.
 *
 * The padding stays: pt-40/lg:pt-44 is the fixed-header clearance.
 *
 * Mobile-only tightening: pt-36/pb-6 apply below the sm breakpoint only —
 * sm:/md:/lg: explicitly restore the original pt-40/pb-14/pb-16 values, so
 * tablet and desktop spacing is untouched. The unscrolled header is ~123px
 * tall at 390px wide, so pt-36 (144px) still clears it with ~21px to
 * spare; it just isn't overshooting by another 16px on top of that like
 * pt-40 (160px) did. */

export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pb-6 pt-36 sm:pb-14 sm:pt-40 md:pt-40 lg:pb-16 lg:pt-44">
      <HeroCarousel />
    </section>
  );
}
