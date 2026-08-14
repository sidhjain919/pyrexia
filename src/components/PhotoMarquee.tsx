import { asset } from '../lib/asset'

const pic = (n: number) => asset(`photos/p${String(n).padStart(2, '0')}.jpg`)
const rowA = [1, 39, 18, 27, 32, 45, 12, 9].map(pic)
const rowB = [24, 37, 28, 43, 15, 5, 26, 41].map(pic)

function Row({ items, reverse = false }: { items: string[]; reverse?: boolean }) {
  const loop = [...items, ...items]
  return (
    <div className={`flex w-max gap-3 ${reverse ? 'marquee-rev' : 'marquee'}`}>
      {loop.map((src, i) => (
        <div key={i} className="sticker-sm h-28 w-44 shrink-0 overflow-hidden rounded-2xl bg-cream sm:h-32 sm:w-52" style={{ rotate: `${(i % 3) - 1}deg` }}>
          <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
        </div>
      ))}
    </div>
  )
}

export default function PhotoMarquee() {
  return (
    <section className="relative overflow-hidden bg-aqua py-6" aria-hidden>
      <div className="map-dots pointer-events-none absolute inset-0 opacity-20" />
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-aqua to-transparent sm:w-28" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-aqua to-transparent sm:w-28" />
      <div className="relative flex flex-col gap-3">
        <Row items={rowA} />
        <Row items={rowB} reverse />
      </div>
    </section>
  )
}
