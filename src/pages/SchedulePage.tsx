import PageHeader from '../components/PageHeader'
import CaptainsLog from '../components/CaptainsLog'
import { sectionPhoto } from '../data/media'

export default function SchedulePage() {
  return (
    <>
      <PageHeader
        eyebrow="The Schedule"
        title="Captain's Log"
        kicker="Five days on the island, charted hour by hour — an indicative voyage plan for October 2026."
        photo={sectionPhoto.scheduleHero}
      />
      <CaptainsLog />
    </>
  )
}
