import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Edit2, Trash2, Tags, RefreshCw, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { categoryService } from '../api/categories'
import { useAuth } from '../context/AuthContext'
import { Modal } from '../components/ui/Modal'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { getCache, setCache, invalidateCache } from '../utils/cache'
import { Badge } from '../components/ui/Badge'

export function CategoriesPage() {
  const { isAdmin } = useAuth()

  // State Data - Diambil dari cache jika ada agar instan tanpa loading
  const [categories, setCategories] = useState(() => getCache('categories') || [])
  const [loading, setLoading] = useState(() => !getCache('categories'))
  const [fetchError, setFetchError] = useState(null)

  // State Modal Form & Delete
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Form Fields & Errors
  const [formData, setFormData] = useState({ name: '', description: '' })
  const [formErrors, setFormErrors] = useState({})
  const [generalFormError, setGeneralFormError] = useState('')

  // Notification Toast
  const [notification, setNotification] = useState(null)

  // Fungsi memuat kategori dari REST API
  const fetchCategories = useCallback(async (isManualRefresh = false) => {
    const cached = getCache('categories')
    if (!cached || isManualRefresh) {
      setLoading(true)
    }
    setFetchError(null)

    try {
      const response = await categoryService.getAll()
      const data = response.data || []
      setCache('categories', data)
      setCategories(data)
    } catch (err) {
      if (!cached) {
        setFetchError(err.friendlyMessage || 'Gagal mengambil data kategori.')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  useEffect(() => {
    if (notification?.type === 'success') {
      const timer = setTimeout(() => setNotification(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  function handleOpenAdd() {
    setEditingCategory(null)
    setFormData({ name: '', description: '' })
    setFormErrors({})
    setGeneralFormError('')
    setIsModalOpen(true)
  }

  function handleOpenEdit(cat) {
    setEditingCategory(cat)
    setFormData({ name: cat.name, description: cat.description || '' })
    setFormErrors({})
    setGeneralFormError('')
    setIsModalOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormErrors({})
    setGeneralFormError('')

    const trimmedName = formData.name.trim()
    const trimmedDescription = formData.description.trim()

    if (!trimmedName) {
      setFormErrors({ name: 'Nama kategori wajib diisi.' })
      return
    }

    setSubmitting(true)
    try {
      if (editingCategory) {
        await categoryService.update(editingCategory.id, {
          name: trimmedName,
          description: trimmedDescription,
        })
        setNotification({
          type: 'success',
          message: `Kategori "${trimmedName}" berhasil diperbarui.`,
        })
      } else {
        await categoryService.create({
          name: trimmedName,
          description: trimmedDescription,
        })
        setNotification({
          type: 'success',
          message: `Kategori "${trimmedName}" berhasil ditambahkan.`,
        })
      }

      invalidateCache('categories')
      invalidateCache('pos_categories')
      setIsModalOpen(false)
      fetchCategories(true)
    } catch (err) {
      if (err.response?.data?.errors) {
        setFormErrors(err.response.data.errors)
      } else {
        setGeneralFormError(err.friendlyMessage || 'Gagal menyimpan kategori.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await categoryService.delete(deleteTarget.id)
      setNotification({
        type: 'success',
        message: `Kategori "${deleteTarget.name}" berhasil dihapus.`,
      })
      invalidateCache('categories')
      invalidateCache('pos_categories')
      setDeleteTarget(null)
      fetchCategories(true)
    } catch (err) {
      setNotification({
        type: 'error',
        message: err.friendlyMessage || 'Gagal menghapus kategori.',
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-zinc-900 tracking-tight">Kategori Produk</h2>
            {!isAdmin && (
              <Badge variant="outline">Mode Baca</Badge>
            )}
          </div>
          <p className="text-xs text-zinc-500">
            Klasifikasi kelompok barang toko
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchCategories(true)}
            disabled={loading}
            className="p-1.5 rounded-lg text-zinc-600 hover:bg-zinc-100 border border-zinc-200 bg-white transition-colors disabled:opacity-50 cursor-pointer"
            title="Segarkan kategori"
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
              <span>Tambah Kategori</span>
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

      {/* Error State */}
      {fetchError && !loading && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-center space-y-2">
          <p className="text-xs text-rose-700">{fetchError}</p>
          <button
            type="button"
            onClick={() => fetchCategories(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-rose-600 text-white text-xs font-medium hover:bg-rose-700"
          >
            <RefreshCw className="w-3 h-3" />
            Coba Lagi
          </button>
        </div>
      )}

      {/* First-time Loading Skeleton */}
      {loading && categories.length === 0 && (
        <div className="bg-white rounded-xl border border-zinc-200/80 p-8 text-center animate-pulse">
          <div className="h-4 bg-zinc-100 rounded w-48 mx-auto mb-2" />
          <div className="h-3 bg-zinc-50 rounded w-32 mx-auto" />
        </div>
      )}

      {/* Empty State */}
      {!loading && !fetchError && categories.length === 0 && (
        <div className="bg-white rounded-xl border border-zinc-200/80 p-10 text-center space-y-3">
          <div className="w-9 h-9 rounded-lg bg-zinc-100 text-zinc-500 flex items-center justify-center mx-auto">
            <Tags className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-zinc-900">Belum Ada Kategori</h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">Tambahkan kategori untuk memudahkan katalog kasir</p>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Kategori</span>
            </button>
          )}
        </div>
      )}

      {/* Categories Table */}
      {categories.length > 0 && (
        <div className="bg-white rounded-xl border border-zinc-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-600">
              <thead className="bg-zinc-50 text-[10px] uppercase tracking-wider text-zinc-400 font-semibold border-b border-zinc-100">
                <tr>
                  <th className="px-5 py-3 w-16">No</th>
                  <th className="px-5 py-3">Nama Kategori</th>
                  <th className="px-5 py-3">Deskripsi</th>
                  <th className="px-5 py-3 text-center w-32">Jumlah Produk</th>
                  <th className="px-5 py-3 text-right w-24">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {categories.map((c, index) => {
                  const productCount = c.products_count ?? c.productCount ?? 0

                  return (
                    <tr key={c.id} className="hover:bg-zinc-50/70 transition-colors">
                      <td className="px-5 py-3 font-mono text-zinc-400 text-[11px]">{index + 1}</td>
                      <td className="px-5 py-3 font-medium text-zinc-900">
                        {c.name}
                      </td>
                      <td className="px-5 py-3 text-zinc-500 text-[11px]">
                        {c.description || <span className="text-zinc-300 italic">-</span>}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <Badge variant="neutral">{productCount} Produk</Badge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {isAdmin ? (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(c)}
                              className="p-1 rounded text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(c)}
                              className="p-1 rounded text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Hapus"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-zinc-300 text-[10px]">-</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Form Tambah / Edit */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !submitting && setIsModalOpen(false)}
        title={editingCategory ? 'Edit Kategori' : 'Tambah Kategori'}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {generalFormError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{generalFormError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Nama Kategori *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value })
                if (formErrors.name) setFormErrors({ ...formErrors, name: null })
              }}
              placeholder="Contoh: Minuman, Makanan"
              disabled={submitting}
              className={`w-full px-3 py-2 rounded-lg border text-xs focus:outline-none ${
                formErrors.name ? 'border-rose-400 focus:border-rose-500' : 'border-zinc-200 focus:border-zinc-900'
              }`}
            />
            {formErrors.name && (
              <p className="text-[11px] text-rose-600 mt-1">{formErrors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Deskripsi (Opsional)
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => {
                setFormData({ ...formData, description: e.target.value })
                if (formErrors.description) setFormErrors({ ...formErrors, description: null })
              }}
              placeholder="Keterangan singkat kategori..."
              disabled={submitting}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-xs focus:outline-none focus:border-zinc-900"
            />
            {formErrors.description && (
              <p className="text-[11px] text-rose-600 mt-1">{formErrors.description}</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setIsModalOpen(false)}
              className="px-3 py-1.5 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 transition-colors shadow-xs disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
              <span>{editingCategory ? 'Simpan' : 'Tambah'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Konfirmasi Hapus */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => !deleting && setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Hapus Kategori"
        message={
          (deleteTarget?.products_count ?? deleteTarget?.productCount ?? 0) > 0
            ? `Peringatan: Kategori "${deleteTarget?.name}" masih memiliki ${
                deleteTarget?.products_count ?? deleteTarget?.productCount
              } produk terdaftar. Anda harus memindahkan produk terlebih dahulu.`
            : `Apakah Anda yakin ingin menghapus kategori "${deleteTarget?.name}"?`
        }
        confirmText={deleting ? 'Menghapus...' : 'Hapus'}
      />
    </div>
  )
}
