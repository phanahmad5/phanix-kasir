import api from './axios'

/**
 * Service API untuk modul Produk & Manajemen Stok
 */
export const productService = {
  /**
   * Mengambil daftar produk dengan parameter pencarian dan filter
   * @param {Object} params - { search, category_id, is_active }
   */
  async getAll(params = {}) {
    const response = await api.get('/api/products', { params })
    return response.data
  },

  /**
   * Mengambil detail satu produk berdasarkan ID
   */
  async getById(id) {
    const response = await api.get(`/api/products/${id}`)
    return response.data
  },

  /**
   * Menambahkan produk baru (Khusus Admin)
   */
  async create(data) {
    const response = await api.post('/api/products', data)
    return response.data
  },

  /**
   * Memperbarui informasi produk (Khusus Admin)
   */
  async update(id, data) {
    const response = await api.put(`/api/products/${id}`, data)
    return response.data
  },

  /**
   * Menghapus produk jika tidak ada riwayat (Khusus Admin)
   */
  async delete(id) {
    const response = await api.delete(`/api/products/${id}`)
    return response.data
  },

  /**
   * Menyesuaikan stok produk secara manual (Khusus Admin)
   * @param {number|string} id - ID produk
   * @param {Object} data - { type: 'in' | 'out' | 'adjustment', quantity: number, note: string }
   */
  async adjustStock(id, data) {
    const response = await api.post(`/api/products/${id}/stock-adjustments`, data)
    return response.data
  },

  /**
   * Mengambil riwayat mutasi stok untuk produk tertentu
   */
  async getStockMovements(id) {
    const response = await api.get(`/api/products/${id}/stock-movements`)
    return response.data
  },
}
