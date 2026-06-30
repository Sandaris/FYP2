import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import AppShell from '@/components/layout/AppShell.jsx'
import { ChromeProvider } from '@/components/layout/ChromeContext.jsx'
import TransactionMapPage from '@/pages/TransactionMapPage.jsx'
import MarketOverviewPage from '@/pages/MarketOverviewPage.jsx'
import RoiCalculator from '@/pages/RoiCalculator.jsx'
import SentimentPage from '@/pages/SentimentPage.jsx'

function LandingRedirect() {
  return <Navigate to="/dashboard" replace />
}

function RoiPage() {
  const { state } = useLocation()
  return <RoiCalculator seed={state?.seed} />
}

function DashboardRoutes() {
  return (
    <ChromeProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<TransactionMapPage />} />
          <Route path="market" element={<MarketOverviewPage />} />
          <Route path="roi" element={<RoiPage />} />
          <Route path="sentiment" element={<SentimentPage />} />
        </Route>
      </Routes>
    </ChromeProvider>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingRedirect />} />
      <Route path="/dashboard/*" element={<DashboardRoutes />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
