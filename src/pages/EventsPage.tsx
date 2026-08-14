import PageHeader from '../components/PageHeader'
import IslandMap from '../components/IslandMap'
import EventsGrid from '../components/EventsGrid'
import { sectionPhoto } from '../data/media'

export default function EventsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Explore the Island"
        title="Territories & Events"
        kicker="Eleven territories. Sixty-plus battles. Chart the map, then claim your spot in the events that call to you."
        photo={sectionPhoto.eventsHero}
      />
      <IslandMap />
      <EventsGrid />
    </>
  )
}
