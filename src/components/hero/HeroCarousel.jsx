/* =================================================================== *
 * skin.script — Hero Carousel (full-bleed, infinite, multi-peek)
 * -------------------------------------------------------------------
 * The promotional banner strip directly below the header. Layout follows
 * the high-end retail pattern: the focal slide sits dead-centre while its
 * neighbours peek in from both viewport edges, so the rail reads as an
 * immersive multi-card preview rather than a boxed-in single banner.
 *
 * Engine: Swiper (loop + centeredSlides). Chosen over the previous CSS
 * scroll-snap build for one reason — true infinite looping. Scroll-snap
 * gives free momentum but cannot wrap without a visible jump at the
 * boundary, which is exactly what a production hero must not do.
 *
 * ── Two non-obvious things worth knowing before editing ──
 *
 * 1. SLIDE DUPLICATION. Swiper's loop needs materially more slides than
 *    are on screen at once (~slidesPerView × 2); below that it pads the
 *    rail with BLANK slides and the loop visibly gaps. With three CMS
 *    banners and ~2 per view that threshold isn't met, so `railSlides`
 *    repeats the source list up to MIN_LOOP_SLIDES. Pagination therefore
 *    keys off `realIndex % slides.length`, not the raw rail index — the
 *    dots must count the REAL banners, not the padded ones.
 *
 * 2. NO CLS. Every tile is a fixed aspect-ratio box, and the caption block
 *    is reserved on all slides whenever ANY slide carries copy. Height is
 *    therefore known before media decodes, so nothing reflows on load.
 *
 * Editable at /admin/content → Homepage Hero Carousel. An empty CMS list
 * falls back to the bundled starter banners — the same "storefront never
 * breaks" contract every other CMS slot in this project honours.
 * =================================================================== */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { A11y, Autoplay, Keyboard } from "swiper/modules";
import { useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useContent, contentMedia, isVideoPath } from "../../lib/api/content.js";
import "swiper/css";

/* NO bundled banner assets by design.
 *
 * Every hero banner — including the starter set — lives in the `site-media`
 * Storage bucket and is referenced by the CMS row (slot: home.heroCarousel).
 * That's what makes the carousel fully admin-owned: uploading, reordering and
 * deleting all happen in /admin/content with no code change and no redeploy,
 * and the repo never accumulates banner files.
 *
 * Consequence to keep in mind: with no banners configured there is nothing to
 * show, so this component renders null rather than an empty rail. <Hero>'s
 * section padding is intentionally left in place around it — on the homepage
 * that padding IS the fixed-header clearance, so collapsing it would slide the
 * next section up under the navbar. */

const MIN_LOOP_SLIDES = 8; // see note 1 in the header comment
const AUTOPLAY_MS = 5500;

/* Centre-dominant peek. slidesPerView is intentionally fractional: the
 * remainder is what becomes the left/right peek, and `centeredSlides` splits
 * it evenly across both edges. ~1.8 puts the focal slide at ~56% of the
 * viewport with a real, deliberate sliver of its neighbours on each side. */
const BREAKPOINTS = {
  0:    { slidesPerView: 1.14, spaceBetween: 12 },
  640:  { slidesPerView: 1.40, spaceBetween: 16 },
  1024: { slidesPerView: 1.80, spaceBetween: 20 },
  1536: { slidesPerView: 2.10, spaceBetween: 24 },
};

/** External links leave the SPA; internal paths are promoted to client-side
 *  navigation by the delegated interceptor in lib/navigate.js, so a plain
 *  <a> is correct for both — no router coupling needed here. */
function isExternal(href) {
  return /^https?:\/\//i.test(href ?? "");
}


/**
 * Cursor-tracked tilt for the focal slide.
 *
 * Applied to an INNER element, never the slide itself: Swiper owns the slide
 * transform for positioning, so writing there would fight the carousel and
 * jitter every frame. Writes are rAF-batched and touch only `transform` plus
 * two custom properties, so each move stays on the compositor.
 */
const MAX_SHIFT = 10; // px of translation at the far edge
const MAX_TILT = 4;   // degrees of rotation at the far edge

function useTilt(enabled) {
  const ref = useRef(null);
  const frame = useRef(0);

  /* Pointer-capability gate. A touch screen fires a single synthetic
   * mousemove on tap, which would leave the banner stuck mid-tilt with no
   * pointer-leave to reset it — so the effect is restricted to devices that
   * genuinely hover. Matched via media query rather than a UA sniff, and
   * re-evaluated on change so a 2-in-1 switching modes is handled. */
  const [canHover, setCanHover] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => setCanHover(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const on = enabled && canHover;

  const onMove = useCallback((e) => {
    if (!on) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // −0.5 … +0.5 relative to the banner's centre
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      el.style.transform =
        `perspective(1400px) translate3d(${(px * MAX_SHIFT * 2).toFixed(1)}px, ${(py * MAX_SHIFT * 2).toFixed(1)}px, 0)` +
        ` rotateX(${(-py * MAX_TILT * 2).toFixed(2)}deg) rotateY(${(px * MAX_TILT * 2).toFixed(2)}deg)`;
      el.style.setProperty("--gx", `${((px + 0.5) * 100).toFixed(1)}%`);
      el.style.setProperty("--gy", `${((py + 0.5) * 100).toFixed(1)}%`);
    });
  }, [on]);

  const onLeave = useCallback(() => {
    cancelAnimationFrame(frame.current);
    // Clearing the inline transform lets the CSS transition ease it home.
    if (ref.current) ref.current.style.transform = "";
  }, []);

  return { ref, onMove, onLeave, on };
}

function SlideMedia({ slide, active }) {
  const videoRef = useRef(null);
  const src = contentMedia(slide.media, slide.fallback);
  // Test the RESOLVED url, not just the CMS field: that way a bundled
  // fallback (…/hero-banner-video-a1b2c3.mp4) is recognised as video too,
  // not only an admin-uploaded Storage path.
  const video = isVideoPath(slide.media) || isVideoPath(src);

  /* Only the focal slide's video plays. Off-centre videos stay paused so a
   * rail of four autoplaying files doesn't compete for decode bandwidth on
   * the most performance-sensitive screen on the site. */
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (active) {
      const p = el.play();
      if (p?.catch) p.catch(() => {}); // pre-gesture autoplay rejection is expected
    } else {
      el.pause();
    }
  }, [active]);

  // Square corners by design — the banners read as full-bleed editorial
  // panels, not as cards floating on a surface.
  return (
    <div className="relative aspect-[16/9] w-full overflow-hidden bg-snow sm:aspect-[2/1]">
      {/* Blurred backdrop. Source banners (and anything an admin uploads)
          don't share one aspect ratio and carry baked-in marketing text, so
          object-cover would crop that copy at unpredictable ratios. contain
          + this fill keeps every banner whole AND the tile full-bleed. */}
      {!video && (
        <img
          src={src}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl"
        />
      )}

      {video ? (
        <video
          ref={videoRef}
          src={src}
          muted
          loop
          playsInline
          preload="metadata"
          // translateZ(0) promotes the video to its own compositor layer, so
          // the rail's transform animation never re-rasterises video frames.
          style={{ transform: "translateZ(0)" }}
          className="relative h-full w-full object-cover"
        />
      ) : (
        <img
          src={src}
          alt={slide.title || "skin.script promotion"}
          loading="eager"
          decoding="async"
          className="relative h-full w-full object-contain"
        />
      )}
    </div>
  );
}

function Slide({ slide, active, reserveCaption, tilt }) {
  const href = slide.ctaHref?.trim();
  const external = isExternal(href);
  const { ref, onMove, onLeave } = useTilt(tilt && active);


  const body = (
    <>
      {/* Two nested transform layers, deliberately kept separate:
       *
       *   outer — hover "pop", pure CSS (group-hover:scale)
       *   inner — magnetic tilt, written as an INLINE style by useTilt
       *
       * They cannot share an element. An inline `transform` beats any
       * stylesheet rule, so a CSS hover-scale on the tilt node would simply
       * never apply while the pointer is over it. Nested, the two transforms
       * compose and each keeps its own transition.
       *
       * The pop is limited to the focal slide — the neighbours are peek
       * slivers, and scaling those on hover reads as a glitch, not a flourish. */}
      <div
        className={`will-change-transform transition-transform duration-300 ease-out ${
          active ? "group-hover:scale-[1.04]" : ""
        }`}
      >
        <div
          ref={ref}
          onMouseMove={onMove}
          onMouseLeave={onLeave}
          className="relative will-change-transform transition-transform duration-300 ease-out"
        >
          <SlideMedia slide={slide} active={active} />
        </div>
      </div>

      {reserveCaption && (
        /* Fixed min-height on every slide — including ones with no copy — so
           the tiles stay bottom-aligned and the rail height never depends on
           which banner happens to be centred. */
        <div className="min-h-[6.5rem] px-1 pt-4 sm:min-h-[7rem]">
          {slide.eyebrow && (
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-magenta sm:text-[11px]">
              {slide.eyebrow}
            </p>
          )}
          {slide.title && (
            <h2 className="mt-1 font-serif text-lg leading-snug text-ink sm:text-xl lg:text-2xl">
              {slide.title}
            </h2>
          )}
          {slide.subtitle && (
            <p className="mt-1 line-clamp-2 text-xs text-ink-soft sm:text-sm">{slide.subtitle}</p>
          )}
          {slide.ctaLabel && (
            <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink transition-all group-hover:gap-2 sm:text-xs">
              {slide.ctaLabel}
              <ChevronRight className="h-3.5 w-3.5 text-magenta" strokeWidth={2.4} />
            </span>
          )}
        </div>
      )}
    </>
  );

  // `group` is what the hover-pop hangs off, so a banner with no link still
  // gets the effect — without it, only linked slides would react.
  if (!href) return <div className="group block">{body}</div>;

  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      aria-label={slide.title || slide.ctaLabel || "View promotion"}
      className="group block outline-none ring-magenta/60 focus-visible:ring-2"
    >
      {body}
    </a>
  );
}

export default function HeroCarousel() {
  const reduce = useReducedMotion();
  const { content } = useContent("home.heroCarousel");

  // Only banners with something to show — an admin who adds a row but never
  // uploads to it shouldn't punch an empty tile into the rail.
  const slides = useMemo(
    () => (content.items ?? []).filter((s) => s?.media),
    [content.items]
  );

  // A single banner has nothing to loop between, so it must NOT be padded —
  // otherwise the rail would hold N identical copies the user can swipe
  // through while the pagination (correctly) shows one dot.
  const loop = slides.length > 1;

  /* Pad the rail up to MIN_LOOP_SLIDES by repeating the source list WHOLE.
   * Repeating whole is the load-bearing detail: it guarantees
   * `railSlides.length % slides.length === 0`, which is what makes
   * `realIndex % slides.length` an exact map back to the real banner —
   * for any banner count. 3→9, 4→8, 5→10, 6→12, 7→14, 8+→unpadded. */
  const railSlides = useMemo(() => {
    if (!loop || slides.length >= MIN_LOOP_SLIDES) return slides;
    const out = [];
    while (out.length < MIN_LOOP_SLIDES) out.push(...slides);
    return out;
  }, [slides, loop]);

  const reserveCaption = useMemo(
    () => slides.some((s) => s.eyebrow || s.title || s.subtitle || s.ctaLabel),
    [slides]
  );

  const swiperRef = useRef(null);
  const [active, setActive] = useState(0);

  const goTo = useCallback((i) => swiperRef.current?.slideToLoop(i), []);
  const prev = useCallback(() => swiperRef.current?.slidePrev(), []);
  const next = useCallback(() => swiperRef.current?.slideNext(), []);

  /* Nothing configured (or every banner deleted) → render nothing.
   * This sits AFTER every hook on purpose: an early return placed above them
   * would run fewer hooks on the empty render than on the populated one, and
   * React throws "rendered fewer hooks than expected" the moment an admin
   * deletes the last banner. <Hero>'s padding stays regardless — on the
   * homepage that padding is the fixed-header clearance. */
  if (!slides.length) return null;

  return (
    <div className="relative w-full">
      <Swiper
        modules={[Autoplay, A11y, Keyboard]}
        onSwiper={(s) => { swiperRef.current = s; }}
        onSlideChange={(s) => setActive(s.realIndex % slides.length)}
        loop={loop}
        centeredSlides
        breakpoints={BREAKPOINTS}
        speed={650}
        grabCursor
        watchSlidesProgress
        keyboard={{ enabled: true }}
        a11y={{ enabled: true, prevSlideMessage: "Previous banner", nextSlideMessage: "Next banner" }}
        // Honour reduced-motion: no self-advancing movement for users who
        // asked the OS for less of it.
        autoplay={
          reduce || !loop
            ? false
            : { delay: AUTOPLAY_MS, disableOnInteraction: false, pauseOnMouseEnter: true }
        }
        className="!px-0"
      >
        {railSlides.map((slide, i) => (
          <SwiperSlide key={i} className="h-auto">
            <Slide
              tilt={!reduce}
              slide={slide}
              active={i % slides.length === active}
              reserveCaption={reserveCaption}
            />
          </SwiperSlide>
        ))}
      </Swiper>

      {loop && (
        <>
          {/* Arrows sit inside the peek gutters, vertically centred on the
              MEDIA box rather than the whole tile — with a caption reserved
              the tile's midpoint drifts below the image. */}
          <button
            type="button"
            aria-label="Previous banner"
            onClick={prev}
            className={`absolute left-3 z-10 hidden -translate-y-1/2 rounded-full bg-white/90 p-3 text-ink shadow-lift backdrop-blur transition hover:bg-white active:scale-95 sm:block lg:left-6 ${
              reserveCaption ? "top-[38%]" : "top-1/2"
            }`}
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2} />
          </button>
          <button
            type="button"
            aria-label="Next banner"
            onClick={next}
            className={`absolute right-3 z-10 hidden -translate-y-1/2 rounded-full bg-white/90 p-3 text-ink shadow-lift backdrop-blur transition hover:bg-white active:scale-95 sm:block lg:right-6 ${
              reserveCaption ? "top-[38%]" : "top-1/2"
            }`}
          >
            <ChevronRight className="h-5 w-5" strokeWidth={2} />
          </button>

          {/* Dots count REAL banners, not the padded rail (header note 1). */}
          <div className="mt-6 flex items-center justify-center gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to banner ${i + 1}`}
                aria-current={i === active}
                onClick={() => goTo(i)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === active ? "w-7 bg-magenta" : "w-2 bg-ink/20 hover:bg-ink/40"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
