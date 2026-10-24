import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CheckCircle2,
  Printer,
  AlertCircle,
  Package,
  RefreshCw,
  X,
  ShieldAlert,
  Loader2,
} from 'lucide-react'
import { transactionService } from '../api/transactions'
import { useAuth } from '../context/AuthContext'
import { formatRupiah, formatDate } from '../utils/formatters'
import { Modal } from '../components/ui/Modal'
import { getCache, setCache, invalidateCache } from '../utils/cache'
import { getPosState, setPosState, resetPosCart } from '../utils/posStore'

export function PosPage() {
  const { user } = useAuth()
  const initialPosState = getPosState()

  // State Katalog Produk & Kategori dari Database Backend & Cache
  const [products, setProducts] = useState(() => getCache('pos_products') || [])
  const [categories, setCategories] = useState(() => getCache('pos_categories') || [])
  const [loadingProducts, setLoadingProducts] = useState(() => !getCache('pos_products'))
  const [loadingCategories, setLoadingCategories] = useState(false)
  const [catalogError, setCatalogError] = useState(null)

  // Filter & Pencarian
  const [selectedCategory, setSelectedCategory] = useState(initialPosState.selectedCategory || 'ALL')
  const [searchQuery, setSearchQuery] = useState(initialPosState.searchQuery || '')

  // State Keranjang Transaksi (Persisten antar-halaman)
  const [cart, setCart] = useState(initialPosState.cart || [])
  const [discount, setDiscount] = useState(initialPosState.discount || '')
  const [cashGiven, setCashGiven] = useState(initialPosState.cashGiven || '')

  // State Proses Transaksi & Notifikasi
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [checkoutError, setCheckoutError] = useState(null)
  const [isNetworkIssue, setIsNetworkIssue] = useState(false)
  const [activeIdempotencyKey, setActiveIdempotencyKey] = useState(null)
  const [toastMessage, setToastMessage] = useState(null)

  // State Modal Struk Resmi
  const [receiptData, setReceiptData] = useState(null)

  // Sinkronisasi state lokal ke posStore agar persisten saat berpindah halaman
  useEffect(() => {
    setPosState({
      cart,
      discount,
      cashGiven,
      selectedCategory,
      searchQuery,
    })
  }, [cart, discount, cashGiven, selectedCategory, searchQuery])

  // Memuat kategori produk
  const fetchCategories = useCallback(async () => {
    const cached = getCache('pos_categories')
    if (!cached) setLoadingCategories(true)
    try {
      const res = await transactionService.getCategories()
      const data = res.data || []
      setCache('pos_categories', data)
      setCategories(data)
    } catch (err) {
      console.error('Gagal memuat kategori:', err)
    } finally {
      setLoadingCategories(false)
    }
  }, [])

  // Memuat katalog produk aktif
  const fetchProducts = useCallback(async (isManualRefresh = false) => {
    const cacheKey = `pos_products:${searchQuery.trim()}:${selectedCategory}`
    const cached = getCache(cacheKey)

    if (!cached || isManualRefresh) {
      setLoadingProducts(true)
    }
    setCatalogError(null)

    try {
      const params = {}
      if (searchQuery.trim()) params.search = searchQuery.trim()
      if (selectedCategory !== 'ALL') params.category_id = selectedCategory

      const res = await transactionService.getActiveProducts(params)
      const loaded = (res.data || []).filter((p) => p.is_active)

      setCache(cacheKey, loaded)
      setCache('pos_products', loaded)
      setProducts(loaded)
    } catch (err) {
      if (!cached) {
        setCatalogError(err.friendlyMessage || 'Gagal memuat katalog produk.')
      }
    } finally {
      setLoadingProducts(false)
    }
  }, [searchQuery, selectedCategory])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts()
    }, 200)
    return () => clearTimeout(timer)
  }, [fetchProducts])

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toastMessage])

  // Operasi Keranjang Belanja
  function addToCart(product) {
    const availableStock = Number(product.stock ?? 0)
    if (availableStock <= 0) {
      setToastMessage({
        type: 'error',
        text: `Stok produk "${product.name}" habis.`,
      })
      return
    }

    setActiveIdempotencyKey(null)
    setIsNetworkIssue(false)
    setCheckoutError(null)

    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id)
      if (existing) {
        if (existing.qty >= availableStock) {
          setToastMessage({
            type: 'warning',
            text: `Kuantitas mencapai stok maksimum (${availableStock} pcs).`,
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
                text: `Kuantitas melebihi stok yang tersedia (${item.stock} pcs).`,
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

  function removeFromCart(productId) {
    setActiveIdempotencyKey(null)
    setIsNetworkIssue(false)
    setCheckoutError(null)
    setCart((prev) => prev.filter((item) => item.id !== productId))
  }

  function handleClearCart() {
    resetPosCart()
    setCart([])
    setDiscount('')
    setCashGiven('')
    setCheckoutError(null)
    setIsNetworkIssue(false)
    setActiveIdempotencyKey(null)
  }

  // Perhitungan Nilai Transaksi
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

  // Checkout Transaksi
  async function handleCheckout() {
    if (cart.length === 0) {
      setCheckoutError('Keranjang belanja masih kosong.')
      return
    }

    if (isDiscountExceeded) {
      setCheckoutError(
        `Diskon (${formatRupiah(discountVal)}) melebihi subtotal belanja (${formatRupiah(subtotal)}).`
      )
      return
    }

    if (!isCashEnough) {
      setCheckoutError(
        `Nominal uang yang diterima (${formatRupiah(cashVal)}) belum mencukupi total belanja (${formatRupiah(total)}).`
      )
      return
    }

    if (isSubmitting) return

    if (isNetworkIssue) {
      setCheckoutError(
        'Koneksi terputus sebelumnya. Mohon verifikasi menu Riwayat Transaksi terlebih dahulu sebelum mencoba kembali.'
      )
      return
    }

    setIsSubmitting(true)
    setCheckoutError(null)

    const currentKey =
      activeIdempotencyKey ||
      `pos-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    if (!activeIdempotencyKey) {
      setActiveIdempotencyKey(currentKey)
    }

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
        const serverTransaction = res.data

        setReceiptData(serverTransaction)
        handleClearCart()

        // Invalidate cache yang terpengaruh
        invalidateCache('products')
        invalidateCache('pos_products')
        invalidateCache('dashboard')
        invalidateCache('transactions')
        invalidateCache('reports')

        await fetchProducts(true)

        setToastMessage({
          type: 'success',
          text: `Transaksi #${serverTransaction.invoice_number} selesai!`,
        })
      } else {
        throw new Error(res?.message || 'Respons server tidak valid.')
      }
    } catch (err) {
      console.error('Transaksi POS gagal:', err)

      if (!err.response) {
        setIsNetworkIssue(true)
        setCheckoutError(
          'Koneksi terputus ke server. Periksa Riwayat Transaksi untuk memastikan tidak tercatat ganda.'
        )
      } else {
        setIsNetworkIssue(false)
        setActiveIdempotencyKey(null)
        setCheckoutError(
          err.friendlyMessage ||
            err.response?.data?.message ||
            'Gagal memproses transaksi.'
        )
        fetchProducts(true)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="h-[calc(100vh-5.5rem)] flex flex-col lg:flex-row gap-4 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-3.5 py-2.5 rounded-lg shadow-lg border flex items-center gap-2 text-xs font-medium ${
            toastMessage.type === 'success'
              ? 'bg-zinc-900 text-white border-zinc-800'
              : toastMessage.type === 'warning'
              ? 'bg-amber-900 text-amber-100 border-amber-800'
              : 'bg-rose-900 text-rose-100 border-rose-800'
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
      <div className="flex-1 flex flex-col bg-white rounded-xl border border-zinc-200/80 shadow-xs overflow-hidden">
        {/* Top Search & Filter Bar */}
        <div className="p-3 border-b border-zinc-100 space-y-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Cari barang atau SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-zinc-200 text-xs focus:outline-none focus:border-zinc-900"
            />
          </div>

          {/* Kategori Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === 'ALL'
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              Semua
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCategory(c.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  selectedCategory === c.id
                    ? 'bg-zinc-900 text-white shadow-xs'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-3.5">
          {loadingProducts && products.length === 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 animate-pulse">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="bg-zinc-50 border border-zinc-100 rounded-lg h-28" />
              ))}
            </div>
          ) : catalogError && products.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-rose-500 py-12 px-4 text-center">
              <AlertCircle className="w-8 h-8 mb-2 text-rose-400" />
              <p className="text-xs font-medium">{catalogError}</p>
              <button
                type="button"
                onClick={() => fetchProducts(true)}
                className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-medium"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Coba Lagi
              </button>
            </div>
          ) : products.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-400 py-12">
              <Package className="w-8 h-8 mb-1.5 text-zinc-300" />
              <p className="text-xs font-medium">Tidak ada produk ditemukan</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
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
                    className={`text-left p-3 rounded-lg border transition-all flex flex-col justify-between relative group cursor-pointer ${
                      isOutOfStock
                        ? 'opacity-40 cursor-not-allowed bg-zinc-50 border-zinc-200'
                        : inCart
                        ? 'border-zinc-900 bg-zinc-50/80 ring-1 ring-zinc-900/10'
                        : 'border-zinc-200/90 hover:border-zinc-400 bg-white'
                    }`}
                  >
                    {inCart && (
                      <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-zinc-900 text-white text-[10px] font-mono font-bold flex items-center justify-center">
                        {inCart.qty}
                      </span>
                    )}

                    <div>
                      <span className="text-[10px] font-mono text-zinc-400 uppercase block">
                        {p.sku}
                      </span>
                      <h4 className="text-xs font-medium text-zinc-900 line-clamp-2 mt-0.5 leading-snug">
                        {p.name}
                      </h4>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-zinc-100 flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-900 tabular-nums font-mono">
                        {formatRupiah(p.selling_price)}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                          isOutOfStock
                            ? 'bg-rose-50 text-rose-700'
                            : isLowStock
                            ? 'bg-amber-50 text-amber-800'
                            : 'text-zinc-500'
                        }`}
                      >
                        {isOutOfStock ? 'Habis' : `${p.stock}`}
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
      <div className="w-full lg:w-96 flex flex-col bg-white rounded-xl border border-zinc-200/80 shadow-xs overflow-hidden">
        {/* Cart Header */}
        <div className="p-3 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-zinc-800" />
            <h3 className="text-xs font-semibold text-zinc-900">Keranjang Kasir</h3>
            {cart.length > 0 && (
              <span className="px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-700 text-[10px] font-mono font-medium">
                {cart.reduce((totalQty, it) => totalQty + it.qty, 0)} item
              </span>
            )}
          </div>
          {cart.length > 0 && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleClearCart}
              className="text-[11px] text-zinc-400 hover:text-rose-600 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Kosongkan
            </button>
          )}
        </div>

        {/* Error Checkout Banner */}
        {checkoutError && (
          <div
            className={`p-2.5 border-b text-xs flex items-start gap-2 ${
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
              <span className="font-semibold block text-[11px]">
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
                  className="mt-1.5 px-2 py-0.5 rounded bg-amber-200 hover:bg-amber-300 text-amber-950 text-[10px] font-medium"
                >
                  Coba Ulang
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setCheckoutError(null)
                setIsNetworkIssue(false)
              }}
              className="text-zinc-400 hover:text-zinc-600 shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-400 py-10">
              <ShoppingCart className="w-7 h-7 mb-1 text-zinc-300" />
              <p className="text-xs font-medium">Keranjang kosong</p>
              <p className="text-[11px] text-zinc-400">Pilih produk di katalog untuk menambahkan</p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.id}
                className="p-2.5 rounded-lg border border-zinc-100 bg-zinc-50/70 flex items-center justify-between gap-2.5"
              >
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-medium text-zinc-900 truncate">{item.name}</h4>
                  <p className="text-[11px] text-zinc-500 font-mono tabular-nums">
                    {formatRupiah(item.selling_price)} × {item.qty} ={' '}
                    <span className="font-semibold text-zinc-900">
                      {formatRupiah(item.selling_price * item.qty)}
                    </span>
                  </p>
                </div>

                {/* Qty Controls */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    id={`cart-minus-${item.id}`}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => updateQty(item.id, -1)}
                    className="w-5 h-5 rounded bg-white border border-zinc-200 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 cursor-pointer"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-5 text-center text-xs font-mono font-semibold text-zinc-800">
                    {item.qty}
                  </span>
                  <button
                    id={`cart-plus-${item.id}`}
                    type="button"
                    disabled={isSubmitting || item.qty >= item.stock}
                    onClick={() => updateQty(item.id, 1)}
                    className="w-5 h-5 rounded bg-white border border-zinc-200 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  <button
                    id={`cart-remove-${item.id}`}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => removeFromCart(item.id)}
                    className="p-1 text-zinc-400 hover:text-rose-600 ml-1 disabled:opacity-40 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Calculation & Cash Payment Footer */}
        <div className="p-3 border-t border-zinc-100 bg-zinc-50/50 space-y-2.5">
          {/* Subtotal & Diskon */}
          <div className="space-y-1 text-xs text-zinc-600">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-medium text-zinc-900 tabular-nums font-mono">{formatRupiah(subtotal)}</span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1">
                <span>Diskon</span>
                {isDiscountExceeded && (
                  <span className="text-[10px] text-rose-600">*lebih dari subtotal</span>
                )}
              </span>
              <input
                type="number"
                min="0"
                disabled={isSubmitting || cart.length === 0}
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder="0"
                className={`w-24 px-2 py-0.5 text-right rounded border bg-white text-xs font-mono tabular-nums focus:outline-none ${
                  isDiscountExceeded
                    ? 'border-rose-400 text-rose-600'
                    : 'border-zinc-200 text-zinc-900 focus:border-zinc-900'
                }`}
              />
            </div>

            <div className="flex justify-between pt-1.5 border-t border-zinc-200 text-xs font-semibold text-zinc-900">
              <span>Total Tagihan</span>
              <span className="text-sm text-zinc-900 tabular-nums font-mono">{formatRupiah(total)}</span>
            </div>
          </div>

          {/* Cash Payment Input */}
          <div className="pt-1.5 border-t border-zinc-200 space-y-1.5">
            <label className="block text-[11px] font-medium text-zinc-600">
              Uang Diterima (Rp)
            </label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-mono">
                Rp
              </span>
              <input
                type="number"
                min="0"
                disabled={isSubmitting || cart.length === 0}
                value={cashGiven}
                onChange={(e) => setCashGiven(e.target.value)}
                placeholder={total ? String(total) : '0'}
                className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-zinc-200 text-xs font-mono font-semibold text-zinc-900 bg-white focus:outline-none focus:border-zinc-900 disabled:bg-zinc-100"
              />
            </div>

            {/* Fast Cash Presets */}
            {total > 0 && !isSubmitting && (
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
                <button
                  id="btn-uang-pas"
                  type="button"
                  onClick={() => setCashGiven(String(total))}
                  className="px-2 py-0.5 rounded bg-zinc-200 hover:bg-zinc-300 text-[11px] font-medium text-zinc-800 whitespace-nowrap cursor-pointer"
                >
                  Uang Pas
                </button>
                {cashPresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setCashGiven(String(preset))}
                    className="px-2 py-0.5 rounded bg-zinc-100 hover:bg-zinc-200 text-[11px] text-zinc-600 whitespace-nowrap cursor-pointer"
                  >
                    {formatRupiah(preset)}
                  </button>
                ))}
              </div>
            )}

            {/* Kembalian / Status Pembayaran */}
            {cashVal > 0 && (
              <div
                className={`p-2 rounded-lg text-xs font-medium flex items-center justify-between ${
                  isCashEnough
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                <span>{isCashEnough ? 'Kembalian:' : 'Kurang:'}</span>
                <span className="font-semibold tabular-nums font-mono">
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
            className="w-full py-2.5 px-3 rounded-lg bg-zinc-900 text-white text-xs font-medium shadow-xs hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Memproses...</span>
              </>
            ) : isNetworkIssue ? (
              <>
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Cek Riwayat Dahulu</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Bayar Transaksi</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* MODAL STRUK RESMI */}
      <Modal
        isOpen={Boolean(receiptData)}
        onClose={() => setReceiptData(null)}
        title="Struk Pembayaran"
        maxWidth="max-w-sm"
      >
        {receiptData && (
          <div className="space-y-3.5">
            {/* Thermal Receipt Paper */}
            <div id="receipt-print-area" className="bg-zinc-50 border border-zinc-200 rounded-lg p-3.5 font-mono text-[11px] text-zinc-700 space-y-2.5">
              <div className="text-center border-b border-dashed border-zinc-300 pb-2.5">
                <h4 className="font-bold text-xs text-zinc-900">PHANIX POS</h4>
                <p className="text-[10px] text-zinc-400">Bukti Pembayaran Kasir</p>
                <div className="mt-2 text-left text-[10px] space-y-0.5 text-zinc-600">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Invoice:</span>
                    <span className="font-bold text-zinc-800">{receiptData.invoice_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Waktu:</span>
                    <span>{formatDate(receiptData.created_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Kasir:</span>
                    <span>{receiptData.user?.name || user?.name || 'Kasir'}</span>
                  </div>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-1 border-b border-dashed border-zinc-300 pb-2.5">
                {(receiptData.items || []).map((it) => (
                  <div key={it.id || it.product_id} className="flex justify-between items-start">
                    <div className="pr-2">
                      <div className="text-zinc-900 font-medium">{it.product_name || it.name}</div>
                      <div className="text-[10px] text-zinc-400">
                        {it.quantity} × {formatRupiah(it.unit_price || it.selling_price)}
                      </div>
                    </div>
                    <span className="font-medium text-zinc-900 shrink-0 tabular-nums">
                      {formatRupiah(it.subtotal)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Total & Kembalian */}
              <div className="space-y-1 text-zinc-600 text-[11px]">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="tabular-nums">{formatRupiah(receiptData.subtotal)}</span>
                </div>
                {Number(receiptData.discount) > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Diskon:</span>
                    <span className="tabular-nums">-{formatRupiah(receiptData.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-zinc-900 text-xs pt-1 border-t border-zinc-200">
                  <span>TOTAL:</span>
                  <span className="tabular-nums">{formatRupiah(receiptData.total)}</span>
                </div>
                <div className="flex justify-between pt-0.5">
                  <span>Tunai:</span>
                  <span className="tabular-nums">{formatRupiah(receiptData.paid_amount)}</span>
                </div>
                <div className="flex justify-between font-semibold text-zinc-900">
                  <span>Kembalian:</span>
                  <span className="text-emerald-700 tabular-nums">{formatRupiah(receiptData.change_amount)}</span>
                </div>
              </div>

              <div className="text-center pt-2 border-t border-dashed border-zinc-300 text-[10px] text-zinc-400">
                <p>Terima kasih atas kunjungan Anda!</p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                id="btn-print-receipt"
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-1.5 rounded-lg bg-zinc-900 text-white text-xs font-medium flex items-center justify-center gap-1.5 hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Struk</span>
              </button>
              <button
                id="btn-new-transaction"
                type="button"
                onClick={() => setReceiptData(null)}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer"
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
