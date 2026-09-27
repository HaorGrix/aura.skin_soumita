import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { imagetools } from "vite-imagetools";

// Every bundled photo (assests/, src/) ships as WebP capped at 2000 px on the
// longest side. The sources were 2000–6000 px PNG/JPEG exports, 0.7–1.8 MB
// each; as WebP they are ~50–300 KB. Source files and their names are left
// untouched, so filename lookups in data/product-images.js keep working.
// public/ stays excluded (the plugin's default), matching Vite's own handling.
const BUNDLED_IMAGE = /\.(jpe?g|jfif|png|webp|avif)(\?.*)?$/i;
// Damaged PNGs sharp refuses to decode (bad chunk checksums); shipped as-is.
// 1161189358 is also truncated — its bottom ~30% is blank — and needs a
// fresh export.
const UNDECODABLE_IMAGE = /-(1161189358|1161173357|1213591271)\.png(\?.*)?$/;
const IMAGE_DIRECTIVES = new URLSearchParams({
  w: "2000", h: "2000", fit: "inside", withoutEnlargement: "", format: "webp", quality: "80",
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    imagetools({
      include: BUNDLED_IMAGE,
      exclude: ["public/**/*", UNDECODABLE_IMAGE],
      defaultDirectives: IMAGE_DIRECTIVES,
    }),
  ],
  // `.jfif` (JPEG with the older extension) isn't in Vite's default asset list
  // — opting it in so Shop by Concern's locally-added images get bundled.
  assetsInclude: ["**/*.jfif"],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'framer-motion': ['framer-motion'],
          'lenis': ['lenis', 'lenis/react'],
          'lucide-react': ['lucide-react'],
          // Hero carousel engine. Split out (rather than left in the entry
          // chunk) so it downloads in parallel with app code and, more to the
          // point, stays cached across deploys — it changes far less often
          // than our own source does.
          'swiper': ['swiper', 'swiper/react', 'swiper/modules'],
        }
      }
    }
  }
});
