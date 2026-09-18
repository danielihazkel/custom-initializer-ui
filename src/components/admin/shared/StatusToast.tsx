import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Toast } from '../../../types'

interface StatusToastProps {
  toast: Toast | null
  onClear: () => void
}

// A toast that offers an action ("Undo") stays up long enough to reach it.
const PLAIN_MS = 3000
const WITH_ACTION_MS = 6000

export function StatusToast({ toast, onClear }: StatusToastProps) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onClear, toast.action ? WITH_ACTION_MS : PLAIN_MS)
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
      {toast.action && (
        <button
          type="button"
          onClick={() => { toast.action?.onClick(); onClear() }}
          className="ml-2 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide bg-background/30 hover:bg-background/50 transition-colors shrink-0"
        >
          {toast.action.label}
        </button>
      )}
    </div>,
    document.body
  )
}
