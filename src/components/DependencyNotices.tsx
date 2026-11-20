import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DB_PRIMARY_OPTIONS } from '../utils/dbDrivers'
import { t } from '../i18n'

function dbKindLabel(kind: string): string {
  return kind === 'jdbc' ? t('Primary JDBC Database') : kind === 'mongodb' ? t('Primary MongoDB Connection') : t('Primary Database')
}

interface Props {
  conflicts: { desc: string }[]
  requires: { desc: string; target: string }[]
  /** Adds the dependency another one requires. */
  onAdd: (depId: string) => void
  /** The selected database drivers, by kind (`jdbc`, `mongodb`). */
  driversByKind: Record<string, string[]>
  selectedOptions: Record<string, string[]>
  nameOf: (depId: string) => string
  onPrimaryChange: (kind: string, driver: string) => void
}

/**
 * The top of the Selected panel when the selection needs a word: dependencies that conflict, one
 * that another requires (with *ADD IT*), and — with two drivers of a kind — which database is
 * the primary. Most selections show none of it, so it is a chunk of its own, mounted by
 * `DependencySelector` the first time there is something to say; it animates in either way.
 */
export function DependencyNotices({ conflicts, requires, onAdd, driversByKind, selectedOptions, nameOf, onPrimaryChange }: Props) {
  const primaryByKind = useMemo(() => {
    const map: Record<string, string | null> = {}
    for (const [kind, drivers] of Object.entries(driversByKind)) {
      map[kind] = drivers.find(d => (selectedOptions[d] ?? []).includes(DB_PRIMARY_OPTIONS[d])) ?? null
    }
    return map
  }, [driversByKind, selectedOptions])

  return (
    <>
      {/* Compatibility warnings (conflicts + requires only; recommends live above search) */}
      <AnimatePresence>
        {(conflicts.length > 0 || requires.length > 0) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2 overflow-hidden flex-shrink-0"
          >
            {conflicts.map((w, i) => (
              <div key={`c-${i}`} className="flex items-start gap-2 px-4 py-3 rounded-xl border border-error/30 bg-error/10 text-xs text-error shadow-sm">
                <span className="material-symbols-outlined flex-shrink-0 mt-0.5" style={{ fontSize: '16px' }}>warning</span>
                <span className="leading-relaxed font-medium">{w.desc}</span>
              </div>
            ))}
            {requires.map((w, i) => (
              <div key={`req-${i}`} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-warning/30 bg-warning/10 text-xs text-warning shadow-sm">
                <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '16px' }}>error</span>
                <span className="flex-1 leading-relaxed font-medium">{w.desc}</span>
                <button
                  type="button"
                  onClick={() => onAdd(w.target)}
                  className="flex-shrink-0 text-[10px] font-bold px-3 py-1 rounded bg-warning text-background shadow-sm transition-transform active:scale-95 hover:brightness-110"
                >
                  {t('ADD IT')}
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Primary Database selector — one panel per kind with ≥2 selected drivers */}
      <AnimatePresence>
        {Object.entries(driversByKind)
          .filter(([, drivers]) => drivers.length >= 2)
          .map(([kind, drivers]) => (
            <motion.div
              key={kind}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="p-4 rounded-xl border border-secondary/30 bg-secondary/5 overflow-hidden flex-shrink-0"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-secondary" style={{ fontSize: '16px' }}>database</span>
                <span className="text-xs font-bold uppercase tracking-widest text-secondary">{dbKindLabel(kind)}</span>
              </div>
              <div className="space-y-2">
                {drivers.map(drv => {
                  const isPrimary = primaryByKind[kind] === drv
                  return (
                    <label key={drv} className="flex items-center gap-3 text-xs cursor-pointer group">
                      <div className={`flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${isPrimary
                        ? 'border-secondary bg-secondary'
                        : 'border-secondary/40 group-hover:border-secondary'
                        }`}>
                        {isPrimary && <div className="w-1.5 h-1.5 rounded-full bg-background" />}
                      </div>
                      <input
                        type="radio"
                        name={`primary-${kind}`}
                        checked={isPrimary}
                        onChange={() => onPrimaryChange(kind, drv)}
                        className="sr-only"
                      />
                      <span className="text-on-surface-variant font-medium group-hover:text-on-surface transition-colors">
                        {nameOf(drv)}
                      </span>
                    </label>
                  )
                })}
              </div>
            </motion.div>
          ))}
      </AnimatePresence>
    </>
  )
}
