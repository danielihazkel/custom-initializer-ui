import { t } from '../i18n'

interface Props {
  /** The backend's own words for the refusal (which header is missing). */
  detail: string
  retrying: boolean
  onRetry: () => void
}

/**
 * Shown instead of the app when the backend's access gate refused the catalog: it is running, and
 * this browser did not come through the company sign-in. Unlike {@link BackendUnreachable} it does
 * not ask again by itself — waiting changes nothing; opening the site the right way does.
 */
export function AccessBlocked({ detail, retrying, onRetry }: Props) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div role="alert" className="bg-surface-container border border-error-container rounded-xl p-8 max-w-md text-center space-y-4">
        <span className="material-symbols-outlined text-error" style={{ fontSize: '36px' }} aria-hidden="true">lock</span>
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold text-on-surface">{t('No access')}</h2>
          <p className="text-sm text-secondary">
            {t('This site can only be opened through the company sign-in. Open it from its usual address, then try again.')}
          </p>
        </div>
        <code dir="ltr" className="block text-xs text-error bg-surface-container-lowest rounded p-3 break-words">{detail}</code>
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold bg-primary text-on-primary hover:opacity-90 transition-opacity active:scale-95 disabled:opacity-60"
        >
          <span className={`material-symbols-outlined ${retrying ? 'animate-spin' : ''}`} style={{ fontSize: '16px' }} aria-hidden="true">
            {retrying ? 'progress_activity' : 'refresh'}
          </span>
          {retrying ? t('Checking…') : t('Try again')}
        </button>
      </div>
    </div>
  )
}
