/**
 * The teaser and the trailer.
 *
 * Both play on the page, from files in `public/videos/`. Instagram's own embed
 * was tried and dropped: it letterboxes into its own frame, brings a white card
 * with a like count and a comment field along with it, and still will not play
 * inline, it only offers "Watch on Instagram". The Instagram links stay as a
 * secondary action for anyone who wants to share or comment.
 *
 * The files are re-encoded to 720p H.264 with the moov atom at the front, so
 * they start playing before they finish downloading. Nothing is fetched until
 * somebody presses play.
 */

import { asset } from '../lib/asset'

export type Reel = {
  id: string
  /** "Teaser", "Trailer": the label on the card. */
  kind: string
  title: string
  blurb: string
  /** The instagram.com permalink. Empty means "not out yet". */
  url: string
  /**
   * A local MP4 or WebM under `public/videos/`. When set, the reel plays on
   * the page and the Instagram link becomes a secondary action.
   */
  file?: string
  /** The still behind the play button. */
  poster: string
  /** How the frame is shaped. The cuts are landscape, not reels. */
  ratio?: '16/9' | '9/16'
}

/** A frame lifted from the cut itself, rather than a stand-in from the gallery. */
const still = (name: string) => asset(`videos/${name}-poster.webp`)

export const REELS: Reel[] = [
  {
    id: 'teaser',
    kind: 'Teaser',
    title: 'The first signal',
    blurb: 'The island shows itself. The first look at what is coming in October.',
    url: 'https://www.instagram.com/pyrexiaaiims/reel/DbkWMeevtbD/',
    file: 'teaser.mp4',
    poster: still('teaser'),
    ratio: '16/9',
  },
  {
    id: 'trailer',
    kind: 'Trailer',
    title: 'Pirates of the Lost Island',
    blurb: 'The full charted voyage: five days, eleven territories, one treasure.',
    url: 'https://www.instagram.com/pyrexiaaiims/reel/DclTKtwPcls/',
    file: 'trailer.mp4',
    poster: still('trailer'),
    ratio: '16/9',
  },
]

/** The playable source for a reel, or null when only the Instagram link exists. */
export function videoSrc(reel: Reel): string | null {
  return reel.file ? asset(`videos/${reel.file}`) : null
}

/** The reels that have something to show. */
export const liveReels = () => REELS.filter((r) => r.url.trim().length > 0 || !!r.file)
