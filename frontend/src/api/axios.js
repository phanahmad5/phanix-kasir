import axios from 'axios'

let activeRequests = 0
const networkListeners = new Set()

function notifyNetwork() {
  const isBusy = activeRequests > 0
  networkListeners.forEach((listener) => listener(isBusy))
}

export function subscribeNetwork(listener) {
  networkListeners.add(listener)
  return () => networkListeners.delete(listener)
}

export function isNetworkBusy() {
  return activeRequests > 0
}

/**
 * Axios instance terpusat untuk komunikasi dengan Laravel Sanctum REST API.
 * Menggunakan mekanisme Session Cookie SPA (stateful) dengan dukungan CSRF.
 */
const api = axios.create({
  baseURL: 'http://localhost:8000',
  withCredentials: true,
  withXSRFToken: true,
  headers: {
    'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
})

// Request interceptor untuk melacak aktivitas jaringan
api.interceptors.request.use(
  (config) => {
    activeRequests++
    notifyNetwork()
    return config
  },
  (error) => {
    activeRequests = Math.max(0, activeRequests - 1)
    notifyNetwork()
    return Promise.reject(error)
  }
)

// Response interceptor untuk standardisasi penanganan error
api.interceptors.response.use(
  (response) => {
    activeRequests = Math.max(0, activeRequests - 1)
    notifyNetwork()
    return response
  },
  (error) => {
    activeRequests = Math.max(0, activeRequests - 1)
    notifyNetwork()

    // Menormalkan pesan error dari respons backend Laravel
    let message = 'Terjadi kesalahan pada server. Silakan coba beberapa saat lagi.'

    if (error.response) {
      const data = error.response.data
      if (error.response.status === 401) {
        message = data?.message || 'Sesi login Anda telah berakhir. Silakan login kembali.'
      } else if (error.response.status === 419) {
        message = 'Sesi CSRF kedaluwarsa (419). Silakan muat ulang halaman atau login kembali.'
      } else if (data?.message) {
        message = data.message
      } else if (data?.errors) {
        const firstKey = Object.keys(data.errors)[0]
        message = data.errors[firstKey][0] || message
      }
    } else if (error.request) {
      message = 'Tidak dapat terhubung ke server backend (http://localhost:8000). Pastikan server aktif.'
    }

    error.friendlyMessage = message
    return Promise.reject(error)
  }
)

export default api
