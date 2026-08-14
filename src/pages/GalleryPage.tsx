import PageHeader from '../components/PageHeader'
import Gallery from '../components/Gallery'
import { sectionPhoto } from '../data/media'

export default function GalleryPage() {
  return (
    <>
      <PageHeader
        eyebrow="Previous Voyages"
        title="Memories from the Sea"
        kicker="Real frames from past editions of PYREXIA at AIIMS Rishikesh — the fever, the crews, the roar."
        photo={sectionPhoto.legend[1]}
      />
      <Gallery />
    </>
  )
}
