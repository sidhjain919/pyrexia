import { useState } from 'react'
import { Play } from 'lucide-react'

import { Icon } from '../lib/icons'

import { Reveal, SectionTitle } from './primitives'
import { liveReels, videoSrc, type Reel } from '../data/videos'

/**
 * The teaser and the trailer.
 *
 * Instagram's embed was tried first and rejected: it letterboxes the cut into
 * its own frame, brings a white card with a comment box along with it, and
 * refuses to play inline anyway. Fighting a third-party frame to look like this
 * site and still not getting playback is a bad trade, so the card is ours and
 * the files are served from here.
 *
 * Nothing is downloaded until somebody presses play: a two-and-a-half minute
 * trailer is not something to spend a visitor's data on speculatively.
 */
export default function Reels() {
  const reels = liveReels()
  if (reels.length === 0) return null

  return (
    <section id="watch" className="relative overflow-hidden py-14 sm:py-18 lg:py-24">
      <div className="map-grid pointer-events-none absolute inset-0 opacity-20" />
      <div className="rule-gold absolute inset-x-0 top-0" />

      <div className="relative mx-auto max-w-6xl px-6">
        <SectionTitle
          index="02"
          eyebrow="Moving Pictures"
          title="The Reveal"
          meaning="Teaser & trailer"
          kicker="Straight from the ship's own reels. The first look at what is coming in October."
        />

        {/* A 9:16 card at full phone width is most of a screen each, and there
            are two of them. Capped so the section stays a section. */}
        <div
          className={`mx-auto mt-10 grid gap-6 sm:mt-12 ${
            reels.length === 1 ? 'max-w-xl' : 'lg:grid-cols-2 lg:max-w-5xl'
          }`}
        >
          {reels.map((reel, i) => (
            <Reveal key={reel.id} delay={i * 0.08}>
              <ReelCard reel={reel} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function ReelCard({ reel }: { reel: Reel }) {
  const [playing, setPlaying] = useState(false)
  const src = videoSrc(reel)

  const cover = (
    <>
      <img
        src={reel.poster}
        alt=""
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover opacity-70 transition-all duration-700 group-hover:scale-105 group-hover:opacity-85"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-abyss via-abyss/55 to-abyss/25" />

      <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-b from-gold-bright to-gold-deep text-abyss shadow-[0_10px_30px_-8px_rgba(230,194,94,0.8)] transition-transform duration-300 group-hover:scale-105">
        <Play size={24} className="ml-1" fill="currentColor" />
      </span>
    </>
  )

  return (
    <figure className="overflow-hidden rounded-xl border border-gold/15 bg-navy/50">
      <div
        className="relative bg-abyss"
        style={{ aspectRatio: reel.ratio ?? '9/16' }}
      >
        {src && playing ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            src={src}
            poster={reel.poster}
            controls
            autoPlay
            playsInline
            preload="none"
            className="absolute inset-0 h-full w-full bg-black object-contain"
          />
        ) : src ? (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            data-cursor="PLAY"
            aria-label={`Play the ${reel.kind.toLowerCase()}`}
            className="group absolute inset-0 flex flex-col items-center justify-center gap-4"
          >
            {cover}
            <span className="relative font-log text-[0.62rem] uppercase tracking-cinema text-parchment/85 [text-shadow:0_2px_10px_rgba(3,11,15,0.95)]">
              Tap to play
            </span>
          </button>
        ) : (
          /* Reels only play on Instagram, so the whole card is the link out
             rather than a play button that quietly does something else. */
          <a
            href={reel.url}
            target="_blank"
            rel="noreferrer"
            data-cursor="WATCH"
            aria-label={`Watch the ${reel.kind.toLowerCase()} on Instagram`}
            className="group absolute inset-0 flex flex-col items-center justify-center gap-4"
          >
            {cover}
            <span className="relative flex items-center gap-2 font-log text-[0.6rem] uppercase tracking-cinema text-parchment/85 [text-shadow:0_2px_10px_rgba(3,11,15,0.95)]">
              <Icon name="Instagram" size={12} className="icon-caps shrink-0" />
              Watch on Instagram
            </span>
          </a>
        )}
      </div>

      <figcaption className="p-5">
        <div className="font-log text-[0.6rem] uppercase tracking-cinema text-gold/70">
          {reel.kind}
        </div>
        <h3 className="mt-1 font-display text-xl text-offwhite">{reel.title}</h3>
        <p className="mt-1.5 text-[0.85rem] leading-relaxed text-parchment/60">{reel.blurb}</p>
        {src && (
          <a
            href={reel.url}
            target="_blank"
            rel="noreferrer"
            /* `min-h-11`: the link's own line box is fifteen pixels tall, which
               is a target nobody hits with a thumb. */
            className="-my-1 mt-2 inline-flex min-h-11 items-center gap-2 font-log text-[0.62rem] uppercase tracking-wide2 text-parchment/45 transition-colors hover:text-gold-bright"
          >
            <Icon name="Instagram" size={12} className="icon-caps shrink-0" />
            Also on Instagram
          </a>
        )}
      </figcaption>
    </figure>
  )
}
