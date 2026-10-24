import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../api/axios'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Memeriksa status sesi pengguna saat aplikasi dimuat
  const checkSession = useCallback(async () => {
    try {
      const response = await api.get('/api/user')
      if (response.data?.success && response.data?.data) {
        setUser(response.data.data)
      } else if (response.data?.id) {
        setUser(response.data)
      } else {
        setUser(null)
      }
    } catch (error) {
      // Status 401 adalah kondisi normal pengunjung belum login
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    checkSession()
  }, [checkSession])

  /**
   * Alur login Sanctum SPA:
   * 1. Ambil CSRF cookie dari Laravel
   * 2. Kirim kredensial ke /login
   * 3. Ambil data profil terbaru dari /api/user
   */
  const login = async (email, password) => {
    // 1. Dapatkan CSRF cookie
    await api.get('/sanctum/csrf-cookie')

    // 2. Kirim kredensial login
    const loginRes = await api.post('/login', { email, password })

    // 3. Konfirmasi profil terautentikasi
    let authenticatedUser = null
    try {
      const userRes = await api.get('/api/user')
      authenticatedUser = userRes.data?.data || userRes.data
    } catch {
      // Fallback ke data user dari login response jika ada
      authenticatedUser = loginRes.data?.data?.user || null
    }

    setUser(authenticatedUser)
    return authenticatedUser
  }

  /**
   * Alur logout:
   * Mengakhiri sesi di backend, menghapus cookie, dan membersihkan state pengguna di frontend
   */
  const logout = async () => {
    try {
      await api.post('/logout')
    } finally {
      setUser(null)
    }
  }

  const refreshUser = async () => {
    try {
      const res = await api.get('/api/user')
      const userData = res.data?.data || res.data
      setUser(userData)
      return userData
    } catch {
      setUser(null)
      return null
    }
  }

  const value = {
    user,
    loading,
    isAuthenticated: Boolean(user),
    isAdmin: user?.role === 'admin',
    isCashier: user?.role === 'cashier',
    login,
    logout,
    refreshUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
