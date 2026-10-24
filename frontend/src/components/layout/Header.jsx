import React from 'react'
import { Menu, Calendar, ShoppingCart, RefreshCw } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

const routeTitles = {
  '/': { title: 'Dashboard', subtitle: 'Ringkasan performa dan aktivitas toko' },
  '/pos': { title: 'Kasir POS', subtitle: 'Transaksi kasir dan cetak struk penjualan' },
  '/products': { title: 'Produk & Stok', subtitle: 'Katalog barang, harga jual, dan persediaan' },
  '/categories': { title: 'Kategori', subtitle: 'Kelompok barang untuk katalog kasir' },
  '/transactions': { title: 'Riwayat Transaksi', subtitle: 'Catatan seluruh transaksi kasir' },
  '/reports': { title: 'Laporan Penjualan', subtitle: 'Rekapitulasi penjualan dan performa produk' },
  '/settings': { title: 'Pengaturan', subtitle: 'Preferensi toko dan konfigurasi cetak' },
}

export function Header({ onOpenMobile, isBusy }) {
  const location = useLocation()
  const currentInfo = routeTitles[location.pathname] || {
    title: 'Phanix POS',
    subtitle: 'Point of Sale',
  }

  const todayFormatted = new Intl.DateTimeFormat('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date())

  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-zinc-200 px-4 sm:px-6 py-3 flex items-center justify-between">
      {/* Left: Mobile Toggle & Page Info */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobile}
          className="lg:hidden p-1.5 rounded-lg text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
          aria-label="Buka Menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm sm:text-base font-semibold text-zinc-900 tracking-tight leading-none">
              {currentInfo.title}
            </h1>
            {isBusy && (
              <span className="flex items-center gap-1 text-[11px] text-blue-600 font-medium">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span className="hidden sm:inline">Sinkronisasi...</span>
              </span>
            )}
          </div>
          <p className="text-[11px] text-zinc-400 mt-0.5 hidden sm:block">
            {currentInfo.subtitle}
          </p>
        </div>
      </div>

      {/* Right: Date & Fast POS Button */}
      <div className="flex items-center gap-2.5">
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-50 border border-zinc-200/80 text-[11px] font-medium text-zinc-600">
          <Calendar className="w-3.5 h-3.5 text-zinc-400" />
          <span>{todayFormatted}</span>
        </div>

        {/* Quick Link to POS if not on POS page */}
        {location.pathname !== '/pos' && (
          <Link
            to="/pos"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 transition-colors shadow-xs"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Kasir</span>
          </Link>
        )}
      </div>
    </header>
  )
}
