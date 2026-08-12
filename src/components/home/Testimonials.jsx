/* =================================================================== *
 * skin.theory — homepage testimonial (dual-mode)
 * -------------------------------------------------------------------
 * Renders whichever type this week's featured entry is:
 *   text  — the quote card: flower icon, quote, star rating
 *   image — the uploaded image at full card width/height, replacing the
 *           card's content entirely — no quote/star overlay on top
 *
 * Renders nothing at all if there's no featured testimonial yet (never a
 * blank/broken card) — same contract as every other CMS-backed section on
 * this homepage.
 * =================================================================== */
import { motion } from "framer-motion";
import { Flower2, Star } from "lucide-react";
import { useWeeklyTestimonial, testimonialImageUrl } from "../../lib/api/testimonials.js";

const EASE = [0.22, 1, 0.36, 1];

export default function Testimonials() {
  const { testimonial } = useWeeklyTestimonial();
  if (!testimonial) return null;

  return (
    <section className="py-10 sm:py-14">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <div className="mb-8 text-center sm:mb-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-magenta">
            Real reviews
          </p>
          <h2 className="mt-2 font-serif text-[clamp(1.9rem,4.5vw,3.25rem)] leading-tight text-ink">
            What our <span className="italic text-gradient-glow">customers</span> are saying
          </h2>
        </div>

        <motion.div
          key={testimonial.id}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          {testimonial.type === "image" ? (
            <div
              className="overflow-hidden rounded-[1.75rem] shadow-soft ring-1 ring-line"
              style={{ aspectRatio: "1300/500" }}
            >
              <img
                src={testimonialImageUrl(testimonial.image_url)}
                alt="Customer reviews"
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="rounded-[1.75rem] bg-white p-8 text-center shadow-soft ring-1 ring-line sm:p-12">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-petal text-magenta">
                <Flower2 className="h-6 w-6" strokeWidth={1.7} />
              </span>

              {testimonial.rating != null && (
                <div className="mt-5 flex justify-center gap-0.5" aria-label={`${testimonial.rating} out of 5 stars`}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      className="h-4 w-4"
                      strokeWidth={0}
                      fill={i < Math.round(testimonial.rating) ? "var(--color-gold)" : "var(--color-line)"}
                    />
                  ))}
                </div>
              )}

              <p className="mt-5 text-pretty font-serif text-xl leading-snug text-ink sm:text-2xl">
                “{testimonial.quote_text}”
              </p>

              <p className="mt-5 text-sm font-medium text-ink">
                {testimonial.customer_name}
                {testimonial.duration_label && (
                  <span className="font-normal text-ink-soft"> · {testimonial.duration_label}</span>
                )}
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
