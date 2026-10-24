import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Package,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Loader2,
  ArrowUpDown,
  History,
  Boxes,
} from 'lucide-react'
import { productService } from '../api/products'
import { categoryService } from '../api/categories'
import { useAuth } from '../context/AuthContext'
import { formatRupiah, formatDate } from '../utils/formatters'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { getCache, setCache, invalidateCache } from '../utils/cache'

export function ProductsPage() {
  const { isAdmin } = useAuth()

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('ALL')
  const [selectedStatus, setSelectedStatus] = useState('ALL')

  // Cache Key
  const cacheKey = useMemo(() => {
    return `products:${searchQuery.trim()}:${selectedCategory}:${selectedStatus}`
  }, [searchQuery, selectedCategory, selectedStatus])

  // State Data diinisialisasi dari cache agar instan tanpa loading
  const [products, setProducts] = useState(() => getCache(cacheKey) || [])
  const [categories, setCategories] = useState(() => getCache('categories') || [])
  const [loading, setLoading] = useState(() => !getCache(cacheKey))
  const [fetchError, setFetchError] = useState(null)

  // Notification Toast
  const [notification, setNotification] = useState(null)

  // Modal State Produk (Add / Edit)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Form Fields & Validation
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    categoryId: '',
    description: '',
    costPrice: '',
    sellingPrice: '',
    stock: '',
    minStock: '5',
    isActive: true,
  })
  const [errors, setErrors] = useState({})
  const [generalError, setGeneralError] = useState('')

  // Modal State Mutasi Stok
  const [isStockModalOpen, setIsStockModalOpen] = useState(false)
  const [stockTarget, setStockTarget] = useState(null)
  const [stockFormData, setStockFormData] = useState({
    type: 'in',
    quantity: '1',
    note: '',
  })
  const [stockSubmitting, setStockSubmitting] = useState(false)
  const [stockError, setStockError] = useState('')

  // Modal Riwayat Mutasi Stok
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const [historyTarget, setHistoryTarget] = useState(null)
  const [movements, setMovements] = useState([])
  const [loadingMovements, setLoadingMovements] = useState(false)

  // Memuat data kategori dari API
  const fetchCategories = useCallback(async () => {
    try {
      const res = await categoryService.getAll()
      const data = res.data || []
      setCache('categories', data)
      setCategories(data)
    } catch (err) {
      console.error('Gagal memuat kategori:', err)
    }
  }, [])

  // Memuat data produk dari API
  const fetchProducts = useCallback(async (isManualRefresh = false) => {
    const cached = getCache(cacheKey)
    if (!cached || isManualRefresh) {
      setLoading(true)
    }
    setFetchError(null)

    try {
      const params = {}
      if (searchQuery.trim()) params.search = searchQuery.trim()
      if (selectedCategory !== 'ALL') params.category_id = selectedCategory
      if (selectedStatus !== 'ALL') {
        params.is_active = selectedStatus === 'ACTIVE' ? '1' : '0'
      }

      const res = await productService.getAll(params)
      const data = res.data || []
      setCache(cacheKey, data)
      setProducts(data)
    } catch (err) {
      if (!cached) {
        setFetchError(err.friendlyMessage || 'Gagal memuat daftar produk.')
      }
    } finally {
      setLoading(false)
    }
  }, [cacheKey, searchQuery, selectedCategory, selectedStatus])

  useEffect(() => {
    const cached = getCache(cacheKey)
    if (cached) {
      setProducts(cached)
      setLoading(false)
    }
  }, [cacheKey])

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
    if (notification?.type === 'success') {
      const timer = setTimeout(() => setNotification(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  function handleOpenAdd() {
    setEditingProduct(null)
    setFormData({
      sku: '',
      name: '',
      categoryId: categories[0]?.id || '',
      description: '',
      costPrice: '',
      sellingPrice: '',
      stock: '',
      minStock: '5',
      isActive: true,
    })
    setErrors({})
    setGeneralError('')
    setIsFormOpen(true)
  }

  function handleOpenEdit(product) {
    setEditingProduct(product)
    setFormData({
      sku: product.sku,
      name: product.name,
      categoryId: product.category_id || product.category?.id || '',
      description: product.description || '',
      costPrice: product.cost_price || '',
      sellingPrice: product.selling_price || '',
      stock: product.stock ?? 0,
      minStock: product.min_stock ?? 5,
      isActive: Boolean(product.is_active),
    })
    setErrors({})
    setGeneralError('')
    setIsFormOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErrors({})
    setGeneralError('')

    const err = {}
    if (!formData.sku.trim()) err.sku = 'SKU wajib diisi.'
    if (!formData.name.trim()) err.name = 'Nama produk wajib diisi.'
    if (!formData.categoryId) err.categoryId = 'Pilih kategori produk.'
    if (formData.costPrice === '' || Number(formData.costPrice) < 0) {
      err.costPrice = 'Harga modal harus >= 0.'
    }
    if (formData.sellingPrice === '' || Number(formData.sellingPrice) < 0) {
      err.sellingPrice = 'Harga jual harus >= 0.'
    }
    if (!editingProduct && (formData.stock === '' || Number(formData.stock) < 0)) {
      err.stock = 'Stok awal harus >= 0.'
    }

    if (Object.keys(err).length > 0) {
      setErrors(err)
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        sku: formData.sku.trim(),
        name: formData.name.trim(),
        category_id: formData.categoryId,
        description: formData.description.trim(),
        cost_price: Number(formData.costPrice),
        selling_price: Number(formData.sellingPrice),
        min_stock: Number(formData.minStock) || 0,
        is_active: Boolean(formData.isActive),
      }

      if (!editingProduct) {
        payload.stock = Number(formData.stock) || 0
      }

      if (editingProduct) {
        await productService.update(editingProduct.id, payload)
        setNotification({
          type: 'success',
          message: `Produk "${payload.name}" berhasil diperbarui.`,
        })
      } else {
        await productService.create(payload)
        setNotification({
          type: 'success',
          message: `Produk "${payload.name}" berhasil ditambahkan.`,
        })
      }

      invalidateCache('products')
      invalidateCache('pos_products')
      invalidateCache('dashboard')
      setIsFormOpen(false)
      fetchProducts(true)
    } catch (err) {
      if (err.response?.data?.errors) {
        setErrors(err.response.data.errors)
      } else {
        setGeneralError(err.friendlyMessage || 'Gagal menyimpan produk.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await productService.delete(deleteTarget.id)
      setNotification({
        type: 'success',
        message: `Produk "${deleteTarget.name}" berhasil dihapus.`,
      })
      invalidateCache('products')
      invalidateCache('pos_products')
      invalidateCache('dashboard')
      setDeleteTarget(null)
      fetchProducts(true)
    } catch (err) {
      setNotification({
        type: 'error',
        message: err.friendlyMessage || 'Gagal menghapus produk.',
      })
    } finally {
      setDeleting(false)
    }
  }

  function handleOpenStockModal(product) {
    setStockTarget(product)
    setStockFormData({
      type: 'in',
      quantity: '1',
      note: '',
    })
    setStockError('')
    setIsStockModalOpen(true)
  }

  async function handleStockSubmit(e) {
    e.preventDefault()
    setStockError('')

    const qty = Number(stockFormData.quantity)
    if (isNaN(qty) || qty < 0) {
      setStockError('Jumlah stok harus berupa angka positif.')
      return
    }

    setStockSubmitting(true)
    try {
      await productService.adjustStock(stockTarget.id, {
        type: stockFormData.type,
        quantity: qty,
        note: stockFormData.note.trim(),
      })

      setNotification({
        type: 'success',
        message: `Stok produk "${stockTarget.name}" berhasil disesuaikan.`,
      })

      invalidateCache('products')
      invalidateCache('pos_products')
      invalidateCache('dashboard')
      setIsStockModalOpen(false)
      fetchProducts(true)
    } catch (err) {
      setStockError(err.friendlyMessage || 'Gagal menyesuaikan stok.')
    } finally {
      setStockSubmitting(false)
    }
  }

  async function handleOpenHistory(product) {
    setHistoryTarget(product)
    setMovements([])
    setIsHistoryModalOpen(true)
    setLoadingMovements(true)

    try {
      const res = await productService.getStockMovements(product.id)
      setMovements(res.data || [])
    } catch (err) {
      console.error('Gagal mengambil riwayat mutasi:', err)
    } finally {
      setLoadingMovements(false)
    }
  }

  const stockPreview = useMemo(() => {
    if (!stockTarget) return 0
    const current = Number(stockTarget.stock) || 0
    const qty = Number(stockFormData.quantity) || 0

    if (stockFormData.type === 'in') return current + qty
    if (stockFormData.type === 'out') return Math.max(0, current - qty)
    if (stockFormData.type === 'adjustment') return qty
    return current
  }, [stockTarget, stockFormData])

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-zinc-900 tracking-tight">Katalog Produk & Stok</h2>
            {!isAdmin && (
              <Badge variant="outline">Mode Baca</Badge>
            )}
          </div>
          <p className="text-xs text-zinc-500">
            {products.length} produk terdaftar
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchProducts(true)}
            disabled={loading}
            className="p-1.5 rounded-lg text-zinc-600 hover:bg-zinc-100 border border-zinc-200 bg-white transition-colors disabled:opacity-50 cursor-pointer"
            title="Segarkan data produk"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-zinc-900' : ''}`} />
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 transition-colors shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Produk</span>
            </button>
          )}
        </div>
      </div>

      {/* Alert Notifikasi */}
      {notification && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center justify-between gap-2 border transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            )}
            <p className="font-medium truncate">{notification.message}</p>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-[11px] underline hover:no-underline shrink-0"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-xl border border-zinc-200/80 shadow-xs flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Cari nama produk atau SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-zinc-200 text-xs focus:outline-none focus:border-zinc-900"
          />
        </div>

        <div className="w-full sm:w-48">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 text-xs bg-white focus:outline-none focus:border-zinc-900"
          >
            <option value="ALL">Semua Kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="w-full sm:w-36">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 text-xs bg-white focus:outline-none focus:border-zinc-900"
          >
            <option value="ALL">Semua Status</option>
            <option value="ACTIVE">Aktif</option>
            <option value="INACTIVE">Nonaktif</option>
          </select>
        </div>
      </div>

      {/* Error Banner */}
      {fetchError && !loading && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-center space-y-2">
          <p className="text-xs text-rose-700">{fetchError}</p>
          <button
            type="button"
            onClick={() => fetchProducts(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-rose-600 text-white text-xs font-medium hover:bg-rose-700"
          >
            <RefreshCw className="w-3 h-3" />
            Coba Lagi
          </button>
        </div>
      )}

      {/* First-time Loading Skeleton */}
      {loading && products.length === 0 && (
        <div className="bg-white rounded-xl border border-zinc-200/80 p-8 text-center animate-pulse">
          <div className="h-4 bg-zinc-100 rounded w-48 mx-auto mb-2" />
          <div className="h-3 bg-zinc-50 rounded w-32 mx-auto" />
        </div>
      )}

      {/* Products Table */}
      {products.length > 0 && (
        <div className="bg-white rounded-xl border border-zinc-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-600">
              <thead className="bg-zinc-50 text-[10px] uppercase tracking-wider text-zinc-400 font-semibold border-b border-zinc-100">
                <tr>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Nama Produk</th>
                  <th className="px-4 py-3">Kategori</th>
                  <th className="px-4 py-3 text-right">Modal</th>
                  <th className="px-4 py-3 text-right">Harga Jual</th>
                  <th className="px-4 py-3 text-center">Stok</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {products.map((p) => {
                  const minStock = p.min_stock ?? p.minStock ?? 5
                  const stock = p.stock ?? 0
                  const isLow = stock <= minStock
                  const isActive = p.is_active ?? p.isActive ?? true
                  const costPrice = p.cost_price ?? p.costPrice ?? 0
                  const sellingPrice = p.selling_price ?? p.sellingPrice ?? 0
                  const categoryName = p.category?.name || p.categoryName || 'Umum'

                  return (
                    <tr key={p.id} className="hover:bg-zinc-50/70 transition-colors">
                      <td className="px-4 py-3 font-mono text-zinc-500 text-[11px]">
                        {p.sku}
                      </td>
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        {p.name}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">
                        <span className="text-[11px] text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded">
                          {categoryName}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-500 tabular-nums font-mono">
                        {formatRupiah(costPrice)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-zinc-900 tabular-nums font-mono">
                        {formatRupiah(sellingPrice)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-mono tabular-nums font-semibold ${
                            stock === 0
                              ? 'bg-rose-50 text-rose-700 border border-rose-200/60'
                              : isLow
                              ? 'bg-amber-50 text-amber-800 border border-amber-200/60'
                              : 'text-zinc-700 bg-zinc-100'
                          }`}
                        >
                          {stock} pcs
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={isActive ? 'success' : 'neutral'} dot>
                          {isActive ? 'Aktif' : 'Nonaktif'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenHistory(p)}
                            className="p-1 rounded text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors"
                            title="Riwayat Mutasi"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>

                          {isAdmin && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenStockModal(p)}
                                className="p-1 rounded text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors"
                                title="Sesuaikan Stok"
                              >
                                <ArrowUpDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(p)}
                                className="p-1 rounded text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors"
                                title="Edit"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(p)}
                                className="p-1 rounded text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                title="Hapus"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !fetchError && products.length === 0 && (
        <div className="bg-white rounded-xl border border-zinc-200/80 p-10 text-center space-y-2">
          <Package className="w-8 h-8 mx-auto text-zinc-300" />
          <p className="text-xs font-semibold text-zinc-700">Tidak ada produk ditemukan</p>
          <p className="text-[11px] text-zinc-400">Sesuaikan kata kunci atau filter pencarian Anda</p>
        </div>
      )}

      {/* Modal Form Tambah / Edit Produk */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => !submitting && setIsFormOpen(false)}
        title={editingProduct ? 'Edit Produk' : 'Tambah Produk Baru'}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {generalError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{generalError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Kode SKU / Barcode *
              </label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                placeholder="BRG-001"
                disabled={submitting}
                className={`w-full px-3 py-1.5 rounded-lg border text-xs font-mono focus:outline-none ${
                  errors.sku ? 'border-rose-400 focus:border-rose-500' : 'border-zinc-200 focus:border-zinc-900'
                }`}
              />
              {errors.sku && <p className="text-[11px] text-rose-600 mt-1">{errors.sku}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Kategori *
              </label>
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                disabled={submitting}
                className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 text-xs bg-white focus:outline-none focus:border-zinc-900"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {errors.categoryId && <p className="text-[11px] text-rose-600 mt-1">{errors.categoryId}</p>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Nama Produk *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Contoh: Beras Ramos 5kg"
              disabled={submitting}
              className={`w-full px-3 py-1.5 rounded-lg border text-xs focus:outline-none ${
                errors.name ? 'border-rose-400 focus:border-rose-500' : 'border-zinc-200 focus:border-zinc-900'
              }`}
            />
            {errors.name && <p className="text-[11px] text-rose-600 mt-1">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Harga Modal (Rp) *
              </label>
              <input
                type="number"
                value={formData.costPrice}
                onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                placeholder="0"
                min="0"
                disabled={submitting}
                className={`w-full px-3 py-1.5 rounded-lg border text-xs focus:outline-none ${
                  errors.costPrice ? 'border-rose-400 focus:border-rose-500' : 'border-zinc-200 focus:border-zinc-900'
                }`}
              />
              {errors.costPrice && <p className="text-[11px] text-rose-600 mt-1">{errors.costPrice}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Harga Jual (Rp) *
              </label>
              <input
                type="number"
                value={formData.sellingPrice}
                onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                placeholder="0"
                min="0"
                disabled={submitting}
                className={`w-full px-3 py-1.5 rounded-lg border text-xs focus:outline-none ${
                  errors.sellingPrice ? 'border-rose-400 focus:border-rose-500' : 'border-zinc-200 focus:border-zinc-900'
                }`}
              />
              {errors.sellingPrice && <p className="text-[11px] text-rose-600 mt-1">{errors.sellingPrice}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                {editingProduct ? 'Stok Saat Ini (Read-only)' : 'Stok Awal *'}
              </label>
              <input
                type="number"
                value={formData.stock}
                onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                placeholder="0"
                min="0"
                disabled={editingProduct || submitting}
                className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 text-xs focus:outline-none focus:border-zinc-900 disabled:bg-zinc-50"
              />
              {errors.stock && <p className="text-[11px] text-rose-600 mt-1">{errors.stock}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Batas Minimum Stok
              </label>
              <input
                type="number"
                value={formData.minStock}
                onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
                placeholder="5"
                min="0"
                disabled={submitting}
                className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 text-xs focus:outline-none focus:border-zinc-900"
              />
            </div>
          </div>

          <div>
            <label className="inline-flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                disabled={submitting}
                className="rounded text-zinc-900 focus:ring-zinc-900 w-4 h-4 cursor-pointer"
              />
              <span className="text-xs font-medium text-zinc-700">
                Produk aktif dan dapat dijual di kasir
              </span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setIsFormOpen(false)}
              className="px-3 py-1.5 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
              <span>{editingProduct ? 'Simpan' : 'Tambah'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Penyesuaian Stok */}
      <Modal
        isOpen={isStockModalOpen}
        onClose={() => !stockSubmitting && setIsStockModalOpen(false)}
        title="Sesuaikan Stok Produk"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleStockSubmit} className="space-y-3.5">
          <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200/80 text-xs">
            <p className="font-medium text-zinc-900">{stockTarget?.name}</p>
            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-500">
              <span>SKU: {stockTarget?.sku}</span>
              <span>•</span>
              <span>Stok: <strong>{stockTarget?.stock} pcs</strong></span>
            </div>
          </div>

          {stockError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{stockError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Jenis Mutasi *
            </label>
            <select
              value={stockFormData.type}
              onChange={(e) => setStockFormData({ ...stockFormData, type: e.target.value })}
              disabled={stockSubmitting}
              className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 text-xs bg-white focus:outline-none focus:border-zinc-900"
            >
              <option value="in">Stok Masuk (Restock)</option>
              <option value="out">Stok Keluar (Rusak / Hilang)</option>
              <option value="adjustment">Stock Opname (Fisik Sebenarnya)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              {stockFormData.type === 'adjustment'
                ? 'Jumlah Stok Fisik Sebenarnya (pcs) *'
                : 'Jumlah Barang (pcs) *'}
            </label>
            <input
              type="number"
              min="0"
              value={stockFormData.quantity}
              onChange={(e) => setStockFormData({ ...stockFormData, quantity: e.target.value })}
              disabled={stockSubmitting}
              className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 text-xs focus:outline-none focus:border-zinc-900"
            />
          </div>

          <div className="p-2.5 rounded-lg bg-zinc-50 border border-zinc-200 flex items-center justify-between text-xs">
            <span className="text-zinc-500">Estimasi Stok Akhir:</span>
            <span className="font-semibold text-zinc-900 tabular-nums font-mono">
              {stockPreview} pcs
            </span>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Catatan
            </label>
            <textarea
              rows={2}
              value={stockFormData.note}
              onChange={(e) => setStockFormData({ ...stockFormData, note: e.target.value })}
              disabled={stockSubmitting}
              placeholder="Keterangan mutasi..."
              className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 text-xs focus:outline-none focus:border-zinc-900"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
            <button
              type="button"
              disabled={stockSubmitting}
              onClick={() => setIsStockModalOpen(false)}
              className="px-3 py-1.5 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={stockSubmitting}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {stockSubmitting && <Loader2 className="w-3 h-3 animate-spin" />}
              <span>Simpan Mutasi</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Riwayat Mutasi Stok */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title={`Riwayat Mutasi: ${historyTarget?.name || ''}`}
        maxWidth="max-w-xl"
      >
        <div className="space-y-3.5">
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-50 border border-zinc-200 text-xs">
            <span className="text-zinc-500">SKU: <strong className="font-mono text-zinc-800">{historyTarget?.sku}</strong></span>
            <span className="text-zinc-500">Stok: <strong className="text-zinc-900 font-mono">{historyTarget?.stock} pcs</strong></span>
          </div>

          {loadingMovements ? (
            <div className="py-6 text-center text-xs text-zinc-400">
              <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1 text-zinc-600" />
              <span>Memuat riwayat...</span>
            </div>
          ) : movements.length === 0 ? (
            <div className="py-6 text-center text-zinc-400 text-xs">
              <Boxes className="w-6 h-6 mx-auto mb-1 text-zinc-300" />
              <span>Belum ada catatan mutasi</span>
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto divide-y divide-zinc-100 border border-zinc-200 rounded-lg">
              {movements.map((m) => {
                const isPositive = m.quantity > 0
                return (
                  <div key={m.id} className="p-2.5 text-xs flex items-center justify-between hover:bg-zinc-50">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${
                            m.type === 'in'
                              ? 'bg-emerald-50 text-emerald-700'
                              : m.type === 'out'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-zinc-100 text-zinc-700'
                          }`}
                        >
                          {m.type === 'in' ? 'Masuk' : m.type === 'out' ? 'Keluar' : 'Opname'}
                        </span>
                        <span className="font-medium text-zinc-900 font-mono">
                          {isPositive ? `+${m.quantity}` : `${m.quantity}`} pcs
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        {m.note || '-'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-zinc-600">{m.user?.name || 'Sistem'}</p>
                      <p className="text-[10px] text-zinc-400">{formatDate(m.created_at)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-zinc-100">
            <button
              type="button"
              onClick={() => setIsHistoryModalOpen(false)}
              className="px-3 py-1.5 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50"
            >
              Tutup
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Konfirmasi Hapus Produk */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => !deleting && setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Hapus Produk"
        message={`Apakah Anda yakin ingin menghapus produk "${deleteTarget?.name}"?`}
        confirmText={deleting ? 'Menghapus...' : 'Hapus'}
      />
    </div>
  )
}
