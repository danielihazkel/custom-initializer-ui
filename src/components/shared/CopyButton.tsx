import { useEffect, useRef, useState } from 'react'
import { copyToClipboard } from '../../utils/clipboard'
import { t } from '../../i18n'

interface Props {
  /** What to copy — read at click time, so a long text is not held in a prop for nothing. */
  text: string | (() => string)
  /** Accessible name, and the tooltip: "Copy Run command". */
  label: string
  /** Material Symbols icon shown until copied. */
  icon?: string
  /** Icon size in px. */
  size?: number
  className?: string
  /** Outcome, for a caller that wants to toast it. */
  onCopied?: (ok: boolean) => void
}

/**
 * A Copy button that answers on the spot: the icon turns into a tick for a moment. Every copy
 * in the app used to rely on a toast alone, which appears somewhere else on the screen.
 */
export function CopyButton({ text, label, icon = 'content_copy', size = 14, className = '', onCopied }: Props) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  async function copy() {
    const ok = await copyToClipboard(typeof text === 'function' ? text() : text)
    onCopied?.(ok)
    if (!ok) return
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1400)
  }

  return (
    <button
      type="button"
      onClick={() => { void copy() }}
      aria-label={label}
      title={copied ? t('Copied') : label}
      className={`p-1 rounded transition-colors ${copied ? 'text-tertiary' : 'text-secondary hover:text-primary hover:bg-primary/10'} ${className}`}
      data-copied={copied || undefined}
    >
      <span key={copied ? 'done' : 'copy'} className={`material-symbols-outlined block ${copied ? 'check-pop' : ''}`} style={{ fontSize: `${size}px` }} aria-hidden="true">
        {copied ? 'check' : icon}
      </span>
    </button>
  )
}
