interface DeleteConfirmDialogProps {
  itemLabel: string
  onConfirm: () => Promise<void>
  onCancel: () => void
  deleting: boolean
}

export function DeleteConfirmDialog({ itemLabel, onConfirm, onCancel, deleting }: DeleteConfirmDialogProps) {
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-background/60 z-40" onClick={onCancel} />

      {/* Dialog */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm bg-surface-container border border-outline-variant rounded-xl shadow-2xl p-6 space-y-4">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-error mt-0.5" style={{ fontSize: '22px' }}>warning</span>
          <div>
            <h3 className="text-sm font-bold text-on-surface">Delete this item?</h3>
            <p className="text-sm text-secondary mt-1 break-all">{itemLabel}</p>
          </div>
        </div>
        <p className="text-xs text-secondary">This action cannot be undone.</p>
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="px-4 py-2 rounded text-sm font-medium border border-outline-variant text-secondary hover:text-on-surface transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="px-4 py-2 rounded text-sm font-bold border border-error-container text-error hover:bg-error/10 transition-all disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </>
  )
}
