import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Route, Routes, useLocation } from 'react-router-dom'

import Cursor from './components/Cursor'
import Loader from './components/Loader'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import RegisterModal from './components/RegisterModal'
import VoyageProgress from './components/VoyageProgress'
import { ScrollManager } from './components/routing'
import Home from './pages/Home'
import Enter from './pages/Enter'
import Pass from './pages/Pass'
import SignIn from './pages/SignIn'

/**
 * The site is one long page plus three small account screens. Those three are
 * real routes rather than modals because they are linked to from email, and a
 * link has to land somewhere on its own.
 */
export default function App() {
  const [loaded, setLoaded] = useState(false)
  const { pathname } = useLocation()

  // The account screens are utilities, not part of the voyage — the branded
  // loading sequence would be noise in front of a sign-in link.
  const isAccountScreen = ['/enter', '/pass', '/sign-in'].includes(pathname)

  return (
    <>
      <Cursor />
      <AnimatePresence>
        {!loaded && !isAccountScreen && <Loader onDone={() => setLoaded(true)} />}
      </AnimatePresence>
      <ScrollManager />
      <VoyageProgress />
      <Navbar />

      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/enter" element={<Enter />} />
          <Route path="/pass" element={<Pass />} />
          <Route path="/sign-in" element={<SignIn />} />
          {/* Anything unrecognised is the fest, not a 404 page nobody wants. */}
          <Route path="*" element={<Home />} />
        </Routes>
      </main>

      <Footer />
      <RegisterModal />
    </>
  )
}
