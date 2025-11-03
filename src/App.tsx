/**
 * Egumeni Eats - Progressive Web Application
 * Version 2.0 - Payment integrations removed
 * University of Mpumalanga Food Ordering System
 */
import React, { useEffect, useState, Suspense, lazy } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Login from './components/Login'
import LandingPage from './components/LandingPage'
import { Toaster } from './components/ui/sonner'
import { RefreshCw } from 'lucide-react'
import { Button } from './components/ui/button'
import { ErrorBoundary } from './components/ErrorBoundary'
import './utils/checkUser' // Import user checking utilities for console debugging

// Lazy load dashboard components for better performance
const CustomerDashboard = lazy(() => import('./components/CustomerDashboard'))
const AdminDashboard = lazy(() => import('./components/AdminDashboard'))
const KitchenDashboard = lazy(() => import('./components/KitchenDashboard'))
const DeliveryDashboard = lazy(() => import('./components/DeliveryDashboard'))
const CashierDashboard = lazy(() => import('./components/CashierDashboard'))
const StoresDashboard = lazy(() => import('./components/StoresDashboard'))

// University of Mpumalanga branded loading component
const AppLoader = ({ message = "Loading..." }) => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-ump-blue-50 via-ump-blue-100 to-ump-blue-200">
    <div className="text-center backdrop-blur-sm bg-white/90 rounded-3xl p-12 border border-ump-blue/20 shadow-2xl">
      <div className="w-20 h-20 border-4 border-ump-navy border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
      <h2 className="text-3xl font-bold text-ump-navy mb-3">Egumeni Eats</h2>
      <p className="text-xl text-ump-navy mb-2">Tfokomala Hotel</p>
      <p className="text-ump-gray">{message}</p>
      
      {/* UMP Brand Color Indicators */}
      <div className="flex justify-center space-x-3 mt-8">
        <div className="w-3 h-3 bg-ump-orange rounded-full animate-pulse"></div>
        <div className="w-3 h-3 bg-ump-navy rounded-full animate-pulse delay-100"></div>
        <div className="w-3 h-3 bg-ump-red rounded-full animate-pulse delay-200"></div>
        <div className="w-3 h-3 bg-ump-navy rounded-full animate-pulse delay-300"></div>
      </div>
    </div>
  </div>
)

// Role-specific dashboard loader with UMP branding
type UserRole = 'admin' | 'supervisor' | 'kitchen' | 'delivery' | 'cashier' | 'stores' | 'customer'

interface DashboardLoaderProps {
  role: UserRole
}

const DashboardLoader: React.FC<DashboardLoaderProps> = ({ role }) => {
  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case 'admin': case 'supervisor': return 'ump-orange'
      case 'kitchen': return 'ump-green'
      case 'delivery': case 'cashier': return 'ump-blue'
      case 'stores': return 'ump-navy'
      default: return 'ump-blue'
    }
  }

  const roleColor = getRoleColor(role)

  return (
    <div className={`min-h-screen flex items-center justify-center bg-gradient-to-br from-${roleColor}/10 via-ump-blue/5 to-ump-blue/10`}>
      <div className="text-center backdrop-blur-sm bg-white/95 rounded-3xl p-12 border border-ump-blue/20 shadow-2xl">
        <div className={`w-24 h-24 border-4 border-${roleColor} border-t-transparent rounded-full animate-spin mx-auto mb-8`}></div>
        <h2 className="text-3xl font-bold text-ump-navy mb-4 capitalize">
          {role} Dashboard
        </h2>
        <p className="text-xl text-ump-navy mb-2">
          Tfokomala Hotel
        </p>
        <p className="text-ump-gray">
          Preparing your workspace...
        </p>
        
        {/* Role-specific emojis */}
        <div className="mt-8 text-4xl">
          {role === 'kitchen' && <span className="animate-bounce">👨‍🍳</span>}
          {role === 'customer' && <span className="animate-bounce">🍽️</span>}
          {(role === 'admin' || role === 'supervisor') && <span className="animate-bounce">📊</span>}
          {role === 'delivery' && <span className="animate-bounce">🚚</span>}
          {role === 'cashier' && <span className="animate-bounce">💳</span>}
          {role === 'stores' && <span className="animate-bounce">📦</span>}
        </div>
      </div>
    </div>
  )
}

// Profile error with UMP branding
const ProfileError = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-ump-red/10 via-ump-orange/10 to-ump-blue/10">
    <div className="text-center backdrop-blur-sm bg-white/95 rounded-3xl p-10 shadow-2xl border border-ump-red/20 max-w-md">
      <div className="w-20 h-20 bg-ump-red/10 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-ump-red/30">
        <span className="text-4xl">⚠️</span>
      </div>
      <h2 className="text-2xl font-bold mb-4 text-ump-red">Profile Error</h2>
      <p className="text-ump-gray mb-8 leading-relaxed">
        Your user profile is incomplete. Please try logging in again.
      </p>
      <Button 
        onClick={() => window.location.reload()} 
        className="bg-ump-navy hover:bg-ump-navy/90 text-white px-8 py-3 rounded-full shadow-lg transition-all duration-200 hover:shadow-xl transform hover:-translate-y-1"
      >
        <RefreshCw className="w-5 h-5 mr-2" />
        Reload Application
      </Button>
    </div>
  </div>
)

function App() {
  const { user, profile, loading } = useAuth()
  const [appInitialized, setAppInitialized] = useState(false)

  // Initialize the app and sample data
  useEffect(() => {
    const initializeApp = async () => {
      try {

        console.log('✅ Egumeni Eats initialized')
        setAppInitialized(true)
      } catch (error) {
        console.error('Failed to initialize app:', error)
        setAppInitialized(true) // Continue anyway
      }
    }

    initializeApp()
  }, [])

  // Show loading screen while initializing
  if (loading || !appInitialized) {
    return <AppLoader message="Initializing Egumeni Eats..." />
  }

  // Route based on authentication state
  // If no user at all, show landing page
  if (!user) {
    // Check if user clicked a login link (simple URL-based routing)
    const currentPath = window.location.pathname
    if (currentPath === '/login') {
      return <Login />
    }
    return <LandingPage />
  }

  // If user exists but no profile, show login to complete profile setup
  if (!profile) {
    return <Login />
  }

  // Validate profile
  if (!profile.role || typeof profile.role !== 'string' || !['admin', 'supervisor', 'kitchen', 'delivery', 'cashier', 'stores', 'customer'].includes(profile.role)) {
    return <ProfileError />
  }

  // Route to appropriate dashboard
  const getDashboardComponent = () => {
    switch (profile.role) {
      case 'supervisor':
      case 'admin':
        return <AdminDashboard />
      case 'kitchen':
        return <KitchenDashboard />
      case 'delivery':
        return <DeliveryDashboard />
      case 'cashier':
        return <CashierDashboard />
      case 'stores':
        return <StoresDashboard />
      default:
        return <CustomerDashboard />
    }
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen">
        {/* Status indicator showing  */}
        <div className="fixed top-0 left-0 right-0 z-50 bg-ump-navy/95 text-white text-center py-1 text-xs shadow-sm">
          <span className="inline-flex items-center gap-2">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
            <span className="text-ump-navy">Egumeni Restaurant & Bar (Tfokomala Hotel) Ordering System</span>
          </span>
        </div>
        
        <Suspense fallback={<DashboardLoader role={profile.role as UserRole} />}>
          <div className="pt-6">
            {getDashboardComponent()}
          </div>
        </Suspense>
      </div>
    </ErrorBoundary>
  )
}

export default function AppWithAuth() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <App />
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 5000,
            style: {
              background: 'rgba(255, 255, 255, 0.95)',
              color: '#1e3a8a',
              border: '1px solid rgba(37, 99, 235, 0.3)',
              backdropFilter: 'blur(12px)',
              borderRadius: '16px',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
            },
          }}
        />
      </AuthProvider>
    </ErrorBoundary>
  )
}