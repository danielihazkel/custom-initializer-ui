import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { FrontendMetadata, FeDependency } from '../../hooks/useFrontendMetadata'

interface Props {
  metadata: FrontendMetadata
  selectedDeps: string[]
  selectedOptions: Record<string, string[]>
  onToggleDep: (depId: string) => void
  onToggleOption: (depId: string, optionId: string) => void
}

export function SelectedDependenciesFE({
  metadata,
  selectedDeps,
  selectedOptions,
  onToggleDep,
  onToggleOption,
}: Props) {
  const cards = useMemo(() => {
    return selectedDeps
      .filter(id => !id.startsWith('design-'))
      .map(id => findDep(metadata, id))
      .filter((d): d is FeDependency => !!d)
  }, [metadata, selectedDeps])

  return (
    <div className="flex flex-col h-full text-on-surface">
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-outline-variant/50">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: '20px' }}>
            shopping_cart
          </span>
          <h3 className="text-xs font-bold uppercase tracking-widest">Selected Dependencies</h3>
        </div>
        <span className="text-xs font-bold py-1 px-3 bg-primary/10 text-primary rounded-full">
          {cards.length}
        </span>
      </div>

      <div className="flex flex-col gap-3 flex-grow overflow-y-auto pr-2 max-h-[60vh]">
        <AnimatePresence mode="popLayout">
          {cards.length > 0 ? cards.map(dep => {
            const opts = selectedOptions[dep.id] ?? []
            return (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, x: -20 }}
                transition={{ duration: 0.2 }}
                key={dep.id}
                className="p-4 rounded-xl border bg-surface-container-highest border-outline-variant shadow-sm flex flex-col gap-1"
              >
                <div className="flex justify-between items-start">
                  <h4 className="text-sm font-bold text-on-surface">{dep.name}</h4>
                  <button
                    type="button"
                    onClick={() => onToggleDep(dep.id)}
                    className="text-secondary hover:text-error bg-surface-container hover:bg-error/10 p-1.5 rounded-lg transition-colors ml-2 flex-shrink-0"
                    aria-label={`Remove ${dep.name}`}
                  >
                    <span className="material-symbols-outlined block" style={{ fontSize: '14px' }}>close</span>
                  </button>
                </div>
                {dep.description && (
                  <p className="text-xs text-on-surface-variant leading-relaxed opacity-80">{dep.description}</p>
                )}
                {dep.subOptions && dep.subOptions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-outline-variant/60 space-y-2">
                    {dep.subOptions.map(o => {
                      const checked = opts.includes(o.id)
                      return (
                        <label key={o.id} className="flex items-start gap-3 text-xs cursor-pointer group">
                          <div className={`flex-shrink-0 mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-all ${
                            checked
                              ? 'bg-secondary border-secondary text-on-surface'
                              : 'bg-surface-container-lowest border-secondary/40 group-hover:border-secondary'
                          }`}>
                            {checked && (
                              <span className="material-symbols-outlined font-bold text-background" style={{ fontSize: '12px' }}>
                                check
                              </span>
                            )}
                          </div>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => onToggleOption(dep.id, o.id)}
                            className="sr-only"
                          />
                          <span className="text-on-surface-variant font-medium group-hover:text-on-surface transition-colors flex-1">
                            <span className="block">{o.label}</span>
                            {o.description && (
                              <span className="block text-[11px] text-secondary mt-0.5">{o.description}</span>
                            )}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </motion.div>
            )
          }) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center text-center py-12 flex-grow"
            >
              <span className="material-symbols-outlined text-secondary opacity-30 mb-3" style={{ fontSize: '40px' }}>
                inventory_2
              </span>
              <p className="text-sm font-medium text-on-surface">No dependencies selected</p>
              <p className="text-xs text-secondary max-w-[200px] mt-1">
                Search and add dependencies from the panel on the right.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function findDep(metadata: FrontendMetadata, id: string): FeDependency | undefined {
  for (const g of metadata.dependencies) {
    for (const e of g.entries) {
      if (e.id === id) return e
    }
  }
  return undefined
}
