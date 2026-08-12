/* =================================================================== *
 * skin.theory — Supabase client (single instance)
 * -------------------------------------------------------------------
 * Reads the two Vite env vars set in `.env.local` (see `.env.example`).
 * Vite inlines VITE_-prefixed vars at BUILD time — changing them requires
 * a rebuild, there is no runtime env on a static host.
 *
 * Only the ANON key belongs here. It is safe to ship in the browser bundle
 * because every table it can touch is protected by Row-Level Security
 * (see the Part 0–9 migration). The service_role key must NEVER appear in
 * frontend code — it bypasses RLS entirely.
 * =================================================================== */
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (import.meta.env.DEV && (!url || !anonKey)) {
  // Fail loud in dev — a silent missing-env bug otherwise surfaces as a
  // confusing "fetch failed" deep inside some unrelated component.
  console.error(
    "[supabase] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.\n" +
    "Copy .env.example to .env.local and fill in your project's values " +
    "(Supabase Dashboard → Settings → API), then restart the dev server."
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
