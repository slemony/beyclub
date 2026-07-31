import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import TopBar from './components/TopBar'
import CommunityPage from './pages/CommunityPage'
import EventsPage from './pages/EventsPage'
import MorePage from './pages/MorePage'
import NewsPage from './pages/NewsPage'
import PlacesPage from './pages/PlacesPage'
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
          <Route path="/events" element={<EventsPage />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/more" element={<MorePage />} />
          <Route path="/more/places" element={<PlacesPage />} />
          <Route path="/more/community" element={<CommunityPage />} />
          <Route path="*" element={<Navigate to="/tiers" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  )
}
