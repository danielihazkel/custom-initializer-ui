import { t } from '../i18n'

/**
 * The catalog's "nothing matches" state. It can only show once a search has run, so it is
 * fetched together with the matcher (see DependencySelector's `loadMatcher`) — already loaded by
 * the time it is needed, with no wait of its own.
 */
export function DependencySearchEmpty({ search, onClear }: { search: string; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
      <span className="material-symbols-outlined text-secondary opacity-30 mb-3" style={{ fontSize: '48px' }}>search_off</span>
      <p className="text-sm font-medium text-on-surface">{t('No results found')}</p>
      <p className="text-xs text-secondary mt-1 max-w-[200px]">{t('We couldn\'t find any dependencies matching “{search}”', { search })}</p>
      <button
        type="button"
        onClick={onClear}
        className="mt-3 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-outline-variant text-secondary hover:text-primary hover:border-primary/50 transition-colors"
      >
        {t('Clear search')}
      </button>
    </div>
  )
}
