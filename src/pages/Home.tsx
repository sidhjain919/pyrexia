import Hero from '../components/Hero'
import Legend from '../components/Legend'
import Reels from '../components/Reels'
import Stats from '../components/Stats'
import Harbour from '../components/Harbour'
import HeroActions from '../components/HeroActions'
import IslandMap from '../components/IslandMap'
import EventsGrid from '../components/EventsGrid'
import FeaturedEvents from '../components/FeaturedEvents'
import PhotoMarquee from '../components/PhotoMarquee'
import CaptainsLog from '../components/CaptainsLog'
import Artists from '../components/Artists'
import Gallery from '../components/Gallery'
import CTA from '../components/CTA'
import Navigator from '../components/Navigator'

/**
 * Single-page layout: every section lives here, in nav order, and the
 * navbar/footer link to these sections by id instead of routing elsewhere.
 */
export default function Home() {
  return (
    <>
      <Hero />
      {/* The secondary invitations the hero used to stack on top of itself. */}
      <HeroActions />

      {/* What this is, and how big. */}
      <Legend />
      <Stats />

      {/* What is on: the hook, the map, then the whole searchable list. */}
      <FeaturedEvents />
      <IslandMap />
      <EventsGrid />
      <PhotoMarquee />

      {/* When, and who. */}
      <CaptainsLog />
      <Artists />

      {/* What it looks like. The gallery is past editions and the teaser is
          this one, so they read in that order: that was then, here is what is
          coming. Renders nothing until a reel link is set in data/videos.ts. */}
      <Gallery />
      <Reels />

      {/* Only now the practical part. Nobody decides where to sleep before
          they have decided to come, which is why this used to sit too early. */}
      <Harbour />
      <CTA />
      <Navigator />
    </>
  )
}
