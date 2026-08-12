import Hero from "../components/Hero.jsx";
import CategoryTiles from "../components/home/CategoryTiles.jsx";
import Offers from "../components/home/Offers.jsx";
import FeaturedProducts from "../components/home/FeaturedProducts.jsx";
import ShopByConcern from "../components/home/ShopByConcern.jsx";
import Rituals from "../components/home/Rituals.jsx";
import Journal from "../components/home/Journal.jsx";
import WhyAura from "../components/home/WhyAura.jsx";
import Testimonials from "../components/home/Testimonials.jsx";
import Footer from "../components/Footer.jsx";

export default function Home() {
  return (
    <>
      {/* Full-page brand wash. Fixed so the tone stays consistent through
          scroll and fills the gaps between sections — no bands of plain
          white. Was a pinkish-cream ramp; now the aqua family, matching the
          #afdcec page background defined in index.css. Stops are drawn from
          tokens so re-theming stays a one-file change. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-20"
        style={{
          background:
            "linear-gradient(180deg, var(--color-aqua-soft) 0%, var(--color-aqua) 38%, var(--color-aqua) 70%, var(--color-aqua-deep) 100%)",
        }}
      />

      <Hero />
      <CategoryTiles />
      <Offers />
      <FeaturedProducts />
      <ShopByConcern />
      <Rituals />
      <Testimonials />
      <Journal />
      <WhyAura />
      <Footer />
    </>
  );
}
