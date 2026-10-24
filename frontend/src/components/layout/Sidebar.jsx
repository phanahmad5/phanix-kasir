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
  UserCheck,
  ShieldCheck,
  LogOut,
  Loader2,
} from 'lucide-react'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/pos', label: 'Kasir (POS)', icon: ShoppingCart },
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

  // Filter menu berdasarkan peran pengguna
  const visibleNavItems = navItems.filter((item) => {
    if (item.adminOnly && !isAdmin) {
      return false
    }
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

  const roleLabel = isAdmin ? 'Administrator' : 'Kasir Toko'

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-900 tracking-tight text-base">Phanix POS</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 uppercase tracking-wider">
                  UMKM
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium leading-none">Point of Sale System</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Menu Utama
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
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-semibold shadow-xs'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            )
          })}
        </div>

        {/* User Identity Info & Logout at Bottom */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/60">
          {logoutError && (
            <p className="text-[10px] text-rose-600 mb-2 leading-tight">
              {logoutError}
            </p>
          )}

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                  isAdmin ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {isAdmin ? <ShieldCheck className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-800 truncate">
                  {user?.name || 'Pengguna'}
                </p>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isAdmin ? 'bg-indigo-600' : 'bg-emerald-500'
                    }`}
                  ></span>
                  <p className="text-[11px] text-slate-500 font-medium truncate">
                    {roleLabel}
                  </p>
                </div>
              </div>
            </div>

            {/* Tombol Logout */}
            <button
              type="button"
              disabled={loggingOut}
              onClick={handleLogout}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0 disabled:opacity-50"
              title="Keluar dari akun (Logout)"
            >
              {loggingOut ? (
                <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
