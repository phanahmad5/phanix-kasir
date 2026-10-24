import React, { useState, useEffect, useCallback } from 'react'
import {
  Search,
  Receipt,
  Eye,
  Printer,
  Calendar,
  CreditCard,
  Loader2,
  RefreshCw,
  AlertCircle,
  X,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckCircle2,
  Clock,
  User,
  ShoppingBag,
} from 'lucide-react'
import { transactionService } from '../api/transactions'
import { useAuth } from '../context/AuthContext'
import { formatRupiah, formatDate } from '../utils/formatters'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'

export function TransactionsPage() {
  const { user, isAdmin } = useAuth()

  // --- State Riwayat Transaksi dari REST API ---
  const [transactions, setTransactions] = useState([])
  const [meta, setMeta] = useState({
    current_page: 1,
    last_page: 1,
    per_page: 15,
    total: 0,
  })
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)

  // --- Filter & Pencarian ---
  const [searchQuery, setSearchQuery] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [methodFilter, setMethodFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [currentPage, setCurrentPage] = useState(1)
  const [perPage, setPerPage] = useState(15)

  // --- State Detail Transaksi ---
  const [selectedTransaction, setSelectedTransaction] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [detailError, setDetailError] = useState(null)

  // --- State Modal Cetak Ulang Struk ---
  const [receiptToPrint, setReceiptToPrint] = useState(null)

  // Memuat data riwayat transaksi dari backend API
  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    setFetchError(null)

    try {
      const params = {
        page: currentPage,
        per_page: perPage,
      }

      if (searchQuery.trim()) {
        params.search = searchQuery.trim()
      }
      if (startDate) {
        params.start_date = startDate
      }
      if (endDate) {
        params.end_date = endDate
      }
      if (methodFilter !== 'ALL') {
        params.payment_method = methodFilter
      }
      if (statusFilter !== 'ALL') {
        params.status = statusFilter
      }

      const res = await transactionService.getAll(params)

      if (res?.success && Array.isArray(res?.data)) {
        setTransactions(res.data)
        if (res.meta) {
          setMeta(res.meta)
        }
      } else {
        setTransactions([])
      }
    } catch (err) {
      console.error('Gagal memuat riwayat transaksi:', err)
      setFetchError(
        err.friendlyMessage ||
          err.response?.data?.message ||
          'Gagal mengambil riwayat transaksi dari server.'
      )
    } finally {
      setLoading(false)
    }
  }, [currentPage, perPage, searchQuery, startDate, endDate, methodFilter, statusFilter])

  // Reset pagination ke halaman 1 saat filter atau pencarian berubah
  const handleFilterChange = () => {
    setCurrentPage(1)
  }

  // Debounce pemanggilan API saat pengguna mengetik nomor invoice
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTransactions()
    }, 300)
    return () => clearTimeout(timer)
  }, [fetchTransactions])

  // Reset seluruh filter ke nilai default
  const handleResetFilters = () => {
    setSearchQuery('')
    setStartDate('')
    setEndDate('')
    setMethodFilter('ALL')
    setStatusFilter('ALL')
    setCurrentPage(1)
  }

  const isFiltered = Boolean(
    searchQuery.trim() ||
      startDate ||
      endDate ||
      methodFilter !== 'ALL' ||
      statusFilter !== 'ALL'
  )

  // Membuka modal detail transaksi & mengambil data rincian snapshot resmi dari server
  async function handleOpenDetail(tx) {
    setSelectedTransaction(tx)
    setLoadingDetail(true)
    setDetailError(null)

    try {
      const res = await transactionService.getById(tx.id)
      if (res?.success && res?.data) {
        setSelectedTransaction(res.data)
      }
    } catch (err) {
      console.error('Gagal mengambil rincian detail transaksi:', err)
      setDetailError(
        err.friendlyMessage ||
          err.response?.data?.message ||
          'Tidak dapat memuat rincian lengkap transaksi.'
      )
    } finally {
      setLoadingDetail(false)
    }
  }

  // Membuka modal struk untuk cetak ulang dari transaksi terpilih
  async function handleOpenReceipt(tx) {
    // Jika data item sudah lengkap, langsung buka modal struk
    if (tx.items && tx.items.length > 0) {
      setReceiptToPrint(tx)
      return
    }

    // Jika belum lengkap, panggil getById terlebih dahulu
    try {
      const res = await transactionService.getById(tx.id)
      if (res?.success && res?.data) {
        setReceiptToPrint(res.data)
      } else {
        setReceiptToPrint(tx)
      }
    } catch {
      setReceiptToPrint(tx)
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Riwayat Transaksi Penjualan
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isAdmin
              ? 'Daftar seluruh penjualan yang tercatat dalam sistem dari seluruh kasir'
              : 'Daftar riwayat transaksi penjualan kasir Anda'}
          </p>
        </div>

        {/* Tombol Segarkan Data */}
        <button
          type="button"
          disabled={loading}
          onClick={fetchTransactions}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          <span>Muat Ulang</span>
        </button>
      </div>

      {/* Filter & Bar Pencarian */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Pencarian Nomor Invoice */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nomor invoice (INV-...)..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                handleFilterChange()
              }}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Filter Tanggal Mulai */}
          <div className="relative">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                handleFilterChange()
              }}
              title="Tanggal Mulai"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Filter Tanggal Akhir */}
          <div className="relative">
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => {
                setEndDate(e.target.value)
                handleFilterChange()
              }}
              title="Tanggal Akhir"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Filter Metode Pembayaran */}
          <div>
            <select
              value={methodFilter}
              onChange={(e) => {
                setMethodFilter(e.target.value)
                handleFilterChange()
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="ALL">Semua Metode Bayar</option>
              <option value="cash">Tunai (Cash)</option>
              <option value="qris">QRIS</option>
              <option value="transfer">Transfer Bank</option>
              <option value="debit">Kartu Debit</option>
            </select>
          </div>
        </div>

        {/* Baris Status & Tombol Reset Filter */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium text-[11px]">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                handleFilterChange()
              }}
              className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">Semua Status</option>
              <option value="completed">Completed (Selesai)</option>
            </select>
          </div>

          {isFiltered && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* Banner Notifikasi Error State */}
      {fetchError && !loading && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start justify-between gap-3 text-xs text-rose-800">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Gagal Mengambil Data Riwayat Transaksi</p>
              <p className="text-[11px] mt-0.5 text-rose-700 leading-relaxed">{fetchError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchTransactions}
            className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-colors shrink-0"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Tabel Riwayat Transaksi */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-100">
              <tr>
                <th className="px-6 py-3.5">No. Invoice</th>
                <th className="px-6 py-3.5">Waktu Transaksi</th>
                <th className="px-6 py-3.5">Kasir</th>
                <th className="px-6 py-3.5">Metode</th>
                <th className="px-6 py-3.5 text-center">Item</th>
                <th className="px-6 py-3.5 text-right">Subtotal</th>
                <th className="px-6 py-3.5 text-right">Diskon</th>
                <th className="px-6 py-3.5 text-right">Total Belanja</th>
                <th className="px-6 py-3.5 text-center">Status</th>
                <th className="px-6 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-14 text-center text-slate-400">
                    <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-blue-600" />
                    <p className="font-semibold text-slate-700 text-xs">Memuat data transaksi dari server...</p>
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-14 text-center text-slate-400">
                    <Receipt className="w-9 h-9 mx-auto mb-2 text-slate-300" />
                    <p className="font-bold text-slate-700 text-xs">Tidak ada transaksi ditemukan.</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {isFiltered
                        ? 'Coba sesuaikan kata kunci pencarian atau rentang tanggal filter Anda.'
                        : 'Belum ada transaksi penjualan yang tercatat dalam sistem.'}
                    </p>
                  </td>
                </tr>
              ) : (
                transactions.map((t) => {
                  const itemsCount = t.items?.length || 0
                  const discountVal = Number(t.discount) || 0

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Nomor Invoice */}
                      <td className="px-6 py-4 font-mono font-bold text-slate-900">
                        {t.invoice_number}
                      </td>

                      {/* Waktu Transaksi */}
                      <td className="px-6 py-4 text-slate-600 whitespace-nowrap">
                        {formatDate(t.created_at)}
                      </td>

                      {/* Kasir */}
                      <td className="px-6 py-4 font-medium text-slate-800">
                        {t.user?.name || '-'}
                      </td>

                      {/* Metode Pembayaran */}
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-semibold text-[11px] uppercase">
                          <CreditCard className="w-3 h-3 text-slate-400" />
                          {t.payment_method}
                        </span>
                      </td>

                      {/* Jumlah Macam Item */}
                      <td className="px-6 py-4 text-center font-medium">
                        {itemsCount} item
                      </td>

                      {/* Subtotal */}
                      <td className="px-6 py-4 text-right text-slate-600">
                        {formatRupiah(t.subtotal)}
                      </td>

                      {/* Diskon */}
                      <td className="px-6 py-4 text-right">
                        {discountVal > 0 ? (
                          <span className="text-rose-600 font-semibold">
                            -{formatRupiah(discountVal)}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Total Akhir */}
                      <td className="px-6 py-4 text-right font-bold text-blue-700 text-xs">
                        {formatRupiah(t.total)}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 text-center">
                        <Badge variant="success">
                          <CheckCircle2 className="w-3 h-3" />
                          {t.status === 'completed' ? 'Selesai' : t.status}
                        </Badge>
                      </td>

                      {/* Tombol Aksi */}
                      <td className="px-6 py-4 text-right whitespace-nowrap space-x-1.5">
                        <button
                          type="button"
                          id={`btn-detail-${t.id}`}
                          onClick={() => handleOpenDetail(t)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-600 hover:text-blue-700 hover:bg-blue-50 font-semibold text-[11px] transition-colors"
                          title="Lihat Rincian Detail Invoice"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Rincian</span>
                        </button>
                        <button
                          type="button"
                          id={`btn-print-${t.id}`}
                          onClick={() => handleOpenReceipt(t)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-semibold text-[11px] transition-colors"
                          title="Cetak Ulang Struk Kasir"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Struk</span>
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Kontrol Pagination Server-Side */}
        {!loading && meta.total > 0 && (
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span>
                Menampilkan{' '}
                <strong className="text-slate-900">
                  {Math.min((meta.current_page - 1) * meta.per_page + 1, meta.total)}
                </strong>
                -
                <strong className="text-slate-900">
                  {Math.min(meta.current_page * meta.per_page, meta.total)}
                </strong>{' '}
                dari <strong className="text-slate-900">{meta.total}</strong> transaksi
              </span>

              <span className="text-slate-300">|</span>

              <select
                value={perPage}
                onChange={(e) => {
                  setPerPage(Number(e.target.value))
                  setCurrentPage(1)
                }}
                className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value={10}>10 / hal</option>
                <option value={15}>15 / hal</option>
                <option value={25}>25 / hal</option>
                <option value={50}>50 / hal</option>
              </select>
            </div>

            {/* Tombol Sebelumnya & Selanjutnya */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">
                Halaman {meta.current_page} dari {meta.last_page}
              </span>
              <button
                type="button"
                id="btn-prev-page"
                disabled={meta.current_page <= 1 || loading}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Halaman Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                id="btn-next-page"
                disabled={meta.current_page >= meta.last_page || loading}
                onClick={() => setCurrentPage((p) => Math.min(meta.last_page, p + 1))}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Halaman Selanjutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DETAIL INVOICE TRANSAKSI */}
      <Modal
        isOpen={Boolean(selectedTransaction)}
        onClose={() => setSelectedTransaction(null)}
        title={`Rincian Transaksi #${selectedTransaction?.invoice_number || ''}`}
        maxWidth="max-w-lg"
      >
        {selectedTransaction && (
          <div className="space-y-4">
            {detailError && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{detailError}</span>
              </div>
            )}

            {/* Informasi Metadata Transaksi */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Waktu Transaksi:</span>
                <span className="font-semibold text-slate-800">
                  {formatDate(selectedTransaction.created_at)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Kasir Penanggung Jawab:</span>
                <span className="font-semibold text-slate-800">
                  {selectedTransaction.user?.name || '-'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Metode Pembayaran:</span>
                <span className="font-semibold uppercase text-slate-800">
                  {selectedTransaction.payment_method}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Status Transaksi:</span>
                <span className="font-semibold text-emerald-700 capitalize">
                  {selectedTransaction.status === 'completed'
                    ? 'Selesai / Lunas'
                    : selectedTransaction.status}
                </span>
              </div>
            </div>

            {/* Rincian Item (Snapshot transaction_items dari Basis Data) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5 text-blue-600" />
                  <span>Item yang Dibeli (Snapshot):</span>
                </h4>
                <span className="text-[11px] text-slate-400">
                  {selectedTransaction.items?.length || 0} ragam barang
                </span>
              </div>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto bg-white">
                {loadingDetail ? (
                  <div className="p-6 text-center text-slate-400">
                    <Loader2 className="w-5 h-5 mx-auto mb-1 animate-spin text-blue-600" />
                    <span className="text-[11px]">Memuat snapshot item transaksi...</span>
                  </div>
                ) : (selectedTransaction.items || []).length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-xs">
                    Tidak ada item yang tercatat.
                  </div>
                ) : (
                  (selectedTransaction.items || []).map((it) => (
                    <div key={it.id} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50/50">
                      <div className="min-w-0 pr-3">
                        <p className="font-semibold text-slate-900 truncate">
                          {it.product_name}
                        </p>
                        <p className="text-[11px] text-slate-400 font-mono">
                          {it.sku || '-'} • {it.quantity} × {formatRupiah(it.unit_price)}
                        </p>
                      </div>
                      <span className="font-bold text-slate-900 shrink-0">
                        {formatRupiah(it.subtotal)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Ringkasan Biaya Otoritatif Server */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-semibold text-slate-900">
                  {formatRupiah(selectedTransaction.subtotal)}
                </span>
              </div>

              {Number(selectedTransaction.discount) > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Diskon Penjualan</span>
                  <span className="font-semibold">
                    -{formatRupiah(selectedTransaction.discount)}
                  </span>
                </div>
              )}

              <div className="flex justify-between font-bold text-slate-900 text-sm pt-2 border-t border-slate-200">
                <span>Total Akhir</span>
                <span className="text-blue-700">{formatRupiah(selectedTransaction.total)}</span>
              </div>

              <div className="flex justify-between pt-1">
                <span>Nominal Pembayaran Diterima</span>
                <span className="font-semibold text-slate-800">
                  {formatRupiah(selectedTransaction.paid_amount)}
                </span>
              </div>

              <div className="flex justify-between font-semibold text-slate-800">
                <span>Kembalian</span>
                <span className="text-emerald-700">
                  {formatRupiah(selectedTransaction.change_amount)}
                </span>
              </div>
            </div>

            {/* Tombol Aksi Modal */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                id="btn-modal-reprint"
                onClick={() => {
                  const tx = selectedTransaction
                  setSelectedTransaction(null)
                  handleOpenReceipt(tx)
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Ulang Struk</span>
              </button>

              <button
                type="button"
                id="btn-close-detail"
                onClick={() => setSelectedTransaction(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL STRUK RESMI UNTUK CETAK ULANG */}
      <Modal
        isOpen={Boolean(receiptToPrint)}
        onClose={() => setReceiptToPrint(null)}
        title="Cetak Ulang Struk Transaksi Resmi"
        maxWidth="max-w-sm"
      >
        {receiptToPrint && (
          <div className="space-y-4">
            {/* Banner Konfirmasi Struk Resmi */}
            <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-[11px] text-blue-800 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
              <span>
                <strong>Struk Resmi Database:</strong> Data struk diambil langsung dari catatan
                transaksi tersimpan. Pencetakan tidak mengubah stok maupun membuat transaksi baru.
              </span>
            </div>

            {/* Thermal Receipt Paper (Khusus Media Cetak @media print) */}
            <div
              id="receipt-print-area"
              className="bg-slate-50 border border-slate-200 rounded-xl p-4 font-mono text-[11px] text-slate-700 space-y-3"
            >
              <div className="text-center border-b border-dashed border-slate-300 pb-3">
                <h4 className="font-bold text-sm text-slate-900">PHANIX POS</h4>
                <p className="text-[10px] text-slate-500">Toko Berkah Mandiri UMKM</p>
                <p className="text-[10px] text-slate-500">Jl. Raya UMKM No. 12, Indonesia</p>
                <div className="mt-2 pt-2 border-t border-slate-200 text-left text-[10px] space-y-0.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Invoice:</span>
                    <span className="font-bold text-slate-800">{receiptToPrint.invoice_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Waktu:</span>
                    <span className="text-slate-700">{formatDate(receiptToPrint.created_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Kasir:</span>
                    <span className="text-slate-700">
                      {receiptToPrint.user?.name || user?.name || 'Kasir'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Metode:</span>
                    <span className="font-semibold uppercase text-slate-700">
                      {receiptToPrint.payment_method}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items Dari Snapshot Database */}
              <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-3">
                {(receiptToPrint.items || []).map((it) => (
                  <div key={it.id || it.product_id} className="flex justify-between items-start">
                    <div className="pr-2">
                      <div className="text-slate-900 font-medium">{it.product_name}</div>
                      <div className="text-[10px] text-slate-400">
                        {it.quantity} × {formatRupiah(it.unit_price)}
                      </div>
                    </div>
                    <span className="font-bold text-slate-900 shrink-0">
                      {formatRupiah(it.subtotal)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Ringkasan Biaya Otoritatif Server */}
              <div className="space-y-1 text-slate-600">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatRupiah(receiptToPrint.subtotal)}</span>
                </div>
                {Number(receiptToPrint.discount) > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Diskon:</span>
                    <span>-{formatRupiah(receiptToPrint.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-slate-900 text-xs pt-1 border-t border-slate-200">
                  <span>TOTAL:</span>
                  <span className="text-blue-700">{formatRupiah(receiptToPrint.total)}</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span>Bayar:</span>
                  <span>{formatRupiah(receiptToPrint.paid_amount)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900">
                  <span>Kembalian:</span>
                  <span className="text-emerald-700">{formatRupiah(receiptToPrint.change_amount)}</span>
                </div>
              </div>

              <div className="text-center pt-3 border-t border-dashed border-slate-300 text-[10px] text-slate-400">
                <p>Terima kasih atas kunjungan Anda!</p>
                <p>Barang yang sudah dibeli tidak dapat ditukar.</p>
              </div>
            </div>

            {/* Tombol Cetak & Tutup */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                id="btn-do-print"
                onClick={() => window.print()}
                className="flex-1 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                Cetak Struk
              </button>
              <button
                type="button"
                id="btn-close-receipt"
                onClick={() => setReceiptToPrint(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
