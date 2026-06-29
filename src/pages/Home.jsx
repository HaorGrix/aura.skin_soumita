import Hero from "../components/Hero.jsx";
import Affirmations from "../components/home/Affirmations.jsx";
import FeaturedProducts from "../components/home/FeaturedProducts.jsx";
import ShopByConcern from "../components/home/ShopByConcern.jsx";
import Rituals from "../components/home/Rituals.jsx";
import Journal from "../components/home/Journal.jsx";
import WhyAura from "../components/home/WhyAura.jsx";
import Footer from "../components/Footer.jsx";

export default function Home() {
  return (
    <>
      {/* Full-page soft pinkish-cream wash (light mode only). Fixed so the tone
          stays consistent through scroll and fills the gaps between sections —
          no more bands of plain white. Dark mode keeps its own dark canvas. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-20 dark:hidden"
        style={{
          background:
            "linear-gradient(180deg, var(--color-petal) 0%, #fff5ef 38%, #ffe9f1 70%, #ffeef5 100%)",
        }}
      />

      <Hero />
      <Affirmations />
      <FeaturedProducts />
      <ShopByConcern />
      <Rituals />
      <Journal />
      <WhyAura />
      <Footer />
    </>
  );
}
