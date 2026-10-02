import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ProductCard from "../ui/ProductCard.jsx";
import { inStockFirst } from "../../data/products.js";

/** "Complete Your Ritual" — horizontal snap carousel of related products. */
// The rail runs edge to edge: it cancels the page's side padding, so
// `bleed` must match the padding of the page it sits in.
const PDP_BLEED = "-mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10";

export default function RelatedProducts({ products, onQuickView, title = "Complete your ritual", bleed = PDP_BLEED }) {
  const scroller = useRef(null);

  const scrollBy = (dir) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth * 0.8), behavior: "smooth" });
  };

  if (!products?.length) return null;
  const ordered = [...products].sort(inStockFirst);

  return (
    <section className="mt-20">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-magenta">
            Pairs beautifully
          </p>
          <h2 className="mt-1 font-serif text-2xl text-ink sm:text-3xl">
            {title} 🌸
          </h2>
        </div>
        <div className="hidden gap-2 sm:flex">
          <button
            onClick={() => scrollBy(-1)}
            aria-label="Scroll left"
            className="grid h-10 w-10 place-items-center rounded-full ring-1 ring-line transition-colors hover:text-magenta"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={1.8} />
          </button>
          <button
            onClick={() => scrollBy(1)}
            aria-label="Scroll right"
            className="grid h-10 w-10 place-items-center rounded-full ring-1 ring-line transition-colors hover:text-magenta"
          >
            <ChevronRight className="h-5 w-5" strokeWidth={1.8} />
          </button>
        </div>
      </div>

      <div
        ref={scroller}
        className={`${bleed} flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
      >
        {ordered.map((p) => (
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
