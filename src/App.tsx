import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import Cursor from './components/Cursor'
import Loader from './components/Loader'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import RegisterModal from './components/RegisterModal'
import { ScrollManager } from './components/routing'
import Home from './pages/Home'

/** Single-page site — everything lives on Home; the navbar scroll-links to sections. */
export default function App() {
  const [loaded, setLoaded] = useState(false)

  return (
    <>
      <Cursor />
      <AnimatePresence>{!loaded && <Loader onDone={() => setLoaded(true)} />}</AnimatePresence>
      <ScrollManager />
      <Navbar />

      <main>
        <Home />
      </main>

      <Footer />
      <RegisterModal />
    </>
  )
}
