import type { PreviewError } from '../../types'
import type { ShareWriteStatus } from './shareLink'

/**
 * The editor's four "state of your draft" banners: a failed preview, a model too big to share by
 * link, the same model edited in a second browser tab, and full browser storage.
 *
 * They live directly under the page header rather than in the action bar: each one tells the user
 * something about work they have already done (or are about to lose), which is the wrong thing to
 * discover in the strip you only look at when you are ready to click Generate.
 *
 * Renders nothing at all when there is nothing to say, so the header sits flush against the
 * "Start from" strip in the common case.
 */
export interface ModelNoticesProps {
  previewError: PreviewError | null
  previewLoading: boolean
  onRetryPreview: () => void
  onDismissPreviewError: () => void
  shareStatus: ShareWriteStatus
  /** The draft another tab wrote, if it has diverged from this one. */
  externalDraft: { entities: unknown[] } | null
  /** Entity count in *this* tab, for the "N there, M here" comparison. */
  entityCount: number
  onLoadTheirs: () => void
  onKeepMine: () => void
  persistFailed: boolean
  presetsPersistFailed: boolean
}

export function ModelNotices({
  previewError, previewLoading, onRetryPreview, onDismissPreviewError,
  shareStatus, externalDraft, entityCount, onLoadTheirs, onKeepMine,
  persistFailed, presetsPersistFailed,
}: ModelNoticesProps) {
  const storageFull = persistFailed || presetsPersistFailed
  if (!previewError && shareStatus !== 'too-large' && !externalDraft && !storageFull) return null

  return (
    <div className="space-y-2" role="region" aria-label="Model notices">
      {/* The other tab's draft comes first: it is the only notice where waiting makes the
          decision harder, because every further edit here widens the divergence. */}
      {externalDraft && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-warning/40 bg-warning/5 px-3 py-2 text-xs text-on-surface" data-external-draft>
          <span className="material-symbols-outlined text-warning" style={{ fontSize: '16px' }}>tab_duplicate</span>
          <span className="flex-1 min-w-0">
            This model was changed in another browser tab ({externalDraft.entities.length} entit{externalDraft.entities.length === 1 ? 'y' : 'ies'} there,
            {' '}{entityCount} here). Which draft should this tab keep?
          </span>
          <button
            type="button"
            onClick={onLoadTheirs}
            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-primary text-on-primary hover:opacity-90"
          >
            Load theirs
          </button>
          <button
            type="button"
            onClick={onKeepMine}
            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-outline-variant text-secondary hover:text-on-surface"
          >
            Keep mine
          </button>
        </div>
      )}

      {previewError && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-error/30 bg-error/10 px-3 py-2">
          <span className="material-symbols-outlined text-error mt-0.5" style={{ fontSize: '18px' }}>error</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-on-surface">Couldn't build the preview</p>
            <p className="text-[11px] text-secondary break-words">
              {previewError.kind ? `${previewError.kind}: ` : ''}{previewError.message}
            </p>
          </div>
          <button
            type="button"
            onClick={onRetryPreview}
            disabled={previewLoading}
            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-primary text-on-primary hover:opacity-90 disabled:opacity-60 shrink-0"
          >
            Retry
          </button>
          <button type="button" onClick={onDismissPreviewError} aria-label="Dismiss preview error" className="p-0.5 rounded text-secondary hover:text-on-surface shrink-0">
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
          </button>
        </div>
      )}

      {storageFull && (
        <p className="flex items-center gap-1.5 text-[11px] text-secondary" role="status" data-storage-full>
          <span className="material-symbols-outlined text-warning" style={{ fontSize: '14px' }}>save_as</span>
          Browser storage is full — {persistFailed ? 'this model' : 'your presets'} won't be restored on refresh.
          Export JSON in "Start from" below, or save to the Team, to keep it.
        </p>
      )}

      {shareStatus === 'too-large' && (
        <p className="flex items-center gap-1.5 text-[11px] text-secondary" role="status">
          <span className="material-symbols-outlined text-warning" style={{ fontSize: '14px' }}>link_off</span>
          This model is too large for a share link — the header's Share button copies a link without it.
          Use Export JSON in "Start from" below to hand it to someone.
        </p>
      )}
    </div>
  )
}
