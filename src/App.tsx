import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import TopBar from './components/TopBar'
import StockPage from './pages/StockPage'
import TierPage from './pages/TierPage'

export default function App() {
  const { pathname } = useLocation()

  // Each tab should start at the top rather than inheriting the last scroll.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="app">
      <TopBar />
      <main className="page">
        <Routes>
          <Route path="/" element={<Navigate to="/tiers" replace />} />
          <Route path="/tiers" element={<TierPage />} />
          <Route path="/stock" element={<StockPage />} />
          <Route path="/events" element={<Navigate to="/tiers" replace />} />
          <Route path="/news" element={<Navigate to="/tiers" replace />} />
          <Route path="/more" element={<Navigate to="/tiers" replace />} />
          <Route path="/more/places" element={<Navigate to="/tiers" replace />} />
          <Route path="/more/community" element={<Navigate to="/tiers" replace />} />
          <Route path="*" element={<Navigate to="/tiers" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  )
}
