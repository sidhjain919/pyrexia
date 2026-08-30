# PYREXIA 2026: Pirates of the Lost Island

The official festival website for **PYREXIA 2026**, the annual socio-cultural & sports fest of
**AIIMS Rishikesh**. A cinematic, immersive single-page experience themed around a lost pirate island.

Built with **React + TypeScript + Vite**, **React Router**, **Tailwind CSS v4**, **Framer Motion**,
and self-hosted fonts (Cinzel / Cinzel Decorative / EB Garamond / Special Elite / Rye).

## Pages

Multi-page app with cinematic route transitions:

| Route | Page |
|-------|------|
| `/` | Immersive landing (hero → legend → island → featured → schedule → artists → gallery → CTA → contact) |
| `/events` | Territory map + searchable/filterable event discovery grid with per-event registration |
| `/schedule` | Full Captain's Log |
| `/artists` | Starlight Summit lineup |
| `/gallery` | Full filterable photo gallery + lightbox |
| `/register` | Delegate registration page |

## Registration

Two tiers, and the second contains the first:

| Tier | Price | What it covers |
|------|-------|----------------|
| **Basic Registration (BR)** | ₹500 | Compulsory for everyone. Entry to the fest and to every event **except** the Pro Nights. |
| **Festival Pass** | +₹2200 (₹2700 total) | BR plus entry to all five Pro Nights. |

Every amount is **exclusive of payment gateway charges**, which are added on top at checkout and
shown as their own line. The rate lives in one place, `CONVENIENCE_BPS` in
`api/src/lib/pricing.ts`, and the server computes the paise that are actually charged.

Both live in `DELEGATE_PASSES` in `src/data/registration.ts`; `BASIC_AMOUNT` and `DELEGATE_ADDON`
are the single source of truth for the numbers shown across the site.

Per-event entry forms are gated **per territory, in code**: `OPEN_TERRITORIES` in
`api/src/data/events.ts` decides, and `src/data/registration.ts` keeps the same set so sixty cards
can label themselves without a round trip. Alfresco is open for 2026; the other ten render a
"Coming Soon" panel. The server enforces it as well as the UI.

**Event entry fees are charged online.** Amounts live in `api/src/data/fees.ts` (paise, the
authority) and `src/data/fees.ts` (display). The client sends a variant id, never an amount. A paid
entry is written `pending` with a Razorpay order attached and is confirmed by the webhook, exactly
like a registration. Fees are shown only inside the entry form, never on the public page.

> Submissions currently save to `localStorage` via the mock adapter in `src/registration/api.ts`.
> See `src/registration/README.md` for the swap to a real backend.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build → dist/
npm run preview  # preview the production build
```

## What's on the page

A branded loading sequence → cinematic hero → **The Legend** (story) → previous-voyage stats →
**Eleven Territories** (interactive island map, the signature) → marquee treasure cards →
**Captain's Log** (schedule) → **Starlight Summit** (artists) → **Memories from the Sea** (gallery
+ lightbox) → registration CTA → **Navigator's Desk**
(FAQ + the organising committee) → footer.

Plus: custom desktop cursor, magnetic buttons, scroll reveals, word-by-word titles, film grain,
parallax hero, and full `prefers-reduced-motion` support.

## Editing content (no UI changes needed)

All copy and data live in `src/data/`: edit these, the components follow:

| File | Contains |
|------|----------|
| `site.ts` | Fest name, dates (12–16 Oct 2026), nav, socials, stats |
| `events.ts` | The 11 territories/verticals, sub-events, coordinator contacts |
| `schedule.ts` | Captain's Log, the five days and their dates (hour-by-hour log still to come) |
| `artists.ts` | Past star lineups + the five 2026 night reveals |
| `gallery.ts` | Photo captions & categories (files in `public/photos/`) |
| `crew.ts` | Chief Organising Committee + FAQs |
| `registration.ts` | Pricing tiers, the event-entry open flag, per-event form shapes |
| `media.ts` | Maps photos to territories & section backdrops (swap imagery here) |
| `fees.ts` | Per-event entry fees, shown only at the point of entering |
| `videos.ts` | Teaser & trailer Instagram links (empty = the section is hidden) |

> Content is real, sourced from the **PYREXIA 5.0 (2025) brochure**. Items that the fest keeps
> secret until closer to the dates (hour-by-hour schedule, 2026 star lineup) are clearly marked
> as tentative/placeholder: replace them as information is confirmed.

## Replacing assets

- **Photos**: drop optimized JPGs into `public/photos/` (named `p01.jpg`, `p02.jpg`, …) and
  reference them in `src/data/gallery.ts`.
- **PYREXIA / AIIMS logo**: the wordmark is currently type-set (Cinzel Decorative). To use an
  image logo, replace the `<Compass/> + wordmark` block in `src/components/Navbar.tsx` and
  `Footer.tsx`.

## Project structure

```
src/
  components/   Loader, Navbar, Cursor, Hero, OceanScene, Legend, Stats,
                IslandMap, FeaturedEvents, CaptainsLog, Artists, Gallery,
                CTA, Navigator, Footer, primitives
  data/         events, schedule, artists, gallery, registration, crew, site
  lib/          icons (lucide + inline brand glyphs)
  index.css     design tokens (@theme), textures, keyframes
public/photos/  festival photography
```
