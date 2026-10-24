import React, { useState } from 'react'
import {
  Store,
  Printer,
  ShieldCheck,
  Save,
  CheckCircle2,
  Info,
} from 'lucide-react'

export function SettingsPage() {
  const [storeName, setStoreName] = useState('Toko Berkah Mandiri')
  const [storePhone, setStorePhone] = useState('0812-3456-7890')
  const [storeAddress, setStoreAddress] = useState('Jl. Raya Perintis Kemerdekaan No. 12, Jawa Barat')
  const [receiptFooter, setReceiptFooter] = useState('Terima kasih atas kunjungan Anda!')
  const [paperSize, setPaperSize] = useState('58mm')
  const [autoPrint, setAutoPrint] = useState(true)
  const [savedNotification, setSavedNotification] = useState(false)

  function handleSave(e) {
    e.preventDefault()
    setSavedNotification(true)
    setTimeout(() => setSavedNotification(false), 3000)
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Pengaturan Sistem</h2>
        <p className="text-xs text-slate-500">
          Kelola profil toko, preferensi cetak struk kasir, dan konfigurasi aplikasi
        </p>
      </div>

      {savedNotification && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          Pengaturan berhasil disimpan secara lokal (Simulasi).
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Profil Toko */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Store className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Informasi Profil Toko</h3>
              <p className="text-xs text-slate-400">Data identitas toko yang akan tertera pada struk belanja</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nama Toko / Usaha *
              </label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nomor Telepon / WhatsApp
              </label>
              <input
                type="text"
                value={storePhone}
                onChange={(e) => setStorePhone(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Alamat Lengkap Toko
            </label>
            <input
              type="text"
              value={storeAddress}
              onChange={(e) => setStoreAddress(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Pesan Footer Struk Pembelian
            </label>
            <input
              type="text"
              value={receiptFooter}
              onChange={(e) => setReceiptFooter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Preferensi Printer */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Preferensi Cetak Struk</h3>
              <p className="text-xs text-slate-400">Pengaturan ukuran kertas thermal printer</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ukuran Lebar Kertas Struk
              </label>
              <select
                value={paperSize}
                onChange={(e) => setPaperSize(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="58mm">58mm (Thermal Standar UMKM)</option>
                <option value="80mm">80mm (Thermal Lebar POS)</option>
              </select>
            </div>

            <div className="flex items-center pt-5">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoPrint}
                  onChange={(e) => setAutoPrint(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <span className="text-xs font-medium text-slate-700">
                  Otomatis buka dialog cetak setelah transaksi selesai
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Info Versi & Keamanan */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 mb-4">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Informasi Sistem & Lingkungan</h3>
              <p className="text-xs text-slate-400">Spesifikasi aplikasi Phanix POS</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50">
              <span className="text-slate-400 block text-[11px]">Versi Frontend:</span>
              <span className="font-bold text-slate-800">v1.0.0-prototype</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50">
              <span className="text-slate-400 block text-[11px]">Framework:</span>
              <span className="font-bold text-slate-800">React 19 + Vite 8</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50">
              <span className="text-slate-400 block text-[11px]">Styling Engine:</span>
              <span className="font-bold text-slate-800">Tailwind CSS v4</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50">
              <span className="text-slate-400 block text-[11px]">Backend Target:</span>
              <span className="font-bold text-slate-800">Laravel 12 API</span>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold shadow-xs hover:bg-blue-700 transition-colors"
          >
            <Save className="w-4 h-4" />
            Simpan Pengaturan
          </button>
        </div>
      </form>
    </div>
  )
}
