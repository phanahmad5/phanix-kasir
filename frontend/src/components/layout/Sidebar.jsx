import React, { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Tags,
  Receipt,
  BarChart3,
  Settings,
  Store,
  X,
  LogOut,
  Loader2,
} from 'lucide-react'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/pos', label: 'Kasir POS', icon: ShoppingCart },
  { to: '/products', label: 'Produk & Stok', icon: Package },
  { to: '/categories', label: 'Kategori', icon: Tags },
  { to: '/transactions', label: 'Riwayat Transaksi', icon: Receipt },
  { to: '/reports', label: 'Laporan Penjualan', icon: BarChart3 },
  { to: '/settings', label: 'Pengaturan', icon: Settings, adminOnly: true },
]

export function Sidebar({ mobileOpen, onCloseMobile }) {
  const { user, logout, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')

  const visibleNavItems = navItems.filter((item) => {
    if (item.adminOnly && !isAdmin) return false
    return true
  })

  async function handleLogout() {
    setLogoutError('')
    setLoggingOut(true)
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch (err) {
      setLogoutError(
        err.friendlyMessage ||
          'Gagal menghubungi server untuk logout. Periksa koneksi Anda.'
      )
    } finally {
      setLoggingOut(false)
    }
  }

  const roleLabel = isAdmin ? 'Admin' : 'Kasir'
  const userInitials = (user?.name || 'U')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-zinc-950/40 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-60 bg-white border-r border-zinc-200 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-14 flex items-center justify-between px-5 border-b border-zinc-100">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-zinc-900 flex items-center justify-center text-white shadow-xs">
              <Store className="w-4 h-4 text-zinc-100" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-zinc-900 text-sm tracking-tight">Phanix POS</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 border border-zinc-200/60">
                POS
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-1 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto px-3 py-3.5 space-y-0.5">
          <div className="px-2.5 pb-2 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
            Menu
          </div>
          {visibleNavItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onCloseMobile}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-zinc-900 text-white font-semibold shadow-xs'
                      : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-zinc-400'}`} />
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            )
          })}
        </div>

        {/* User Identity Info & Logout at Bottom */}
        <div className="p-3 border-t border-zinc-100 bg-zinc-50/50">
          {logoutError && (
            <p className="text-[10px] text-rose-600 mb-2 leading-tight">
              {logoutError}
            </p>
          )}

          <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-full bg-zinc-200 text-zinc-700 flex items-center justify-center font-bold text-[11px] shrink-0">
                {userInitials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-zinc-900 truncate leading-snug">
                  {user?.name || 'Kasir'}
                </p>
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${isAdmin ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
                  <p className="text-[10px] text-zinc-500 font-medium">
                    {roleLabel}
                  </p>
                </div>
              </div>
            </div>

            {/* Logout Button */}
            <button
              type="button"
              disabled={loggingOut}
              onClick={handleLogout}
              className="p-1.5 rounded-md text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0 disabled:opacity-50"
              title="Keluar dari akun"
            >
              {loggingOut ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />
              ) : (
                <LogOut className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
