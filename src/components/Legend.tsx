import { Reveal, SectionTitle } from './primitives'
import WaxSeal from './WaxSeal'
import { art } from '../lib/art'
import { SITE } from '../data/site'
import { sectionPhoto } from '../data/media'

const chapters = [
  {
    n: 'I',
    title: 'The Call',
    body: 'Every October, a signal rises from AIIMS Rishikesh: five days of fever, from the 12th to the 16th, calling students from across India to the hills of the Ganga.',
  },
  {
    n: 'II',
    title: 'The Voyage',
    body: 'For its sixth edition, PYREXIA sets sail as Pirates of the Lost Island, a socio-cultural and sports odyssey through music, dance, drama, art, sport and lore.',
  },
  {
    n: 'III',
    title: 'The Island',
    body: 'Eleven territories rise from the mist. Rhythm Reef, Conquest Arena, Ink & Lore Lagoon. Each one a world of its own to be discovered.',
  },
  {
    n: 'IV',
    title: 'The Challenge',
    body: 'Crews compete for glory across 60+ events: high-energy showdowns by day, comedy and theatre by dusk, the arena roaring till night.',
  },
  {
    n: 'V',
    title: 'The Treasure',
    body: 'And then the summit: the Pro Nights. The island saves its brightest for last, and keeps its promise. Feel the fever.',
  },
]

export default function Legend() {
  return (
    <section id="legend" className="relative overflow-hidden py-14 sm:py-18 lg:py-24">
      <div className="map-grid pointer-events-none absolute inset-0 opacity-30" />
      {/* atmospheric photography */}
      <img
        src={sectionPhoto.legend[1]}
        alt=""
        className="pointer-events-none absolute right-0 top-0 h-full w-2/3 object-cover opacity-[0.1]"
        style={{ maskImage: 'linear-gradient(to left, black, transparent 70%)', WebkitMaskImage: 'linear-gradient(to left, black, transparent 70%)' }}
      />
      {/* gold horizon line */}
      <div className="rule-gold absolute inset-x-0 top-0" />

      <div className="relative mx-auto max-w-6xl px-6">
        <SectionTitle
          index="01"
          eyebrow="About PYREXIA"
          title="The Legend"
          kicker={`${SITE.institutionFull} · the annual socio-cultural & sports fest, now in its sixth voyage.`}
        />

        <div className="mt-12 grid items-start gap-10 sm:mt-16 lg:grid-cols-[0.92fr_1.08fr] lg:gap-14">
          {/* Parchment intro card */}
          <Reveal>
            {/* A photographed sheet rather than a gradient with a clipped edge. The
                torn border, the foxing and the crease are in the image, so the
                card is one element instead of a stack of fakes. */}
            <div
              className="relative px-9 py-10 sm:px-12 sm:py-12"
              style={{
                backgroundImage: `url(${art.parchment})`,
                // Stretched rather than cropped: the torn edge is the frame, so
                // it has to meet the box exactly however tall the copy runs.
                backgroundSize: '100% 100%',
                backgroundRepeat: 'no-repeat',
                filter: 'drop-shadow(0 18px 40px rgba(0,0,0,0.55))',
              }}
            >
              <div className="font-log text-[0.6rem] uppercase tracking-cinema text-wood/60">
                From the Captain's Log
              </div>
              <p className="mt-4 font-display text-2xl leading-snug text-wood sm:text-[1.7rem]">
                “The fever returns. The most epic edition yet.”
              </p>
              <p className="mt-5 text-[0.95rem] leading-relaxed text-wood/80">
                Five days packed with everything you can dream of: dance, music, drama, sports,
                art, literary battles, informal games, Mr.&nbsp;&amp; Ms.&nbsp;PYREXIA, and the much-awaited
                pro nights. From high-energy competitions to crazy fun nights, there's something for
                every voyager.
              </p>
              <p className="mt-4 text-[0.95rem] leading-relaxed text-wood/80">
                Set on the banks of the Ganga in mystic Rishikesh, PYREXIA is one of India's biggest
                medical fests. Are you ready to feel the fever?
              </p>
              <div className="mt-6 flex items-center gap-3">
                <WaxSeal size={54} />
                <span className="font-log text-[0.7rem] uppercase tracking-wide2 text-wood/70">
                  {SITE.dates} · Rishikesh
                </span>
              </div>
            </div>

            {/* The dates, under the card rather than across the foot of the
                section. The chapters opposite run a couple of hundred pixels
                longer than the parchment, and that difference was showing as
                dead space under the card. */}
            <div className="mt-8 flex flex-col items-center gap-3 text-center">
              <span className="rule-gold w-full max-w-sm" />
              <div className="font-log text-[0.6rem] uppercase tracking-cinema text-gold/70">
                Mark the chart
              </div>
              <div className="font-display text-3xl leading-none text-foil sm:text-4xl">
                {SITE.dates}
              </div>
              <div className="font-log text-[0.62rem] uppercase tracking-wide2 text-parchment/60">
                Five days · {SITE.institution} · {SITE.edition}
              </div>
              <span className="rule-gold w-full max-w-sm" />
            </div>
          </Reveal>

          {/* Chapters route: line runs through the circle centres, ending at V */}
          <div className="relative">
            <ul>
              {chapters.map((c, i) => {
                const last = i === chapters.length - 1
                return (
                  <Reveal as="li" key={c.n} delay={i * 0.08} className="flex gap-5">
                    <div className="flex flex-col items-center">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gold/50 bg-ocean font-display text-xs text-gold-bright">
                        {c.n}
                      </span>
                      {!last && <span className="mt-1.5 w-px flex-1 bg-gradient-to-b from-gold/50 to-gold/10" />}
                    </div>
                    <div className={last ? 'pb-1' : 'pb-9'}>
                      <h3 className="font-display text-xl text-offwhite">{c.title}</h3>
                      <p className="mt-1.5 max-w-md text-[0.92rem] leading-relaxed text-parchment/65">
                        {c.body}
                      </p>
                    </div>
                  </Reveal>
                )
              })}
            </ul>
          </div>
        </div>

      </div>
    </section>
  )
}
