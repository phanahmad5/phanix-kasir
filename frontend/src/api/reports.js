import api from './axios'

/**
 * Service API untuk modul Laporan Penjualan POS
 * Menggunakan instance Axios terpusat dengan autentikasi Laravel Sanctum.
 */
export const reportService = {
  /**
   * Mengambil ringkasan laporan analitik penjualan berkala
   * @param {Object} params - { period: 'today'|'last_7_days'|'last_30_days'|'custom', start_date, end_date }
   */
  async getSummary(params = {}) {
    const response = await api.get('/api/reports/summary', { params })
    return response.data
  },

  /**
   * Mengunduh ekspor laporan transaksi dalam format file CSV
   * @param {Object} params - { period, start_date, end_date }
   */
  async exportCsv(params = {}) {
    const response = await api.get('/api/reports/export', {
      params,
      responseType: 'blob',
    })

    // Buat tautan unduhan otomatis untuk file blob CSV
    const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url

    // Coba ambil nama file dari header Content-Disposition jika tersedia
    let filename = `laporan-penjualan-${new Date().toISOString().slice(0, 10)}.csv`
    const disposition = response.headers['content-disposition']
    if (disposition && disposition.indexOf('filename=') !== -1) {
      const match = disposition.match(/filename="?([^"]+)"?/)
      if (match && match[1]) {
        filename = match[1]
      }
    }

    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)

    return true
  },
}
