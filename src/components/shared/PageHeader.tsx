import type { ReactNode } from 'react'

interface Props {
  /** Material Symbols icon name. */
  icon: string
  title: string
  /** One or two sentences on what this generator makes. */
  children?: ReactNode
}

/**
 * The heading of a generator tab — the same shape on Backend, Frontend and Fullstack. They used
 * to open three different ways: no title at all, an `h2`, and an `h1` with a paragraph.
 */
export function PageHeader({ icon, title, children }: Props) {
  return (
    <header className="flex items-start gap-3 min-w-0" data-page-header>
      <span
        className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center"
        aria-hidden="true"
      >
        <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>{icon}</span>
      </span>
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-on-surface tracking-tight leading-tight">{title}</h1>
        {children && <p className="text-xs text-secondary mt-1 max-w-2xl leading-relaxed">{children}</p>}
      </div>
    </header>
  )
}
