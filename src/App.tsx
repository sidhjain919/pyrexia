import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Routes, Route, useLocation } from 'react-router-dom'
import Cursor from './components/Cursor'
import Loader from './components/Loader'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import RegisterModal from './components/RegisterModal'
import { ScrollManager } from './components/routing'
import Home from './pages/Home'
import EventsPage from './pages/EventsPage'
import SchedulePage from './pages/SchedulePage'
import ArtistsPage from './pages/ArtistsPage'
import GalleryPage from './pages/GalleryPage'
import SponsorsPage from './pages/SponsorsPage'
import RegisterPage from './pages/RegisterPage'

export default function App() {
  const [loaded, setLoaded] = useState(false)
  const location = useLocation()
  const reduce = useReducedMotion()

  return (
    <>
      <Cursor />
      <AnimatePresence>{!loaded && <Loader onDone={() => setLoaded(true)} />}</AnimatePresence>
      <ScrollManager />
      <Navbar />

      <AnimatePresence mode="wait">
        <motion.main
          key={location.pathname}
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: -8 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <Routes location={location}>
            <Route path="/" element={<Home />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/artists" element={<ArtistsPage />} />
            <Route path="/gallery" element={<GalleryPage />} />
            <Route path="/sponsors" element={<SponsorsPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </motion.main>
      </AnimatePresence>

      <Footer />
      <RegisterModal />
    </>
  )
}
