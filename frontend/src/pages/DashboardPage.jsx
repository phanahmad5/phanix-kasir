import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp,
  Receipt,
  CreditCard,
  ShoppingBag,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  ShoppingCart,
  Calendar,
  Award,
  Users,
  Package,
  Layers,
  ChevronRight,
  Loader2,
} from 'lucide-react'
import { dashboardService } from '../api/dashboard'
import { useAuth } from '../context/AuthContext'
import { formatRupiah, formatDateOnly } from '../utils/formatters'
import { Badge } from '../components/ui/Badge'

export function DashboardPage() {
  const { user, isAdmin } = useAuth()

  // State Filter Periode
  const [period, setPeriod] = useState('last_7_days')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [showCustomDate, setShowCustomDate] = useState(false)

  // State Data Dashboard
  const [dashboardData, setDashboardData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Fetch data dari REST API backend
  const fetchDashboardData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = { period }
      if (period === 'custom') {
        if (customStartDate) params.start_date = customStartDate
        if (customEndDate) params.end_date = customEndDate
      }

      const res = await dashboardService.getSummary(params)
      if (res?.success && res?.data) {
        setDashboardData(res.data)
      } else {
        setError('Format data dashboard tidak valid.')
      }
    } catch (err) {
      console.error('Gagal mengambil ringkasan dashboard:', err)
      setError(
        err.friendlyMessage ||
          err.response?.data?.message ||
          'Gagal memuat data dashboard dari server. Pastikan server backend aktif.'
      )
    } finally {
      setLoading(false)
    }
  }, [period, customStartDate, customEndDate])

  useEffect(() => {
    if (period !== 'custom') {
      fetchDashboardData()
    }
  }, [period, fetchDashboardData])

  const handleApplyCustomDate = (e) => {
    e.preventDefault()
    if (!customStartDate || !customEndDate) return
    fetchDashboardData()
  }

  const kpi = dashboardData?.kpi
  const dailySales = dashboardData?.daily_sales || []
  const paymentMethods = dashboardData?.by_payment_method || []
  const topProducts = dashboardData?.top_products || []
  const cashierSummary = dashboardData?.by_cashier || []
  const lowStockProducts = dashboardData?.low_stock_products || []
  const activeProductsCount = dashboardData?.active_products_count ?? 0

  // Cari nilai maksimum omzet harian untuk penskalaan grafik bar
  const maxDailyTotal = Math.max(...dailySales.map((d) => d.total), 1)

  // Helper render indikator tren persentase
  const renderTrendBadge = (metric) => {
    if (!metric) return null
    const { change_percentage, trend } = metric

    if (trend === 'up') {
      return (
        <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
          <ArrowUpRight className="w-3.5 h-3.5" />
          +{change_percentage}%
        </span>
      )
    }
    if (trend === 'down') {
      return (
        <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
          <ArrowDownRight className="w-3.5 h-3.5" />
          {change_percentage}%
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
        <Minus className="w-3.5 h-3.5" />
        0%
      </span>
    )
  }

  // Label nama metode pembayaran ramah pengguna
  const getMethodLabel = (method) => {
    switch (method?.toLowerCase()) {
      case 'cash':
        return 'Tunai (Cash)'
      case 'qris':
        return 'QRIS'
      case 'transfer':
        return 'Transfer Bank'
      case 'debit':
        return 'Kartu Debit'
      default:
        return method ? method.toUpperCase() : 'Lainnya'
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Halaman & Selector Filter Periode */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Dashboard Analitik Penjualan
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isAdmin
              ? 'Akumulasi performa transaksi seluruh kasir toko UMKM'
              : 'Ringkasan performa transaksi kasir akun Anda'}
          </p>
        </div>

        {/* Kontrol Filter & Tombol Segarkan */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Pilihan Tab Periode */}
          <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-xs text-xs font-semibold">
            {[
              { id: 'today', label: 'Hari Ini' },
              { id: 'last_7_days', label: '7 Hari Terakhir' },
              { id: 'last_30_days', label: '30 Hari Terakhir' },
              { id: 'custom', label: 'Kustom' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setPeriod(tab.id)
                  setShowCustomDate(tab.id === 'custom')
                }}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  period === tab.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tombol Refresh Manual */}
          <button
            type="button"
            disabled={loading}
            onClick={fetchDashboardData}
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors shadow-xs disabled:opacity-50"
            title="Segarkan Data Dashboard"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Rentang Tanggal Khusus (Jika tab Kustom aktif) */}
      {showCustomDate && (
        <form
          onSubmit={handleApplyCustomDate}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-3 text-xs"
        >
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Dari:</span>
            <input
              type="date"
              required
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Sampai:</span>
            <input
              type="date"
              required
              min={customStartDate || undefined}
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !customStartDate || !customEndDate}
            className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors disabled:opacity-50 shadow-xs"
          >
            Terapkan Filter
          </button>
        </form>
      )}

      {/* Banner Error State */}
      {error && !loading && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start justify-between gap-3 text-xs text-rose-800">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Gagal Mengambil Data Dashboard</p>
              <p className="text-[11px] mt-0.5 text-rose-700">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchDashboardData}
            className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-colors shrink-0"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Loading Skeleton Indicator */}
      {loading && !dashboardData && (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-xs">
          <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-blue-600" />
          <p className="text-xs font-semibold text-slate-700">Menghitung analitik transaksi dari server...</p>
          <p className="text-[11px] text-slate-400 mt-1">Mengagregasi omzet, barang terjual, dan snapshot item</p>
        </div>
      )}

      {dashboardData && (
        <>
          {/* Kartu KPI Grid (4 Metrik Utama) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Omzet Bersih Penjualan Selesai */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Omzet Bersih
                </span>
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
                  {formatRupiah(kpi?.net_turnover?.current || 0)}
                </h3>
                <div className="mt-2 flex items-center gap-2">
                  {renderTrendBadge(kpi?.net_turnover)}
                  <span className="text-[11px] text-slate-400">vs periode lalu</span>
                </div>
              </div>
            </div>

            {/* KPI 2: Jumlah Transaksi Selesai */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Transaksi Selesai
                </span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Receipt className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
                  {kpi?.transaction_count?.current || 0} Struk
                </h3>
                <div className="mt-2 flex items-center gap-2">
                  {renderTrendBadge(kpi?.transaction_count)}
                  <span className="text-[11px] text-slate-400">vs periode lalu</span>
                </div>
              </div>
            </div>

            {/* KPI 3: Rata-rata Nilai Transaksi (AOV) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Rata-rata Transaksi
                </span>
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
                  {formatRupiah(kpi?.average_transaction_value?.current || 0)}
                </h3>
                <div className="mt-2 flex items-center gap-2">
                  {renderTrendBadge(kpi?.average_transaction_value)}
                  <span className="text-[11px] text-slate-400">per transaksi</span>
                </div>
              </div>
            </div>

            {/* KPI 4: Total Kuantitas Barang Terjual */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Barang Terjual
                </span>
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
                  {kpi?.items_sold?.current || 0} Pcs
                </h3>
                <div className="mt-2 flex items-center gap-2">
                  {renderTrendBadge(kpi?.items_sold)}
                  <span className="text-[11px] text-slate-400">unit keluar</span>
                </div>
              </div>
            </div>
          </div>

          {/* Grid Konten: Grafik Harian & Kolom Samping */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Kolom Kiri: Grafik Omzet & Distribusi Pembayaran & Kasir (2 Kolom) */}
            <div className="lg:col-span-2 space-y-6">
              {/* Grafik Omzet Harian (Clean SVG / CSS Bar Chart) */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 tracking-tight">
                      Grafik Omzet Penjualan Harian
                    </h3>
                    <p className="text-xs text-slate-500">
                      Periode: {formatDateOnly(dashboardData.start_date)} s/d {formatDateOnly(dashboardData.end_date)}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-100 px-3 py-1 rounded-xl self-start sm:self-auto">
                    Total: {formatRupiah(kpi?.net_turnover?.current || 0)}
                  </span>
                </div>

                {dailySales.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs">
                    <Receipt className="w-8 h-8 mb-2 text-slate-300" />
                    <span>Tidak ada data transaksi pada rentang tanggal ini.</span>
                  </div>
                ) : (
                  <div className="h-64 flex items-end gap-2 sm:gap-4 pt-6 pb-2 px-2 border-b border-slate-100 overflow-x-auto">
                    {dailySales.map((item, index) => {
                      const heightPercent =
                        item.total > 0
                          ? Math.max(12, Math.round((item.total / maxDailyTotal) * 100))
                          : 4
                      const isToday = index === dailySales.length - 1

                      return (
                        <div
                          key={item.date}
                          className="flex-1 min-w-[36px] flex flex-col items-center gap-2 h-full justify-end group"
                        >
                          {/* Tooltip pada saat hover */}
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-semibold bg-slate-900 text-white px-2 py-1 rounded shadow-md pointer-events-none mb-1 text-center whitespace-nowrap z-10">
                            <p>{formatRupiah(item.total)}</p>
                            <p className="text-[9px] text-slate-300">{item.count} trs • {item.items_sold} pcs</p>
                          </div>

                          {/* Batang Bar Chart */}
                          <div className="w-full max-w-[40px] bg-slate-100 rounded-t-lg relative flex items-end justify-center overflow-hidden h-full">
                            <div
                              style={{ height: `${heightPercent}%` }}
                              className={`w-full rounded-t-lg transition-all duration-300 ${
                                item.total === 0
                                  ? 'bg-slate-200'
                                  : isToday
                                  ? 'bg-blue-600 group-hover:bg-blue-700'
                                  : 'bg-blue-400 group-hover:bg-blue-500'
                              }`}
                            />
                          </div>

                          {/* Label Tanggal & Hari */}
                          <div className="text-center">
                            <span
                              className={`block text-[11px] font-bold ${
                                isToday ? 'text-blue-700' : 'text-slate-700'
                              }`}
                            >
                              {item.day_name}
                            </span>
                            <span className="block text-[9px] text-slate-400">
                              {item.date.slice(8, 10)}/{item.date.slice(5, 7)}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Ringkasan Distribusi Metode Pembayaran */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 tracking-tight">
                      Distribusi Metode Pembayaran
                    </h3>
                    <p className="text-xs text-slate-500">
                      Rekap transaksi berdasarkan saluran pembayaran
                    </p>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-400">
                    {paymentMethods.length} Metode Aktif
                  </span>
                </div>

                {paymentMethods.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">
                    Belum ada data pembayaran pada periode ini.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {paymentMethods.map((pm) => (
                      <div
                        key={pm.payment_method}
                        className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 flex flex-col justify-between space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-800">
                            {getMethodLabel(pm.payment_method)}
                          </span>
                          <span className="font-bold text-blue-700">
                            {formatRupiah(pm.total)}
                          </span>
                        </div>
                        <div>
                          <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                            <span>{pm.count} transaksi</span>
                            <span>{pm.percentage}%</span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-blue-600 h-1.5 rounded-full"
                              style={{ width: `${Math.min(100, Math.max(4, pm.percentage))}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Ringkasan Penjualan per Kasir (Khusus Admin) */}
              {isAdmin && cashierSummary && cashierSummary.length > 0 && (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-indigo-600" />
                      <h3 className="text-base font-bold text-slate-900 tracking-tight">
                        Penjualan per Kasir
                      </h3>
                    </div>
                    <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">
                      Khusus Admin
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-600">
                      <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                        <tr>
                          <th className="px-4 py-2.5">Kasir</th>
                          <th className="px-4 py-2.5 text-center">Jumlah Transaksi</th>
                          <th className="px-4 py-2.5 text-right">Total Omzet Penjualan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {cashierSummary.map((c) => (
                          <tr key={c.user_id} className="hover:bg-slate-50/60">
                            <td className="px-4 py-3 font-semibold text-slate-800">
                              {c.user_name}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {c.transaction_count} transaksi
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-blue-700">
                              {formatRupiah(c.total_sales)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Kolom Kanan: Top Produk & Peringatan Stok (1 Kolom) */}
            <div className="space-y-6">
              {/* Top 5 Produk Terlaris */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-500" />
                    <span>Produk Terlaris</span>
                  </h3>
                  <span className="text-[11px] text-slate-400 font-semibold">Berdasarkan Qty</span>
                </div>

                {topProducts.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">
                    Belum ada produk yang terjual pada rentang tanggal ini.
                  </p>
                ) : (
                  <div className="space-y-3.5">
                    {topProducts.map((p, idx) => {
                      const maxQty = topProducts[0]?.total_quantity || 1
                      const pct = Math.round((p.total_quantity / maxQty) * 100)

                      return (
                        <div key={p.sku || p.product_name} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-800 truncate pr-2 flex items-center gap-1.5">
                              <span className="text-[11px] font-mono font-bold text-slate-400">
                                #{idx + 1}
                              </span>
                              <span className="truncate">{p.product_name}</span>
                            </span>
                            <span className="font-bold text-slate-900 shrink-0">
                              {p.total_quantity} pcs
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <span>SKU: {p.sku || '-'}</span>
                            <span>{formatRupiah(p.total_revenue)}</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-amber-500 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Peringatan Stok Menipis */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span>Peringatan Stok</span>
                  </h3>
                  <Link
                    to="/products"
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5"
                  >
                    Katalog
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600">Total Katalog Aktif:</span>
                  </div>
                  <strong className="text-slate-900 font-bold">{activeProductsCount} SKU</strong>
                </div>

                {lowStockProducts.length === 0 ? (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-center text-xs text-emerald-800">
                    Seluruh stok produk berada dalam batas aman.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {lowStockProducts.map((p) => (
                      <div
                        key={p.id}
                        className="p-3 rounded-xl border border-slate-100 bg-slate-50/70 flex items-center justify-between text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-semibold text-slate-800 truncate">{p.name}</p>
                          <p className="text-[11px] text-slate-400">
                            Min: {p.min_stock} • SKU: {p.sku}
                          </p>
                        </div>
                        <span className="shrink-0 px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800">
                          Sisa {p.stock}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tombol Pintasan Buka POS */}
                <div className="pt-2 border-t border-slate-100">
                  <Link
                    to="/pos"
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors shadow-xs"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    <span>Buka Terminal Kasir</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
