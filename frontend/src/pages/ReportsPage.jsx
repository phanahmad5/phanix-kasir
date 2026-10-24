import React, { useState, useEffect, useCallback } from 'react'
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Award,
  Calendar,
  Layers,
  Download,
  RefreshCw,
  AlertCircle,
  Users,
  CreditCard,
  FileSpreadsheet,
  Loader2,
  Receipt,
  ArrowUpRight,
} from 'lucide-react'
import { reportService } from '../api/reports'
import { useAuth } from '../context/AuthContext'
import { formatRupiah, formatDateOnly } from '../utils/formatters'
import { Badge } from '../components/ui/Badge'

export function ReportsPage() {
  const { user, isAdmin } = useAuth()

  // State Filter Periode
  const [period, setPeriod] = useState('last_7_days')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [showCustomDate, setShowCustomDate] = useState(false)

  // State Data Laporan
  const [reportData, setReportData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // State Proses Ekspor CSV
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState(null)

  // Memuat data agregasi laporan penjualan dari backend API
  const fetchReportData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = { period }
      if (period === 'custom') {
        if (customStartDate) params.start_date = customStartDate
        if (customEndDate) params.end_date = customEndDate
      }

      const res = await reportService.getSummary(params)
      if (res?.success && res?.data) {
        setReportData(res.data)
      } else {
        setError('Format data laporan tidak valid.')
      }
    } catch (err) {
      console.error('Gagal memuat laporan penjualan:', err)
      setError(
        err.friendlyMessage ||
          err.response?.data?.message ||
          'Gagal mengambil laporan penjualan dari server.'
      )
    } finally {
      setLoading(false)
    }
  }, [period, customStartDate, customEndDate])

  useEffect(() => {
    if (period !== 'custom') {
      fetchReportData()
    }
  }, [period, fetchReportData])

  const handleApplyCustomDate = (e) => {
    e.preventDefault()
    if (!customStartDate || !customEndDate) return
    fetchReportData()
  }

  // Handler ekspor CSV resmi dari backend
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
      console.error('Gagal mengekspor CSV:', err)
      setExportError(
        err.friendlyMessage ||
          err.response?.data?.message ||
          'Gagal mengunduh berkas CSV. Periksa koneksi dan filter Anda.'
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
            Laporan & Rekapitulasi Penjualan
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isAdmin
              ? 'Laporan berkala seluruh penjualan kasir, laba kotor, dan ekspor CSV'
              : 'Laporan performa transaksi kasir Anda dan ekspor CSV'}
          </p>
        </div>

        {/* Action Controls: Periode & Ekspor CSV */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Tabs Periode */}
          <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-xs text-xs font-semibold">
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

          {/* Tombol Ekspor CSV */}
          <button
            type="button"
            disabled={exporting || loading}
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors shadow-xs disabled:opacity-50"
            title="Unduh Data Laporan ke File CSV"
          >
            {exporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>{exporting ? 'Mengunduh...' : 'Ekspor CSV'}</span>
          </button>

          {/* Tombol Refresh */}
          <button
            type="button"
            disabled={loading}
            onClick={fetchReportData}
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors shadow-xs disabled:opacity-50"
            title="Segarkan Data Laporan"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Rentang Tanggal Khusus */}
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

      {/* Notifikasi Error Ekspor CSV */}
      {exportError && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{exportError}</span>
        </div>
      )}

      {/* Notifikasi Error Fetching */}
      {error && !loading && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start justify-between gap-3 text-xs text-rose-800">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Gagal Mengambil Data Laporan</p>
              <p className="text-[11px] mt-0.5 text-rose-700">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchReportData}
            className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-colors shrink-0"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Loading Indicator */}
      {loading && !reportData && (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-xs">
          <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-blue-600" />
          <p className="text-xs font-semibold text-slate-700">Mengkalkulasi laporan penjualan...</p>
          <p className="text-[11px] text-slate-400 mt-1">Mengambil data agregasi transaksi dari basis data</p>
        </div>
      )}

      {reportData && (
        <>
          {/* KPI Cards Ringkasan Total Penjualan */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Omzet Penjualan */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Omzet Bersih
              </span>
              <h3 className="text-2xl font-bold text-slate-900 mt-2">
                {formatRupiah(totalOmset)}
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">Akumulasi pendapatan selesai</p>
            </div>

            {/* Estimasi Laba Kotor */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Estimasi Laba Kotor
              </span>
              <h3 className="text-2xl font-bold text-emerald-600 mt-2">
                {formatRupiah(grossProfit)}
              </h3>
              <p className="text-[11px] text-emerald-600/80 font-medium mt-1">
                Berdasarkan snapshot modal item
              </p>
            </div>

            {/* Volume Transaksi */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Volume Transaksi
              </span>
              <h3 className="text-2xl font-bold text-slate-900 mt-2">
                {totalTransaksi} Struk
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">Total nota kasir selesai</p>
            </div>

            {/* Rata-rata Nilai Transaksi (AOV) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Rata-rata Nilai Keranjang (AOV)
              </span>
              <h3 className="text-2xl font-bold text-blue-700 mt-2">
                {formatRupiah(avgBasket)}
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">Pembelian per transaksi</p>
            </div>
          </div>

          {/* Grid: Tabel Penjualan per Hari & Distribusi Pembayaran */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Tabel Penjualan per Hari (2 Kolom) */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col justify-between">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-600" />
                    <span>Rincian Penjualan per Hari</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Akumulasi transaksi pada rentang {formatDateOnly(reportData.start_date)} s/d {formatDateOnly(reportData.end_date)}
                  </p>
                </div>
                <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                  {dailySales.length} Hari
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-3">Tanggal</th>
                      <th className="px-6 py-3">Hari</th>
                      <th className="px-6 py-3 text-center">Transaksi</th>
                      <th className="px-6 py-3 text-center">Barang Terjual</th>
                      <th className="px-6 py-3 text-right">Omzet Penjualan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dailySales.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-10 text-center text-slate-400">
                          Tidak ada transaksi pada periode ini.
                        </td>
                      </tr>
                    ) : (
                      dailySales.map((d) => (
                        <tr key={d.date} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-6 py-3.5 font-medium text-slate-900 font-mono">
                            {formatDateOnly(d.date)}
                          </td>
                          <td className="px-6 py-3.5 font-medium text-slate-700">
                            {d.day_name}
                          </td>
                          <td className="px-6 py-3.5 text-center font-medium">
                            {d.count} trs
                          </td>
                          <td className="px-6 py-3.5 text-center text-slate-500">
                            {d.items_sold} pcs
                          </td>
                          <td className="px-6 py-3.5 text-right font-bold text-slate-900">
                            {formatRupiah(d.total)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {dailySales.length > 0 && (
                    <tfoot className="bg-slate-50/80 font-bold text-slate-900 border-t border-slate-200">
                      <tr>
                        <td colSpan={2} className="px-6 py-3.5">
                          TOTAL PERIODE
                        </td>
                        <td className="px-6 py-3.5 text-center">
                          {totalTransaksi} trs
                        </td>
                        <td className="px-6 py-3.5 text-center">
                          {kpi?.items_sold?.current || 0} pcs
                        </td>
                        <td className="px-6 py-3.5 text-right text-blue-700">
                          {formatRupiah(totalOmset)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* Rekap Metode Pembayaran (1 Kolom) */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-indigo-600" />
                    <span>Rekap Metode Bayar</span>
                  </h3>
                  <span className="text-[11px] font-semibold text-slate-400">
                    {paymentMethods.length} Jalur
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-4">
                  Total omzet berdasarkan saluran pembayaran transaksi
                </p>

                {paymentMethods.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">
                    Belum ada metode bayar tercatat.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {paymentMethods.map((pm) => (
                      <div
                        key={pm.payment_method}
                        className="p-3 rounded-xl border border-slate-100 bg-slate-50/70 space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-800">
                            {getMethodLabel(pm.payment_method)}
                          </span>
                          <span className="font-bold text-blue-700">
                            {formatRupiah(pm.total)}
                          </span>
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-400">
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
                    ))}
                  </div>
                )}
              </div>

              {/* Info Ekspor */}
              <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] text-slate-400 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Gunakan tombol "Ekspor CSV" di atas untuk unduhan spreadsheet nota lengkap.</span>
              </div>
            </div>
          </div>

          {/* Grid: Produk Terlaris & Penjualan per Kasir */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top 10 Produk Terlaris */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-500" />
                  <span>10 Produk Terlaris (Top Sellers)</span>
                </h3>
                <span className="text-[11px] font-semibold text-slate-400">Snapshot Item</span>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Peringkat produk berdasarkan akumulasi kuantitas penjualan
              </p>

              {topProducts.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">
                  Belum ada produk yang terjual pada periode ini.
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
                            <span className="w-5 text-slate-400 font-mono text-[11px] font-bold">
                              #{idx + 1}
                            </span>
                            <span className="truncate">{p.product_name}</span>
                          </span>
                          <span className="font-bold text-slate-900 shrink-0">
                            {p.total_quantity} terjual
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400 pl-6">
                          <span>SKU: {p.sku || '-'}</span>
                          <span>Omzet: {formatRupiah(p.total_revenue)}</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden ml-6 max-w-[calc(100%-1.5rem)]">
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

            {/* Penjualan per Kasir (Hanya Muncul untuk Admin) */}
            {isAdmin && cashierSummary && cashierSummary.length > 0 ? (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-600" />
                    <span>Rekap Penjualan per Kasir</span>
                  </h3>
                  <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">
                    Khusus Admin
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-4">
                  Performa dan kontribusi setiap staf kasir terhadap total omzet toko
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                      <tr>
                        <th className="px-4 py-2.5">Nama Kasir</th>
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
            ) : (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-center items-center text-center">
                <Receipt className="w-10 h-10 text-slate-300 mb-2" />
                <h4 className="text-sm font-bold text-slate-700">Laporan Penjualan Kasir</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  {isAdmin
                    ? 'Belum ada transaksi kasir yang tercatat pada rentang tanggal ini.'
                    : 'Seluruh angka laporan di atas merefleksikan transaksi penjualan resmi kasir Anda.'}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
