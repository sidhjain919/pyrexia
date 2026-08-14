import PageHeader from '../components/PageHeader'
import Sponsors from '../components/Sponsors'
import Navigator from '../components/Navigator'
import { sectionPhoto } from '../data/media'

export default function SponsorsPage() {
  return (
    <>
      <PageHeader
        eyebrow="The Trading Ports"
        title="Allies of the Voyage"
        kicker="No island is conquered alone. Our partners power the fever — the wind in our sails."
        photo={sectionPhoto.sponsorsHero}
      />
      <Sponsors />
      <Navigator />
    </>
  )
}
