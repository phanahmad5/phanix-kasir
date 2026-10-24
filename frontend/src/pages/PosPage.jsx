import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CheckCircle2,
  Printer,
  RotateCcw,
  Tag,
  AlertCircle,
  Coins,
  Package,
  Loader2,
  RefreshCw,
  X,
  Receipt,
  ShieldAlert,
} from 'lucide-react'
import { transactionService } from '../api/transactions'
import { useAuth } from '../context/AuthContext'
import { formatRupiah, formatDate } from '../utils/formatters'
import { Modal } from '../components/ui/Modal'

export function PosPage() {
  const { user } = useAuth()

  // --- State Katalog Produk & Kategori dari Database Backend ---
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [loadingCategories, setLoadingCategories] = useState(false)
  const [catalogError, setCatalogError] = useState(null)

  // Filter & Pencarian
  const [selectedCategory, setSelectedCategory] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  // --- State Keranjang Transaksi (React State Lokal Halaman Aktif) ---
  // Format item: [{ id, sku, name, selling_price, stock, qty }]
  const [cart, setCart] = useState([])
  const [discount, setDiscount] = useState('')
  const [cashGiven, setCashGiven] = useState('')

  // --- State Proses Transaksi & Notifikasi ---
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [checkoutError, setCheckoutError] = useState(null)
  const [isNetworkIssue, setIsNetworkIssue] = useState(false)
  const [activeIdempotencyKey, setActiveIdempotencyKey] = useState(null)
  const [toastMessage, setToastMessage] = useState(null)

  // --- State Modal Struk Resmi dari Backend ---
  const [receiptData, setReceiptData] = useState(null)

  // Memuat kategori produk dari database
  const fetchCategories = useCallback(async () => {
    setLoadingCategories(true)
    try {
      const res = await transactionService.getCategories()
      setCategories(res.data || [])
    } catch (err) {
      console.error('Gagal memuat kategori produk:', err)
    } finally {
      setLoadingCategories(false)
    }
  }, [])

  // Memuat katalog produk aktif dari database
  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true)
    setCatalogError(null)
    try {
      const params = {}
      if (searchQuery.trim()) {
        params.search = searchQuery.trim()
      }
      if (selectedCategory !== 'ALL') {
        params.category_id = selectedCategory
      }

      const res = await transactionService.getActiveProducts(params)
      // Pastikan hanya produk yang valid dan aktif dari backend
      const loaded = (res.data || []).filter((p) => p.is_active)
      setProducts(loaded)
    } catch (err) {
      setCatalogError(
        err.friendlyMessage || 'Gagal memuat daftar produk dari server backend.'
      )
    } finally {
      setLoadingProducts(false)
    }
  }, [searchQuery, selectedCategory])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  // Debounce pemanggilan API produk saat mengetik pencarian
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts()
    }, 250)
    return () => clearTimeout(timer)
  }, [fetchProducts])

  // Auto-dismiss pesan toast
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null)
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [toastMessage])

  // --- Operasi Keranjang Belanja ---

  // Menambahkan produk ke dalam keranjang
  function addToCart(product) {
    const isActive = Boolean(product.is_active ?? product.isActive ?? true)
    if (!isActive) {
      setToastMessage({
        type: 'error',
        text: `Produk "${product.name}" sedang dinonaktifkan.`,
      })
      return
    }

    const availableStock = Number(product.stock ?? 0)
    if (availableStock <= 0) {
      setToastMessage({
        type: 'error',
        text: `Stok produk "${product.name}" telah habis.`,
      })
      return
    }

    // Reset idempotensi jika ada item baru ditambahkan
    setActiveIdempotencyKey(null)
    setIsNetworkIssue(false)
    setCheckoutError(null)

    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id)
      if (existing) {
        if (existing.qty >= availableStock) {
          setToastMessage({
            type: 'warning',
            text: `Kuantitas telah mencapai batas maksimum stok (${availableStock} pcs).`,
          })
          return prev
        }
        return prev.map((item) =>
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item
        )
      }

      return [
        ...prev,
        {
          id: product.id,
          sku: product.sku,
          name: product.name,
          selling_price: Number(product.selling_price ?? product.sellingPrice) || 0,
          stock: availableStock,
          qty: 1,
        },
      ]
    })
  }

  // Mengubah kuantitas item (+1 atau -1)
  function updateQty(productId, delta) {
    setActiveIdempotencyKey(null)
    setIsNetworkIssue(false)
    setCheckoutError(null)

    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === productId) {
            const newQty = item.qty + delta
            if (newQty <= 0) return null
            if (newQty > item.stock) {
              setToastMessage({
                type: 'warning',
                text: `Kuantitas tidak dapat melebihi stok yang tersedia (${item.stock} pcs).`,
              })
              return item
            }
            return { ...item, qty: newQty }
          }
          return item
        })
        .filter(Boolean)
    )
  }

  // Menghapus item dari keranjang
  function removeFromCart(productId) {
    setActiveIdempotencyKey(null)
    setIsNetworkIssue(false)
    setCheckoutError(null)
    setCart((prev) => prev.filter((item) => item.id !== productId))
  }

  // Mengosongkan keranjang belanja
  function clearCart() {
    setCart([])
    setDiscount('')
    setCashGiven('')
    setCheckoutError(null)
    setIsNetworkIssue(false)
    setActiveIdempotencyKey(null)
  }

  // --- Perhitungan Nilai Transaksi di Sisi Frontend (Estimasi) ---
  const subtotal = cart.reduce(
    (sum, item) => sum + Number(item.selling_price) * item.qty,
    0
  )
  const discountVal = Math.max(0, Number(discount) || 0)
  const isDiscountExceeded = discountVal > subtotal && subtotal > 0
  const total = Math.max(0, subtotal - discountVal)
  const cashVal = Number(cashGiven) || 0
  const change = Math.max(0, cashVal - total)
  const isCashEnough = cashVal >= total && total > 0 && !isDiscountExceeded

  // Preset pecahan uang pembayaran tunai yang relevan dengan total belanja
  const cashPresets = useMemo(() => {
    if (total <= 0) return []
    const presets = new Set()
    if (total % 10000 !== 0) presets.add(Math.ceil(total / 10000) * 10000)
    if (total % 50000 !== 0) presets.add(Math.ceil(total / 50000) * 50000)
    if (total % 100000 !== 0) presets.add(Math.ceil(total / 100000) * 100000)
    ;[20000, 50000, 100000, 200000, 500000].forEach((nom) => {
      if (nom > total) presets.add(nom)
    })
    return Array.from(presets)
      .sort((a, b) => a - b)
      .slice(0, 4)
  }, [total])

  // --- Proses Pembayaran (Konfirmasi Transaksi ke Server) ---
  async function handleCheckout() {
    // 1. Validasi keranjang belanja
    if (cart.length === 0) {
      setCheckoutError('Keranjang belanja masih kosong.')
      return
    }

    if (isDiscountExceeded) {
      setCheckoutError(
        `Diskon (${formatRupiah(discountVal)}) tidak boleh melebihi subtotal belanja (${formatRupiah(subtotal)}).`
      )
      return
    }

    if (!isCashEnough) {
      setCheckoutError(
        `Nominal uang yang diterima (${formatRupiah(cashVal)}) belum mencukupi total belanja (${formatRupiah(total)}).`
      )
      return
    }

    // 2. Cegah klik ganda selama proses request berlangsung atau saat peringatan jaringan aktif
    if (isSubmitting) return

    if (isNetworkIssue) {
      setCheckoutError(
        'Koneksi terputus sebelumnya. Mohon verifikasi menu Riwayat Transaksi terlebih dahulu sebelum mencoba kembali.'
      )
      return
    }

    setIsSubmitting(true)
    setCheckoutError(null)

    // Pertahankan Idempotency Key yang sama jika ini adalah percobaan ulang akibat terputus,
    // atau generate kunci baru jika baru pertama kali diproses.
    const currentKey =
      activeIdempotencyKey ||
      `pos-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    if (!activeIdempotencyKey) {
      setActiveIdempotencyKey(currentKey)
    }

    // Payload sesuai kontrak endpoint Tahap 6A
    // CATATAN: Harga jual TIDAK dikirim dari frontend sebagai sumber kebenaran!
    const payload = {
      items: cart.map((item) => ({
        product_id: item.id,
        quantity: item.qty,
      })),
      discount: discountVal,
      payment_method: 'cash',
      paid_amount: cashVal,
      idempotency_key: currentKey,
    }

    try {
      const res = await transactionService.create(payload)

      if (res?.success && res?.data) {
        // Ambil data otoritatif dari respons database
        const serverTransaction = res.data

        // 3. Tampilkan modal struk resmi dengan data dari server
        setReceiptData(serverTransaction)

        // 4. Kosongkan keranjang hanya setelah server mengonfirmasi transaksi berhasil
        setCart([])
        setDiscount('')
        setCashGiven('')
        setCheckoutError(null)
        setIsNetworkIssue(false)
        setActiveIdempotencyKey(null)

        // 5. Perbarui data stok produk dari backend secara realtime
        await fetchProducts()

        setToastMessage({
          type: 'success',
          text: `Transaksi #${serverTransaction.invoice_number} berhasil diselesaikan!`,
        })
      } else {
        throw new Error(res?.message || 'Respons server tidak valid.')
      }
    } catch (err) {
      console.error('Transaksi POS gagal diproses:', err)

      // Identifikasi kegagalan koneksi jaringan terputus vs error validasi backend
      if (!err.response) {
        setIsNetworkIssue(true)
        setCheckoutError(
          'Koneksi terputus ke server backend saat memproses transaksi. Jangan mengirim ulang transaksi secara tergesa-gesa. Silakan periksa Riwayat Transaksi terlebih dahulu untuk memastikan transaksi tidak tercatat ganda.'
        )
      } else {
        setIsNetworkIssue(false)
        setActiveIdempotencyKey(null)
        const errMsg =
          err.friendlyMessage ||
          err.response?.data?.message ||
          'Terjadi kesalahan saat memproses transaksi.'
        setCheckoutError(errMsg)
        // Perbarui katalog produk untuk memastikan tampilan stok terbaru
        fetchProducts()
      }
      // PENTING: Keranjang belanja dipertahankan jika request gagal!
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg border flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-bottom-2 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-900 text-emerald-100 border-emerald-700'
              : toastMessage.type === 'warning'
              ? 'bg-amber-900 text-amber-100 border-amber-700'
              : 'bg-rose-900 text-rose-100 border-rose-700'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 text-white/60 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* PANEL KIRI: Katalog Produk */}
      <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Top Search & Filter Bar */}
        <div className="p-4 border-b border-slate-100 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama barang atau kode SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Kategori Tabs dari Database */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === 'ALL'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua Produk
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCategory(c.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedCategory === c.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid / Loading / Error / Empty State */}
        <div className="flex-1 overflow-y-auto p-4">
          {loadingProducts ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-16">
              <Loader2 className="w-8 h-8 mb-2 animate-spin text-blue-600" />
              <p className="text-xs font-medium">Memuat katalog produk aktif...</p>
            </div>
          ) : catalogError ? (
            <div className="h-full flex flex-col items-center justify-center text-rose-500 py-16 px-4 text-center">
              <AlertCircle className="w-10 h-10 mb-2 text-rose-400" />
              <p className="text-xs font-bold text-rose-700">{catalogError}</p>
              <button
                type="button"
                onClick={fetchProducts}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-100 text-rose-700 hover:bg-rose-200 text-xs font-semibold"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Coba Lagi
              </button>
            </div>
          ) : products.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-16">
              <Package className="w-10 h-10 mb-2 text-slate-300" />
              <p className="text-xs font-medium">Tidak ada produk aktif yang sesuai.</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Pastikan produk berstatus aktif dan memiliki stok di database.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {products.map((p) => {
                const inCart = cart.find((item) => item.id === p.id)
                const isOutOfStock = p.stock <= 0
                const minStock = p.min_stock ?? 5
                const isLowStock = p.stock <= minStock && !isOutOfStock

                return (
                  <button
                    key={p.id}
                    id={`product-card-${p.sku || p.id}`}
                    type="button"
                    disabled={isOutOfStock}
                    onClick={() => addToCart(p)}
                    className={`text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between relative group ${
                      isOutOfStock
                        ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-200'
                        : inCart
                        ? 'border-blue-500 bg-blue-50/40 shadow-xs ring-1 ring-blue-500/30'
                        : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50/80 bg-white'
                    }`}
                  >
                    {inCart && (
                      <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center shadow-xs">
                        {inCart.qty}
                      </span>
                    )}

                    <div>
                      <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase block">
                        {p.sku}
                      </span>
                      <h4 className="text-xs font-bold text-slate-900 line-clamp-2 mt-0.5 leading-snug">
                        {p.name}
                      </h4>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-700">
                        {formatRupiah(p.selling_price)}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          isOutOfStock
                            ? 'bg-rose-100 text-rose-700'
                            : isLowStock
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {isOutOfStock ? 'Habis' : `Stok: ${p.stock}`}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* PANEL KANAN: Keranjang & Pembayaran Tunai */}
      <div className="w-full lg:w-96 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Cart Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">Keranjang Transaksi</h3>
            {cart.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold">
                {cart.reduce((totalQty, it) => totalQty + it.qty, 0)} item
              </span>
            )}
          </div>
          {cart.length > 0 && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={clearCart}
              className="text-[11px] text-rose-600 hover:text-rose-700 font-medium disabled:opacity-50"
            >
              Kosongkan
            </button>
          )}
        </div>

        {/* Error Checkout Banner */}
        {checkoutError && (
          <div
            className={`p-3 border-b text-xs flex items-start gap-2.5 ${
              isNetworkIssue
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {isNetworkIssue ? (
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <span className="font-semibold block">
                {isNetworkIssue ? 'Peringatan Koneksi' : 'Gagal Memproses Transaksi'}
              </span>
              <p className="text-[11px] mt-0.5 leading-relaxed">{checkoutError}</p>
              {isNetworkIssue && (
                <button
                  type="button"
                  onClick={() => {
                    setIsNetworkIssue(false)
                    setCheckoutError(null)
                  }}
                  className="mt-2 px-2.5 py-1 rounded-lg bg-amber-200 hover:bg-amber-300 text-amber-950 text-[10px] font-bold inline-block transition-colors"
                >
                  Saya Sudah Cek Riwayat (Coba Ulang Transaksi)
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setCheckoutError(null)
                setIsNetworkIssue(false)
              }}
              className="text-slate-400 hover:text-slate-600 shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
              <ShoppingCart className="w-10 h-10 mb-2 text-slate-300" />
              <p className="text-xs font-medium">Keranjang masih kosong</p>
              <p className="text-[11px] text-slate-400">Pilih produk di katalog untuk menambahkan</p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-xl border border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-semibold text-slate-900 truncate">{item.name}</h4>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {formatRupiah(item.selling_price)} × {item.qty} ={' '}
                    <span className="font-bold text-slate-800">
                      {formatRupiah(item.selling_price * item.qty)}
                    </span>
                  </p>
                </div>

                {/* Qty Controls */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    id={`cart-minus-${item.id}`}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => updateQty(item.id, -1)}
                    className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-6 text-center text-xs font-bold text-slate-800">
                    {item.qty}
                  </span>
                  <button
                    id={`cart-plus-${item.id}`}
                    type="button"
                    disabled={isSubmitting || item.qty >= item.stock}
                    onClick={() => updateQty(item.id, 1)}
                    className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  <button
                    id={`cart-remove-${item.id}`}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => removeFromCart(item.id)}
                    className="p-1 text-slate-400 hover:text-rose-600 ml-1 disabled:opacity-40"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Calculation & Cash Payment Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-3">
          {/* Subtotal & Diskon */}
          <div className="space-y-1.5 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-semibold text-slate-900">{formatRupiah(subtotal)}</span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1">
                <span>Diskon (Rp)</span>
                {isDiscountExceeded && (
                  <span className="text-[10px] text-rose-600 font-bold">*melebihi subtotal</span>
                )}
              </span>
              <input
                type="number"
                min="0"
                disabled={isSubmitting || cart.length === 0}
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder="0"
                className={`w-28 px-2 py-1 text-right rounded-lg border bg-white text-xs font-semibold focus:outline-none focus:ring-1 ${
                  isDiscountExceeded
                    ? 'border-rose-400 text-rose-600 focus:ring-rose-500'
                    : 'border-slate-200 text-slate-900 focus:ring-blue-500'
                }`}
              />
            </div>

            <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-bold text-slate-900">
              <span>Total Akhir</span>
              <span className="text-base text-blue-700">{formatRupiah(total)}</span>
            </div>
          </div>

          {/* Cash Payment Input */}
          <div className="pt-2 border-t border-slate-200 space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              Nominal Uang Tunai Diterima (Rp)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                Rp
              </span>
              <input
                type="number"
                min="0"
                disabled={isSubmitting || cart.length === 0}
                value={cashGiven}
                onChange={(e) => setCashGiven(e.target.value)}
                placeholder={total ? String(total) : '0'}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-100"
              />
            </div>

            {/* Fast Cash Presets */}
            {total > 0 && !isSubmitting && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                <button
                  id="btn-uang-pas"
                  type="button"
                  onClick={() => setCashGiven(String(total))}
                  className="px-2 py-1 rounded-lg bg-blue-100 hover:bg-blue-200 text-[11px] font-bold text-blue-800 whitespace-nowrap"
                >
                  Uang Pas
                </button>
                {cashPresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setCashGiven(String(preset))}
                    className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-medium text-slate-600 whitespace-nowrap"
                  >
                    {formatRupiah(preset)}
                  </button>
                ))}
              </div>
            )}

            {/* Kembalian / Status Pembayaran */}
            {cashVal > 0 && (
              <div
                className={`p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between ${
                  isCashEnough
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                <span>{isCashEnough ? 'Kembalian:' : 'Uang Kurang:'}</span>
                <span className="text-sm font-bold">
                  {formatRupiah(isCashEnough ? change : total - cashVal)}
                </span>
              </div>
            )}
          </div>

          {/* Tombol Proses Pembayaran */}
          <button
            id="btn-checkout"
            type="button"
            disabled={!isCashEnough || cart.length === 0 || isSubmitting || isNetworkIssue}
            onClick={handleCheckout}
            className="w-full py-3 px-4 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-xs hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Memproses Transaksi ke Server...</span>
              </>
            ) : isNetworkIssue ? (
              <>
                <ShieldAlert className="w-4 h-4" />
                <span>Periksa Riwayat Transaksi Dahulu</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Proses Pembayaran Tunai</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* MODAL STRUK RESMI (DARI DATABASE MYSQL BACKEND) */}
      <Modal
        isOpen={Boolean(receiptData)}
        onClose={() => setReceiptData(null)}
        title="Struk Bukti Pembayaran Resmi"
        maxWidth="max-w-sm"
      >
        {receiptData && (
          <div className="space-y-4">
            {/* Informasi Sukses dari Backend */}
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <span>
                <strong>Transaksi Berhasil Tercatat:</strong> Data transaksi telah diverifikasi dan
                tersimpan resmi di database server backend.
              </span>
            </div>

            {/* Thermal Receipt Paper */}
            <div id="receipt-print-area" className="bg-slate-50 border border-slate-200 rounded-xl p-4 font-mono text-[11px] text-slate-700 space-y-3">
              <div className="text-center border-b border-dashed border-slate-300 pb-3">
                <h4 className="font-bold text-sm text-slate-900">PHANIX POS</h4>
                <p className="text-[10px] text-slate-500">Toko Berkah Mandiri UMKM</p>
                <p className="text-[10px] text-slate-500">Jl. Raya UMKM No. 12, Indonesia</p>
                <div className="mt-2 pt-2 border-t border-slate-200 text-left text-[10px] space-y-0.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Invoice:</span>
                    <span className="font-bold text-slate-800">{receiptData.invoice_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Waktu:</span>
                    <span className="text-slate-700">{formatDate(receiptData.created_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Kasir:</span>
                    <span className="text-slate-700">
                      {receiptData.user?.name || user?.name || 'Kasir'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Metode:</span>
                    <span className="font-semibold uppercase text-slate-700">
                      {receiptData.payment_method}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items Dari Snapshot Database */}
              <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-3">
                {(receiptData.items || []).map((it) => (
                  <div key={it.id || it.product_id} className="flex justify-between items-start">
                    <div className="pr-2">
                      <div className="text-slate-900 font-medium">
                        {it.product_name || it.name}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {it.quantity} × {formatRupiah(it.unit_price || it.selling_price)}
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
                  <span>{formatRupiah(receiptData.subtotal)}</span>
                </div>
                {Number(receiptData.discount) > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Diskon:</span>
                    <span>-{formatRupiah(receiptData.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-slate-900 text-xs pt-1 border-t border-slate-200">
                  <span>TOTAL:</span>
                  <span className="text-blue-700">{formatRupiah(receiptData.total)}</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span>Bayar (Tunai):</span>
                  <span>{formatRupiah(receiptData.paid_amount)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900">
                  <span>Kembalian:</span>
                  <span className="text-emerald-700">{formatRupiah(receiptData.change_amount)}</span>
                </div>
              </div>

              <div className="text-center pt-3 border-t border-dashed border-slate-300 text-[10px] text-slate-400">
                <p>Terima kasih atas kunjungan Anda!</p>
                <p>Barang yang sudah dibeli tidak dapat ditukar.</p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                id="btn-print-receipt"
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                Cetak Struk
              </button>
              <button
                id="btn-new-transaction"
                type="button"
                onClick={() => setReceiptData(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Transaksi Baru
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
