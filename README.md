# PYREXIA 2026 — Pirates of the Lost Island

The official festival website for **PYREXIA 2026**, the annual socio-cultural & sports fest of
**AIIMS Rishikesh**. A cinematic, immersive single-page experience themed around a lost pirate island.

Built with **React + TypeScript + Vite**, **React Router**, **Tailwind CSS v4**, **Framer Motion**,
and self-hosted fonts (Cinzel / Cinzel Decorative / Space Grotesk / Special Elite).

## Pages

Multi-page app with cinematic route transitions:

| Route | Page |
|-------|------|
| `/` | Immersive landing (hero → legend → island → featured → schedule → artists → gallery → sponsors → CTA → contact) |
| `/events` | Territory map + searchable/filterable event discovery grid with per-event registration |
| `/schedule` | Full Captain's Log |
| `/artists` | Starlight Summit lineup |
| `/gallery` | Full filterable photo gallery + lightbox |
| `/sponsors` | Allies + Navigator's Desk |
| `/register` | Delegate registration page |

## Registration

A global 2-step form (details → pick events) opens as a **modal** from any "Register Now" / "Join
the Crew" button, and as a full page at `/register`. Individual events are registerable from the
events grid, the island-map panel chips, and the marquee cards (each pre-selects that event).

> Submissions currently save to `localStorage` as a demo capture. **Wire a real backend or Google
> Form** in `src/registration/RegisterForm.tsx` (`submit()`) to collect live entries.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build → dist/
npm run preview  # preview the production build
```

## What's on the page

A branded loading sequence → cinematic hero → **The Legend** (story) → previous-voyage stats →
**Eleven Territories** (interactive island map — the signature) → marquee treasure cards →
**Captain's Log** (schedule) → **Starlight Summit** (artists) → **Memories from the Sea** (gallery
+ lightbox) → **Allies of the Voyage** (sponsors) → registration CTA → **Navigator's Desk**
(FAQ + ARSWA committee) → footer.

Plus: custom desktop cursor, magnetic buttons, scroll reveals, word-by-word titles, film grain,
parallax hero, and full `prefers-reduced-motion` support.

## Editing content (no UI changes needed)

All copy and data live in `src/data/` — edit these, the components follow:

| File | Contains |
|------|----------|
| `site.ts` | Fest name, dates window, nav, socials, legend chips, stats |
| `events.ts` | The 11 territories/verticals, sub-events, coordinator contacts |
| `schedule.ts` | Captain's Log — day-wise timeline (indicative; swap for the official one) |
| `artists.ts` | Past star lineups + 2026 mystery slots |
| `gallery.ts` | Photo captions & categories (files in `public/photos/`) |
| `sponsors.ts` | Ally tiers (placeholder — set `logo` to swap wax seals for real logos) |
| `crew.ts` | ARSWA office bearers + FAQs |
| `media.ts` | Maps photos to territories & section backdrops (swap imagery here) |

> Content is real, sourced from the **PYREXIA 5.0 (2025) brochure**. Items that the fest keeps
> secret until closer to the dates (exact schedule, 2026 star lineup, sponsors) are clearly marked
> as tentative/placeholder — replace them as information is confirmed.

## Replacing assets

- **Photos** — drop optimized JPGs into `public/photos/` (named `p01.jpg`, `p02.jpg`, …) and
  reference them in `src/data/gallery.ts`.
- **PYREXIA / AIIMS logo** — the wordmark is currently type-set (Cinzel Decorative). To use an
  image logo, replace the `<Compass/> + wordmark` block in `src/components/Navbar.tsx` and
  `Footer.tsx`.
- **Sponsor logos** — set `logo` in `src/data/sponsors.ts` (currently `null` → renders a wax-seal
  monogram) and render it inside `WaxSeal` in `src/components/Sponsors.tsx`.

## Project structure

```
src/
  components/   Loader, Navbar, Cursor, Hero, OceanScene, Legend, Stats,
                IslandMap, FeaturedEvents, CaptainsLog, Artists, Gallery,
                Sponsors, CTA, Navigator, Footer, primitives
  data/         events, schedule, artists, gallery, sponsors, crew, site
  lib/          icons (lucide + inline brand glyphs)
  index.css     design tokens (@theme), textures, keyframes
public/photos/  festival photography
```
