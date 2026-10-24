import api from './axios'

/**
 * Service API untuk modul Kategori Produk
 */
export const categoryService = {
  /**
   * Mengambil daftar seluruh kategori
   */
  async getAll() {
    const response = await api.get('/api/categories')
    return response.data
  },

  /**
   * Mengambil detail satu kategori berdasarkan ID
   */
  async getById(id) {
    const response = await api.get(`/api/categories/${id}`)
    return response.data
  },

  /**
   * Menambahkan kategori baru (Khusus Admin)
   */
  async create(data) {
    const response = await api.post('/api/categories', data)
    return response.data
  },

  /**
   * Memperbarui data kategori (Khusus Admin)
   */
  async update(id, data) {
    const response = await api.put(`/api/categories/${id}`, data)
    return response.data
  },

  /**
   * Menghapus kategori (Khusus Admin)
   */
  async delete(id) {
    const response = await api.delete(`/api/categories/${id}`)
    return response.data
  },
}
