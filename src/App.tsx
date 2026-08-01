import { Navigate, Route, Routes } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import TopBar from './components/TopBar'
import { useScrollMemory } from './lib/useScrollMemory'
import StockPage from './pages/StockPage'
import TierPage from './pages/TierPage'

export default function App() {
  // Each tab comes back where the reader left it; reopening the current tab
  // starts from the top.
  useScrollMemory()

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
