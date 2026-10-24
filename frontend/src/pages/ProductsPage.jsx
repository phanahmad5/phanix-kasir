import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Package,
  AlertCircle,
  CheckCircle2,
  Tag,
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

export function ProductsPage() {
  const { isAdmin } = useAuth()

  // State Data
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('ALL')
  const [selectedStatus, setSelectedStatus] = useState('ALL')

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

  // Modal State Mutasi Stok (Stock Adjustment)
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
      setCategories(res.data || [])
    } catch (err) {
      console.error('Gagal memuat kategori:', err)
    }
  }, [])

  // Memuat data produk dari API
  const fetchProducts = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const params = {}
      if (searchQuery.trim()) params.search = searchQuery.trim()
      if (selectedCategory !== 'ALL') params.category_id = selectedCategory
      if (selectedStatus !== 'ALL') {
        params.is_active = selectedStatus === 'ACTIVE' ? '1' : '0'
      }

      const res = await productService.getAll(params)
      setProducts(res.data || [])
    } catch (err) {
      setFetchError(err.friendlyMessage || 'Gagal mengambil data produk dari server.')
    } finally {
      setLoading(false)
    }
  }, [searchQuery, selectedCategory, selectedStatus])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts()
    }, 250)
    return () => clearTimeout(timer)
  }, [fetchProducts])

  // Auto-dismiss notification toast
  useEffect(() => {
    if (notification?.type === 'success') {
      const timer = setTimeout(() => {
        setNotification(null)
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  // Open Add Product Modal
  function handleOpenAdd() {
    setEditingProduct(null)
    const nextNum = products.length + 1
    setFormData({
      sku: `BRG-${String(nextNum).padStart(3, '0')}`,
      name: '',
      categoryId: categories[0]?.id ? String(categories[0].id) : '',
      description: '',
      costPrice: '',
      sellingPrice: '',
      stock: '0',
      minStock: '5',
      isActive: true,
    })
    setErrors({})
    setGeneralError('')
    setIsFormOpen(true)
  }

  // Open Edit Product Modal
  function handleOpenEdit(product) {
    setEditingProduct(product)
    setFormData({
      sku: product.sku,
      name: product.name,
      categoryId: String(product.category_id || product.categoryId || categories[0]?.id || ''),
      description: product.description || '',
      costPrice: String(Math.round(product.cost_price ?? product.costPrice ?? 0)),
      sellingPrice: String(Math.round(product.selling_price ?? product.sellingPrice ?? 0)),
      stock: String(product.stock ?? 0),
      minStock: String(product.min_stock ?? product.minStock ?? 5),
      isActive: Boolean(product.is_active ?? product.isActive ?? true),
    })
    setErrors({})
    setGeneralError('')
    setIsFormOpen(true)
  }

  // Submit Add / Edit Product
  async function handleSubmit(e) {
    e.preventDefault()
    setErrors({})
    setGeneralError('')

    const newErrors = {}
    if (!formData.sku.trim()) newErrors.sku = 'Kode SKU wajib diisi.'
    if (!formData.name.trim()) newErrors.name = 'Nama produk wajib diisi.'
    if (!formData.categoryId) newErrors.categoryId = 'Kategori produk wajib dipilih.'

    const costNum = Number(formData.costPrice)
    const sellNum = Number(formData.sellingPrice)
    const stockNum = Number(formData.stock)
    const minStockNum = Number(formData.minStock)

    if (isNaN(costNum) || costNum < 0) {
      newErrors.costPrice = 'Harga modal harus bernilai minimal 0.'
    }
    if (isNaN(sellNum) || sellNum < 0) {
      newErrors.sellingPrice = 'Harga jual harus bernilai minimal 0.'
    }
    if (!editingProduct && (isNaN(stockNum) || stockNum < 0)) {
      newErrors.stock = 'Stok awal tidak boleh bernilai negatif.'
    }
    if (isNaN(minStockNum) || minStockNum < 0) {
      newErrors.minStock = 'Batas minimum stok tidak boleh negatif.'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setSubmitting(true)
    try {
      if (editingProduct) {
        // Update product
        await productService.update(editingProduct.id, {
          sku: formData.sku.trim(),
          name: formData.name.trim(),
          category_id: Number(formData.categoryId),
          description: formData.description.trim(),
          cost_price: costNum,
          selling_price: sellNum,
          min_stock: minStockNum,
          is_active: formData.isActive,
        })
        setNotification({
          type: 'success',
          message: `Produk "${formData.name.trim()}" berhasil diperbarui.`,
        })
      } else {
        // Create product
        await productService.create({
          sku: formData.sku.trim(),
          name: formData.name.trim(),
          category_id: Number(formData.categoryId),
          description: formData.description.trim(),
          cost_price: costNum,
          selling_price: sellNum,
          stock: stockNum,
          min_stock: minStockNum,
          is_active: formData.isActive,
        })
        setNotification({
          type: 'success',
          message: `Produk "${formData.name.trim()}" berhasil ditambahkan.`,
        })
      }

      setIsFormOpen(false)
      await fetchProducts()
    } catch (err) {
      if (err.response?.status === 422 && err.response?.data?.errors) {
        const backendErrors = {}
        const be = err.response.data.errors
        if (be.sku) backendErrors.sku = be.sku[0]
        if (be.name) backendErrors.name = be.name[0]
        if (be.category_id) backendErrors.categoryId = be.category_id[0]
        if (be.cost_price) backendErrors.costPrice = be.cost_price[0]
        if (be.selling_price) backendErrors.sellingPrice = be.selling_price[0]
        if (be.stock) backendErrors.stock = be.stock[0]
        if (be.min_stock) backendErrors.minStock = be.min_stock[0]
        setErrors(backendErrors)
      } else {
        setGeneralError(err.friendlyMessage || 'Terjadi kesalahan saat menyimpan data produk.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // Delete product confirmation
  async function handleDeleteConfirm() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await productService.delete(deleteTarget.id)
      setNotification({
        type: 'success',
        message: `Produk "${deleteTarget.name}" berhasil dihapus.`,
      })
      setDeleteTarget(null)
      await fetchProducts()
    } catch (err) {
      setNotification({
        type: 'error',
        message:
          err.friendlyMessage ||
          'Produk tidak dapat dihapus karena memiliki riwayat data. Nonaktifkan produk sebagai gantinya.',
      })
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  // Open Stock Adjustment Modal
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

  // Preview target stock calculation
  const stockPreview = useMemo(() => {
    if (!stockTarget) return 0
    const current = Number(stockTarget.stock) || 0
    const qty = Number(stockFormData.quantity) || 0

    if (stockFormData.type === 'in') {
      return current + qty
    } else if (stockFormData.type === 'out') {
      return current - qty
    } else if (stockFormData.type === 'adjustment') {
      return qty
    }
    return current
  }, [stockTarget, stockFormData])

  // Submit Stock Adjustment
  async function handleStockSubmit(e) {
    e.preventDefault()
    setStockError('')

    const qty = Number(stockFormData.quantity)
    if (isNaN(qty) || qty < 0) {
      setStockError('Kuantitas stok harus bernilai angka positif.')
      return
    }

    if (stockFormData.type === 'out' && qty > (stockTarget?.stock || 0)) {
      setStockError(
        `Kuantitas pengurangan (${qty}) melebihi stok yang tersedia saat ini (${stockTarget?.stock || 0}).`
      )
      return
    }

    setStockSubmitting(true)
    try {
      await productService.adjustStock(stockTarget.id, {
        type: stockFormData.type,
        quantity: qty,
        note: stockFormData.note.trim() || undefined,
      })

      setNotification({
        type: 'success',
        message: `Stok "${stockTarget.name}" berhasil disesuaikan menjadi ${stockPreview} pcs.`,
      })

      setIsStockModalOpen(false)
      await fetchProducts()
    } catch (err) {
      setStockError(err.friendlyMessage || 'Gagal melakukan mutasi stok.')
    } finally {
      setStockSubmitting(false)
    }
  }

  // Open Stock History Modal
  async function handleOpenHistory(product) {
    setHistoryTarget(product)
    setIsHistoryModalOpen(true)
    setLoadingMovements(true)
    try {
      const res = await productService.getStockMovements(product.id)
      setMovements(res.data || [])
    } catch (err) {
      console.error('Gagal mengambil riwayat mutasi:', err)
      setMovements([])
    } finally {
      setLoadingMovements(false)
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Katalog Produk & Stok</h2>
            {!isAdmin && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                Mode Baca (Kasir)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Total {products.length} produk terdaftar dalam katalog sistem Phanix POS
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Tombol Segarkan */}
          <button
            type="button"
            onClick={fetchProducts}
            disabled={loading}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition-colors disabled:opacity-50"
            title="Segarkan data produk"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          {/* Tombol Tambah Produk (Khusus Admin) */}
          {isAdmin && (
            <button
              type="button"
              onClick={handleOpenAdd}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold shadow-xs hover:bg-blue-700 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Tambah Produk Baru
            </button>
          )}
        </div>
      </div>

      {/* Alert Notifikasi Feedback */}
      {notification && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center justify-between gap-3 border transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
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
            className="text-[11px] font-semibold underline hover:no-underline shrink-0"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari berdasarkan nama produk atau kode SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        {/* Category Filter */}
        <div className="w-full md:w-56">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <option value="ALL">Semua Kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="w-full md:w-44">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <option value="ALL">Semua Status</option>
            <option value="ACTIVE">Aktif Dijual</option>
            <option value="INACTIVE">Nonaktif</option>
          </select>
        </div>
      </div>

      {/* Error State */}
      {fetchError && !loading && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-rose-900">Gagal Memuat Produk</h3>
            <p className="text-xs text-rose-700 mt-1 max-w-md mx-auto">{fetchError}</p>
          </div>
          <button
            type="button"
            onClick={fetchProducts}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Coba Lagi
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
          <div className="flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <p className="text-xs text-slate-500 font-medium">Memuat katalog produk dari database...</p>
          </div>
        </div>
      )}

      {/* Products Table */}
      {!loading && !fetchError && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3.5">SKU</th>
                  <th className="px-6 py-3.5">Nama Produk</th>
                  <th className="px-6 py-3.5">Kategori</th>
                  <th className="px-6 py-3.5 text-right">Harga Modal</th>
                  <th className="px-6 py-3.5 text-right">Harga Jual</th>
                  <th className="px-6 py-3.5 text-center">Stok</th>
                  <th className="px-6 py-3.5 text-center">Status</th>
                  <th className="px-6 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                      <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="font-semibold text-slate-700">Tidak ada produk ditemukan.</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Sesuaikan kata kunci pencarian atau filter kategori Anda.
                      </p>
                    </td>
                  </tr>
                ) : (
                  products.map((p) => {
                    const minStock = p.min_stock ?? p.minStock ?? 5
                    const stock = p.stock ?? 0
                    const isLow = stock <= minStock
                    const isActive = p.is_active ?? p.isActive ?? true
                    const costPrice = p.cost_price ?? p.costPrice ?? 0
                    const sellingPrice = p.selling_price ?? p.sellingPrice ?? 0
                    const categoryName = p.category?.name || p.categoryName || 'Umum'

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-6 py-4 font-mono font-semibold text-slate-700">
                          {p.sku}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-900">{p.name}</div>
                          <div className="text-[11px] text-slate-400">Min. Stok: {minStock}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-medium">
                            <Tag className="w-3 h-3 text-slate-400" />
                            {categoryName}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-slate-500">
                          {formatRupiah(costPrice)}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-slate-900">
                          {formatRupiah(sellingPrice)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${
                              stock === 0
                                ? 'bg-rose-100 text-rose-700'
                                : isLow
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {stock === 0 ? 'Habis (0)' : `${stock} pcs`}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {isActive ? (
                            <Badge variant="success">Aktif</Badge>
                          ) : (
                            <Badge variant="neutral">Nonaktif</Badge>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Tombol Riwayat Mutasi Stok (Bisa dilihat Admin & Kasir) */}
                            <button
                              type="button"
                              onClick={() => handleOpenHistory(p)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                              title="Riwayat Mutasi Stok"
                            >
                              <History className="w-4 h-4" />
                            </button>

                            {/* Tombol Mutasi Stok Manual (Khusus Admin) */}
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleOpenStockModal(p)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                title="Sesuaikan Stok"
                              >
                                <ArrowUpDown className="w-4 h-4" />
                              </button>
                            )}

                            {/* Tombol Edit Produk (Khusus Admin) */}
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(p)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                title="Edit Data Produk"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}

                            {/* Tombol Hapus Produk (Khusus Admin) */}
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(p)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                title="Hapus Produk"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}

                            {!isAdmin && (
                              <span className="text-[11px] text-slate-300 italic">Lihat</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Form Tambah / Edit Produk */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => !submitting && setIsFormOpen(false)}
        title={editingProduct ? 'Edit Data Produk' : 'Tambah Produk Baru'}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {generalError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{generalError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Kode SKU / Barcode *
              </label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                placeholder="misal: BRG-001"
                disabled={submitting}
                className={`w-full px-3 py-2 rounded-xl border text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                  errors.sku ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 focus:border-blue-500'
                }`}
              />
              {errors.sku && <p className="text-[11px] text-rose-500 mt-1">{errors.sku}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Kategori Produk *
              </label>
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                disabled={submitting}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {errors.categoryId && <p className="text-[11px] text-rose-500 mt-1">{errors.categoryId}</p>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nama Produk *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="misal: Beras Premium Ramos 5kg"
              disabled={submitting}
              className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                errors.name ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 focus:border-blue-500'
              }`}
            />
            {errors.name && <p className="text-[11px] text-rose-500 mt-1">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Harga Modal / Beli (Rp) *
              </label>
              <input
                type="number"
                value={formData.costPrice}
                onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                placeholder="68000"
                min="0"
                disabled={submitting}
                className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                  errors.costPrice ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 focus:border-blue-500'
                }`}
              />
              {errors.costPrice && <p className="text-[11px] text-rose-500 mt-1">{errors.costPrice}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Harga Jual (Rp) *
              </label>
              <input
                type="number"
                value={formData.sellingPrice}
                onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                placeholder="75000"
                min="0"
                disabled={submitting}
                className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                  errors.sellingPrice ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 focus:border-blue-500'
                }`}
              />
              {errors.sellingPrice && <p className="text-[11px] text-rose-500 mt-1">{errors.sellingPrice}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {editingProduct ? 'Stok Saat Ini (Hanya Baca)' : 'Stok Awal Masuk *'}
              </label>
              <input
                type="number"
                value={formData.stock}
                onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                placeholder="10"
                min="0"
                disabled={editingProduct || submitting}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
              />
              {editingProduct ? (
                <p className="text-[10px] text-slate-400 mt-1">
                  *Untuk mengubah jumlah stok, gunakan tombol <strong>Sesuaikan Stok</strong> pada tabel.
                </p>
              ) : (
                errors.stock && <p className="text-[11px] text-rose-500 mt-1">{errors.stock}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Batas Minimum Stok
              </label>
              <input
                type="number"
                value={formData.minStock}
                onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
                placeholder="5"
                min="0"
                disabled={submitting}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              {errors.minStock && <p className="text-[11px] text-rose-500 mt-1">{errors.minStock}</p>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Deskripsi Singkat (Opsional)
            </label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Keterangan singkat produk..."
              disabled={submitting}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div className="pt-2">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                disabled={submitting}
                className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
              />
              <span className="text-xs font-medium text-slate-700">
                Produk aktif dan dapat dijual di kasir
              </span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setIsFormOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-xs disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editingProduct ? 'Simpan Perubahan' : 'Tambahkan Produk'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Penyesuaian Stok (Stock Adjustment) */}
      <Modal
        isOpen={isStockModalOpen}
        onClose={() => !stockSubmitting && setIsStockModalOpen(false)}
        title="Penyesuaian Stok Produk"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleStockSubmit} className="space-y-4">
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
            <p className="text-xs font-bold text-slate-900">{stockTarget?.name}</p>
            <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500">
              <span>SKU: <strong className="font-mono text-slate-700">{stockTarget?.sku}</strong></span>
              <span>•</span>
              <span>Stok Saat Ini: <strong className="text-blue-700">{stockTarget?.stock} pcs</strong></span>
            </div>
          </div>

          {stockError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{stockError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Jenis Mutasi Stok *
            </label>
            <select
              value={stockFormData.type}
              onChange={(e) => setStockFormData({ ...stockFormData, type: e.target.value })}
              disabled={stockSubmitting}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="in">Stok Masuk (Pembelian / Restock Supplier)</option>
              <option value="out">Stok Keluar (Barang Rusak / Kedaluwarsa / Hilang)</option>
              <option value="adjustment">Penyesuaian Fisik (Hasil Stock Opname)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
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
              placeholder="1"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Kalkulasi Preview */}
          <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100 flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium">Estimasi Stok Akhir:</span>
            <span className="font-bold text-blue-700 text-sm">
              {stockPreview} pcs
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Catatan / Alasan Mutasi
            </label>
            <textarea
              rows={2}
              value={stockFormData.note}
              onChange={(e) => setStockFormData({ ...stockFormData, note: e.target.value })}
              disabled={stockSubmitting}
              placeholder="misal: Pembelian faktur #INV-001 dari supplier"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              disabled={stockSubmitting}
              onClick={() => setIsStockModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={stockSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-xs disabled:opacity-50"
            >
              {stockSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Simpan Mutasi Stok
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Riwayat Mutasi Stok */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title={`Riwayat Mutasi: ${historyTarget?.name || ''}`}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500">SKU:</span>{' '}
              <span className="font-mono font-bold text-slate-800">{historyTarget?.sku}</span>
            </div>
            <div>
              <span className="text-slate-500">Stok Saat Ini:</span>{' '}
              <span className="font-bold text-blue-700">{historyTarget?.stock} pcs</span>
            </div>
          </div>

          {loadingMovements ? (
            <div className="py-8 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
              <p className="text-xs text-slate-500">Memuat log mutasi stok...</p>
            </div>
          ) : movements.length === 0 ? (
            <div className="py-8 text-center text-slate-400">
              <Boxes className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-xs font-medium">Belum ada riwayat mutasi stok untuk produk ini.</p>
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
              {movements.map((m) => {
                const isPositive = m.quantity > 0
                return (
                  <div key={m.id} className="p-3 text-xs flex items-center justify-between hover:bg-slate-50/70">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            m.type === 'in'
                              ? 'bg-emerald-100 text-emerald-800'
                              : m.type === 'out'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-indigo-100 text-indigo-800'
                          }`}
                        >
                          {m.type === 'in' ? 'Masuk' : m.type === 'out' ? 'Keluar' : 'Penyesuaian'}
                        </span>
                        <span className="font-semibold text-slate-800">
                          {isPositive ? `+${m.quantity}` : `${m.quantity}`} pcs
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        {m.note || <span className="italic text-slate-300">Tidak ada catatan</span>}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-medium text-slate-600">
                        {m.user?.name || 'Sistem'}
                      </p>
                      <p className="text-[10px] text-slate-400">{formatDate(m.created_at)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsHistoryModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
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
        message={`Apakah Anda yakin ingin menghapus produk "${deleteTarget?.name}"? Produk yang memiliki riwayat transaksi atau mutasi stok tidak dapat dihapus secara permanen.`}
        confirmText={deleting ? 'Menghapus...' : 'Hapus Produk'}
      />
    </div>
  )
}
