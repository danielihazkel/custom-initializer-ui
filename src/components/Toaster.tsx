import { createPortal } from 'react-dom'
import { dismissToast, holdToasts, releaseToasts, useIsPrimaryToaster, useToasts } from '../toast'
import { t } from '../i18n'

/**
 * Draws the app's toast stack (see `src/toast.ts`): bottom centre, newest at the bottom, each
 * with its own close button and optional action. Mounted once by `App`; the toast adapters also
 * render one so they work alone, and only the first mounted Toaster draws.
 *
 * Each toast is its own `role="status"` live region, so a screen reader announces it as it
 * arrives. Hovering the stack pauses every timer.
 */
export function Toaster() {
  const primary = useIsPrimaryToaster()
  const toasts = useToasts()
  if (!primary || toasts.length === 0) return null

  return createPortal(
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[110] flex flex-col items-center gap-2 max-w-[90vw] pointer-events-none"
      onMouseEnter={holdToasts}
      onMouseLeave={releaseToasts}
      data-toaster
    >
      {toasts.map(toast => (
        <div
          key={toast.id}
          role="status"
          aria-live="polite"
          className={`pointer-events-auto toast-enter ps-4 pe-2 py-2.5 rounded-xl text-sm font-medium shadow-lg flex items-center gap-2 max-w-full ${
            toast.type === 'success'
              ? 'bg-tertiary-container text-on-tertiary-container'
              : 'bg-error-container text-on-error-container'
          }`}
        >
          <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '16px' }} aria-hidden="true">
            {toast.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <span className="break-words min-w-0">{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              onClick={() => { toast.action?.onClick(); dismissToast(toast.id) }}
              className="ms-2 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide bg-background/30 hover:bg-background/50 transition-colors shrink-0"
            >
              {toast.action.label}
            </button>
          )}
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            aria-label={t('Dismiss')}
            className="p-1 rounded-lg opacity-60 hover:opacity-100 hover:bg-background/30 transition-opacity shrink-0"
          >
            <span className="material-symbols-outlined block" style={{ fontSize: '14px' }} aria-hidden="true">close</span>
          </button>
        </div>
      ))}
    </div>,
    document.body,
  )
}
