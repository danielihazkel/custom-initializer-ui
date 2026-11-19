import { useMemo } from 'react'
import type { FullstackEntityDef, FullstackEntityOptKey } from '../../types'
import { optCoverage } from './scaffoldOptions'
import { t, tn, useLang } from '../../i18n'

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
  const lang = useLang()
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the reasons are in the site's language
  const coverage = useMemo(() => optCoverage(entities, optKey), [entities, optKey, lang])
  const total = entities.length
  if (total === 0) return null
  const n = coverage.applies.length
  const all = n === total
  return (
    <span className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px]" data-opt-coverage={optKey}>
      <span className={all ? 'text-secondary' : 'text-warning'}>
        {all
          ? (total === 1 ? t('Applies to the entity') : t('Applies to all {total} entities', { total }))
          : n === 0
            ? tn(total, 'Applies to {count} of {n} entity — nothing will be generated for it', 'Applies to {count} of {n} entities — nothing will be generated for it', { count: n })
            : tn(total, 'Applies to {count} of {n} entity', 'Applies to {count} of {n} entities', { count: n })}
      </span>
      {coverage.excluded.map(e => (
        <button
          key={e.uid}
          type="button"
          onClick={ev => { ev.preventDefault(); onReveal(e.uid) }}
          title={t('{entity}: {reason} — click to open the entity', { entity: e.name, reason: e.reason })}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border border-warning/40 text-warning hover:bg-warning/10 transition-colors font-mono"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>block</span>
          {e.name}
        </button>
      ))}
    </span>
  )
}
