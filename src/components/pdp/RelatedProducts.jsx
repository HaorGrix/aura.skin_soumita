import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ProductCard from "../ui/ProductCard.jsx";

/** "Complete Your Ritual" — horizontal snap carousel of related products. */
export default function RelatedProducts({ products, onQuickView, title = "Complete your ritual" }) {
  const scroller = useRef(null);

  const scrollBy = (dir) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth * 0.8), behavior: "smooth" });
  };

  if (!products?.length) return null;

  return (
    <section className="mt-20">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-magenta">
            Pairs beautifully
          </p>
          <h2 className="mt-1 font-serif text-2xl text-ink dark:text-white sm:text-3xl">
            {title} 🌸
          </h2>
        </div>
        <div className="hidden gap-2 sm:flex">
          <button
            onClick={() => scrollBy(-1)}
            aria-label="Scroll left"
            className="grid h-10 w-10 place-items-center rounded-full ring-1 ring-line transition-colors hover:text-magenta dark:ring-white/15"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={1.8} />
          </button>
          <button
            onClick={() => scrollBy(1)}
            aria-label="Scroll right"
            className="grid h-10 w-10 place-items-center rounded-full ring-1 ring-line transition-colors hover:text-magenta dark:ring-white/15"
          >
            <ChevronRight className="h-5 w-5" strokeWidth={1.8} />
          </button>
        </div>
      </div>

      <div
        ref={scroller}
        className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {products.map((p) => (
          <div
            key={p.id}
            className="w-[60%] shrink-0 snap-start sm:w-[40%] md:w-[30%] lg:w-[23%]"
          >
            <ProductCard product={p} onQuickView={onQuickView} />
          </div>
        ))}
      </div>
    </section>
  );
}
