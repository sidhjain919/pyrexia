import Hero from '../components/Hero'
import Legend from '../components/Legend'
import Stats from '../components/Stats'
import IslandMap from '../components/IslandMap'
import EventsGrid from '../components/EventsGrid'
import FeaturedEvents from '../components/FeaturedEvents'
import PhotoMarquee from '../components/PhotoMarquee'
import CaptainsLog from '../components/CaptainsLog'
import Artists from '../components/Artists'
import Gallery from '../components/Gallery'
import Sponsors from '../components/Sponsors'
import CTA from '../components/CTA'
import Navigator from '../components/Navigator'

/**
 * Single-page layout — every section lives here, in nav order, and the
 * navbar/footer link to these sections by id instead of routing elsewhere.
 */
export default function Home() {
  return (
    <>
      <Hero />
      <Legend />
      <Stats />
      <FeaturedEvents />
      <IslandMap />
      <EventsGrid />
      <PhotoMarquee />
      <CaptainsLog />
      <Artists />
      <Gallery />
      <Sponsors />
      <CTA />
      <Navigator />
    </>
  )
}
