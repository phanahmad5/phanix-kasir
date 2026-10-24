import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Search,
  Filter,
  Eye,
  Printer,
  RefreshCw,
  AlertCircle,
  Receipt,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  CreditCard,
  Loader2,
} from 'lucide-react'
import { transactionService } from '../api/transactions'
import { useAuth } from '../context/AuthContext'
import { formatRupiah, formatDate } from '../utils/formatters'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { getCache, setCache } from '../utils/cache'

export function TransactionsPage() {
  const { user } = useAuth()

  // Filter & Pencarian
  const [searchQuery, setSearchQuery] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [methodFilter, setMethodFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [currentPage, setCurrentPage] = useState(1)
  const [perPage, setPerPage] = useState(15)

  // Cache Key
  const cacheKey = useMemo(() => {
    return `transactions:${currentPage}:${perPage}:${searchQuery.trim()}:${startDate}:${endDate}:${methodFilter}:${statusFilter}`
  }, [currentPage, perPage, searchQuery, startDate, endDate, methodFilter, statusFilter])

  // Inisialisasi dari cache agar instan tanpa loading
  const cachedInitial = getCache(cacheKey)
  const [transactions, setTransactions] = useState(() => cachedInitial?.data || [])
  const [meta, setMeta] = useState(() => cachedInitial?.meta || {
    current_page: 1,
    last_page: 1,
    per_page: 15,
    total: 0,
  })
  const [loading, setLoading] = useState(() => !cachedInitial)
  const [fetchError, setFetchError] = useState(null)

  // State Detail Transaksi
  const [selectedTransaction, setSelectedTransaction] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [detailError, setDetailError] = useState(null)

  // State Modal Cetak Ulang Struk
  const [receiptToPrint, setReceiptToPrint] = useState(null)

  // Memuat data riwayat transaksi
  const fetchTransactions = useCallback(async (isManualRefresh = false) => {
    const cached = getCache(cacheKey)
    if (!cached || isManualRefresh) {
      setLoading(true)
    }
    setFetchError(null)

    try {
      const params = {
        page: currentPage,
        per_page: perPage,
      }
      if (searchQuery.trim()) params.search = searchQuery.trim()
      if (startDate) params.start_date = startDate
      if (endDate) params.end_date = endDate
      if (methodFilter !== 'ALL') params.payment_method = methodFilter
      if (statusFilter !== 'ALL') params.status = statusFilter

      const res = await transactionService.getAll(params)

      if (res?.success && Array.isArray(res?.data)) {
        const cachePayload = { data: res.data, meta: res.meta }
        setCache(cacheKey, cachePayload)
        setTransactions(res.data)
        if (res.meta) setMeta(res.meta)
      } else {
        setTransactions([])
      }
    } catch (err) {
      if (!cached) {
        setFetchError(
          err.friendlyMessage ||
            err.response?.data?.message ||
            'Gagal mengambil riwayat transaksi.'
        )
      }
    } finally {
      setLoading(false)
    }
  }, [cacheKey, currentPage, perPage, searchQuery, startDate, endDate, methodFilter, statusFilter])

  useEffect(() => {
    const cached = getCache(cacheKey)
    if (cached) {
      setTransactions(cached.data)
      if (cached.meta) setMeta(cached.meta)
      setLoading(false)
    }
  }, [cacheKey])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTransactions()
    }, 200)
    return () => clearTimeout(timer)
  }, [fetchTransactions])

  const handleResetFilter = () => {
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

  async function handleOpenDetail(tx) {
    setSelectedTransaction(tx)
    setDetailError(null)

    if (!tx.items || tx.items.length === 0) {
      setLoadingDetail(true)
      try {
        const res = await transactionService.getById(tx.id)
        if (res?.success && res?.data) {
          setSelectedTransaction(res.data)
        }
      } catch (err) {
        setDetailError('Gagal memuat rincian detail barang.')
      } finally {
        setLoadingDetail(false)
      }
    }
  }

  async function handleOpenReceipt(tx) {
    if (tx.items && tx.items.length > 0) {
      setReceiptToPrint(tx)
    } else {
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
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 tracking-tight">Riwayat Transaksi</h2>
          <p className="text-xs text-zinc-500">
            {meta.total} transaksi tercatat
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchTransactions(true)}
          disabled={loading}
          className="self-start sm:self-auto p-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 transition-colors disabled:opacity-50 cursor-pointer"
          title="Segarkan data transaksi"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-zinc-900' : ''}`} />
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-3 rounded-xl border border-zinc-200/80 shadow-xs space-y-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Cari no. invoice..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-zinc-200 text-xs focus:outline-none focus:border-zinc-900"
            />
          </div>

          {/* Date Range */}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full px-2 py-1.5 rounded-lg border border-zinc-200 text-xs bg-white focus:outline-none focus:border-zinc-900"
              title="Dari tanggal"
            />
            <span className="text-zinc-400 text-xs">-</span>
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => {
                setEndDate(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full px-2 py-1.5 rounded-lg border border-zinc-200 text-xs bg-white focus:outline-none focus:border-zinc-900"
              title="Sampai tanggal"
            />
          </div>

          {/* Payment Method */}
          <div>
            <select
              value={methodFilter}
              onChange={(e) => {
                setMethodFilter(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 text-xs bg-white focus:outline-none focus:border-zinc-900"
            >
              <option value="ALL">Semua Pembayaran</option>
              <option value="cash">Tunai (Cash)</option>
              <option value="qris">QRIS</option>
              <option value="transfer">Transfer Bank</option>
              <option value="debit">Kartu Debit</option>
            </select>
          </div>

          {/* Reset Filter Button */}
          {isFiltered && (
            <div className="flex items-center">
              <button
                type="button"
                onClick={handleResetFilter}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              >
                Reset Filter
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Error State */}
      {fetchError && !loading && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex items-center justify-between text-xs text-rose-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{fetchError}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchTransactions(true)}
            className="px-2.5 py-1 rounded bg-rose-600 text-white font-medium text-xs hover:bg-rose-700"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Transactions Table */}
      <div className="bg-white rounded-xl border border-zinc-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-600">
            <thead className="bg-zinc-50 text-[10px] uppercase tracking-wider text-zinc-400 font-semibold border-b border-zinc-100">
              <tr>
                <th className="px-4 py-3">No. Invoice</th>
                <th className="px-4 py-3">Waktu</th>
                <th className="px-4 py-3">Kasir</th>
                <th className="px-4 py-3">Metode</th>
                <th className="px-4 py-3 text-center">Item</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading && transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-zinc-400">
                    <Loader2 className="w-5 h-5 mx-auto mb-1 animate-spin text-zinc-600" />
                    <span>Memuat transaksi...</span>
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-zinc-400">
                    <Receipt className="w-6 h-6 mx-auto mb-1 text-zinc-300" />
                    <p className="font-medium text-zinc-700 text-xs">Tidak ada transaksi ditemukan</p>
                  </td>
                </tr>
              ) : (
                transactions.map((t) => {
                  const itemsCount = t.items?.length || 0

                  return (
                    <tr key={t.id} className="hover:bg-zinc-50/70 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium text-zinc-900 text-[11px]">
                        {t.invoice_number}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 whitespace-nowrap text-[11px]">
                        {formatDate(t.created_at)}
                      </td>
                      <td className="px-4 py-3 font-medium text-zinc-800">
                        {t.user?.name || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-mono font-medium uppercase px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700">
                          {t.payment_method}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-zinc-500 tabular-nums font-mono">
                        {itemsCount}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-zinc-900 tabular-nums font-mono">
                        {formatRupiah(t.total)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="success" dot>
                          {t.status === 'completed' ? 'Selesai' : t.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            id={`btn-detail-${t.id}`}
                            onClick={() => handleOpenDetail(t)}
                            className="p-1 rounded text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors"
                            title="Rincian"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            id={`btn-print-${t.id}`}
                            onClick={() => handleOpenReceipt(t)}
                            className="p-1 rounded text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors"
                            title="Cetak Struk"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {meta.total > 0 && (
          <div className="p-3 border-t border-zinc-100 bg-zinc-50/50 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-zinc-500">
            <div className="flex items-center gap-2">
              <span>
                {Math.min((meta.current_page - 1) * meta.per_page + 1, meta.total)}
                -
                {Math.min(meta.current_page * meta.per_page, meta.total)} dari {meta.total}
              </span>
              <select
                value={perPage}
                onChange={(e) => {
                  setPerPage(Number(e.target.value))
                  setCurrentPage(1)
                }}
                className="px-1.5 py-0.5 rounded border border-zinc-200 bg-white text-xs text-zinc-700"
              >
                <option value={10}>10 / hal</option>
                <option value={15}>15 / hal</option>
                <option value={25}>25 / hal</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-zinc-400">
                Hal {meta.current_page} / {meta.last_page}
              </span>
              <button
                type="button"
                id="btn-prev-page"
                disabled={meta.current_page <= 1 || loading}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                id="btn-next-page"
                disabled={meta.current_page >= meta.last_page || loading}
                onClick={() => setCurrentPage((p) => Math.min(meta.last_page, p + 1))}
                className="p-1 rounded border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DETAIL INVOICE */}
      <Modal
        isOpen={Boolean(selectedTransaction)}
        onClose={() => setSelectedTransaction(null)}
        title={`Rincian #${selectedTransaction?.invoice_number || ''}`}
        maxWidth="max-w-md"
      >
        {selectedTransaction && (
          <div className="space-y-3.5">
            {detailError && (
              <div className="p-2 rounded bg-amber-50 text-amber-800 text-xs">
                {detailError}
              </div>
            )}

            {/* Metadata */}
            <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-zinc-50 border border-zinc-100 text-xs">
              <div>
                <span className="text-zinc-400 text-[10px] block">Waktu:</span>
                <span className="font-medium text-zinc-800">{formatDate(selectedTransaction.created_at)}</span>
              </div>
              <div>
                <span className="text-zinc-400 text-[10px] block">Kasir:</span>
                <span className="font-medium text-zinc-800">{selectedTransaction.user?.name || '-'}</span>
              </div>
              <div>
                <span className="text-zinc-400 text-[10px] block">Metode:</span>
                <span className="font-medium uppercase text-zinc-800">{selectedTransaction.payment_method}</span>
              </div>
              <div>
                <span className="text-zinc-400 text-[10px] block">Status:</span>
                <span className="font-medium text-emerald-700 capitalize">{selectedTransaction.status}</span>
              </div>
            </div>

            {/* Items */}
            <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-lg max-h-48 overflow-y-auto">
              {loadingDetail ? (
                <div className="p-4 text-center text-xs text-zinc-400">
                  <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1 text-zinc-600" />
                  <span>Memuat item...</span>
                </div>
              ) : (selectedTransaction.items || []).map((it) => (
                <div key={it.id} className="p-2.5 flex items-center justify-between text-xs">
                  <div className="min-w-0 pr-2">
                    <p className="font-medium text-zinc-900 truncate">{it.product_name}</p>
                    <p className="text-[10px] text-zinc-400 font-mono">
                      {it.quantity} × {formatRupiah(it.unit_price)}
                    </p>
                  </div>
                  <span className="font-medium text-zinc-900 tabular-nums font-mono shrink-0">
                    {formatRupiah(it.subtotal)}
                  </span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="p-2.5 rounded-lg bg-zinc-50 border border-zinc-100 space-y-1 text-xs text-zinc-600">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="tabular-nums font-mono">{formatRupiah(selectedTransaction.subtotal)}</span>
              </div>
              {Number(selectedTransaction.discount) > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Diskon:</span>
                  <span className="tabular-nums font-mono">-{formatRupiah(selectedTransaction.discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-zinc-900 pt-1 border-t border-zinc-200">
                <span>Total:</span>
                <span className="tabular-nums font-mono">{formatRupiah(selectedTransaction.total)}</span>
              </div>
              <div className="flex justify-between pt-0.5">
                <span>Tunai:</span>
                <span className="tabular-nums font-mono">{formatRupiah(selectedTransaction.paid_amount)}</span>
              </div>
              <div className="flex justify-between font-medium text-zinc-900">
                <span>Kembalian:</span>
                <span className="text-emerald-700 tabular-nums font-mono">{formatRupiah(selectedTransaction.change_amount)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  const tx = selectedTransaction
                  setSelectedTransaction(null)
                  handleOpenReceipt(tx)
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Struk</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedTransaction(null)}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Tutup
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL STRUK UNTUK CETAK ULANG */}
      <Modal
        isOpen={Boolean(receiptToPrint)}
        onClose={() => setReceiptToPrint(null)}
        title="Cetak Ulang Struk"
        maxWidth="max-w-sm"
      >
        {receiptToPrint && (
          <div className="space-y-3.5">
            <div id="receipt-print-area" className="bg-zinc-50 border border-zinc-200 rounded-lg p-3.5 font-mono text-[11px] text-zinc-700 space-y-2.5">
              <div className="text-center border-b border-dashed border-zinc-300 pb-2">
                <h4 className="font-bold text-xs text-zinc-900">PHANIX POS</h4>
                <p className="text-[10px] text-zinc-400">Salinan Struk Resmi</p>
                <div className="mt-2 text-left text-[10px] space-y-0.5 text-zinc-600">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Invoice:</span>
                    <span className="font-bold text-zinc-800">{receiptToPrint.invoice_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Waktu:</span>
                    <span>{formatDate(receiptToPrint.created_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Kasir:</span>
                    <span>{receiptToPrint.user?.name || user?.name || 'Kasir'}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1 border-b border-dashed border-zinc-300 pb-2">
                {(receiptToPrint.items || []).map((it) => (
                  <div key={it.id || it.product_id} className="flex justify-between items-start">
                    <div className="pr-2">
                      <div className="text-zinc-900 font-medium">{it.product_name}</div>
                      <div className="text-[10px] text-zinc-400">
                        {it.quantity} × {formatRupiah(it.unit_price)}
                      </div>
                    </div>
                    <span className="font-medium text-zinc-900 shrink-0 tabular-nums">
                      {formatRupiah(it.subtotal)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-1 text-zinc-600 text-[11px]">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="tabular-nums">{formatRupiah(receiptToPrint.subtotal)}</span>
                </div>
                {Number(receiptToPrint.discount) > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Diskon:</span>
                    <span className="tabular-nums">-{formatRupiah(receiptToPrint.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-zinc-900 text-xs pt-1 border-t border-zinc-200">
                  <span>TOTAL:</span>
                  <span className="tabular-nums">{formatRupiah(receiptToPrint.total)}</span>
                </div>
                <div className="flex justify-between pt-0.5">
                  <span>Bayar:</span>
                  <span className="tabular-nums">{formatRupiah(receiptToPrint.paid_amount)}</span>
                </div>
                <div className="flex justify-between font-semibold text-zinc-900">
                  <span>Kembalian:</span>
                  <span className="text-emerald-700 tabular-nums">{formatRupiah(receiptToPrint.change_amount)}</span>
                </div>
              </div>

              <div className="text-center pt-2 border-t border-dashed border-zinc-300 text-[10px] text-zinc-400">
                <p>Terima kasih atas kunjungan Anda!</p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                id="btn-do-print"
                onClick={() => window.print()}
                className="flex-1 py-1.5 rounded-lg bg-zinc-900 text-white text-xs font-medium flex items-center justify-center gap-1.5 hover:bg-zinc-800 transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Struk</span>
              </button>
              <button
                type="button"
                id="btn-close-receipt"
                onClick={() => setReceiptToPrint(null)}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
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
