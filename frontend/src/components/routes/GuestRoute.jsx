import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Store, Loader2 } from 'lucide-react'

export function GuestRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md mb-4 animate-pulse">
          <Store className="w-6 h-6" />
        </div>
        <div className="flex items-center gap-2 text-slate-600 text-xs font-semibold">
          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          <span>Memeriksa sesi...</span>
        </div>
      </div>
    )
  }

  if (isAuthenticated) {
    const origin = location.state?.from?.pathname || '/'
    return <Navigate to={origin} replace />
  }

  return children
}
