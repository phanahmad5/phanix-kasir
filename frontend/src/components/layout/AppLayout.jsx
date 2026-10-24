import React, { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { subscribeNetwork, isNetworkBusy } from '../../api/axios'

export function AppLayout() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [isBusy, setIsBusy] = useState(() => isNetworkBusy())

  useEffect(() => {
    return subscribeNetwork((busy) => {
      setIsBusy(busy)
    })
  }, [])

  return (
    <div className="min-h-screen bg-zinc-50 flex font-sans antialiased text-zinc-900">
      {/* Top Background Activity Bar (Subtle, non-blocking) */}
      <div
        className={`fixed top-0 left-0 right-0 h-0.5 z-50 transition-opacity duration-300 pointer-events-none ${
          isBusy ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="h-full bg-blue-600 animate-pulse w-full" />
      </div>

      {/* Sidebar (Fixed on desktop) */}
      <Sidebar
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-60">
        {/* Sticky Header */}
        <Header onOpenMobile={() => setMobileSidebarOpen(true)} isBusy={isBusy} />

        {/* Scrollable Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
