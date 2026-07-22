/* =================================================================== *
 * scrollLock — ONE ref-counted body-scroll lock for the whole app.
 * -------------------------------------------------------------------
 * Every overlay (mobile nav drawer, Shop filter sheet, auth modal, quick
 * view, notify-me, write-review) shares this single module-level counter
 * instead of each one snapshotting + restoring document.body.style.overflow
 * on its own.
 *
 * WHY THIS EXISTS — the bug it kills:
 * The old per-component pattern captured the *current* overflow value and
 * later "restored" it. When two overlays overlapped (e.g. open the mobile
 * menu, then open a modal from inside it), the second locker captured the
 * first's "hidden" and, on close, restored "hidden" — leaving <body>
 * permanently locked. On phones that silently kills native touch scrolling;
 * desktop kept scrolling because Lenis drives the wheel programmatically and
 * only watches <html>, never <body>. Result: "PC fine, phone stuck."
 *
 * THE FIX: capture the TRUE original overflow exactly once (on 0 -> 1) and
 * restore it exactly once (on 1 -> 0). A module-level counter (not React
 * state) means an unmount's cleanup still decrements even mid-route-change,
 * so the lock can never leak. No caller may read or write
 * document.body.style.overflow directly ever again — that per-component
 * "prev" snapshot WAS the bug.
 * =================================================================== */
import { useEffect } from "react";

let count = 0;
let original = "";

/** Increment the lock. On the first lock, snapshot the real original once. */
export function lock() {
  if (typeof document === "undefined") return;
  if (count === 0) {
    original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  count += 1;
}

/** Decrement the lock. On the last unlock, restore the snapshotted original. */
export function unlock() {
  if (typeof document === "undefined") return;
  if (count === 0) return; // guard against underflow (double-unlock)
  count -= 1;
  if (count === 0) {
    document.body.style.overflow = original;
    original = "";
  }
}

/**
 * useBodyScrollLock(active) — lock the page while `active` is true.
 *
 * Mirrors the existing useFocusTrap(ref, active) convention so call sites are
 * one line. The cleanup always runs on unmount (even mid-route-change), and
 * lock/unlock stay symmetric per effect instance — so React StrictMode's
 * mount→cleanup→mount double-invoke nets out correctly (lock, unlock, lock).
 */
export function useBodyScrollLock(active) {
  useEffect(() => {
    if (!active) return;
    lock();
    return unlock;
  }, [active]);
}
