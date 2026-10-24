import api from './axios'

/**
 * Service API untuk modul Transaksi Penjualan (POS Cashier)
 * Menggunakan Axios instance terpusat dengan autentikasi Laravel Sanctum.
 */
export const transactionService = {
  /**
   * Mengambil daftar produk aktif untuk katalog kasir
   * @param {Object} params - { search, category_id }
   */
  async getActiveProducts(params = {}) {
    const response = await api.get('/api/products', {
      params: { ...params, is_active: '1' },
    })
    return response.data
  },

  /**
   * Mengambil daftar kategori produk untuk filter kasir
   */
  async getCategories() {
    const response = await api.get('/api/categories')
    return response.data
  },

  /**
   * Mengirim transaksi penjualan baru ke backend (Tahap 6A)
   * Backend menghitung ulang seluruh harga, diskon, subtotal, total, dan kembalian secara otoritatif.
   *
   * @param {Object} payload - { items: [{ product_id, quantity }], discount, payment_method, paid_amount, idempotency_key }
   * @param {Object} [options] - Opsi tambahan seperti konfigurasi headers
   */
  async create(payload, options = {}) {
    const headers = { ...(options.headers || {}) }

    // Sertakan header X-Idempotency-Key untuk proteksi double submit / network replay
    if (payload.idempotency_key && !headers['X-Idempotency-Key']) {
      headers['X-Idempotency-Key'] = payload.idempotency_key
    }

    const response = await api.post('/api/transactions', payload, { headers })
    return response.data
  },

  /**
   * Mengambil daftar riwayat transaksi kasir
   * @param {Object} params - { search, start_date, end_date, payment_method, per_page, page }
   */
  async getAll(params = {}) {
    const response = await api.get('/api/transactions', { params })
    return response.data
  },

  /**
   * Mengambil rincian detail satu transaksi berdasarkan ID transaksi
   * @param {number|string} id - ID transaksi
   */
  async getById(id) {
    const response = await api.get(`/api/transactions/${id}`)
    return response.data
  },
}
