import { useEffect, useRef, useState } from "react";

/**
 * useAdaptiveLoader — tunes the intro pacing based on visitor history AND
 * real page-load performance. Replaces the previous fixed-6s loader.
 *
 *   First visit (`!localStorage[SEEN_KEY]`):
 *     full beautiful sweep — 6 affirmations × 900ms (~5.7s).
 *
 *   Returning visit:
 *     4 affirmations, perLine derived from:
 *       • window.load time since mount (cached → snappy, slow → graceful)
 *       • navigator.connection.effectiveType when available
 *     Total intro stays in roughly [2.2s, 5.5s].
 *
 * Graceful fallback: if any perf API throws, neutral 600ms per line.
 * Returns { perLine, totalLines, isFirstVisit, markSeen }.
 */
const SEEN_KEY = "skinscript-intro-seen";

/* Tunables (ms) */
const PER_LINE_FIRST = 900;
const TOTAL_LINES_FIRST = 6;
const PER_LINE_RETURN_MIN = 470; // snappy floor: 470*4 + 350 = 2230ms ≥ 2.2s min
const PER_LINE_RETURN_MAX = 1000; // graceful ceiling (caps total ≈ 4.35s)
const PER_LINE_RETURN_BASE = 600; // neutral guess until we measure
const TOTAL_LINES_RETURN = 4;
const LOAD_WAIT_CAP_MS = 4000; // never wait longer than this for window.load

function readIsFirstVisit() {
  try { return !localStorage.getItem(SEEN_KEY); } catch { return true; }
}

function effectiveTypeFactor() {
  const eff = navigator.connection?.effectiveType;
  if (eff === "slow-2g" || eff === "2g") return 1.4; // calmer
  if (eff === "3g") return 1.15;
  if (eff === "4g") return 0.85;                     // snappier
  return 1.0;                                        // unknown (Safari iOS)
}

function loadTimeFactor(loadMs) {
  if (loadMs < 600) return 0.7;   // hot cache
  if (loadMs < 1200) return 0.85;
  if (loadMs < 2500) return 1.0;
  return 1.3;                      // slow — give assets breathing room
}

export function useAdaptiveLoader() {
  const isFirstVisit = useRef(readIsFirstVisit()).current;
  const [perLine, setPerLine] = useState(
    isFirstVisit ? PER_LINE_FIRST : PER_LINE_RETURN_BASE
  );

  useEffect(() => {
    if (isFirstVisit) return; // first-time visitors get the full fixed sweep
    const start = performance.now();

    const tune = () => {
      let next = PER_LINE_RETURN_BASE;
      try {
        const loadMs = performance.now() - start;
        next = PER_LINE_RETURN_BASE * loadTimeFactor(loadMs) * effectiveTypeFactor();
      } catch {
        /* perf APIs unavailable — keep the neutral base */
      }
      setPerLine(Math.round(
        Math.min(PER_LINE_RETURN_MAX, Math.max(PER_LINE_RETURN_MIN, next))
      ));
    };

    if (document.readyState === "complete") { tune(); return; }
    let fired = false;
    const onLoad = () => { if (fired) return; fired = true; tune(); };
    window.addEventListener("load", onLoad, { once: true });
    const fallback = setTimeout(onLoad, LOAD_WAIT_CAP_MS);
    return () => {
      window.removeEventListener("load", onLoad);
      clearTimeout(fallback);
    };
  }, [isFirstVisit]);

  return {
    perLine,
    totalLines: isFirstVisit ? TOTAL_LINES_FIRST : TOTAL_LINES_RETURN,
    isFirstVisit,
    markSeen: () => { try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* ignore */ } },
  };
}
