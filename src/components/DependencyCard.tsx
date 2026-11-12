import { memo } from 'react'
import { Highlight } from './shared/Highlight'

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
  /** Where the search matched the name / the description (see `utils/fuzzy`). */
  nameRanges?: [number, number][]
  descriptionRanges?: [number, number][]
  /** What a wizard can generate for this dependency ("SQL", "OpenAPI"…): shown as a badge, so a
   *  wizard is discoverable before the dependency is selected. */
  wizard?: string
  /** Starred by this browser. Leave `onFavourite` out for a catalog without favourites. */
  favourite?: boolean
  /** Must be referentially stable, like `onToggle`. */
  onFavourite?: (id: string) => void
}

/**
 * One row in the "Explore Dependencies" catalog. Memoised because the catalog holds
 * hundreds of these and only the toggled card's props change on a click.
 *
 * Plain elements and CSS on purpose — no framer-motion here. A motion component per card (plus
 * a `layoutId` bar and a spring on the tick) meant hundreds of animation subscriptions in the
 * hottest list of the page; the accent bar and the tick are a transition and a one-shot keyframe.
 *
 * The star is a sibling of the label, not a child: a button inside a label is invalid, and a
 * click on it must not toggle the dependency.
 */
export const DependencyCard = memo(function DependencyCard({
  id, name, description, versionBadge, versionTitle, isSelected, onToggle,
  nameRanges, descriptionRanges, wizard, favourite = false, onFavourite,
}: Props) {
  return (
    <div className="relative group/card">
      <label
        className={`flex items-start gap-4 p-4 rounded-xl border relative cursor-pointer overflow-hidden group transition-colors duration-200 ${
          isSelected
            ? 'border-primary bg-primary/10 glow-primary-soft'
            : 'border-outline-variant bg-surface-container-high hover:border-primary/50 hover:bg-surface-container-highest'
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute left-0 top-0 bottom-0 w-1 bg-primary origin-center transition-transform duration-200 ${isSelected ? 'scale-y-100' : 'scale-y-0'}`}
        />
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggle(id)}
          className="sr-only"
          data-dep-card={id}
        />
        <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors duration-200 ${
          isSelected
            ? 'bg-primary border-primary text-on-primary glow-primary'
            : 'bg-surface-container-lowest border-secondary/40 group-hover:border-primary/50'
        }`}>
          {isSelected && (
            <span className="material-symbols-outlined font-bold check-pop" style={{ fontSize: '14px' }}>
              check
            </span>
          )}
        </div>
        <div className={`flex-1 min-w-0 ${onFavourite ? 'pr-6' : ''}`}>
          <div className="text-sm font-bold text-on-surface flex items-center flex-wrap gap-2">
            <span><Highlight text={name} ranges={nameRanges} /></span>
            {versionBadge && (
              <span
                title={versionTitle}
                className="text-[9px] font-bold text-secondary bg-surface-container px-1.5 py-0.5 rounded-full border border-outline-variant/50"
              >
                {versionBadge}
              </span>
            )}
            {wizard && (
              <span
                title={`Select it to generate code from ${wizard}`}
                className="inline-flex items-center gap-0.5 text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full border border-primary/25"
                data-wizard-badge
              >
                <span className="material-symbols-outlined" style={{ fontSize: '11px' }} aria-hidden="true">auto_fix_high</span>
                {wizard} wizard
              </span>
            )}
          </div>
          {description && (
            <div className="text-xs text-on-surface-variant leading-relaxed mt-1">
              <Highlight text={description} ranges={descriptionRanges} />
            </div>
          )}
        </div>
      </label>
      {onFavourite && (
        <button
          type="button"
          onClick={() => onFavourite(id)}
          aria-pressed={favourite}
          aria-label={favourite ? `Remove ${name} from favourites` : `Add ${name} to favourites`}
          title={favourite ? 'Remove from favourites' : 'Add to favourites'}
          className={`absolute top-2.5 right-2.5 p-1 rounded-lg transition-opacity hover:bg-surface-container ${
            favourite ? 'text-warning opacity-100' : 'text-secondary opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100'
          }`}
        >
          <span
            className="material-symbols-outlined block"
            style={{ fontSize: '16px' }}
            aria-hidden="true"
          >
            star
          </span>
        </button>
      )}
    </div>
  )
})
