import { useStoreSettings } from "../../lib/api/settings.js";

/** Shown behind a journal card's cover — visible when the article has no
 *  cover photo (or it fails to load), so the card never reads as empty. */
export default function CoverPlaceholder() {
  const { storeName } = useStoreSettings();
  return (
    <div aria-hidden className="absolute inset-0 grid place-items-center text-center">
      <div>
        <p className="font-serif text-3xl italic text-magenta/80 sm:text-4xl">{storeName}</p>
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-magenta/60">The Journal</p>
      </div>
    </div>
  );
}
