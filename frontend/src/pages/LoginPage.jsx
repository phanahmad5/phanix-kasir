import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  Store,
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  Loader2,
  ShieldCheck,
  UserCheck,
} from 'lucide-react'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [validationErrors, setValidationErrors] = useState({})

  const from = location.state?.from?.pathname || '/'

  // Quick fill helper untuk mempermudah pengujian manual demo
  function fillCredentials(demoEmail, demoPassword) {
    setEmail(demoEmail)
    setPassword(demoPassword)
    setErrorMessage('')
    setValidationErrors({})
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErrorMessage('')
    const errors = {}

    if (!email.trim()) {
      errors.email = 'Email wajib diisi.'
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = 'Format email tidak valid.'
    }

    if (!password) {
      errors.password = 'Password wajib diisi.'
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors)
      return
    }

    setValidationErrors({})
    setLoading(true)

    try {
      await login(email.trim(), password)
      navigate(from, { replace: true })
    } catch (err) {
      setErrorMessage(
        err.friendlyMessage ||
          err.response?.data?.message ||
          'Gagal masuk ke sistem. Periksa kembali email dan password Anda.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans antialiased">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Header */}
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-sm">
            <Store className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Phanix POS</h1>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 uppercase tracking-wider">
                UMKM
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">Point of Sale System</p>
          </div>
        </div>

        <h2 className="mt-4 text-center text-lg font-bold text-slate-900">
          Masuk ke Akun POS Anda
        </h2>
        <p className="text-center text-xs text-slate-500">
          Masukkan email dan password untuk mengakses kasir dan manajemen toko
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          {/* Error Alert Box */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Input Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Alamat Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  disabled={loading}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@phanixpos.test"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-50"
                />
              </div>
              {validationErrors.email && (
                <p className="text-[11px] text-rose-500 mt-1 font-medium">
                  {validationErrors.email}
                </p>
              )}
            </div>

            {/* Input Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Kata Sandi
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  disabled={loading}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-50"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-md"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {validationErrors.password && (
                <p className="text-[11px] text-rose-500 mt-1 font-medium">
                  {validationErrors.password}
                </p>
              )}
            </div>

            {/* Tombol Submit Login */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 text-white text-xs font-semibold shadow-xs hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Memproses Autentikasi...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Masuk ke Sistem</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Quick Demo Switcher (Praktis untuk Pengujian Lokal) */}
          <div className="pt-4 border-t border-slate-100">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5 text-center">
              Pilihan Akun Uji Coba Demo
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => fillCredentials('admin@phanixpos.test', 'password123')}
                className="p-2 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-blue-50/60 hover:border-blue-300 transition-colors text-left group"
              >
                <div className="flex items-center gap-1.5 text-slate-700 group-hover:text-blue-700">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-[11px] font-bold">Admin</span>
                </div>
                <p className="text-[10px] text-slate-500 truncate mt-0.5">admin@phanixpos.test</p>
              </button>

              <button
                type="button"
                onClick={() => fillCredentials('kasir@phanixpos.test', 'password123')}
                className="p-2 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-blue-50/60 hover:border-blue-300 transition-colors text-left group"
              >
                <div className="flex items-center gap-1.5 text-slate-700 group-hover:text-blue-700">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-[11px] font-bold">Kasir</span>
                </div>
                <p className="text-[10px] text-slate-500 truncate mt-0.5">kasir@phanixpos.test</p>
              </button>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <p className="mt-4 text-center text-[11px] text-slate-400">
          Phanix POS • Autentikasi Laravel Sanctum SPA
        </p>
      </div>
    </div>
  )
}
