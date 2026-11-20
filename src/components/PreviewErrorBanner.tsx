import type { PreviewError } from '../types'
import { t } from '../i18n'

interface Props {
  error: PreviewError
  retrying: boolean
  onRetry: () => void
  onDismiss: () => void
}

/**
 * Above the Backend tab when Explore failed for a reason that is no dependency's wizard (those
 * show in the dependency picker): the server's words, Retry and a way to dismiss it. Drawn only
 * after a failure, so it is a chunk of its own.
 */
export function PreviewErrorBanner({ error, retrying, onRetry, onDismiss }: Props) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 relative z-10 mb-6">
      <div role="alert" className="glass-panel border-error-container rounded-xl px-4 py-3 flex items-start gap-3">
        <span className="material-symbols-outlined text-error mt-0.5" style={{ fontSize: '20px' }}>error</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-on-surface">{t("Couldn't generate preview")}</p>
          <p className="text-xs text-secondary mt-0.5 break-words">{error.message}</p>
        </div>
        <button
          onClick={onRetry}
          disabled={retrying}
          className="px-3 py-1 rounded-lg text-xs font-medium bg-primary text-on-primary hover:opacity-90 transition-opacity active:scale-95 disabled:opacity-60 shrink-0"
        >
          {retrying ? t('Retrying…') : t('Retry')}
        </button>
        <button
          onClick={onDismiss}
          aria-label={t('Dismiss error')}
          className="p-1 rounded text-secondary hover:text-on-surface transition-colors shrink-0"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
        </button>
      </div>
    </div>
  )
}
