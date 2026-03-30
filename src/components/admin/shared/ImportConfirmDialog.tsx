interface ImportConfirmDialogProps {
  fileName: string
  onConfirm: () => void
  onCancel: () => void
  importing: boolean
}

export function ImportConfirmDialog({ fileName, onConfirm, onCancel, importing }: ImportConfirmDialogProps) {
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-background/60 z-40" onClick={onCancel} />

      {/* Dialog */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm bg-surface-container border border-outline-variant rounded-xl shadow-2xl p-6 space-y-4">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-warning mt-0.5" style={{ fontSize: '22px' }}>
            upload_file
          </span>
          <div>
            <h3 className="text-sm font-bold text-on-surface">Import Configuration</h3>
            <p className="text-sm text-secondary mt-1 break-all">{fileName}</p>
          </div>
        </div>

        <div className="bg-error/5 border border-error/20 rounded-lg p-3">
          <p className="text-xs text-error font-medium">
            This will replace ALL current configuration. This action cannot be undone.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={importing}
            className="px-4 py-2 rounded text-sm font-medium border border-outline-variant text-secondary hover:text-on-surface transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={importing}
            className="px-4 py-2 rounded text-sm font-bold bg-primary text-on-primary hover:brightness-110 transition-all disabled:opacity-50"
          >
            {importing ? 'Importing…' : 'Import'}
          </button>
        </div>
      </div>
    </>
  )
}
