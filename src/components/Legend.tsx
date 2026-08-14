import { Reveal, SectionTitle } from './primitives'
import { LEGEND_META, SITE } from '../data/site'
import { Coin, Chest } from './art'

const chapters = [
  { n: '1', title: 'The Call', body: 'Every October a signal rises from AIIMS Rishikesh — a week-long fever that calls students from across India to the hills of the Ganga.' },
  { n: '2', title: 'The Voyage', body: 'For its sixth edition, PYREXIA sets sail as Pirates of the Lost Island — an odyssey of music, dance, drama, art, sport and lore.' },
  { n: '3', title: 'The Island', body: 'Eleven territories rise from the sea. Rhythm Reef, Conquest Arena, Ink & Lore Lagoon — each a world to discover.' },
  { n: '4', title: 'The Challenge', body: 'Crews compete for glory across 60+ events — high-energy showdowns by day, comedy and theatre by dusk.' },
  { n: '5', title: 'The Treasure', body: 'And then the summit — the Star Nights. The biggest names light up the sky, and the island keeps its promise.' },
]

export default function Legend() {
  return (
    <section id="legend" className="relative overflow-hidden bg-cream py-16 sm:py-24">
      <div className="map-dots pointer-events-none absolute inset-0 opacity-60" />
      <div className="relative mx-auto max-w-6xl px-6">
        <SectionTitle index="01" eyebrow="The Legend" title="The Story So Far" color="var(--color-sea-deep)"
          kicker={`${SITE.institutionFull} — the annual socio-cultural & sports fest, now on its sixth voyage.`} />

        <div className="mt-14 grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
          {/* Parchment scroll */}
          <Reveal>
            <div className="parchment sticker-lg relative rounded-3xl p-8 sm:p-9" style={{ rotate: '-1.2deg' }}>
              <div className="font-hand text-2xl text-red">From the Captain's Log…</div>
              <p className="mt-3 font-display text-2xl leading-tight text-ink sm:text-3xl">“The fever returns — the most epic edition yet!”</p>
              <p className="mt-4 font-fun text-[1.02rem] leading-relaxed text-ink/80">
                A full week packed with dance, music, drama, sports, art, literary battles, informal games,
                Mr.&nbsp;&amp; Ms.&nbsp;PYREXIA, and the much-awaited star nights. Something for every voyager.
              </p>
              <p className="mt-3 font-fun text-[1.02rem] leading-relaxed text-ink/80">
                Set on the banks of the Ganga in mystic Rishikesh — one of India's biggest medical fests.
                Ready to feel the fever?
              </p>
              <div className="mt-5 flex items-center gap-3">
                <Coin size={30} />
                <span className="font-hand text-xl text-ink/70">{SITE.window} · Rishikesh</span>
              </div>
              <div className="absolute -bottom-6 -right-4 anim-bob"><Chest size={110} /></div>
            </div>
          </Reveal>

          {/* Route */}
          <div className="relative">
            <ul className="space-y-6">
              {chapters.map((c, i) => (
                <Reveal as="li" key={c.n} delay={i * 0.07} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span className="sticker-sm flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sun font-display text-lg text-ink">{c.n}</span>
                    {i < chapters.length - 1 && <span className="my-1 w-1 flex-1 rounded-full" style={{ background: 'repeating-linear-gradient(180deg,#2a2018 0 6px,transparent 6px 13px)' }} />}
                  </div>
                  <div className="pb-2">
                    <h3 className="font-display text-2xl text-sea-deep">{c.title}</h3>
                    <p className="mt-1 max-w-md font-fun text-[1rem] leading-relaxed text-ink/75">{c.body}</p>
                  </div>
                </Reveal>
              ))}
            </ul>
          </div>
        </div>

        <Reveal delay={0.1}>
          <div className="mt-14 flex flex-wrap gap-2.5">
            {LEGEND_META.map((m, i) => (
              <span key={m} className={`sticker-sm rounded-full px-4 py-2 font-fun text-sm font-bold text-ink ${['bg-aqua-light', 'bg-sun', 'bg-peach', 'bg-foam'][i % 4]}`}>{m}</span>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
