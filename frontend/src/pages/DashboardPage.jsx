import React, { useState, useEffect, useCallback, useMemo } from 'react'
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
  Award,
  Users,
  Package,
  ChevronRight,
  Loader2,
} from 'lucide-react'
import { dashboardService } from '../api/dashboard'
import { useAuth } from '../context/AuthContext'
import { formatRupiah, formatDateOnly } from '../utils/formatters'
import { getCache, setCache } from '../utils/cache'

export function DashboardPage() {
  const { user, isAdmin } = useAuth()

  // State Filter Periode
  const [period, setPeriod] = useState('last_7_days')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [showCustomDate, setShowCustomDate] = useState(false)

  // Cache Key untuk SWR (Stale-While-Revalidate)
  const cacheKey = useMemo(() => {
    return `dashboard:${period}:${customStartDate}:${customEndDate}`
  }, [period, customStartDate, customEndDate])

  // Inisialisasi state langsung dari cache jika tersedia
  const [dashboardData, setDashboardData] = useState(() => getCache(cacheKey) || null)
  const [loading, setLoading] = useState(() => !getCache(cacheKey))
  const [error, setError] = useState(null)

  // Fetch data dari REST API backend
  const fetchDashboardData = useCallback(async (isManualRefresh = false) => {
    const cached = getCache(cacheKey)
    if (!cached || isManualRefresh) {
      setLoading(true)
    }
    setError(null)

    try {
      const params = { period }
      if (period === 'custom') {
        if (customStartDate) params.start_date = customStartDate
        if (customEndDate) params.end_date = customEndDate
      }

      const res = await dashboardService.getSummary(params)
      if (res?.success && res?.data) {
        setCache(cacheKey, res.data)
        setDashboardData(res.data)
      } else {
        if (!cached) setError('Format data dashboard tidak valid.')
      }
    } catch (err) {
      console.error('Gagal mengambil ringkasan dashboard:', err)
      if (!cached) {
        setError(
          err.friendlyMessage ||
            err.response?.data?.message ||
            'Gagal memuat data dashboard. Pastikan backend aktif.'
        )
      }
    } finally {
      setLoading(false)
    }
  }, [period, customStartDate, customEndDate, cacheKey])

  useEffect(() => {
    const cached = getCache(cacheKey)
    if (cached) {
      setDashboardData(cached)
      setLoading(false)
    }
    if (period !== 'custom') {
      fetchDashboardData()
    }
  }, [period, cacheKey, fetchDashboardData])

  const handleApplyCustomDate = (e) => {
    e.preventDefault()
    if (!customStartDate || !customEndDate) return
    fetchDashboardData(true)
  }

  const kpi = dashboardData?.kpi
  const dailySales = dashboardData?.daily_sales || []
  const paymentMethods = dashboardData?.by_payment_method || []
  const topProducts = dashboardData?.top_products || []
  const cashierSummary = dashboardData?.by_cashier || []
  const lowStockProducts = dashboardData?.low_stock_products || []
  const activeProductsCount = dashboardData?.active_products_count ?? 0

  const maxDailyTotal = Math.max(...dailySales.map((d) => d.total), 1)

  const renderTrend = (metric) => {
    if (!metric) return null
    const { change_percentage, trend } = metric

    if (trend === 'up') {
      return (
        <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-emerald-600">
          <ArrowUpRight className="w-3.5 h-3.5" />
          +{change_percentage}%
        </span>
      )
    }
    if (trend === 'down') {
      return (
        <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-rose-600">
          <ArrowDownRight className="w-3.5 h-3.5" />
          {change_percentage}%
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-zinc-400">
        <Minus className="w-3 h-3" />
        0%
      </span>
    )
  }

  const getMethodLabel = (method) => {
    switch (method?.toLowerCase()) {
      case 'cash':
        return 'Tunai'
      case 'qris':
        return 'QRIS'
      case 'transfer':
        return 'Transfer'
      case 'debit':
        return 'Debit'
      default:
        return method ? method.toUpperCase() : 'Lainnya'
    }
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header Halaman & Filter Periode */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 tracking-tight">
            Ringkasan Penjualan
          </h2>
          <p className="text-xs text-zinc-500">
            {isAdmin ? 'Performa transaksi toko' : 'Performa kasir Anda'}
          </p>
        </div>

        {/* Filter & Refresh */}
        <div className="flex items-center gap-2">
          <div className="inline-flex p-0.5 rounded-lg bg-zinc-100 border border-zinc-200/80 text-xs font-medium">
            {[
              { id: 'today', label: 'Hari Ini' },
              { id: 'last_7_days', label: '7 Hari' },
              { id: 'last_30_days', label: '30 Hari' },
              { id: 'custom', label: 'Kustom' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setPeriod(tab.id)
                  setShowCustomDate(tab.id === 'custom')
                }}
                className={`px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer ${
                  period === tab.id
                    ? 'bg-white text-zinc-900 font-semibold shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={() => fetchDashboardData(true)}
            className="p-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 transition-colors disabled:opacity-50 cursor-pointer"
            title="Segarkan data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-zinc-900' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Kustom */}
      {showCustomDate && (
        <form
          onSubmit={handleApplyCustomDate}
          className="bg-white p-3.5 rounded-xl border border-zinc-200 shadow-xs flex flex-wrap items-center gap-3 text-xs"
        >
          <div className="flex items-center gap-2">
            <span className="text-zinc-500 font-medium">Dari:</span>
            <input
              type="date"
              required
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-zinc-200 text-xs text-zinc-800 bg-white focus:outline-none focus:border-zinc-900"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-zinc-500 font-medium">Sampai:</span>
            <input
              type="date"
              required
              min={customStartDate || undefined}
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-zinc-200 text-xs text-zinc-800 bg-white focus:outline-none focus:border-zinc-900"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !customStartDate || !customEndDate}
            className="px-3 py-1.5 rounded-lg bg-zinc-900 text-white font-medium text-xs hover:bg-zinc-800 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Terapkan
          </button>
        </form>
      )}

      {/* Error State */}
      {error && !dashboardData && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center justify-between text-xs text-rose-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchDashboardData(true)}
            className="px-2.5 py-1 rounded-md bg-rose-600 text-white font-medium text-xs hover:bg-rose-700"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* First-time Loading Skeleton */}
      {loading && !dashboardData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white p-4 rounded-xl border border-zinc-200 h-24" />
          ))}
        </div>
      )}

      {dashboardData && (
        <>
          {/* KPI Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* KPI 1 */}
            <div className="bg-white p-4 rounded-xl border border-zinc-200/80 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                Omzet Bersih
              </span>
              <div className="mt-2">
                <h3 className="text-xl font-semibold text-zinc-900 tracking-tight tabular-nums font-mono">
                  {formatRupiah(kpi?.net_turnover?.current || 0)}
                </h3>
                <div className="mt-1 flex items-center gap-1.5 text-xs">
                  {renderTrend(kpi?.net_turnover)}
                  <span className="text-[11px] text-zinc-400">vs periode lalu</span>
                </div>
              </div>
            </div>

            {/* KPI 2 */}
            <div className="bg-white p-4 rounded-xl border border-zinc-200/80 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                Transaksi Selesai
              </span>
              <div className="mt-2">
                <h3 className="text-xl font-semibold text-zinc-900 tracking-tight tabular-nums font-mono">
                  {kpi?.transaction_count?.current || 0}
                  <span className="text-xs font-normal text-zinc-500 ml-1">struk</span>
                </h3>
                <div className="mt-1 flex items-center gap-1.5 text-xs">
                  {renderTrend(kpi?.transaction_count)}
                  <span className="text-[11px] text-zinc-400">vs periode lalu</span>
                </div>
              </div>
            </div>

            {/* KPI 3 */}
            <div className="bg-white p-4 rounded-xl border border-zinc-200/80 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                Rata-rata Transaksi
              </span>
              <div className="mt-2">
                <h3 className="text-xl font-semibold text-zinc-900 tracking-tight tabular-nums font-mono">
                  {formatRupiah(kpi?.average_transaction_value?.current || 0)}
                </h3>
                <div className="mt-1 flex items-center gap-1.5 text-xs">
                  {renderTrend(kpi?.average_transaction_value)}
                  <span className="text-[11px] text-zinc-400">per struk</span>
                </div>
              </div>
            </div>

            {/* KPI 4 */}
            <div className="bg-white p-4 rounded-xl border border-zinc-200/80 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                Barang Terjual
              </span>
              <div className="mt-2">
                <h3 className="text-xl font-semibold text-zinc-900 tracking-tight tabular-nums font-mono">
                  {kpi?.items_sold?.current || 0}
                  <span className="text-xs font-normal text-zinc-500 ml-1">item</span>
                </h3>
                <div className="mt-1 flex items-center gap-1.5 text-xs">
                  {renderTrend(kpi?.items_sold)}
                  <span className="text-[11px] text-zinc-400">unit</span>
                </div>
              </div>
            </div>
          </div>

          {/* Main Grid: Charts & Panels */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left 2 Cols: Chart & Payment Distribution */}
            <div className="lg:col-span-2 space-y-5">
              {/* Daily Sales Chart */}
              <div className="bg-white p-5 rounded-xl border border-zinc-200/80 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900">
                      Grafik Penjualan Harian
                    </h3>
                    <p className="text-[11px] text-zinc-400">
                      {formatDateOnly(dashboardData.start_date)} — {formatDateOnly(dashboardData.end_date)}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-zinc-900 tabular-nums font-mono">
                    {formatRupiah(kpi?.net_turnover?.current || 0)}
                  </span>
                </div>

                {dailySales.length === 0 ? (
                  <div className="h-52 flex flex-col items-center justify-center text-zinc-400 text-xs">
                    <Receipt className="w-6 h-6 mb-1 text-zinc-300" />
                    <span>Tidak ada transaksi pada periode ini</span>
                  </div>
                ) : (
                  <div className="h-52 flex items-end gap-2 pt-6 pb-2 px-1 border-b border-zinc-100 overflow-x-auto">
                    {dailySales.map((item, index) => {
                      const heightPercent =
                        item.total > 0
                          ? Math.max(10, Math.round((item.total / maxDailyTotal) * 100))
                          : 4
                      const isToday = index === dailySales.length - 1

                      return (
                        <div
                          key={item.date}
                          className="flex-1 min-w-[32px] flex flex-col items-center gap-1.5 h-full justify-end group relative"
                        >
                          {/* Tooltip on hover */}
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 text-[10px] font-medium bg-zinc-900 text-white px-2 py-0.5 rounded shadow pointer-events-none whitespace-nowrap z-10">
                            {formatRupiah(item.total)} ({item.count} trs)
                          </div>

                          {/* Bar */}
                          <div className="w-full max-w-[32px] bg-zinc-100 rounded-t relative flex items-end justify-center overflow-hidden h-full">
                            <div
                              style={{ height: `${heightPercent}%` }}
                              className={`w-full rounded-t transition-all duration-200 ${
                                item.total === 0
                                  ? 'bg-zinc-200'
                                  : isToday
                                  ? 'bg-zinc-900 group-hover:bg-zinc-800'
                                  : 'bg-zinc-700 group-hover:bg-zinc-900'
                              }`}
                            />
                          </div>

                          {/* Label */}
                          <div className="text-center">
                            <span
                              className={`block text-[10px] font-medium ${
                                isToday ? 'text-zinc-900 font-bold' : 'text-zinc-500'
                              }`}
                            >
                              {item.day_name.slice(0, 3)}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Payment Methods */}
              <div className="bg-white p-5 rounded-xl border border-zinc-200/80 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-zinc-900">
                    Metode Pembayaran
                  </h3>
                  <span className="text-[11px] text-zinc-400">
                    {paymentMethods.length} metode
                  </span>
                </div>

                {paymentMethods.length === 0 ? (
                  <p className="text-xs text-zinc-400 py-3 text-center">
                    Belum ada data pembayaran
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {paymentMethods.map((pm) => (
                      <div
                        key={pm.payment_method}
                        className="p-3 rounded-lg border border-zinc-100 bg-zinc-50/60 flex flex-col justify-between space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-zinc-800">
                            {getMethodLabel(pm.payment_method)}
                          </span>
                          <span className="font-semibold text-zinc-900 tabular-nums font-mono">
                            {formatRupiah(pm.total)}
                          </span>
                        </div>
                        <div>
                          <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
                            <span>{pm.count} transaksi</span>
                            <span>{pm.percentage}%</span>
                          </div>
                          <div className="w-full bg-zinc-200 rounded-full h-1 overflow-hidden">
                            <div
                              className="bg-zinc-900 h-1 rounded-full"
                              style={{ width: `${Math.min(100, Math.max(4, pm.percentage))}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Cashier Summary (Admin) */}
              {isAdmin && cashierSummary && cashierSummary.length > 0 && (
                <div className="bg-white p-5 rounded-xl border border-zinc-200/80 shadow-xs">
                  <h3 className="text-sm font-semibold text-zinc-900 mb-3">
                    Performa Kasir
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-zinc-600">
                      <thead className="bg-zinc-50 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-100">
                        <tr>
                          <th className="px-3 py-2">Kasir</th>
                          <th className="px-3 py-2 text-center">Transaksi</th>
                          <th className="px-3 py-2 text-right">Total Penjualan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {cashierSummary.map((c) => (
                          <tr key={c.user_id} className="hover:bg-zinc-50/80">
                            <td className="px-3 py-2.5 font-medium text-zinc-900">
                              {c.user_name}
                            </td>
                            <td className="px-3 py-2.5 text-center text-zinc-500">
                              {c.transaction_count}
                            </td>
                            <td className="px-3 py-2.5 text-right font-medium text-zinc-900 tabular-nums font-mono">
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

            {/* Right Column: Top Products & Stock Warning */}
            <div className="space-y-5">
              {/* Top Products */}
              <div className="bg-white p-5 rounded-xl border border-zinc-200/80 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-amber-500" />
                    <span>Produk Terlaris</span>
                  </h3>
                  <span className="text-[11px] text-zinc-400">Qty</span>
                </div>

                {topProducts.length === 0 ? (
                  <p className="text-xs text-zinc-400 py-4 text-center">
                    Belum ada produk terjual
                  </p>
                ) : (
                  <div className="space-y-3">
                    {topProducts.map((p, idx) => {
                      const maxQty = topProducts[0]?.total_quantity || 1
                      const pct = Math.round((p.total_quantity / maxQty) * 100)

                      return (
                        <div key={p.sku || p.product_name} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-zinc-800 truncate pr-2 flex items-center gap-1.5">
                              <span className="text-[10px] font-mono text-zinc-400">
                                #{idx + 1}
                              </span>
                              <span className="truncate">{p.product_name}</span>
                            </span>
                            <span className="font-semibold text-zinc-900 shrink-0 tabular-nums font-mono">
                              {p.total_quantity} pcs
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-zinc-400">
                            <span>{p.sku || '-'}</span>
                            <span className="tabular-nums font-mono">{formatRupiah(p.total_revenue)}</span>
                          </div>
                          <div className="w-full bg-zinc-100 rounded-full h-1 overflow-hidden">
                            <div
                              className="bg-zinc-800 h-1 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Low Stock Warning */}
              <div className="bg-white p-5 rounded-xl border border-zinc-200/80 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    <span>Peringatan Stok</span>
                  </h3>
                  <Link
                    to="/products"
                    className="text-xs font-medium text-zinc-600 hover:text-zinc-900 flex items-center gap-0.5"
                  >
                    Katalog
                    <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-50 border border-zinc-100 text-xs">
                  <span className="text-zinc-500">Total Katalog Aktif:</span>
                  <strong className="text-zinc-900 font-semibold">{activeProductsCount} SKU</strong>
                </div>

                {lowStockProducts.length === 0 ? (
                  <div className="p-3 rounded-lg bg-emerald-50/70 border border-emerald-100 text-center text-xs text-emerald-800">
                    Seluruh stok produk berada dalam batas aman.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {lowStockProducts.map((p) => (
                      <div
                        key={p.id}
                        className="p-2.5 rounded-lg border border-zinc-100 bg-zinc-50 flex items-center justify-between text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-medium text-zinc-800 truncate">{p.name}</p>
                          <p className="text-[10px] text-zinc-400 font-mono">
                            SKU: {p.sku} • Min: {p.min_stock}
                          </p>
                        </div>
                        <span className="shrink-0 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/60 tabular-nums font-mono">
                          Sisa {p.stock}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-2 border-t border-zinc-100">
                  <Link
                    to="/pos"
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 transition-colors shadow-xs"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span>Buka Kasir</span>
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
