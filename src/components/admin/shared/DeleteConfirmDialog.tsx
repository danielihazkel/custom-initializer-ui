export interface OrphanDetails {
  message: string
  references: Record<string, number>
}

interface DeleteConfirmDialogProps {
  itemLabel: string
  onConfirm: () => Promise<void>
  onCancel: () => void
  deleting: boolean
  orphanDetails?: OrphanDetails | null
  onForceDelete?: () => Promise<void>
}

const REF_LABELS: Record<string, string> = {
  fileContributions: 'file contributions',
  buildCustomizations: 'build customizations',
  subOptions: 'sub-options',
  compatibilityRules: 'compatibility rules',
  starterTemplateDeps: 'starter template deps',
  moduleDependencyMappings: 'module dependency mappings',
}

export function DeleteConfirmDialog({ itemLabel, onConfirm, onCancel, deleting, orphanDetails, onForceDelete }: DeleteConfirmDialogProps) {
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-background/60 z-40" onClick={onCancel} />

      {/* Dialog */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm bg-surface-container border border-outline-variant rounded-xl shadow-2xl p-6 space-y-4">
        <div className="flex items-start gap-3">
          <span className={`material-symbols-outlined ${orphanDetails ? 'text-warning' : 'text-error'} mt-0.5`} style={{ fontSize: '22px' }}>
            warning
          </span>
          <div>
            <h3 className="text-sm font-bold text-on-surface">
              {orphanDetails ? 'This item is referenced elsewhere' : 'Delete this item?'}
            </h3>
            <p className="text-sm text-secondary mt-1 break-all">{itemLabel}</p>
          </div>
        </div>

        {orphanDetails ? (
          <div className="bg-surface-container-high rounded-lg p-3 space-y-2">
            <p className="text-xs text-secondary">Deleting this will also remove:</p>
            <ul className="text-xs text-on-surface space-y-1">
              {Object.entries(orphanDetails.references)
                .filter(([, count]) => count > 0)
                .map(([key, count]) => (
                  <li key={key} className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-warning" style={{ fontSize: '14px' }}>arrow_right</span>
                    <span><strong>{count}</strong> {REF_LABELS[key] ?? key}</span>
                  </li>
                ))}
            </ul>
          </div>
        ) : (
          <p className="text-xs text-secondary">This action cannot be undone.</p>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="px-4 py-2 rounded text-sm font-medium border border-outline-variant text-secondary hover:text-on-surface transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          {orphanDetails && onForceDelete ? (
            <button
              onClick={onForceDelete}
              disabled={deleting}
              className="px-4 py-2 rounded text-sm font-bold border border-error-container text-error hover:bg-error/10 transition-all disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Delete Anyway'}
            </button>
          ) : (
            <button
              onClick={onConfirm}
              disabled={deleting}
              className="px-4 py-2 rounded text-sm font-bold border border-error-container text-error hover:bg-error/10 transition-all disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          )}
        </div>
      </div>
    </>
  )
}
