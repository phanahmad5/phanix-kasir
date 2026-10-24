import React from 'react'
import { Menu, Calendar, ShoppingCart, ShieldCheck } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

const routeTitles = {
  '/': { title: 'Ringkasan Dashboard', subtitle: 'Pantau performa penjualan dan status operasional hari ini' },
  '/pos': { title: 'Kasir Penjualan', subtitle: 'Proses transaksi cepat, hitung keranjang, dan cetak struk' },
  '/products': { title: 'Katalog Produk & Stok', subtitle: 'Kelola data produk, harga jual, dan kontrol persediaan' },
  '/categories': { title: 'Kategori Produk', subtitle: 'Kelompokkan barang dagangan untuk kemudahan pencarian' },
  '/transactions': { title: 'Riwayat Transaksi', subtitle: 'Daftar seluruh penjualan yang tercatat dalam sistem' },
  '/reports': { title: 'Laporan Penjualan', subtitle: 'Analisis omset, rata-rata transaksi, dan tren produk terlaris' },
  '/settings': { title: 'Pengaturan Sistem', subtitle: 'Konfigurasi profil toko dan preferensi aplikasi POS' },
}

export function Header({ onOpenMobile }) {
  const location = useLocation()
  const currentInfo = routeTitles[location.pathname] || {
    title: 'Phanix POS',
    subtitle: 'Point of Sale Terpercaya untuk UMKM',
  }

  const todayFormatted = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 flex items-center justify-between shadow-xs">
      {/* Left: Mobile Toggle & Page Info */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobile}
          className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          aria-label="Buka Menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-tight">
            {currentInfo.title}
          </h1>
          <p className="text-xs text-slate-500 font-medium hidden sm:block">
            {currentInfo.subtitle}
          </p>
        </div>
      </div>

      {/* Right: Date, Store Badge & Fast POS Button */}
      <div className="flex items-center gap-3">
        {/* Date badge */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-600">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>{todayFormatted}</span>
        </div>

        {/* Quick Link to POS if not on POS page */}
        {location.pathname !== '/pos' && (
          <Link
            to="/pos"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold shadow-xs hover:bg-blue-700 transition-colors"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Buka Kasir</span>
          </Link>
        )}

        {/* Store badge */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
          <span className="text-xs font-semibold text-slate-700 hidden sm:inline">
            Toko Berkah UMKM
          </span>
        </div>
      </div>
    </header>
  )
}
