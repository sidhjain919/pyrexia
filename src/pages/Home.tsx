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
      <Legend />
      {/* Renders nothing until a reel link is set in src/data/videos.ts. */}
      <Reels />
      <Stats />
      {/* Before the events, not after: beds are limited and first come, first
          served, so somebody who scrolls only this far has still seen it. */}
      <Harbour />
      <FeaturedEvents />
      <IslandMap />
      <EventsGrid />
      <PhotoMarquee />
      <CaptainsLog />
      <Artists />
      <Gallery />
      <CTA />
      <Navigator />
    </>
  )
}
