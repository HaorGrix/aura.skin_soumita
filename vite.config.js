import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
