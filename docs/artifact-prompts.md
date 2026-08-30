# Artwork

> **All nine are in and wired up.** Kept as a record of what was asked for, what
> it replaced, and the house style, so a redraw or an addition matches.
>
> The files live in `public/art/` as WebP, resized from the delivered PNGs. The
> eleven territory glyphs arrived as one sheet with a painted brown background;
> they were flood-cut into `public/art/territory/<id>.png` with the background
> knocked out. If a sheet is ever redelivered, the cutter is
> `scratchpad/split2.mjs` in the session that made it, and the grid it assumes
> is 4 / 4 / 3 in the order of the table below.

Everything is **PNG with a transparent background** unless it says otherwise, and
square unless a ratio is given.

House style for every prompt: *aged nautical cartography, warm sepia and oxblood,
candle-lit, hand-inked, 18th-century engraving. No modern gloss, no neon, no text
unless asked for.*

---

## 1. Parchment sheet, The Legend card (highest value)

`public/art/parchment.png` · 1200 × 1600 · transparent outside the paper

The Captain's Log quote currently sits on a CSS gradient with a clipped edge. It
is the one place on the page where a real texture would do the most work, because
it is large, light, and surrounded by dark.

> A single sheet of aged parchment lying flat, photographed straight on from
> directly above. Torn and frayed along all four edges, no straight cuts. Warm
> cream to tan, with foxing, water stains and a soft crease down the middle. Fine
> paper fibre visible. Even, slightly warm light with a faint shadow under the
> edges. Completely blank, no writing, no marks. Transparent background outside
> the sheet. High resolution, top-down, no perspective.

## 2. Night seascape, the hero

`public/art/hero-sea.webp` · 2400 × 1400 · JPEG or WebP, no transparency

The hero ocean is SVG and CSS today. It holds together, but a painted plate would
lift the first thing every visitor sees.

> A moonlit tropical sea at night, painted in the style of a romantic marine oil
> painting. A dark volcanic island silhouetted on the horizon with palms on its
> summit. A tall ship with three masts under sail in the middle distance, small,
> sailing left to right. Calm water with a long moon reflection. Deep teal and
> near-black water, a warm ivory moon high on the right, a scatter of stars.
> Cinematic, atmospheric, very dark in the lower third so text can sit over it.
> No people, no text, no border.

## 3. Compass rose

`public/art/compass.png` · 1000 × 1000

Used in the footer, the CTA and the mobile menu; currently an inline SVG that
reads as a UI glyph next to the real map.

> A hand-inked compass rose from an antique sea chart. Eight points, the north
> point elongated and decorated with a fleur-de-lis. Fine cross-hatching, sepia
> and oxblood ink on nothing, slightly irregular as if drawn by hand with a
> quill. Transparent background. No circle border, no text, no cardinal letters.

## 4. Rope divider

`public/art/rope.png` · 2000 × 120 · tileable left to right

The gold hairline between sections is fine, but a rope would tie the theme
together where the sections are heaviest.

> A single length of thick weathered hemp ship's rope lying perfectly horizontal
> and straight, photographed from directly above against nothing. Even lighting,
> visible twist and fibre, frayed nowhere. The ends run exactly to the left and
> right edges so it can repeat seamlessly. Transparent background.

## 5. Ship's logbook page, Captain's Log

`public/art/logbook.png` · 1400 × 1000 · transparent outside the page

The schedule section is the most plainly-styled part of the site.

> An open ship's logbook page, aged and slightly warped, photographed from
> directly above. Faint blue-grey horizontal ruling, a vertical margin rule in
> red, a stitched binding edge down the left. Ink blots and a ring from a cup.
> Completely blank of writing. Transparent background outside the page.

## 6. Wooden signboard, the noticeboard

`public/art/notice-board.png` · 1600 × 1000 · transparent outside the board

`/notices` is the page people will open every morning of the fest. It currently
looks like a settings screen.

> A weathered ship's notice board: dark salt-bleached planks in a rough frame,
> four rusted nails at the corners, a couple of empty nail holes. Straight on,
> flat lighting, no perspective. Nothing pinned to it, no paper, no text.
> Transparent background outside the board.

## 7. Boarding pass, My Pass

`public/art/pass-card.png` · 1600 × 900 · transparent outside the card

The delegate pass is the thing people screenshot and show at the gate.

> An antique ticket or ship's passage card, printed on thick cream card stock and
> slightly worn at the corners. An ornate engraved border, a perforated stub down
> the right-hand third, one punched hole. Warm cream with oxblood and gold ink.
> Completely blank inside the border, no text, no numbers, no barcode.
> Transparent background outside the card.

## 8. Eleven territory glyphs

`public/art/territory/<id>.png` · 400 × 400 each

Each territory card carries a Lucide icon in a coloured chip. Hand-drawn glyphs
in the map's own hand would sit far better beside the chart. One prompt, swapping
the subject:

> A small hand-inked icon in the style of an antique sea chart marginal drawing.
> Sepia and oxblood ink, fine cross-hatching, slightly irregular quill line.
> Subject: **{SUBJECT}**. Transparent background, no frame, no circle, no text.

| id | file | {SUBJECT} |
|---|---|---|
| fahrenheit | `fahrenheit.png` | a lit signal brazier on a pole, flames streaming |
| chorea | `chorea.png` | a pair of dancing figures mid-step, arms raised |
| sinfonia | `sinfonia.png` | a lute and a set of pan pipes crossed |
| thespians | `thespians.png` | two theatre masks, comedy and tragedy, on ribbons |
| velocity | `velocity.png` | two crossed cutlasses over a round shield |
| chronos | `chronos.png` | a jewelled crown resting on a cushion |
| littmania | `littmania.png` | an open book with a quill lying across it |
| kalakriti | `kalakriti.png` | an artist's palette with three brushes |
| alfresco | `alfresco.png` | a tankard, dice and a set of playing cards |
| thunderbolt | `thunderbolt.png` | a lightning bolt striking a stone tower |
| auriga | `auriga.png` | a five-pointed star with radiating rays |

## 9. Chart improvements

`public/map/archipelago.png`: the existing chart is good and the island names are
now lettered onto it by the site. Two things would make it better still:

> Redraw the same eleven-island archipelago chart with the island names lettered
> **onto the parchment itself** in period hand-lettered capitals: Rhythm Reef,
> Siren's Harbor, Masquerade Bay, Conquest Arena, Crown Isle, Ink & Lore Lagoon,
> Painted Cliffs, Carnival Cove, Thunder Keep, Starlight Summit, Ember Landing.
> Keep the sea serpent, the whale and the compass rose. Add faint rhumb lines
> radiating from two compass points, depth soundings in the shallows, and a
> decorative cartouche in the lower-left corner reading PYREXIA 2026. Same aged
> parchment, same ink, no modern type.

If that lands, the site's own labels come off in one line and the names become
part of the artwork, which is what a real chart looks like.

---

## Photographs still wanted

Every event card, the gallery, the marquee, the territory panels and the past
headliners now use real festival photography. Three places still have none:

- **Euphonia** and **Metallica**: the only two events whose folder held a Sony
  RAW (`.ARW`) file, which the web cannot use. A JPEG of either would fill them.
- **Poetic Reverie**, , **mADD Angle**: no folder in the drop. They fall
  back to their territory's photo.
- **The teaser and trailer.** The MP4s. Instagram will not play a reel inside
  another site, so the cards link out; drop the files in `public/videos/` and
  they play on the page instead.
