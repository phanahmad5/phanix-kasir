import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Edit2, Trash2, Tags, Layers, Loader2, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react'
import { categoryService } from '../api/categories'
import { useAuth } from '../context/AuthContext'
import { Modal } from '../components/ui/Modal'
import { ConfirmModal } from '../components/ui/ConfirmModal'

export function CategoriesPage() {
  const { isAdmin } = useAuth()

  // State Data
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
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

  // Feedback Notification (Toast / Alert)
  const [notification, setNotification] = useState(null) // { type: 'success' | 'error', message: '' }

  // Fungsi memuat kategori dari REST API
  const fetchCategories = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const response = await categoryService.getAll()
      // response format: { success: true, data: [...] }
      setCategories(response.data || [])
    } catch (err) {
      setFetchError(err.friendlyMessage || 'Gagal mengambil data kategori dari server.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  // Otomatis menutup notifikasi setelah 4 detik
  useEffect(() => {
    if (notification?.type === 'success') {
      const timer = setTimeout(() => {
        setNotification(null)
      }, 4000)
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

      setIsModalOpen(false)
      await fetchCategories()
    } catch (err) {
      if (err.response?.status === 422 && err.response?.data?.errors) {
        const backendErrors = {}
        const errors = err.response.data.errors
        if (errors.name) backendErrors.name = errors.name[0]
        if (errors.description) backendErrors.description = errors.description[0]
        setFormErrors(backendErrors)
      } else {
        setGeneralFormError(
          err.friendlyMessage || 'Terjadi kesalahan saat menyimpan kategori.'
        )
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
      setDeleteTarget(null)
      await fetchCategories()
    } catch (err) {
      setNotification({
        type: 'error',
        message:
          err.friendlyMessage ||
          'Kategori gagal dihapus. Pastikan kategori tidak digunakan oleh produk.',
      })
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Kategori Produk</h2>
            {!isAdmin && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                Mode Baca (Kasir)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Klasifikasikan produk toko untuk mempermudah pencarian saat transaksi
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Tombol Segarkan */}
          <button
            type="button"
            onClick={fetchCategories}
            disabled={loading}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition-colors disabled:opacity-50"
            title="Segarkan data kategori"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          {/* Tombol Tambah Kategori (Khusus Admin) */}
          {isAdmin && (
            <button
              type="button"
              onClick={handleOpenAdd}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold shadow-xs hover:bg-blue-700 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Tambah Kategori
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

      {/* Error State saat Pengambilan Data Gagal */}
      {fetchError && !loading && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-rose-900">Gagal Memuat Kategori</h3>
            <p className="text-xs text-rose-700 mt-1 max-w-md mx-auto">{fetchError}</p>
          </div>
          <button
            type="button"
            onClick={fetchCategories}
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
            <p className="text-xs text-slate-500 font-medium">Memuat data kategori dari server...</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !fetchError && categories.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Belum Ada Kategori Produk</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Klasifikasikan produk toko Anda ke dalam kategori untuk mempercepat pencarian barang di kasir.
            </p>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Tambah Kategori Pertama
            </button>
          )}
        </div>
      )}

      {/* Categories Table */}
      {!loading && !fetchError && categories.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3.5">ID</th>
                  <th className="px-6 py-3.5">Nama Kategori</th>
                  <th className="px-6 py-3.5">Deskripsi</th>
                  <th className="px-6 py-3.5 text-center">Jumlah Produk</th>
                  <th className="px-6 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categories.map((c, index) => {
                  const productCount = c.products_count ?? c.productCount ?? 0

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4 font-mono text-slate-400">#{index + 1}</td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900 flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                            <Tags className="w-3.5 h-3.5" />
                          </div>
                          {c.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {c.description || (
                          <span className="text-slate-300 italic">Tidak ada deskripsi</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                          {productCount} Produk
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isAdmin ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(c)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Edit Kategori"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(c)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Hapus Kategori"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-300 text-[11px] italic">Khusus Admin</span>
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
        title={editingCategory ? 'Edit Kategori' : 'Tambah Kategori Baru'}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {generalFormError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{generalFormError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nama Kategori *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value })
                if (formErrors.name) setFormErrors({ ...formErrors, name: null })
              }}
              placeholder="misal: Makanan Ringan"
              disabled={submitting}
              className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                formErrors.name ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 focus:border-blue-500'
              }`}
            />
            {formErrors.name && (
              <p className="text-[11px] text-rose-500 mt-1">{formErrors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Deskripsi Singkat (Opsional)
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => {
                setFormData({ ...formData, description: e.target.value })
                if (formErrors.description) setFormErrors({ ...formErrors, description: null })
              }}
              placeholder="Keterangan singkat mengenai kategori ini..."
              disabled={submitting}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            {formErrors.description && (
              <p className="text-[11px] text-rose-500 mt-1">{formErrors.description}</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setIsModalOpen(false)}
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
              {editingCategory ? 'Simpan Perubahan' : 'Tambahkan Kategori'}
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
              } produk terdaftar. Anda harus memindahkan atau menghapus produk terkait sebelum dapat menghapus kategori ini.`
            : `Apakah Anda yakin ingin menghapus kategori "${deleteTarget?.name}"? Tindakan ini tidak dapat dibatalkan.`
        }
        confirmText={deleting ? 'Menghapus...' : 'Hapus Kategori'}
      />
    </div>
  )
}
