import { useEffect, useRef, useState } from 'react'
import type { FullstackEntityDef } from '../../types'

interface Props {
  entities: FullstackEntityDef[]
  /** Validation error count per entity index (from `countEntityErrors`). */
  errorCounts: Record<number, number>
  /** Lint suggestion count per entity uid. */
  lintCounts: Map<string, number>
  filter: string
  onFilterChange: (value: string) => void
  /** Reveal (expand + scroll to) an entity card. */
  onSelect: (uid: string) => void
  /** Uid of the card currently in view, for the highlight. */
  activeUid: string | null
}

/** Case-insensitive match on entity name, labels, table name and field names. */
export function entityMatches(entity: FullstackEntityDef, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const hay = [entity.name, entity.label, entity.labelPlural, entity.tableName, entity.schema, ...entity.fields.map(f => f.name)]
  return hay.some(s => s?.toLowerCase().includes(q))
}

/**
 * Outline of the entity list: one row per entity with its error / suggestion badges, a filter
 * that also narrows the cards, ↑/↓ + Enter navigation, and a highlight on the card currently
 * scrolled into view. Rendered by FullstackView beside the cards once the model is big enough
 * to need it.
 */
export function EntityNavigator({ entities, errorCounts, lintCounts, filter, onFilterChange, onSelect, activeUid }: Props) {
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const visible = entities
    .map((e, index) => ({ entity: e, index }))
    .filter(({ entity }) => entityMatches(entity, filter))
  useEffect(() => { setCursor(c => Math.min(c, Math.max(0, visible.length - 1))) }, [visible.length])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, visible.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)) }
    else if (e.key === 'Enter') {
      const uid = visible[cursor]?.entity.uid
      if (uid) { e.preventDefault(); onSelect(uid) }
    } else if (e.key === 'Escape' && filter) { e.preventDefault(); onFilterChange('') }
  }

  return (
    <nav aria-label="Entities outline" className="space-y-2" data-entity-navigator>
      <div className="relative">
        <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-secondary" style={{ fontSize: '16px' }}>search</span>
        <input
          ref={inputRef}
          id="fs-entity-filter"
          type="search"
          value={filter}
          onChange={e => onFilterChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Find entity or field…"
          aria-label="Find entity"
          className="w-full bg-background border border-outline-variant rounded-lg pl-8 pr-2 py-1.5 text-xs text-on-surface placeholder:text-secondary/60 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
        />
      </div>
      {visible.length === 0 ? (
        <p className="text-[11px] text-secondary px-1">No entity matches “{filter.trim()}”.</p>
      ) : (
        <ul className="space-y-0.5 max-h-[60vh] overflow-y-auto pr-1" onKeyDown={onKeyDown} tabIndex={-1}>
          {visible.map(({ entity, index }, i) => {
            const uid = entity.uid ?? `i${index}`
            const errs = errorCounts[index] ?? 0
            const lints = lintCounts.get(uid) ?? 0
            const isView = entity.viewQuery != null
            const active = activeUid === entity.uid
            return (
              <li key={uid}>
                <button
                  type="button"
                  onClick={() => { setCursor(i); if (entity.uid) onSelect(entity.uid) }}
                  aria-current={active ? 'true' : undefined}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs transition-colors ${
                    active ? 'bg-primary/10 text-primary' : i === cursor ? 'bg-surface-container-high text-on-surface' : 'text-on-surface hover:bg-surface-container-high'}`}
                >
                  <span className="material-symbols-outlined text-secondary shrink-0" style={{ fontSize: '14px' }}>
                    {isView ? 'table_view' : entity.readOnly ? 'visibility' : 'table'}
                  </span>
                  <span className="flex-1 min-w-0 truncate font-mono">{entity.name.trim() || '(unnamed)'}</span>
                  <span className="text-[10px] text-secondary shrink-0">{entity.fields.length}</span>
                  {errs > 0 && (
                    <span className="shrink-0 inline-flex items-center px-1.5 rounded-full bg-error/10 text-error text-[10px] font-semibold" title={`${errs} issue${errs === 1 ? '' : 's'}`}>{errs}</span>
                  )}
                  {lints > 0 && (
                    <span className="shrink-0 inline-flex items-center px-1.5 rounded-full bg-warning/15 text-warning text-[10px] font-semibold" title={`${lints} suggestion${lints === 1 ? '' : 's'}`}>{lints}</span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </nav>
  )
}

/**
 * Which entity card is most in view — drives the navigator highlight. Observes the cards'
 * `data-entity-index` elements; a no-op where IntersectionObserver is missing (jsdom).
 */
export function useActiveEntity(entities: FullstackEntityDef[]): string | null {
  const [active, setActive] = useState<string | null>(null)
  const count = entities.length
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || count === 0) return
    const ratios = new Map<Element, number>()
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) ratios.set(entry.target, entry.isIntersecting ? entry.intersectionRatio : 0)
      let best: Element | null = null
      let bestRatio = 0
      for (const [el, ratio] of ratios) if (ratio > bestRatio) { best = el; bestRatio = ratio }
      setActive(best ? (best as HTMLElement).dataset.rowUid ?? null : null)
    }, { rootMargin: '-20% 0px -60% 0px', threshold: [0, 0.25, 0.5, 1] })
    const cards = document.querySelectorAll<HTMLElement>('#fs-entities [data-entity-index]')
    cards.forEach(c => observer.observe(c))
    return () => observer.disconnect()
  }, [count])
  return active
}
