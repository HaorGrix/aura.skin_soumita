/* =================================================================== *
 * skin.theory — homepage testimonials wall
 * -------------------------------------------------------------------
 * Renders the FULL featured set (useFeaturedTestimonials(),
 * lib/api/testimonials.js) as a single-row horizontal slider — never a
 * wrapping grid, so any count from 2 up to MAX_VISIBLE_TESTIMONIALS stays
 * one row, scrolled/arrowed through instead of spilling onto a second row.
 * The rail itself is the same native scroll-snap strip used everywhere
 * else on this homepage (ShopByConcern's own pattern); the prev/next
 * arrows are new here, styled to match HeroCarousel's exact button
 * treatment so the interaction reads as the same carousel language site-
 * wide. 1 featured entry renders as a single centered card with no slider
 * chrome at all. Above MAX_VISIBLE_TESTIMONIALS the hook hands back a
 * rotating window, so this component never has to know or care how many
 * the admin actually featured — it always just lays out whatever array
 * it's given, in one row.
 *
 * Card proportions mirror Journal.jsx's article cards — same fixed width
 * and the same aspect-[16/10] image ratio — so this section reads as the
 * same size/weight as the card row right below it, not a visually
 * unrelated shape.
 *
 * Renders nothing at all when nothing is featured (never a blank/broken
 * section) — same contract as every other CMS-backed homepage slot.
 * =================================================================== */
import { useRef } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Flower2, Star } from "lucide-react";
import { useFeaturedTestimonials, testimonialImageUrl } from "../../lib/api/testimonials.js";

const EASE = [0.22, 1, 0.36, 1];
// Matches Journal's rendered card width at each breakpoint closely enough
// that the two rows share the same visual weight sitting one above the
// other — not pixel-locked to it (Journal's is 1/3 of a 3-col grid, which
// isn't a fixed value), just the same neighbourhood.
const CARD_WIDTH = "w-[19rem] sm:w-[21rem] lg:w-[22rem]";

function TestimonialCard({ testimonial: t, index, className = "", reveal = true }) {
  const date = t.created_at
    ? new Date(t.created_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })
    : null;

  // `reveal` is only used for the single-card case. Inside the slider it's
  // off on purpose: whileInView's intersection check is 2D, so a card
  // sitting off to the right of a horizontally-scrolled rail reads as "not
  // in view" until the rail is scrolled to it — same as ShopByConcern's own
  // rail cards, which skip this entrance animation for the same reason.
  const motionProps = reveal
    ? {
        initial: { opacity: 0, y: 24 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.3 },
        transition: { duration: 0.5, delay: (index % 6) * 0.06, ease: EASE },
      }
    : {};

  return (
    <motion.div {...motionProps} className={className}>
      {t.type === "image" ? (
        // aspect-[16/10] — same ratio as Journal's cover image, see file header.
        <div className="relative aspect-[16/10] overflow-hidden rounded-none shadow-soft ring-1 ring-line">
          <img
            src={testimonialImageUrl(t.image_url)}
            alt="Customer reviews"
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
      ) : (
        <div className="flex h-full flex-col rounded-none bg-white p-6 text-center shadow-soft ring-1 ring-line sm:p-7">
          <span className="mx-auto grid h-12 w-12 shrink-0 place-items-center rounded-full bg-petal text-magenta">
            <Flower2 className="h-5 w-5" strokeWidth={1.7} />
          </span>

          {t.rating != null && (
            <div className="mt-4 flex justify-center gap-0.5" aria-label={`${t.rating} out of 5 stars`}>
              {Array.from({ length: 5 }, (_, i) => (
                <Star
                  key={i}
                  className="h-3.5 w-3.5"
                  strokeWidth={0}
                  fill={i < Math.round(t.rating) ? "var(--color-gold)" : "var(--color-line)"}
                />
              ))}
            </div>
          )}

          <p className="mt-4 flex-1 text-pretty font-serif text-lg leading-snug text-ink">
            “{t.quote_text}”
          </p>

          <p className="mt-4 text-sm font-medium text-ink">
            {t.customer_name}
            {(t.duration_label || date) && (
              <span className="font-normal text-ink-soft"> · {t.duration_label || date}</span>
            )}
          </p>
        </div>
      )}
    </motion.div>
  );
}

export default function Testimonials() {
  const { testimonials } = useFeaturedTestimonials();
  const railRef = useRef(null);
  if (testimonials.length === 0) return null;

  const single = testimonials.length === 1;

  // One card width's worth of travel per click — matches how far a swipe
  // naturally lands, since each card also snap-stops there.
  const scrollByCard = (dir) => {
    const el = railRef.current;
    if (!el) return;
    const card = el.firstElementChild;
    const step = (card?.offsetWidth ?? el.clientWidth * 0.85) + 20; // + gap
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  return (
    <section className="py-10 sm:py-14">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mb-8 text-center sm:mb-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-magenta">
            Real reviews
          </p>
          <h2 className="mt-2 font-serif text-[clamp(1.9rem,4.5vw,3.25rem)] leading-tight text-ink">
            What our <span className="italic text-gradient-glow">customers</span> are saying
          </h2>
        </div>

        {single ? (
          <div className="mx-auto max-w-2xl">
            <TestimonialCard testimonial={testimonials[0]} index={0} />
          </div>
        ) : (
          <div className="relative">
            {/* Single-row rail at every breakpoint — a fixed card width plus
                overflow-x-auto means this can never wrap to a second row,
                unlike a CSS grid. Scroll-snap gives free touch/trackpad
                swiping on top of the arrow buttons below. */}
            <div
              ref={railRef}
              className="-mx-5 flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth px-5 pb-2 scrollbar-thin sm:mx-0 sm:px-0"
            >
              {testimonials.map((t, i) => (
                <TestimonialCard
                  key={t.id}
                  testimonial={t}
                  index={i}
                  reveal={false}
                  className={`${CARD_WIDTH} shrink-0 snap-start`}
                />
              ))}
            </div>

            {/* Arrows — same button treatment as HeroCarousel's prev/next,
                hidden below sm where the rail is swiped by touch instead. */}
            <button
              type="button"
              aria-label="Previous testimonial"
              onClick={() => scrollByCard(-1)}
              className="absolute left-0 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/90 p-3 text-ink shadow-lift backdrop-blur transition hover:bg-white active:scale-95 sm:block"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={2} />
            </button>
            <button
              type="button"
              aria-label="Next testimonial"
              onClick={() => scrollByCard(1)}
              className="absolute right-0 top-1/2 z-10 hidden -translate-y-1/2 translate-x-1/2 rounded-full bg-white/90 p-3 text-ink shadow-lift backdrop-blur transition hover:bg-white active:scale-95 sm:block"
            >
              <ChevronRight className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
