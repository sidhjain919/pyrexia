import PageHeader from '../components/PageHeader'
import Artists from '../components/Artists'
import { sectionPhoto } from '../data/media'

export default function ArtistsPage() {
  return (
    <>
      <PageHeader
        eyebrow="The Crew · Legends"
        title="Starlight Summit"
        kicker="The peak of every voyage. The legends who have lit the PYREXIA sky — and the names still charted in secret."
        photo={sectionPhoto.artistsHero}
      />
      <Artists />
    </>
  )
}
