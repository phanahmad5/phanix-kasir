import React, { useState } from 'react'
import {
  Save,
  CheckCircle2,
} from 'lucide-react'

export function SettingsPage() {
  const [storeName, setStoreName] = useState('Toko Berkah Mandiri')
  const [storePhone, setStorePhone] = useState('0812-3456-7890')
  const [storeAddress, setStoreAddress] = useState('Jl. Raya Perintis Kemerdekaan No. 12')
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
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-base font-semibold text-zinc-900 tracking-tight">Pengaturan Sistem</h2>
        <p className="text-xs text-zinc-500">
          Profil toko dan konfigurasi struk kasir
        </p>
      </div>

      {savedNotification && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Pengaturan berhasil disimpan.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        {/* Profil Toko */}
        <div className="bg-white p-4 rounded-xl border border-zinc-200/80 shadow-xs space-y-3.5">
          <div className="border-b border-zinc-100 pb-2.5">
            <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider">Identitas Toko</h3>
            <p className="text-[11px] text-zinc-400">Informasi yang dicetak pada bagian atas struk</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Nama Toko *
              </label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 text-xs focus:outline-none focus:border-zinc-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Telepon / WhatsApp
              </label>
              <input
                type="text"
                value={storePhone}
                onChange={(e) => setStorePhone(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 text-xs focus:outline-none focus:border-zinc-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Alamat Toko
            </label>
            <input
              type="text"
              value={storeAddress}
              onChange={(e) => setStoreAddress(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 text-xs focus:outline-none focus:border-zinc-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Pesan Footer Struk
            </label>
            <input
              type="text"
              value={receiptFooter}
              onChange={(e) => setReceiptFooter(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 text-xs focus:outline-none focus:border-zinc-900"
            />
          </div>
        </div>

        {/* Preferensi Printer */}
        <div className="bg-white p-4 rounded-xl border border-zinc-200/80 shadow-xs space-y-3.5">
          <div className="border-b border-zinc-100 pb-2.5">
            <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider">Preferensi Printer</h3>
            <p className="text-[11px] text-zinc-400">Pengaturan cetak struk thermal</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Lebar Kertas
              </label>
              <select
                value={paperSize}
                onChange={(e) => setPaperSize(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 text-xs bg-white focus:outline-none focus:border-zinc-900"
              >
                <option value="58mm">58mm (Thermal Standar)</option>
                <option value="80mm">80mm (Thermal Lebar)</option>
              </select>
            </div>

            <div className="pt-4">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoPrint}
                  onChange={(e) => setAutoPrint(e.target.checked)}
                  className="rounded text-zinc-900 focus:ring-zinc-900 w-4 h-4 cursor-pointer"
                />
                <span className="text-xs font-medium text-zinc-700">
                  Otomatis buka dialog cetak setelah bayar
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* System Info */}
        <div className="bg-white p-4 rounded-xl border border-zinc-200/80 shadow-xs">
          <div className="border-b border-zinc-100 pb-2.5 mb-3">
            <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider">Informasi Lingkungan</h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-zinc-50 border border-zinc-100">
              <span className="text-zinc-400 block text-[10px]">Aplikasi:</span>
              <span className="font-medium text-zinc-800">Phanix POS</span>
            </div>
            <div className="p-2.5 rounded-lg bg-zinc-50 border border-zinc-100">
              <span className="text-zinc-400 block text-[10px]">Framework:</span>
              <span className="font-medium text-zinc-800">React 19 + Vite</span>
            </div>
            <div className="p-2.5 rounded-lg bg-zinc-50 border border-zinc-100">
              <span className="text-zinc-400 block text-[10px]">Engine:</span>
              <span className="font-medium text-zinc-800">Tailwind CSS v4</span>
            </div>
            <div className="p-2.5 rounded-lg bg-zinc-50 border border-zinc-100">
              <span className="text-zinc-400 block text-[10px]">Backend:</span>
              <span className="font-medium text-zinc-800">Laravel Sanctum</span>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-1">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 transition-colors shadow-xs cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Simpan Pengaturan</span>
          </button>
        </div>
      </form>
    </div>
  )
}
