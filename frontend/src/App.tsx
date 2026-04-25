import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'

// Pages (lazy-loaded for performance)
import { lazy, Suspense } from 'react'

const LandingPage       = lazy(() => import('@/pages/LandingPage'))
const LoginPage         = lazy(() => import('@/pages/LoginPage'))
const RegisterPage      = lazy(() => import('@/pages/RegisterPage'))
const QuestionnairePage = lazy(() => import('@/pages/QuestionnairePage'))
const ProfileResultPage = lazy(() => import('@/pages/ProfileResultPage'))
const DashboardPage     = lazy(() => import('@/pages/DashboardPage'))
const AssetDetailPage   = lazy(() => import('@/pages/AssetDetailPage'))
const ComparePage       = lazy(() => import('@/pages/ComparePage'))
const AdminPage         = lazy(() => import('@/pages/AdminPage'))
const NotFoundPage      = lazy(() => import('@/pages/NotFoundPage'))
const VerifyEmailPage   = lazy(() => import('@/pages/VerifyEmailPage'))
const MarketPoolPage    = lazy(() => import('@/pages/MarketPoolPage'))   // ← NEW

// ─── Guards ───────────────────────────────────────────────────────────────────

/** Redirects unauthenticated users to /login */
function PrivateRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return <PageLoader />
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />
}

/** Redirects already-authenticated users away from auth pages */
function GuestRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return <PageLoader />
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Outlet />
}

/** Redirects non-admin users */
function AdminRoute() {
  const { isAuthenticated, isLoading, user } = useAuth()
  if (isLoading) return <PageLoader />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.role !== 'admin') return <Navigate to="/dashboard" replace />
  return <Outlet />
}

// ─── Loading fallback ─────────────────────────────────────────────────────────

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-fw-900">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-fw-gold border-t-transparent rounded-full animate-spin" />
        <p className="text-fw-600 text-sm font-sans">Loading...</p>
      </div>
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />

            {/* Guest only (redirect to dashboard if logged in) */}
            <Route element={<GuestRoute />}>
              <Route path="/login"    element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
            </Route>

            {/* Protected (login required) */}
            <Route element={<PrivateRoute />}>
              <Route path="/questionnaire"      element={<QuestionnairePage />} />
              <Route path="/profile/result"     element={<ProfileResultPage />} />
              <Route path="/dashboard"          element={<DashboardPage />} />
              <Route path="/instrument/:ticker" element={<AssetDetailPage />} />
              <Route path="/compare"            element={<ComparePage />} />
              <Route path="/pool"               element={<MarketPoolPage />} />  {/* ← NEW */}
            </Route>

            {/* Admin only */}
            <Route element={<AdminRoute />}>
              <Route path="/admin" element={<AdminPage />} />
            </Route>

            {/* 404 */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}
