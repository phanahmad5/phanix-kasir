import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Download,
  RefreshCw,
  AlertCircle,
  FileSpreadsheet,
  Award,
  Users,
  CreditCard,
  Loader2,
  Calendar,
} from 'lucide-react'
import { reportService } from '../api/reports'
import { useAuth } from '../context/AuthContext'
import { formatRupiah, formatDateOnly } from '../utils/formatters'
import { getCache, setCache } from '../utils/cache'

export function ReportsPage() {
  const { user, isAdmin } = useAuth()

  // State Filter Periode
  const [period, setPeriod] = useState('last_7_days')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [showCustomDate, setShowCustomDate] = useState(false)

  // Cache Key
  const cacheKey = useMemo(() => {
    return `reports:${period}:${customStartDate}:${customEndDate}`
  }, [period, customStartDate, customEndDate])

  // Inisialisasi dari cache agar instan tanpa loading berulang
  const [reportData, setReportData] = useState(() => getCache(cacheKey) || null)
  const [loading, setLoading] = useState(() => !getCache(cacheKey))
  const [error, setError] = useState(null)

  // State Proses Ekspor CSV
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState(null)

  // Memuat data agregasi laporan penjualan
  const fetchReportData = useCallback(async (isManualRefresh = false) => {
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

      const res = await reportService.getSummary(params)
      if (res?.success && res?.data) {
        setCache(cacheKey, res.data)
        setReportData(res.data)
      } else {
        if (!cached) setError('Format data laporan tidak valid.')
      }
    } catch (err) {
      if (!cached) {
        setError(
          err.friendlyMessage ||
            err.response?.data?.message ||
            'Gagal memuat laporan penjualan.'
        )
      }
    } finally {
      setLoading(false)
    }
  }, [cacheKey, period, customStartDate, customEndDate])

  useEffect(() => {
    const cached = getCache(cacheKey)
    if (cached) {
      setReportData(cached)
      setLoading(false)
    }
    if (period !== 'custom') {
      fetchReportData()
    }
  }, [period, cacheKey, fetchReportData])

  const handleApplyCustomDate = (e) => {
    e.preventDefault()
    if (!customStartDate || !customEndDate) return
    fetchReportData(true)
  }

  const handleExportCsv = async () => {
    setExporting(true)
    setExportError(null)

    try {
      const params = { period }
      if (period === 'custom') {
        if (customStartDate) params.start_date = customStartDate
        if (customEndDate) params.end_date = customEndDate
      }

      await reportService.exportCsv(params)
    } catch (err) {
      setExportError(
        err.friendlyMessage ||
          err.response?.data?.message ||
          'Gagal mengunduh berkas CSV.'
      )
    } finally {
      setExporting(false)
    }
  }

  const kpi = reportData?.kpi
  const dailySales = reportData?.daily_sales || []
  const paymentMethods = reportData?.by_payment_method || []
  const topProducts = reportData?.top_products || []
  const cashierSummary = reportData?.by_cashier || []

  const totalOmset = kpi?.net_turnover?.current || 0
  const grossProfit = kpi?.gross_profit?.current || 0
  const totalTransaksi = kpi?.transaction_count?.current || 0
  const avgBasket = kpi?.average_transaction_value?.current || 0

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
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Header Halaman & Kontrol */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 tracking-tight">
            Laporan Penjualan
          </h2>
          <p className="text-xs text-zinc-500">
            {isAdmin ? 'Rekapitulasi penjualan & laba kotor' : 'Rekapitulasi penjualan kasir Anda'}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Tabs Periode */}
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

          {/* Tombol Ekspor CSV */}
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={exporting || loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
          >
            {exporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>Ekspor CSV</span>
          </button>

          {/* Refresh Manual */}
          <button
            type="button"
            disabled={loading}
            onClick={() => fetchReportData(true)}
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
          className="bg-white p-3 rounded-xl border border-zinc-200 shadow-xs flex flex-wrap items-center gap-2.5 text-xs"
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
      {error && !reportData && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex items-center justify-between text-xs text-rose-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchReportData(true)}
            className="px-2.5 py-1 rounded bg-rose-600 text-white font-medium text-xs hover:bg-rose-700"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Skeleton on First Load */}
      {loading && !reportData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white p-4 rounded-xl border border-zinc-200 h-24" />
          ))}
        </div>
      )}

      {reportData && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-white p-4 rounded-xl border border-zinc-200/80 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                Omzet Bersih
              </span>
              <div className="mt-2">
                <h3 className="text-xl font-semibold text-zinc-900 tracking-tight tabular-nums font-mono">
                  {formatRupiah(totalOmset)}
                </h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">Penjualan selesai</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-zinc-200/80 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                Estimasi Laba Kotor
              </span>
              <div className="mt-2">
                <h3 className="text-xl font-semibold text-emerald-600 tracking-tight tabular-nums font-mono">
                  {formatRupiah(grossProfit)}
                </h3>
                <p className="text-[11px] text-emerald-600/70 mt-0.5">Omzet dikurangi modal</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-zinc-200/80 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                Volume Transaksi
              </span>
              <div className="mt-2">
                <h3 className="text-xl font-semibold text-zinc-900 tracking-tight tabular-nums font-mono">
                  {totalTransaksi}
                  <span className="text-xs font-normal text-zinc-500 ml-1">struk</span>
                </h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">Nota kasir selesai</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-zinc-200/80 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                Rata-rata Transaksi (AOV)
              </span>
              <div className="mt-2">
                <h3 className="text-xl font-semibold text-zinc-900 tracking-tight tabular-nums font-mono">
                  {formatRupiah(avgBasket)}
                </h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">Nilai per struk</p>
              </div>
            </div>
          </div>

          {/* Grid: Daily Sales & Payment Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Tabel Penjualan per Hari */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-zinc-200/80 shadow-xs overflow-hidden flex flex-col justify-between">
              <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900">
                    Penjualan Harian
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    {formatDateOnly(reportData.start_date)} — {formatDateOnly(reportData.end_date)}
                  </p>
                </div>
                <span className="text-xs font-medium text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded">
                  {dailySales.length} hari
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-zinc-600">
                  <thead className="bg-zinc-50 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-100">
                    <tr>
                      <th className="px-4 py-2.5">Tanggal</th>
                      <th className="px-4 py-2.5">Hari</th>
                      <th className="px-4 py-2.5 text-center">Transaksi</th>
                      <th className="px-4 py-2.5 text-center">Item</th>
                      <th className="px-4 py-2.5 text-right">Omzet</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {dailySales.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-zinc-400">
                          Tidak ada transaksi pada periode ini
                        </td>
                      </tr>
                    ) : (
                      dailySales.map((d) => (
                        <tr key={d.date} className="hover:bg-zinc-50/70">
                          <td className="px-4 py-2.5 font-mono text-[11px] text-zinc-800">
                            {formatDateOnly(d.date)}
                          </td>
                          <td className="px-4 py-2.5 text-zinc-700">
                            {d.day_name}
                          </td>
                          <td className="px-4 py-2.5 text-center font-mono">
                            {d.count}
                          </td>
                          <td className="px-4 py-2.5 text-center text-zinc-500 font-mono">
                            {d.items_sold}
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium text-zinc-900 tabular-nums font-mono">
                            {formatRupiah(d.total)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {dailySales.length > 0 && (
                    <tfoot className="bg-zinc-50 font-semibold text-zinc-900 border-t border-zinc-200">
                      <tr>
                        <td colSpan={2} className="px-4 py-2.5">
                          Total
                        </td>
                        <td className="px-4 py-2.5 text-center font-mono">
                          {totalTransaksi}
                        </td>
                        <td className="px-4 py-2.5 text-center font-mono">
                          {kpi?.items_sold?.current || 0}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-mono">
                          {formatRupiah(totalOmset)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* Rekap Metode Bayar */}
            <div className="bg-white p-4 rounded-xl border border-zinc-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-zinc-900">
                    Metode Pembayaran
                  </h3>
                  <span className="text-[11px] text-zinc-400">
                    {paymentMethods.length} jalur
                  </span>
                </div>

                {paymentMethods.length === 0 ? (
                  <p className="text-xs text-zinc-400 py-6 text-center">
                    Belum ada metode bayar tercatat
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {paymentMethods.map((pm) => (
                      <div
                        key={pm.payment_method}
                        className="p-2.5 rounded-lg border border-zinc-100 bg-zinc-50/70 space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-zinc-800">
                            {getMethodLabel(pm.payment_method)}
                          </span>
                          <span className="font-semibold text-zinc-900 tabular-nums font-mono">
                            {formatRupiah(pm.total)}
                          </span>
                        </div>
                        <div className="flex justify-between text-[10px] text-zinc-400">
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
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-100 text-[10px] text-zinc-400 flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span>Gunakan Ekspor CSV untuk rekap lengkap</span>
              </div>
            </div>
          </div>

          {/* Grid: Produk Terlaris & Penjualan Kasir */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Top Products */}
            <div className="bg-white p-4 rounded-xl border border-zinc-200/80 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-500" />
                  <span>Produk Terlaris</span>
                </h3>
                <span className="text-[11px] text-zinc-400">Top 10</span>
              </div>

              {topProducts.length === 0 ? (
                <p className="text-xs text-zinc-400 py-6 text-center">
                  Belum ada produk terjual
                </p>
              ) : (
                <div className="space-y-2.5">
                  {topProducts.map((p, idx) => {
                    const maxQty = topProducts[0]?.total_quantity || 1
                    const pct = Math.round((p.total_quantity / maxQty) * 100)

                    return (
                      <div key={p.sku || p.product_name} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-zinc-800 truncate pr-2 flex items-center gap-1.5">
                            <span className="text-zinc-400 font-mono text-[10px]">
                              #{idx + 1}
                            </span>
                            <span className="truncate">{p.product_name}</span>
                          </span>
                          <span className="font-semibold text-zinc-900 shrink-0 tabular-nums font-mono">
                            {p.total_quantity} pcs
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-zinc-400 pl-4">
                          <span>{p.sku || '-'}</span>
                          <span className="tabular-nums font-mono">{formatRupiah(p.total_revenue)}</span>
                        </div>
                        <div className="w-full bg-zinc-100 rounded-full h-1 overflow-hidden ml-4 max-w-[calc(100%-1rem)]">
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

            {/* Cashier Sales */}
            {isAdmin && cashierSummary && cashierSummary.length > 0 ? (
              <div className="bg-white p-4 rounded-xl border border-zinc-200/80 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-zinc-900">
                    Penjualan per Kasir
                  </h3>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600">
                    Admin
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-zinc-600">
                    <thead className="bg-zinc-50 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-100">
                      <tr>
                        <th className="px-3 py-2">Kasir</th>
                        <th className="px-3 py-2 text-center">Transaksi</th>
                        <th className="px-3 py-2 text-right">Omzet</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {cashierSummary.map((c) => (
                        <tr key={c.user_id} className="hover:bg-zinc-50/70">
                          <td className="px-3 py-2.5 font-medium text-zinc-900">
                            {c.user_name}
                          </td>
                          <td className="px-3 py-2.5 text-center text-zinc-500 font-mono">
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
            ) : (
              <div className="bg-white p-4 rounded-xl border border-zinc-200/80 shadow-xs flex flex-col justify-center items-center text-center">
                <p className="text-xs font-medium text-zinc-700">Ringkasan Kasir</p>
                <p className="text-[11px] text-zinc-400 mt-0.5 max-w-xs">
                  {isAdmin ? 'Belum ada data transaksi staf kasir.' : 'Laporan mencerminkan transaksi aktif akun Anda.'}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
