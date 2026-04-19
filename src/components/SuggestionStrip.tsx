import { AnimatePresence, motion } from 'framer-motion'

export interface Suggestion {
  targetDepId: string
  targetName: string
  score: number
  sourceNames: string[]
  reasons: string[]
}

interface SuggestionStripProps {
  suggestions: Suggestion[]
  onAdd: (depId: string) => void
}

export function SuggestionStrip({ suggestions, onAdd }: SuggestionStripProps) {
  if (suggestions.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="mb-4 overflow-hidden"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="material-symbols-outlined text-primary" style={{ fontSize: '16px' }}>auto_awesome</span>
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-secondary">Suggested for you</h4>
      </div>
      <div className="flex flex-wrap gap-2">
        <AnimatePresence>
          {suggestions.map(s => {
            const tooltip = s.reasons.length > 0 ? s.reasons.join('\n') : `Recommended by ${s.sourceNames.join(', ')}`
            return (
              <motion.button
                key={s.targetDepId}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={() => onAdd(s.targetDepId)}
                title={tooltip}
                className="flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-medium transition-colors active:scale-95"
              >
                <span>{s.targetName}</span>
                {s.score > 1 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-primary/20 text-[9px] font-bold">
                    ×{s.score}
                  </span>
                )}
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
              </motion.button>
            )
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
