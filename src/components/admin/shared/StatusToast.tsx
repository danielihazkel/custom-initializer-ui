import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Toast } from '../../../types'

interface StatusToastProps {
  toast: Toast | null
  onClear: () => void
}

export function StatusToast({ toast, onClear }: StatusToastProps) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onClear, 3000)
    return () => clearTimeout(t)
  }, [toast, onClear])

  if (!toast) return null

  return createPortal(
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-xl text-sm shadow-lg flex items-center gap-2 transition-all max-w-[90vw] ${
        toast.type === 'success'
          ? 'bg-tertiary-container text-on-tertiary-container'
          : 'bg-error-container text-on-error-container'
      }`}
      role="status"
      aria-live="polite"
    >
      <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '16px' }}>
        {toast.type === 'success' ? 'check_circle' : 'error'}
      </span>
      <span className="break-words">{toast.message}</span>
    </div>,
    document.body
  )
}
