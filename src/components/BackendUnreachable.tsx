import { useEffect, useRef, useState } from 'react'

interface Props {
  error: string
  retrying: boolean
  onRetry: () => void
}

/** Seconds to wait before each automatic attempt; the last one repeats. */
export const RETRY_DELAYS = [2, 4, 8, 15, 30]

/**
 * Shown instead of the app when the catalog cannot be loaded. The usual cause is a backend that
 * is still starting, so the page asks again by itself — after 2, 4, 8, 15 and then every 30
 * seconds, only while the tab is visible — and comes up without a reload once it answers.
 */
export function BackendUnreachable({ error, retrying, onRetry }: Props) {
  const [attempt, setAttempt] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(RETRY_DELAYS[0])
  const retryRef = useRef(onRetry)
  retryRef.current = onRetry

  // One countdown per attempt; it restarts when an attempt has come back failed.
  useEffect(() => {
    if (retrying) return
    let left = RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)]
    setSecondsLeft(left)
    const timer = setInterval(() => {
      // A hidden tab waits: no point knocking on a server nobody is looking at.
      if (document.visibilityState === 'hidden') return
      left -= 1
      setSecondsLeft(left)
      if (left <= 0) {
        clearInterval(timer)
        setAttempt(n => n + 1)
        retryRef.current()
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [attempt, retrying])

  function retryNow() {
    setAttempt(n => n + 1)
    onRetry()
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div role="alert" className="bg-surface-container border border-error-container rounded-xl p-8 max-w-md text-center space-y-4">
        <span className="material-symbols-outlined text-error" style={{ fontSize: '36px' }} aria-hidden="true">power_off</span>
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold text-on-surface">Cannot reach backend</h2>
          <p className="text-sm text-secondary">Make sure the Spring Initializr backend is running on port 8080.</p>
        </div>
        <code className="block text-xs text-error bg-surface-container-lowest rounded p-3 break-words">{error}</code>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={retryNow}
            disabled={retrying}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold bg-primary text-on-primary hover:opacity-90 transition-opacity active:scale-95 disabled:opacity-60"
          >
            <span className={`material-symbols-outlined ${retrying ? 'animate-spin' : ''}`} style={{ fontSize: '16px' }} aria-hidden="true">
              {retrying ? 'progress_activity' : 'refresh'}
            </span>
            {retrying ? 'Trying…' : 'Retry now'}
          </button>
          <span className="text-xs text-secondary" aria-live="off">
            {retrying ? 'Asking the backend…' : `Trying again in ${secondsLeft} s`}
          </span>
        </div>
      </div>
    </div>
  )
}
