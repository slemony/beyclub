import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import SyncArrivalDialog from './components/SyncArrivalDialog'
import TopBar from './components/TopBar'
import { useAuthUser } from './lib/auth'
import { useScrollMemory } from './lib/useScrollMemory'
import { startSync, stopSync } from './lib/userSync'
import BuildsPage from './pages/BuildsPage'
import CollectionPage from './pages/CollectionPage'
import StockPage from './pages/StockPage'
import TierPage from './pages/TierPage'

export default function App() {
  // Each tab comes back where the reader left it; reopening the current tab
  // starts from the top.
  useScrollMemory()

  // Collection, builds and decks all sync through one document, so the sync
  // belongs to the session rather than to whichever page is open. Started
  // here it survives navigation: reading the tier list no longer tears down
  // the listener, and a build edited a moment before switching tabs still
  // reaches the cloud.
  const user = useAuthUser()
  useEffect(() => {
    if (!user) {
      void stopSync()
      return
    }
    void startSync(user)
    return () => void stopSync()
  }, [user])

  return (
    <div className="app">
      <TopBar />
      <main className="page">
        <Routes>
          <Route path="/" element={<Navigate to="/tiers" replace />} />
          <Route path="/tiers" element={<TierPage />} />
          <Route path="/stock" element={<StockPage />} />
          <Route path="/collection" element={<CollectionPage />} />
          <Route path="/builds" element={<BuildsPage />} />
          <Route path="/events" element={<Navigate to="/tiers" replace />} />
          <Route path="/news" element={<Navigate to="/tiers" replace />} />
          <Route path="/more" element={<Navigate to="/tiers" replace />} />
          <Route path="/more/places" element={<Navigate to="/tiers" replace />} />
          <Route path="/more/community" element={<Navigate to="/tiers" replace />} />
          <Route path="*" element={<Navigate to="/tiers" replace />} />
        </Routes>
      </main>
      <BottomNav />
      <SyncArrivalDialog />
    </div>
  )
}
