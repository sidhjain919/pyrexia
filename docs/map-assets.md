# PYREXIA 2026: Island Map Art Brief

Everything you need to generate for the **Eleven Territories** section, plus the exact
prompts. Drop the finished files into `site/public/map/` with the filenames below and the
map component picks them up.

---

## 0. Rules that apply to every image

1. **No text, no lettering, no numbers, no labels anywhere in the image.** Image models
   garble type. Every territory name, chip and legend is drawn over the art in code, so it
   stays crisp and tintable.
2. **No logos and no watermark.**
3. Colour target, the site palette, so the art doesn't fight the page:

   | role | hex |
   |---|---|
   | deep sea / ground | `#06141b` → `#030b0f` |
   | shallow water | `#174a52` / `#2b7d84` |
   | parchment | `#e8d5ae` |
   | gold ink | `#c89b3c` |
   | wax red | `#7a2318` |

4. Export **PNG**. Sprites must be **transparent**, with no drop shadow baked in, the
   code adds the shadow, and a baked one looks wrong the moment the sprite rotates.
5. Generate at the size given; don't upscale a small render.

---

## 1. The map, `map/archipelago.png`

**The one required asset.** An aged sea chart with eleven islands.

- Size: **2048 × 1408** (16:11: the exact ratio of the map frame; mobile crops to 4:3
  from the centre, so keep every island inside the middle 75% horizontally).
- Format: PNG, opaque.
- Style: aged parchment nautical chart, hand-inked, sepia + gold ink, faint watercolour
  wash. Not photoreal, not cartoon-cute, an 18th-century privateer's chart.

**Prompt**

> An aged 18th-century pirate treasure map of a tropical archipelago, hand-drawn nautical
> chart on weathered parchment. Eleven distinct islands of clearly different shapes and
> sizes scattered across an open sea, each island large enough to read as a landmark: one
> volcanic island with a smoking cone, one long crescent reef, one harbour island with a
> natural cove, one rocky bay with sea stacks, one broad arena-like plateau, one small
> crowned peak, one lagoon ringed by mangroves, one island of striped painted cliffs, one
> low sandy cove, one storm-wracked cliff fortress island, one tall lone summit. Sepia and
> gold ink linework, faint blue-green watercolour wash on the shallows, fine hatched
> depth-sounding lines and stippled coastlines, subtle rhumb lines radiating across the
> ocean, tiny hand-drawn waves, a sea serpent and a spouting whale in open water. Torn and
> singed parchment edges, coffee stains, soft vignette. No text, no letters, no numbers,
> no labels, no compass rose, no watermark. Flat overhead top-down view, even lighting,
> 16:11 landscape.

**Negative prompt**

> text, letters, words, numbers, labels, typography, captions, watermark, signature,
> compass rose, modern coastline, satellite photo, photorealistic, 3D render, people,
> frame border, blurry

**Layout hint: raises your odds of a usable arrangement.** The site currently places the
eleven territories at these positions, as a percentage of the map's width and height:

| # | Vertical | Territory | x % | y % | island character to aim for |
|---|---|---|---|---|---|
| 1 | Fahrenheit | Ember Landing | 50 | 20 | volcanic cone, smoke plume |
| 2 | Chorea | Rhythm Reef | 24 | 34 | long crescent reef |
| 3 | Sinfonia | Siren's Harbor | 71 | 30 | harbour with a natural cove |
| 4 | Thespians | Masquerade Bay | 38 | 52 | rocky bay, sea stacks |
| 5 | Velocity | Conquest Arena | 82 | 55 | broad flat plateau |
| 6 | Chronos | Crown Isle | 58 | 46 | small island, crown-shaped peak |
| 7 | Littmania | Ink & Lore Lagoon | 17 | 62 | lagoon ringed by mangroves |
| 8 | Kalakriti | Painted Cliffs | 30 | 78 | striped cliff faces |
| 9 | Alfresco | Carnival Cove | 63 | 74 | low sandy cove, palms |
| 10 | Thunderbolt | Thunder Keep | 78 | 82 | cliff fortress under storm |
| 11 | Auriga | Starlight Summit | 50 | 88 | tall lone summit |

You don't have to hit these exactly: **send me the final PNG and I'll re-measure the
eleven coordinates off the actual image** and update `src/data/events.ts`. What matters is
that there are exactly eleven separated islands, with clear open water between them and
none jammed against an edge.

> **Variant worth trying:** the same prompt with *"deep midnight blue-black chart, gold
> ink on dark indigo, moonlit"* in place of parchment. Parchment gives the section strong
> focal contrast against the dark page; the dark version blends in more. Generate both and
> compare: parchment is my recommendation.

---

## 2. The ship, `map/ship.png`

The sprite that sails between territories.

- Size: **1024 × 1024**, transparent PNG.
- **Critical:** three-quarter *aerial* view (camera above and slightly behind), with the
  **bow pointing at the RIGHT edge of the frame**, ship horizontally centred, sails up.
  The code rotates the sprite to face its heading, and rotation is measured from "pointing
  right": any other orientation puts the ship permanently sideways.
- Leave ~12% empty margin on all sides so rotation never clips a mast.
- No water, no wake, no shadow, no background.

**Prompt**

> A single pirate galleon seen from above and slightly behind, three-quarter aerial view,
> bow pointing to the right of the frame. Dark weathered timber hull with gold trim, three
> masts, cream canvas sails full of wind, visible rigging, a small dark red pennant at the
> mainmast top. Hand-inked engraving style with soft watercolour shading, sepia and gold
> palette, warm rim light from the upper left. Isolated on a fully transparent background,
> centred, no water, no wake, no shadow, no background elements. No text, no watermark.

**Negative prompt**

> background, water, sea, waves, wake, shadow, ground, text, watermark, multiple ships,
> harbour, photorealistic, 3D render, motion blur

---

## 3. The captain, `map/captain.png`

The pirate who guides the voyage: shown beside the active territory's detail panel.

- Size: **1024 × 1536** (2:3 portrait), transparent PNG.
- Full body, standing, facing slightly left, feet inside the frame.

**Prompt**

> Full-body illustration of a friendly pirate captain standing with one hand on a hip and
> the other resting on a rolled map, facing slightly to the left, three-quarter view. Long
> dark coat with gold trim, a wide feathered tricorn hat, a compass on a chain, tall
> boots. Warm confident expression, adventurous rather than menacing. Hand-inked engraving
> style with soft watercolour shading, sepia, gold and deep teal palette, warm rim light
> from the upper left. Isolated on a fully transparent background, full body inside frame,
> no shadow, no ground, no background. No text, no watermark.

**Negative prompt**

> background, ground, shadow, cropped limbs, text, watermark, weapons pointed at viewer,
> gore, skull face, photorealistic, 3D render

---

## 4. Route markers, `map/markers.png`

One transparent sheet, **1024 × 1024**, four icons in a clean 2 × 2 grid with generous
empty space between them (I slice it into four files):

1. top-left, a hand-inked **X** mark, two crossed brush strokes, wax red
2. top-right, a small closed **treasure chest**, gold-banded, three-quarter view
3. bottom-left, an **anchor**
4. bottom-right, a **skull-and-crossbones wax seal**, deep red wax

**Prompt**

> Four separate pirate map icons arranged in a 2x2 grid with wide empty space between
> them, on a fully transparent background: top-left a bold hand-inked X mark made of two
> crossed brush strokes in dark wax red; top-right a small closed wooden treasure chest
> with gold bands, three-quarter view; bottom-left a simple iron anchor; bottom-right a
> round deep-red wax seal stamped with a skull and crossbones. Hand-drawn ink and
> watercolour engraving style, sepia gold and wax-red palette, consistent line weight
> across all four. Each icon fully separated and centred in its quadrant, no shadow, no
> background, no frame, no text, no watermark.

**Negative prompt**

> background, shadow, frame, border, grid lines, text, labels, watermark, overlapping
> icons, photorealistic, 3D render

---

## 5. Optional, `map/compass.png`

Only if you want to replace the SVG compass rose already on the map. **1024 × 1024**,
transparent.

**Prompt**

> An ornate 18th-century nautical compass rose, hand-inked in sepia and gold on a
> transparent background, sixteen points, fine engraved detail, a fleur-de-lis marking
> north. Symmetrical, centred, flat top-down view. No text, no letters, no numbers, no
> background, no shadow, no watermark.

---

## What happens once you send the files

Drop them in `site/public/map/` under exactly those names and I'll wire up:

- the parchment chart as the map background, replacing the generated SVG islands;
- the eleven coordinates re-measured from your actual image;
- the ship sprite sailing island → island, rotated to its heading, with a **dotted gold
  route line drawing itself behind it** as it travels;
- an **X mark** dropped on every territory already visited, and a **treasure chest**
  landing on the one it arrives at;
- the captain shown beside the active territory's detail card;
- a "chart the full course" control that sails the ship through all eleven in order.

Two things to check before you send: no text anywhere in the map, and every island clear
of the frame edges.
