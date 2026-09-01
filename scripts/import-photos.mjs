#!/usr/bin/env node
/**
 * Bring new photography into the site.
 *
 * Drop originals — any size, JPG/PNG/HEIC/WebP — into a folder and run this.
 * Each one is resized to the size it actually renders at and re-encoded to
 * WebP, which is what turned 1.3 GB of originals into 12 MB the first time
 * round. Nothing is written outside `public/photos/`, and an original is never
 * modified.
 *
 *   node scripts/import-photos.mjs ../new_photos
 *
 * The destination and the target size come from the filename's prefix, so the
 * folder can hold a mix:
 *
 *   artist-mohit-chauhan.jpg   → public/photos/artists/mohit-chauhan.webp  900×600
 *   event-art-roulette.jpg     → public/photos/events/art-roulette.webp   1000×667
 *   gallery-anything.jpg       → public/photos/gallery/anything.webp      1400×933
 *
 * A file with no known prefix is skipped and named in the summary rather than
 * guessed at: putting a portrait into the events folder is a mistake that is
 * quiet until somebody notices the wrong face on a card.
 *
 * Requires ffmpeg on PATH, which is what the rest of this project's image work
 * already uses.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { basename, dirname, extname, join, resolve } from 'node:path'

/** Where each prefix lands, and the box its images are fitted to. */
const KINDS = {
  artist: { dir: 'artists', width: 900, height: 600 },
  event: { dir: 'events', width: 1000, height: 667 },
  gallery: { dir: 'gallery', width: 1400, height: 933 },
  scene: { dir: 'scene', width: 1400, height: 933 },
}

const SOURCE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.tif', '.tiff'])
/** High enough that a face survives it, low enough that a card stays under 60 KB. */
const QUALITY = 82

const src = resolve(process.argv[2] ?? '')
if (!src || !existsSync(src)) {
  console.error('Usage: node scripts/import-photos.mjs <folder-of-originals>')
  process.exit(1)
}

// `fileURLToPath`, not `.pathname`: on Windows the latter yields "/D:/..."
// and `resolve` then prefixes the drive again.
const publicPhotos = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'photos')

const done = []
const skipped = []

for (const name of readdirSync(src).sort()) {
  const full = join(src, name)
  if (!statSync(full).isFile()) continue

  const ext = extname(name)
  if (!SOURCE_EXT.has(ext.toLowerCase())) continue

  // Phones and Drive downloads routinely produce "foo.jpg.JPEG". Strip every
  // trailing image extension, not just one, so the slug is the name and not
  // the name plus a fossil. Note `basename` is case-sensitive about the
  // extension it removes, so it gets the raw one, never a lower-cased copy.
  let stem = basename(name, ext).toLowerCase()
  while (/\.(jpe?g|png|webp|heic|tiff?)$/i.test(stem)) {
    stem = stem.replace(/\.(jpe?g|png|webp|heic|tiff?)$/i, '')
  }
  const prefix = Object.keys(KINDS).find((k) => stem.startsWith(`${k}-`))
  if (!prefix) {
    skipped.push(`${name} — no artist-/event-/gallery-/scene- prefix`)
    continue
  }

  const kind = KINDS[prefix]
  // Kebab-case, because that is what `photos.ts` already references.
  const slug = stem
    .slice(prefix.length + 1)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  if (!slug) {
    skipped.push(`${name} — nothing left after the prefix`)
    continue
  }

  const outDir = join(publicPhotos, kind.dir)
  mkdirSync(outDir, { recursive: true })
  const out = join(outDir, `${slug}.webp`)

  // `increase` then centre-crop: fill the box and keep the middle, which is
  // where a face is. Scaling to fit instead would letterbox inside a card that
  // has no letterbox.
  const filter =
    `scale=${kind.width}:${kind.height}:force_original_aspect_ratio=increase:flags=lanczos,` +
    `crop=${kind.width}:${kind.height}`

  try {
    execFileSync(
      'ffmpeg',
      ['-y', '-loglevel', 'error', '-i', full, '-vf', filter, '-c:v', 'libwebp',
       '-quality', String(QUALITY), '-compression_level', '6', '-preset', 'picture', out],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    )
    const kb = Math.round(statSync(out).size / 1024)
    done.push(`${kind.dir}/${slug}.webp  ${kind.width}×${kind.height}  ${kb} KB   ← ${name}`)
  } catch (err) {
    skipped.push(`${name} — ffmpeg failed: ${String(err.stderr ?? err).slice(0, 120)}`)
  }
}

console.log(`\n${done.length} imported:`)
for (const line of done) console.log('  ' + line)

if (skipped.length) {
  console.log(`\n${skipped.length} skipped:`)
  for (const line of skipped) console.log('  ' + line)
}

console.log(
  '\nNow reference them in src/data/photos.ts —' +
    ' `artistPhoto` for portraits, `eventPhoto` for event frames.\n',
)
