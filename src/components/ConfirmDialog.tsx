import { useEffect } from 'react'

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  /** 'danger' uses error styling on the confirm button; 'default' uses primary. */
  tone?: 'danger' | 'default'
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Lightweight, glass-styled confirmation modal — the in-app replacement for
 * window.confirm(). Closes on Escape / backdrop click. Visual sibling of the
 * admin DeleteConfirmDialog.
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  const confirmClasses = tone === 'danger'
    ? 'border border-error-container text-error hover:bg-error/10'
    : 'bg-primary text-on-primary hover:opacity-90'

  return (
    <>
      <div className="fixed inset-0 bg-background/60 z-[60]" onClick={onCancel} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-full max-w-sm glass-panel border border-outline-variant rounded-xl shadow-2xl p-6 space-y-4"
      >
        <div className="flex items-start gap-3">
          <span className={`material-symbols-outlined ${tone === 'danger' ? 'text-error' : 'text-primary'} mt-0.5`} style={{ fontSize: '22px' }}>
            {tone === 'danger' ? 'warning' : 'help'}
          </span>
          <div>
            <h3 className="text-sm font-bold text-on-surface">{title}</h3>
            <p className="text-sm text-secondary mt-1">{message}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded text-sm font-medium border border-outline-variant text-secondary hover:text-on-surface transition-all"
          >
            {cancelLabel}
          </button>
          <button
            autoFocus
            onClick={onConfirm}
            className={`px-4 py-2 rounded text-sm font-bold transition-all active:scale-95 ${confirmClasses}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  )
}
