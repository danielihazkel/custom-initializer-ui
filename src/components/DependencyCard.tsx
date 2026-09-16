import { memo } from 'react'
import { motion, type Variants } from 'framer-motion'

interface Props {
  id: string
  name: string
  description?: string
  /** Short badge text (e.g. "Boot [3.2.0,4.0.0)" or "React 18 only"); omitted = no badge. */
  versionBadge?: string
  /** Native tooltip for the badge (the raw range when the badge text is a summary). */
  versionTitle?: string
  isSelected: boolean
  /** Must be referentially stable (wrap in useCallback over a ref) for the memo to pay off. */
  onToggle: (id: string) => void
  /** Optional framer-motion variants for a staggered cascade from the parent grid. */
  variants?: Variants
}

/**
 * One row in the "Explore Dependencies" catalog. Memoised because the catalog holds
 * hundreds of these and only the toggled card's props change on a click. Deliberately
 * no `layout` prop: the grid is fixed-order, so per-commit measurement is wasted work.
 */
export const DependencyCard = memo(function DependencyCard({
  id, name, description, versionBadge, versionTitle, isSelected, onToggle, variants,
}: Props) {
  return (
    <motion.label
      variants={variants}
      className={`flex items-start gap-4 p-4 rounded-xl border relative cursor-pointer overflow-hidden group transition-all duration-300 ${
        isSelected
          ? 'border-primary bg-primary/10 shadow-[0_4px_20px_rgba(139,92,246,0.1)]'
          : 'border-outline-variant bg-surface-container-high hover:border-primary/50 hover:bg-surface-container-highest'
      }`}
    >
      {isSelected && (
        <motion.div layoutId={`dep-active-${id}`} className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
      )}
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => onToggle(id)}
        className="sr-only"
      />
      <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-all duration-300 ${
        isSelected
          ? 'bg-primary border-primary text-white shadow-[0_0_10px_rgba(139,92,246,0.5)]'
          : 'bg-surface-container-lowest border-secondary/40 group-hover:border-primary/50'
      }`}>
        {isSelected && (
          <motion.span
            className="material-symbols-outlined font-bold"
            style={{ fontSize: '14px' }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 600, damping: 20 }}
          >
            check
          </motion.span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-on-surface flex items-center flex-wrap gap-2">
          {name}
          {versionBadge && (
            <span
              title={versionTitle}
              className="text-[9px] font-bold text-secondary bg-surface-container px-1.5 py-0.5 rounded-full border border-outline-variant/50"
            >
              {versionBadge}
            </span>
          )}
        </div>
        {description && (
          <div className="text-xs text-on-surface-variant leading-relaxed mt-1">{description}</div>
        )}
      </div>
    </motion.label>
  )
})
