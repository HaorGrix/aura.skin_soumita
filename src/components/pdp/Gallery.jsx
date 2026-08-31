import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ZoomIn, X, ChevronLeft, ChevronRight, Play, Images } from "lucide-react";
import Badge from "../ui/Badge.jsx";

/* Gradient artwork for each gallery "angle" (swap in real images via item.image) */
function tile(item) {
  const overlays = [
    "radial-gradient(120% 100% at 50% 0%, #ffffff 0%, TONE 70%, #ffe1ec 100%)",
    "linear-gradient(135deg, #ffffff 0%, TONE 60%, #ffd9e4 100%)",
    "radial-gradient(90% 90% at 30% 30%, TONE 0%, #ffffff 60%, #e9defb 100%)",
    "linear-gradient(200deg, TONE 0%, #ffffff 55%, #d6f5ec 100%)",
  ];
  return overlays[item.hue % overlays.length].replaceAll("TONE", item.tone);
}

export default function Gallery({ product }) {
  const reduce = useReducedMotion();
  const { gallery, hasVideo, badge, brand, name } = product;

  const [tab, setTab] = useState("photos"); // photos | video
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState({ on: false, x: 50, y: 50 });
  const [lightbox, setLightbox] = useState(false);

  const onMove = (e) => {
    if (reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    setZoom({
      on: true,
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
    });
  };

  const go = (dir) =>
    setActive((i) => (i + dir + gallery.length) % gallery.length);

  const current = gallery[active];

  return (
    // min-w-0: CSS Grid items default to min-width:auto, which refuses to
    // shrink below their content's intrinsic width — the stage below has a
    // max-w-[28rem] (448px) sizing hint that Grid treated as a hard floor,
    // so on any viewport narrower than that this whole column rendered at
    // ~448px regardless of the actual column width and got silently
    // clipped by the page's overflow-x:hidden (no scrollbar, so it read as
    // "the image is cut off" rather than an obviously-scrollable overflow).
    // flex (not lg:flex) so the order-1/order-2 classes below actually apply
    // on mobile too — they previously only worked from `lg` up, so below that
    // breakpoint the browser fell back to plain DOM order (thumbnails first,
    // stage after) with none of the intended gap between them: the thumbnail
    // row sat flush against the top edge of the full-width hero image below
    // it, reading as one clashing block instead of two distinct sections.
    <div className="flex min-w-0 flex-col gap-3 lg:gap-4">
      {/* Thumbnails (left on desktop, below on mobile) — spacing now comes
          from the parent flex's `gap`, not a one-sided margin, so it's
          correct regardless of which order these actually render in. */}
      {/* Every photo (up to 12, ImageManager.jsx's MAX_IMAGES) gets a real
          thumbnail here now — no cap, no "+N more" tile collapsing the
          tail into the lightbox. On mobile this scrolls horizontally
          (overflow-x-auto + snap) so the 12th photo is one swipe away,
          same as any native mobile gallery strip; on desktop it's a
          vertical rail that scrolls instead of running off the page.
          Scrollbar hidden for a cleaner look — same pattern ProductTabs.jsx
          uses for its own horizontally-scrolling tab bar. */}
      <div className="order-2 flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {gallery.map((g, i) => (
          <button
            key={g.id}
            onClick={() => {
              setTab("photos");
              setActive(i);
            }}
            aria-label={g.label || `Photo ${i + 1}`}
            className={`relative aspect-square w-[22%] min-w-[4.5rem] max-w-[6rem] shrink-0 overflow-hidden rounded-2xl ring-2 transition-all lg:rounded-xl ${
              tab === "photos" && active === i
                ? "ring-[3px] ring-magenta lg:ring-2"
                : "ring-transparent hover:ring-rose/50"
            }`}
          >
            <span className="absolute inset-0" style={{ background: tile(g) }} />
            {g.image && (
              <img
                src={g.image}
                alt={g.label || `${brand} ${name} — photo ${i + 1}`}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
            {g.label && (
              <span className="absolute inset-x-0 bottom-0 bg-black/30 py-0.5 text-[8px] font-medium text-white">
                {g.label}
              </span>
            )}
          </button>
        ))}
        {hasVideo && (
          <button
            onClick={() => setTab("video")}
            aria-label="Watch video"
            className={`relative grid aspect-square w-[22%] min-w-[4.5rem] max-w-[6rem] shrink-0 place-items-center overflow-hidden rounded-2xl bg-ink text-white ring-2 transition-all lg:rounded-xl ${
              tab === "video" ? "ring-[3px] ring-magenta lg:ring-2" : "ring-transparent hover:ring-rose/50"
            }`}
          >
            <Play className="h-5 w-5" fill="currentColor" strokeWidth={0} />
          </button>
        )}
      </div>

      {/* Stage — aspect-[4/5] at every width, matching the same crop
          ProductCard's shop-grid tile and ImageManager's admin preview
          use (see ImageManager.jsx's own comment on this). This used to
          switch to aspect-square from `sm` up, a leftover from before
          4:5 was established as the site-wide standard — an admin
          framing a photo for this ratio was getting a different crop
          here than everywhere else it's shown. */}
      <div className="order-1 w-full">
        {/* Full-bleed within the page's own gutters on mobile (no width cap) —
            a deliberate change from the earlier max-w-xs treatment: that kept
            the stage a fixed 320px regardless of the actual viewport, reading
            as noticeably smaller/more boxed-in than a typical mobile PDP
            hero. Still the SAME 4:5 crop everywhere (unchanged) — only the
            box it's displayed in now fills the available width. */}
        <div className="relative mx-auto aspect-square w-full overflow-hidden rounded-[1.75rem] ring-1 ring-line lg:rounded-[1.5rem]">
          {/* Tab pills — only meaningful as a Photos/Video TOGGLE, so they
              only render when there's actually a video to switch to. Most
              products have no video, where "Photos" was just a permanent,
              purposeless label sitting on top of the hero image with
              nothing to toggle. */}
          {hasVideo && (
            <div className="absolute left-3 top-3 z-20 flex gap-1.5">
              <button
                onClick={() => setTab("photos")}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold backdrop-blur transition-colors ${
                  tab === "photos" ? "bg-ink text-white" : "bg-white/80 text-ink"
                }`}
              >
                <Images className="h-3.5 w-3.5" strokeWidth={1.8} /> Photos
              </button>
              <button
                onClick={() => setTab("video")}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold backdrop-blur transition-colors ${
                  tab === "video" ? "bg-ink text-white" : "bg-white/80 text-ink"
                }`}
              >
                <Play className="h-3 w-3" fill="currentColor" strokeWidth={0} /> Video
              </button>
            </div>
          )}

          {badge && (
            <div className="absolute right-3 top-3 z-20">
              <Badge variant={badge.variant}>{badge.label}</Badge>
            </div>
          )}

          <AnimatePresence mode="wait">
            {tab === "photos" ? (
              <motion.div
                key={current.id}
                initial={{ opacity: 0, scale: 1.02 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="group absolute inset-0 cursor-zoom-in touch-pan-y"
                onMouseMove={onMove}
                onMouseLeave={() => setZoom((z) => ({ ...z, on: false }))}
                onClick={() => setLightbox(true)}
                // Native swipe-to-change, standard mobile gallery UX. Locked to the
                // x axis with zero drag distance (it snaps straight back) — this is
                // a gesture trigger, not a finger-following drag, so it can't fight
                // the AnimatePresence slide/fade between images. `touch-pan-y` above
                // keeps vertical page scroll working while a horizontal swipe is
                // captured, and dragThreshold on go() calls means it never fires
                // this to fire on the same tap as the zoom-lightbox onClick.
                drag={gallery.length > 1 ? "x" : false}
                dragDirectionLock={true}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.7}
                onDragEnd={(_, info) => {
                  const SWIPE_DISTANCE = 40;
                  const SWIPE_VELOCITY = 350;
                  if (info.offset.x <= -SWIPE_DISTANCE || info.velocity.x <= -SWIPE_VELOCITY) go(1);
                  else if (info.offset.x >= SWIPE_DISTANCE || info.velocity.x >= SWIPE_VELOCITY) go(-1);
                }}
              >
                <div
                  className="absolute inset-0 transition-transform duration-200"
                  style={{
                    background: tile(current),
                    transform: zoom.on ? "scale(1.8)" : "scale(1)",
                    transformOrigin: `${zoom.x}% ${zoom.y}%`,
                  }}
                />
                {current.image && (
                  <img
                    src={current.image}
                    alt={`${brand} ${name}`}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-200"
                    style={{
                      transform: zoom.on ? "scale(1.8)" : "scale(1)",
                      transformOrigin: `${zoom.x}% ${zoom.y}%`,
                    }}
                  />
                )}
                {/* Floating label + zoom hint */}
                {current.label && (
                  <span className="absolute bottom-3 left-3 rounded-full bg-white/85 px-3 py-1 text-xs font-medium text-ink backdrop-blur">
                    {current.label}
                  </span>
                )}
                <span className="absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-white/85 text-ink backdrop-blur opacity-0 transition-opacity group-hover:opacity-100">
                  <ZoomIn className="h-4 w-4" strokeWidth={1.8} />
                </span>
              </motion.div>
            ) : (
              <motion.div
                key="video"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-ink"
              >
                {/* Real uploaded video (0023_product_video.sql) — native
                    controls rather than a custom play button: it's the most
                    reliable "click to play, inline" experience across
                    browsers/devices without hand-rolling play/pause/seek
                    state. `poster` avoids a blank black frame before the
                    shopper presses play. */}
                <video
                  key={product.videoUrl}
                  src={product.videoUrl}
                  poster={current.image}
                  controls
                  playsInline
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Prev / next (photos) */}
          {tab === "photos" && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  go(-1);
                }}
                aria-label="Previous image"
                className="absolute left-3 top-1/2 z-20 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-ink backdrop-blur transition-colors hover:text-magenta"
              >
                <ChevronLeft className="h-5 w-5" strokeWidth={1.8} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  go(1);
                }}
                aria-label="Next image"
                className="absolute right-3 top-1/2 z-20 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-ink backdrop-blur transition-colors hover:text-magenta"
              >
                <ChevronRight className="h-5 w-5" strokeWidth={1.8} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            className="fixed inset-0 z-[160] flex items-center justify-center bg-ink/85 p-4 backdrop-blur"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightbox(false)}
          >
            <button
              onClick={() => setLightbox(false)}
              aria-label="Close"
              className="absolute right-5 top-5 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </button>
            <motion.div
              key={current.id}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 28 }}
              className="relative aspect-square w-full max-w-lg overflow-hidden rounded-[1.5rem]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute inset-0" style={{ background: tile(current) }} />
              {current.image && (
                <img src={current.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
              )}
            </motion.div>

            {/* Lightbox thumbnails */}
            <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2" onClick={(e) => e.stopPropagation()}>
              {gallery.map((g, i) => (
                <button
                  key={g.id}
                  onClick={() => setActive(i)}
                  className={`relative h-12 w-12 overflow-hidden rounded-lg ring-2 ${active === i ? "ring-white" : "ring-white/30"}`}
                >
                  <span className="absolute inset-0" style={{ background: tile(g) }} />
                  {g.image && (
                    <img src={g.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
