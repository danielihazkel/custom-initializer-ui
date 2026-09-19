import { useMemo } from 'react'
import type { FullstackEntityDef, FullstackEntityOptKey } from '../../types'
import { optCoverage } from './scaffoldOptions'

interface Props {
  optKey: FullstackEntityOptKey
  entities: FullstackEntityDef[]
  /** Jump to an entity card (the view's `revealRow`). */
  onReveal: (uid: string) => void
}

/**
 * The line under a checked per-entity option in the Options section: "applies to N of M
 * entities", with one chip per entity it will not reach (an Off override, a view, a composite
 * key…) so the reason is one hover away and the card one click away. Renders nothing while the
 * model has no entities.
 */
export function OptionCoverage({ optKey, entities, onReveal }: Props) {
  const coverage = useMemo(() => optCoverage(entities, optKey), [entities, optKey])
  const total = entities.length
  if (total === 0) return null
  const n = coverage.applies.length
  const all = n === total
  return (
    <span className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px]" data-opt-coverage={optKey}>
      <span className={all ? 'text-secondary' : 'text-warning'}>
        {all
          ? `Applies to ${total === 1 ? 'the entity' : `all ${total} entities`}`
          : `Applies to ${n} of ${total} entit${total === 1 ? 'y' : 'ies'}${n === 0 ? ' — nothing will be generated for it' : ''}`}
      </span>
      {coverage.excluded.map(e => (
        <button
          key={e.uid}
          type="button"
          onClick={ev => { ev.preventDefault(); onReveal(e.uid) }}
          title={`${e.name}: ${e.reason} — click to open the entity`}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border border-warning/40 text-warning hover:bg-warning/10 transition-colors font-mono"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>block</span>
          {e.name}
        </button>
      ))}
    </span>
  )
}
