import Hero from '../components/Hero'
import Legend from '../components/Legend'
import Stats from '../components/Stats'
import IslandMap from '../components/IslandMap'
import FeaturedEvents from '../components/FeaturedEvents'
import PhotoMarquee from '../components/PhotoMarquee'
import CaptainsLog from '../components/CaptainsLog'
import Artists from '../components/Artists'
import Gallery from '../components/Gallery'
import Sponsors from '../components/Sponsors'
import CTA from '../components/CTA'
import Navigator from '../components/Navigator'

export default function Home() {
  return (
    <>
      <Hero />
      <Legend />
      <Stats />
      <IslandMap preview />
      <PhotoMarquee />
      <FeaturedEvents />
      <CaptainsLog preview />
      <Artists />
      <Gallery preview />
      <Sponsors preview />
      <CTA />
      <Navigator />
    </>
  )
}
