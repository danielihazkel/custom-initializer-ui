import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'

export interface MenuItem {
  key: string
  label: ReactNode
  icon?: string
  /** Why it is off; a disabled item stays listed. */
  disabled?: boolean | string
  tone?: 'danger' | 'muted'
  onSelect: () => void
}

/**
 * A small popover menu under (or beside) the control that opened it: the first item takes the
 * focus, ↑/↓/Home/End move it, Escape or a click outside closes it and hands the focus back.
 * Escape is marked handled, so the designer does not close too.
 */
export function DesignerMenu({ label, items, onClose, className = '', returnFocus, heading }: {
  label: string
  items: MenuItem[]
  onClose: () => void
  /** Where the popover sits, relative to its positioned parent. */
  className?: string
  /** The element that opened the menu — focused again on close. */
  returnFocus?: HTMLElement | null
  heading?: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const anchorRef = useRef(returnFocus)
  anchorRef.current = returnFocus

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus()
    const onPointer = (e: PointerEvent) => {
      // A press on the opener is its own toggle's to handle.
      const target = e.target as Node
      if (!ref.current?.contains(target) && !anchorRef.current?.contains(target)) onCloseRef.current()
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [])

  function close() {
    onClose()
    returnFocus?.focus()
  }

  function onKey(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape' || e.key === 'Tab') {
      if (e.key === 'Escape') e.preventDefault()
      e.stopPropagation()
      close()
      return
    }
    const all = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])
    const at = all.indexOf(document.activeElement as HTMLElement)
    const to = e.key === 'ArrowDown' ? (at + 1) % all.length
      : e.key === 'ArrowUp' ? (at - 1 + all.length) % all.length
        : e.key === 'Home' ? 0
          : e.key === 'End' ? all.length - 1
            : -1
    if (to < 0 || all.length === 0) return
    e.preventDefault()
    all[to].focus()
  }

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={label}
      onKeyDown={onKey}
      className={`absolute z-20 min-w-[13rem] max-w-[22rem] rounded-xl border border-outline-variant bg-surface-container py-1 shadow-lg ${className}`}
    >
      {heading && <div className="border-b border-outline-variant px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-secondary">{heading}</div>}
      <div className="max-h-[60vh] overflow-y-auto">
        {items.map(item => (
          <button
            key={item.key}
            type="button"
            role="menuitem"
            disabled={Boolean(item.disabled)}
            title={typeof item.disabled === 'string' ? item.disabled : undefined}
            onClick={() => { item.onSelect(); close() }}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-start text-xs hover:bg-primary/5 focus:bg-primary/10 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 ${
              item.tone === 'danger' ? 'text-error' : item.tone === 'muted' ? 'text-secondary' : 'text-on-surface'}`}
          >
            {item.icon && <span className="material-symbols-outlined shrink-0 text-secondary" style={{ fontSize: '15px' }} aria-hidden="true">{item.icon}</span>}
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
