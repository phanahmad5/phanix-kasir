import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  Store,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  Loader2,
  Shield,
  User,
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
          'Gagal masuk ke sistem. Periksa kembali email dan kata sandi Anda.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans antialiased text-zinc-900">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        {/* Brand Header */}
        <div className="flex items-center justify-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-white shadow-xs">
            <Store className="w-4 h-4 text-zinc-100" />
          </div>
          <span className="text-lg font-semibold text-zinc-900 tracking-tight">Phanix POS</span>
        </div>

        <h2 className="text-center text-xl font-semibold text-zinc-900 tracking-tight">
          Masuk ke Akun
        </h2>
        <p className="mt-1 text-center text-xs text-zinc-500">
          Kelola transaksi kasir dan manajemen toko
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-sm">
        <div className="bg-white py-7 px-6 sm:px-8 rounded-xl border border-zinc-200 shadow-sm space-y-5">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="email"
                  value={email}
                  disabled={loading}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@phanixpos.test"
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-zinc-200 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 disabled:bg-zinc-50 transition-colors"
                />
              </div>
              {validationErrors.email && (
                <p className="text-[11px] text-rose-600 mt-1">
                  {validationErrors.email}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Kata Sandi
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  disabled={loading}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-9 py-2 rounded-lg border border-zinc-200 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 disabled:bg-zinc-50 transition-colors"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 p-0.5"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              {validationErrors.password && (
                <p className="text-[11px] text-rose-600 mt-1">
                  {validationErrors.password}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 rounded-lg bg-zinc-900 text-white text-xs font-medium shadow-xs hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <span>Masuk</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Switcher */}
          <div className="pt-3 border-t border-zinc-100">
            <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-2 text-center">
              Akun Demo
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => fillCredentials('admin@phanixpos.test', 'password123')}
                className="p-2 rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 hover:border-zinc-300 transition-colors text-left"
              >
                <div className="flex items-center gap-1.5 text-zinc-800">
                  <Shield className="w-3 h-3 text-zinc-600" />
                  <span className="text-xs font-medium">Admin</span>
                </div>
                <p className="text-[10px] text-zinc-400 truncate mt-0.5">admin@phanixpos.test</p>
              </button>

              <button
                type="button"
                onClick={() => fillCredentials('kasir@phanixpos.test', 'password123')}
                className="p-2 rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 hover:border-zinc-300 transition-colors text-left"
              >
                <div className="flex items-center gap-1.5 text-zinc-800">
                  <User className="w-3 h-3 text-zinc-600" />
                  <span className="text-xs font-medium">Kasir</span>
                </div>
                <p className="text-[10px] text-zinc-400 truncate mt-0.5">kasir@phanixpos.test</p>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
