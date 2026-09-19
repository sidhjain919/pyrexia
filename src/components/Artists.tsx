import { pastLegends, proNights, type ProNight } from '../data/artists'
import { Reveal, SectionTitle } from './primitives'
import { Star, Lock, Music2 } from 'lucide-react'
import { asset } from '../lib/asset'
import { SITE } from '../data/site'

/**
 * Starlight Summit: the Pro Nights lineup.
 *
 * Announced nights get a full portrait card, because a headliner is the one
 * thing on this page somebody screenshots and sends to a friend. Unannounced
 * ones keep the locked slot they had, at a smaller size, so the row reads as
 * "three of five revealed" rather than five equal placeholders.
 */
export default function Artists() {
  const announced = proNights.filter((n) => n.artist)
  const locked = proNights.filter((n) => !n.artist)

  return (
    <section id="artists" className="relative overflow-hidden py-14 sm:py-18 lg:py-24">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(70% 50% at 50% 0%, rgba(230,194,94,0.08), transparent 60%)' }}
      />
      <div className="relative mx-auto max-w-6xl px-6">
        <SectionTitle
          index="05"
          eyebrow="Auriga · The Pro Nights"
          title="Starlight Summit"
          meaning="Lineup"
          kicker={`Five nights on the island, ${SITE.dates}. Three names are out. Two are still charted in secret.`}
        />

        {/* the announced headliners */}
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {announced.map((n, i) => (
            <Reveal key={n.label} delay={i * 0.09}>
              <HeadlinerCard night={n} />
            </Reveal>
          ))}
        </div>

        {/* still under wraps */}
        <Reveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {locked.map((n) => (
              <div
                key={n.label}
                className="glass group relative flex items-center gap-4 overflow-hidden rounded-xl px-5 py-4"
              >
                <div className="absolute inset-0 map-grid opacity-25" />
                <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold/10 ring-1 ring-inset ring-gold/30">
                  <Lock size={16} className="text-gold/70 transition-transform group-hover:-translate-y-0.5" />
                </div>
                <div className="relative min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2.5">
                    <span className="font-display text-lg leading-none text-offwhite">{n.label}</span>
                    <span className="font-log text-[0.62rem] uppercase tracking-cinema text-gold-bright">
                      {n.date} 2026
                    </span>
                  </div>
                  <p className="mt-1.5 font-log text-[0.58rem] uppercase leading-relaxed tracking-wide2 text-parchment/60">
                    {n.hint}
                  </p>
                </div>
                <span className="relative ml-auto shrink-0 rounded-full bg-gold/10 px-3 py-1 font-log text-[0.6rem] uppercase tracking-wide2 text-gold-bright">
                  Reveal soon
                </span>
              </div>
            ))}
          </div>
        </Reveal>

        {/* past legends */}
        <Reveal>
          <div className="mt-16 flex items-center gap-3 font-log text-[0.62rem] uppercase tracking-cinema text-gold/70">
            <Star size={12} />
            A glimpse of past voyages · Auriga lineups
          </div>
        </Reveal>

        {/* Eight cards: two even rows of four from `sm` up (and 2×4 on a
            phone), so the block fills its width instead of leaving four empty
            slots on a six-column row. */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {pastLegends.map((a, i) => (
            <Reveal key={a.name} delay={i * 0.05}>
              <div className="group relative aspect-[3/4] overflow-hidden rounded-lg border border-gold/15">
                {/* star-night frame, where there is one */}
                {a.photo ? (
                  <img
                    src={asset(a.photo)}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover object-[50%_32%] transition-transform duration-700 group-hover:scale-110"
                  />
                ) : (
                  <div
                    aria-hidden
                    className="absolute inset-0"
                    style={{ background: `radial-gradient(120% 90% at 50% 15%, ${a.accent}3d, #071820 70%)` }}
                  />
                )}
                <div
                  className="absolute inset-0"
                  style={{ background: `linear-gradient(to top, #030b0f 8%, rgba(3,11,15,0.35) 45%, ${a.accent}22 100%)` }}
                />
                {/* grain + gold outline on hover */}
                <div className="grain absolute inset-0" />
                <div className="absolute inset-0 ring-1 ring-inset ring-transparent transition-all duration-500 group-hover:ring-gold/85" />
                {/* monogram seal */}
                <span
                  className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full font-deco text-[0.62rem] backdrop-blur"
                  style={{ background: `${a.accent}2e`, border: `1px solid ${a.accent}66`, color: '#f4efe3' }}
                >
                  {a.mono}
                </span>
                {/* info */}
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <div className="font-display text-sm leading-tight text-offwhite">{a.name}</div>
                  <div className="mt-0.5 font-log text-[0.7rem] uppercase tracking-wide2 text-parchment/70">
                    {a.year ? `${a.role} · ${a.year}` : a.role}
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/**
 * One announced night.
 *
 * The portrait is the card: name and hook sit on the photograph, and the
 * detail (who they are, what you'd recognise) sits under it where it can be
 * read without fighting the image for contrast.
 */
function HeadlinerCard({ night }: { night: ProNight }) {
  const a = night.artist!
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-gold/18 bg-navy/55 transition-colors duration-500 hover:border-gold/60">
      <div className="relative aspect-[3/4] overflow-hidden">
        <img
          src={asset(a.photo)}
          alt={a.name}
          loading="lazy"
          style={{ objectPosition: a.focus }}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-[900ms] group-hover:scale-[1.06]"
        />
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to top, #030b0f 4%, rgba(3,11,15,0.72) 32%, rgba(3,11,15,0.05) 62%, ${night.accent}26 100%)`,
          }}
        />
        <div className="grain absolute inset-0" />

        {/* the date, top-left, so five cards can be scanned by night */}
        <span className="absolute left-3 top-3 rounded-full bg-abyss/70 px-3 py-1 font-log text-[0.6rem] uppercase tracking-wide2 text-gold-bright backdrop-blur">
          {night.label} · {night.date}
        </span>
        <span
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full font-deco text-[0.64rem] backdrop-blur"
          style={{ background: `${night.accent}33`, border: `1px solid ${night.accent}70`, color: '#f4efe3' }}
        >
          {a.mono}
        </span>

        {/* name + hook, on the photograph */}
        <div className="absolute inset-x-0 bottom-0 p-4">
          <h3 className="font-display text-2xl leading-none text-offwhite drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)]">
            {a.name}
          </h3>
          <p className="mt-1.5 font-log text-[0.62rem] uppercase tracking-wide2 text-gold-bright">
            {a.role}
          </p>
          <p className="mt-2 font-display text-[1.02rem] italic leading-snug text-foil">
            “{a.tagline}”
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4 pt-3.5">
        <p className="text-[0.84rem] leading-relaxed text-parchment/70">{a.blurb}</p>
        <div className="mt-3.5 flex items-start gap-2 border-t border-gold/12 pt-3.5">
          <Music2 size={13} className="mt-0.5 shrink-0 text-gold/70" />
          <p className="text-[0.78rem] leading-relaxed text-parchment/55">
            {a.known.join(' · ')}
          </p>
        </div>
      </div>
    </article>
  )
}
