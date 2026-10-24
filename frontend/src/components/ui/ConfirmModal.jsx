import React from 'react'
import { AlertTriangle } from 'lucide-react'
import { Modal } from './Modal'

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Konfirmasi Tindakan',
  message = 'Apakah Anda yakin ingin melanjutkan tindakan ini?',
  confirmText = 'Hapus',
  cancelText = 'Batal',
  isDanger = true,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-md">
      <div className="flex items-start gap-3.5">
        <div
          className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
            isDanger ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-blue-50 text-blue-600 border border-blue-100'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <p className="text-xs text-zinc-600 leading-relaxed">{message}</p>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end gap-2.5 pt-4 border-t border-zinc-100">
        <button
          type="button"
          onClick={onClose}
          className="px-3.5 py-1.5 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
        >
          {cancelText}
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm()
            onClose()
          }}
          className={`px-3.5 py-1.5 text-xs font-medium text-white rounded-lg shadow-xs transition-colors ${
            isDanger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-zinc-900 hover:bg-zinc-800'
          }`}
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  )
}
