import { useEffect, useRef, useState } from 'react'

export interface MenuItem {
  id: string
  label: string
  /** Material Symbols icon name. */
  icon?: string
  /** Marks the item that is the current page / the active state. */
  current?: boolean
  onSelect: () => void
}

interface Props {
  /** Accessible name of the button (it shows only an icon). */
  label: string
  icon: string
  items: MenuItem[]
  /** Which edge of the button the panel lines up with. */
  align?: 'left' | 'right'
  className?: string
}

/**
 * An icon button that opens a short menu under it — the header's navigation and its secondary
 * actions on a narrow window, where they do not fit in a row. Arrow keys move through the items,
 * Escape and a click outside close it, and focus returns to the button.
 */
export function PopoverMenu({ label, icon, items, align = 'right', className = '' }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const menuItems = () => Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
    menuItems()[0]?.focus()

    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
        buttonRef.current?.focus()
        return
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      const list = menuItems()
      if (list.length === 0) return
      e.preventDefault()
      const at = list.indexOf(document.activeElement as HTMLElement)
      const next = e.key === 'ArrowDown' ? (at + 1) % list.length : (at - 1 + list.length) % list.length
      list[next].focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        title={label}
        className="p-2 rounded text-secondary hover:text-on-surface transition-colors duration-200"
      >
        <span className="material-symbols-outlined block" style={{ fontSize: '20px' }} aria-hidden="true">{icon}</span>
      </button>
      {open && (
        <div
          role="menu"
          aria-label={label}
          className={`absolute top-full mt-2 ${align === 'right' ? 'right-0' : 'left-0'} min-w-48 py-1.5 rounded-xl border border-outline-variant bg-surface-container shadow-2xl animate-fade-in z-50`}
        >
          {items.map(item => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              aria-current={item.current ? 'page' : undefined}
              onClick={() => { setOpen(false); item.onSelect() }}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-left transition-colors hover:bg-surface-container-high ${
                item.current ? 'text-on-surface font-semibold' : 'text-secondary hover:text-on-surface'
              }`}
            >
              {item.icon && (
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">{item.icon}</span>
              )}
              <span className="flex-1">{item.label}</span>
              {item.current && (
                <span className="material-symbols-outlined text-primary" style={{ fontSize: '16px' }} aria-hidden="true">check</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
