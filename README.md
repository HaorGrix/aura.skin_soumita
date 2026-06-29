# aura.skin 🌿

A premium, mobile-first skincare e-commerce experience.
**Glow within. Bloom daily.**

Built with **React 19 · Tailwind CSS v4 · Framer Motion · Lenis**.

## Stack

| Concern        | Choice                                  |
| -------------- | --------------------------------------- |
| Framework      | React 19 + Vite 6                       |
| Styling        | Tailwind CSS v4 (`@tailwindcss/vite`)   |
| Motion         | Framer Motion v12                       |
| Smooth scroll  | Lenis (`lenis/react`, root provider)    |
| Icons          | lucide-react                            |
| Fonts          | Instrument Serif (display) + Inter (body) |

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL (usually http://localhost:5173).

## Project structure

```
src/
├─ App.jsx                  # Lenis root, theme + loader orchestration
├─ index.css                # Tailwind v4 theme tokens (the design system)
├─ context/
│  └─ CartContext.jsx       # Lightweight cart store (count + add/remove)
└─ components/
   ├─ Loader.jsx            # Entry ritual — aura orbs + affirmations
   ├─ Navbar.jsx            # Sticky frosted nav + mobile slide-in menu
   ├─ Hero.jsx              # Ocean video bg, parallax, dual CTAs
   └─ ui/
      └─ MagneticButton.jsx # Reusable cursor-magnetic button
```

## Design tokens

All brand colors, fonts, easings, and shadows live in `src/index.css` under
`@theme`. Use them as Tailwind utilities (`bg-sage`, `text-teal`, `shadow-lift`,
`font-serif`, …) or as CSS variables (`var(--color-gold)`).

## Roadmap (build order)

- [x] **Phase 1** — Loader · Navbar · Hero
- [ ] Phase 2 — Affirmations carousel · Skin Quiz teaser · Best Sellers
- [ ] Phase 3 — Shop by Concern · Rituals · Journal · Why Aura · Footer
- [ ] Phase 4 — Shop listing (virtualized grid, filters) · Quick view
- [ ] Phase 5 — Product detail page (gallery, tabs, bundles)
- [ ] Phase 6 — Cart drawer · mini-cart fly-in · checkout flow

## Notes

- **Reduced motion** is respected everywhere (`prefers-reduced-motion`).
- The hero video falls back to an animated brand gradient, so it looks
  polished even offline. Swap `VIDEO_SRC` in `Hero.jsx` for your own asset.
- Dark mode toggles via the moon/sun icon and persists to `localStorage`.
