import api from './axios'

/**
 * Service API untuk modul Dashboard Analitik POS
 * Menggunakan instance Axios terpusat dengan autentikasi Laravel Sanctum.
 */
export const dashboardService = {
  /**
   * Mengambil ringkasan metrik dashboard, grafik harian, produk terlaris, dan stok
   * @param {Object} params - { period: 'today'|'last_7_days'|'last_30_days'|'custom', start_date, end_date }
   */
  async getSummary(params = {}) {
    const response = await api.get('/api/dashboard/summary', { params })
    return response.data
  },
}
