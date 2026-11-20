import { useState, useMemo, useEffect, useCallback, useRef, useDeferredValue, lazy, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { DependencySelectorProps, DependencyGroup, EventsByDep, MetadataOption } from '../types'
import { DependencyCard } from './DependencyCard'
// Not needed to paint the picker, so chunks of their own: the wizards (their drawers and ⌘K
// entries — mounted from the start, drawing nothing until one opens) and the notices at the top
// of the Selected panel (conflicts, a required dependency, the primary database).
const DependencyWizards = lazy(() => import('./DependencyWizards').then(m => ({ default: m.DependencyWizards })))
const DependencyNotices = lazy(() => import('./DependencyNotices').then(m => ({ default: m.DependencyNotices })))
import type { OpenWizards, WizardKind } from './DependencyWizards'

const NO_EVENTS_DEPS: string[] = []
const NO_EVENTS: EventsByDep = {}
// Shown only while a selected dependency recommends another.
const SuggestionStrip = lazy(() => import('./SuggestionStrip').then(m => ({ default: m.SuggestionStrip })))
import { useDependencyCompatibility } from '../hooks/useDependencyCompatibility'
import { DB_DRIVERS, DB_DRIVER_KINDS, DB_PRIMARY_OPTIONS, DB_SECONDARY_OPTIONS, DB_SUB_OPTION_IDS } from '../utils/dbDrivers'
// The matcher is fetched when the search box is first used — the catalog paints without it — and
// with it the "nothing matches" state, which only a search can lead to.
const loadMatcher = () => Promise.all([import('../utils/fuzzy'), import('./DependencySearchEmpty')])
  .then(([fuzzy, empty]) => ({ fuzzyMatch: fuzzy.fuzzyMatch, substringMatch: fuzzy.substringMatch, Empty: empty.DependencySearchEmpty }))
type Matcher = Awaited<ReturnType<typeof loadMatcher>>
import { useHotkeys } from '../hooks/useHotkeys'
import { useDepFavorites } from '../hooks/useDepFavorites'
import { usePopularDeps } from '../hooks/usePopularDeps'
import { t, tn, useLang } from '../i18n'

/** Where a search matched one dependency. */
interface Hit { name?: [number, number][]; description?: [number, number][] }
const NO_HITS = new Map<string, Hit>()
const NO_RECENT: string[] = []

/** Why a dependency is among the Quick picks. */
type PickKind = 'favourite' | 'recent' | 'popular'
const PICK_ICON: Record<PickKind, string> = { favourite: 'star', recent: 'history', popular: 'trending_up' }
function pickTitle(kind: PickKind): string {
  return kind === 'favourite' ? t('One of your favourites')
    : kind === 'recent' ? t('In a project you generated or explored lately')
    : t('Among the most used here')
}
/** Dependency checkboxes Tab and the arrows can reach: those of the groups that are open. */
const OPEN_CARD_INPUTS = '.collapse-rows:not([data-collapsed="true"]) input[data-dep-card]'

/** A selected dependency's wizard: the button that opens it, and what it already holds. */
function WizardRow({ icon, label, note, onOpen }: { icon: string; label: string; note?: string | false; onOpen: () => void }) {
  return (
    <div className="mt-3 pt-3 border-t border-outline-variant/60 flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={onOpen}
        className="flex items-center gap-1.5 text-[11px] font-bold py-1.5 px-3 rounded-lg bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-all active:scale-95"
      >
        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{icon}</span>
        {label}
      </button>
      {note && (
        <span className="text-[10px] text-secondary font-medium whitespace-nowrap">
          ✓ {note}
        </span>
      )}
    </div>
  )
}

export function DependencySelector({
  metadata,
  selected,
  onChange,
  extensions,
  selectedOptions,
  onOptionsChange,
  compatibilityRules,
  sqlDialects,
  sqlByDep,
  onSqlByDepChange,
  openApiCapableDeps,
  openApiByDep,
  onOpenApiByDepChange,
  soapCapableDeps,
  soapByDep,
  onSoapByDepChange,
  eventsCapableDeps = NO_EVENTS_DEPS,
  eventsByDep = NO_EVENTS,
  onEventsByDepChange,
  sqlParseError,
  recentDepIds = NO_RECENT,
}: DependencySelectorProps) {
  useLang()
  const [search, setSearch] = useState<string>('')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  // Which wizard is open on which dependency. The drawers themselves are DependencyWizards'.
  const [openWizards, setOpenWizards] = useState<OpenWizards>({})
  const openWizard = useCallback((kind: WizardKind, depId: string | null) => {
    setOpenWizards(prev => ({ ...prev, [kind]: depId ?? undefined }))
  }, [])

  const toggleGroup = useCallback((name: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }, [])

  // The list follows the search box a render behind, so typing stays instant while hundreds of
  // cards are filtered (and animated) in the background.
  const deferredSearch = useDeferredValue(search)
  // Asked for when the box takes focus, so it is there by the first keystroke. Until it is, a
  // query narrows nothing (and Enter adds nothing): never a wrong result, only a late one.
  const [matcher, setMatcher] = useState<Matcher | null>(null)
  const wantMatcher = useCallback(() => { void loadMatcher().then(m => setMatcher(() => m)) }, [])
  const isCollapsed = (name: string) => !deferredSearch.trim() && collapsedGroups.has(name)

  const groups = useMemo<DependencyGroup[]>(() => {
    if (!metadata?.dependencies?.values) return []
    return metadata.dependencies.values
  }, [metadata])

  const allDeps = useMemo<MetadataOption[]>(() => groups.flatMap(g => g.values ?? []), [groups])

  useEffect(() => {
    // (An empty catalog shows the same empty state, so it asks too.)
    if ((search || groups.length === 0) && !matcher) wantMatcher()
  }, [search, groups, matcher, wantMatcher])

  // A name matches loosely ("sdj" finds Spring Data JPA); a description, being prose, only by
  // the words typed. The catalog keeps its order — a list that reshuffles while typing is hard
  // to scan — and each hit remembers where it matched, for the highlight.
  const { filtered, hits } = useMemo((): { filtered: DependencyGroup[]; hits: Map<string, Hit> } => {
    const q = deferredSearch.trim()
    if (!q || !matcher) return { filtered: groups, hits: NO_HITS }
    const lowered = q.toLowerCase()
    const found = new Map<string, Hit>()
    const narrowed = groups
      .map(group => ({
        ...group,
        values: (group.values ?? []).filter(d => {
          const name = matcher.fuzzyMatch(q, d.name)
          const description = matcher.substringMatch(q, d.description ?? '')
          if (!name && !description && !d.id.toLowerCase().includes(lowered)) return false
          found.set(d.id, { name: name?.ranges, description: description?.ranges })
          return true
        }),
      }))
      .filter(g => g.values.length > 0)
    return { filtered: narrowed, hits: found }
  }, [groups, deferredSearch, matcher])

  // Stable toggle (reads the latest props through refs) so the memoised DependencyCards
  // don't all re-render whenever the selection changes.
  const selectedRef = useRef(selected)
  selectedRef.current = selected
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const toggle = useCallback((depId: string): void => {
    const current = selectedRef.current
    if (current.includes(depId)) {
      onChangeRef.current(current.filter(id => id !== depId))
    } else {
      onChangeRef.current([...current, depId])
    }
  }, [])

  function toggleOption(depId: string, optId: string): void {
    const current = selectedOptions[depId] ?? []
    const next = current.includes(optId)
      ? current.filter(id => id !== optId)
      : [...current, optId]
    onOptionsChange(depId, next)
  }

  // ── Primary Database auto-management (scoped per driver kind) ──────────
  const driversByKind = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const id of DB_DRIVERS) {
      if (!selected.includes(id)) continue
      const kind = DB_DRIVER_KINDS[id]
        ; (map[kind] ??= []).push(id)
    }
    return map
  }, [selected])

  const driversByKindKey = Object.entries(driversByKind)
    .map(([k, d]) => `${k}:${d.join(',')}`)
    .join('|')

  // Auto-set primary/secondary per kind. A kind with only one selected driver
  // still gets its `*-primary` sub-option silently — @Primary on its beans is
  // harmless because no other driver of that kind competes.
  useEffect(() => {
    for (const [, drivers] of Object.entries(driversByKind)) {
      if (drivers.length === 0) continue
      const existing = drivers.find(d => (selectedOptions[d] ?? []).includes(DB_PRIMARY_OPTIONS[d])) ?? null
      const effectivePrimary = existing && drivers.includes(existing) ? existing : drivers[0]
      for (const drv of drivers) {
        const expected = drv === effectivePrimary ? DB_PRIMARY_OPTIONS[drv] : DB_SECONDARY_OPTIONS[drv]
        const current = selectedOptions[drv] ?? []
        const currentDbOpts = current.filter(o => DB_SUB_OPTION_IDS.has(o))
        if (currentDbOpts.length !== 1 || currentDbOpts[0] !== expected) {
          const nonDbOpts = current.filter(o => !DB_SUB_OPTION_IDS.has(o))
          onOptionsChange(drv, [...nonDbOpts, expected])
        }
      }
    }
  }, [driversByKindKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePrimaryChange = useCallback((kind: string, drv: string) => {
    const drivers = driversByKind[kind] ?? []
    for (const d of drivers) {
      const current = selectedOptions[d] ?? []
      const nonDbOpts = current.filter(o => !DB_SUB_OPTION_IDS.has(o))
      const dbOpt = d === drv ? DB_PRIMARY_OPTIONS[d] : DB_SECONDARY_OPTIONS[d]
      onOptionsChange(d, [...nonDbOpts, dbOpt])
    }
  }, [driversByKind, selectedOptions, onOptionsChange])

  // Filter out DB sub-options from the normal checkbox UI
  const filteredExtensions = useMemo(() => {
    const result: Record<string, typeof extensions[string]> = {}
    for (const [depId, opts] of Object.entries(extensions)) {
      const filtered = opts.filter(o => !DB_SUB_OPTION_IDS.has(o.id))
      if (filtered.length > 0) result[depId] = filtered
    }
    return result
  }, [extensions])

  const selectedSet = useMemo(() => new Set(selected), [selected])
  const selectedDeps = useMemo(() => allDeps.filter(d => selectedSet.has(d.id)), [allDeps, selectedSet])

  const { conflicts, requires, suggestions } = useDependencyCompatibility(
    compatibilityRules, selected, allDeps,
  )
  // The notices' chunk is fetched the first time the selection needs a word, and stays mounted
  // from then on so what it shows can animate out.
  const noticesNeeded = useRef(false)
  if (conflicts.length > 0 || requires.length > 0 || Object.values(driversByKind).some(d => d.length >= 2)) {
    noticesNeeded.current = true
  }
  const nameOf = useCallback((depId: string) => allDeps.find(d => d.id === depId)?.name ?? depId, [allDeps])

  // ── Quick picks: favourites, then what was used lately, then what is popular here ─────────
  const { favorites, toggle: toggleFavorite } = useDepFavorites()
  const favoriteSet = useMemo(() => new Set(favorites), [favorites])
  const popular = usePopularDeps('BACKEND')
  const quickPicks = useMemo(() => {
    const byId = new Map(allDeps.map(d => [d.id, d]))
    const seen = new Set<string>()
    const take = (ids: string[], kind: PickKind, max: number) =>
      ids.filter(id => byId.has(id) && !seen.has(id)).slice(0, max).map(id => {
        seen.add(id)
        return { dep: byId.get(id)!, kind }
      })
    return [...take(favorites, 'favourite', 8), ...take(recentDepIds, 'recent', 5), ...take(popular, 'popular', 5)]
  }, [allDeps, favorites, recentDepIds, popular])

  // What a wizard can generate for a dependency, shown on its card before it is selected.
  const wizardOf = useMemo(() => {
    const map = new Map<string, string>()
    const add = (id: string, what: string) => map.set(id, map.has(id) ? `${map.get(id)} · ${what}` : what)
    for (const id of Object.keys(sqlDialects)) add(id, 'SQL')
    for (const id of openApiCapableDeps) add(id, 'OpenAPI')
    for (const id of soapCapableDeps) add(id, 'WSDL')
    for (const id of eventsCapableDeps) add(id, 'AsyncAPI')
    return map
  }, [sqlDialects, openApiCapableDeps, soapCapableDeps, eventsCapableDeps])

  // ── Keyboard: "/" to the search box, arrows through the results, Enter adds the first ─────
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const focusSearch = useCallback(() => {
    searchRef.current?.focus()
    searchRef.current?.select()
  }, [])
  useHotkeys([{ key: '/', run: focusSearch }])

  const cardInputs = () => Array.from(listRef.current?.querySelectorAll<HTMLInputElement>(OPEN_CARD_INPUTS) ?? [])

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      cardInputs()[0]?.focus()
    } else if (e.key === 'Enter' && search.trim()) {
      // Type, Enter: the top result is added (or removed) without leaving the box.
      e.preventDefault()
      const first = matcher ? filtered[0]?.values[0] : undefined
      if (first) toggle(first.id)
    } else if (e.key === 'Escape' && search) {
      e.preventDefault()
      setSearch('')
    }
  }

  function onListKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const target = e.target as HTMLElement
    if (!target.matches('input[data-dep-card]')) return
    e.preventDefault()
    const inputs = cardInputs()
    const at = inputs.indexOf(target as HTMLInputElement)
    if (e.key === 'ArrowUp' && at <= 0) {
      focusSearch()
      return
    }
    inputs[e.key === 'ArrowDown' ? Math.min(at + 1, inputs.length - 1) : at - 1]?.focus()
  }

  return (
    <>
      {/* Two panels side by side, pinned and as tall as the window, on every desktop width (`lg`
          up — where the page itself has two columns). **A picked dependency's options and wizard
          buttons are in the Selected panel, so it must be in sight while picking**: stacking the
          panels below `xl` once put it a full screen under the catalog on a 1280px window.
          Below `lg` the page is one column; Selected comes first there, capped, for the same reason. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:sticky lg:top-20 lg:h-[calc(100vh-12rem)]" data-dep-panels>

        {/* Panel 1: Selected Dependencies */}
        <div className="glass-panel rounded-2xl p-6 flex flex-col overflow-hidden text-on-surface max-lg:max-h-[45vh]" data-tour="selected-deps">
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-outline-variant/50">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: '20px' }}>shopping_cart</span>
              <h3 className="text-xs font-bold uppercase tracking-widest">{t('Selected Dependencies')}</h3>
            </div>
            <span className="text-xs font-bold py-1 px-3 bg-primary/10 text-primary rounded-full">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={selected.length}
                  className="inline-block"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                >
                  {selected.length}
                </motion.span>
              </AnimatePresence>
            </span>
          </div>

          {/* Single scroll container — warnings + primary DB selector + deps list */}
          <div className="flex flex-col gap-3 flex-grow overflow-y-auto pe-2 tutorial-scroll">

            {noticesNeeded.current && (
              <Suspense fallback={null}>
                <DependencyNotices
                  conflicts={conflicts}
                  requires={requires}
                  onAdd={depId => onChange([...selected, depId])}
                  driversByKind={driversByKind}
                  selectedOptions={selectedOptions}
                  nameOf={nameOf}
                  onPrimaryChange={handlePrimaryChange}
                />
              </Suspense>
            )}

            <AnimatePresence mode="popLayout">
              {selectedDeps.length > 0 ? selectedDeps.map(dep => (
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
                    <h4 dir="auto" className="text-sm font-bold text-on-surface">{dep.name}</h4>
                    <button
                      type="button"
                      onClick={() => toggle(dep.id)}
                      className="text-secondary hover:text-error bg-surface-container hover:bg-error/10 p-1.5 rounded-lg transition-colors ms-2 flex-shrink-0"
                      aria-label={t('Remove {name}', { name: dep.name })}
                    >
                      <span className="material-symbols-outlined block" style={{ fontSize: '14px' }}>close</span>
                    </button>
                  </div>
                  {dep.description && (
                    <p dir="auto" className="text-xs text-on-surface-variant leading-relaxed opacity-80">{dep.description}</p>
                  )}
                  {(filteredExtensions[dep.id]?.length ?? 0) > 0 && (
                    <div className="mt-3 pt-3 border-t border-outline-variant/60 space-y-2">
                      {filteredExtensions[dep.id].map(opt => (
                        <label key={opt.id} className="flex items-center gap-3 text-xs cursor-pointer group">
                          <div className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-all ${(selectedOptions[dep.id] ?? []).includes(opt.id)
                            ? 'bg-secondary border-secondary text-on-surface'
                            : 'bg-surface-container-lowest border-secondary/40 group-hover:border-secondary'
                            }`}>
                            {(selectedOptions[dep.id] ?? []).includes(opt.id) && (
                              <motion.span
                                className="material-symbols-outlined font-bold text-background"
                                style={{ fontSize: '12px' }}
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', stiffness: 600, damping: 20 }}
                              >
                                check
                              </motion.span>
                            )}
                          </div>
                          <input
                            type="checkbox"
                            checked={(selectedOptions[dep.id] ?? []).includes(opt.id)}
                            onChange={() => toggleOption(dep.id, opt.id)}
                            className="sr-only"
                          />
                          <span className="text-on-surface-variant font-medium group-hover:text-on-surface transition-colors" title={opt.description}>
                            {opt.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                  {sqlDialects[dep.id] && (
                    <WizardRow
                      icon="auto_fix_high"
                      onOpen={() => openWizard('sql', dep.id)}
                      label={sqlByDep[dep.id] ? t('Edit SQL entities…') : t('Generate entities from SQL…')}
                      note={sqlByDep[dep.id] && tn(sqlByDep[dep.id].tables.length, '{n} table', '{n} tables')}
                    />
                  )}
                  {openApiCapableDeps.includes(dep.id) && (
                    <WizardRow
                      icon="integration_instructions"
                      onOpen={() => openWizard('openapi', dep.id)}
                      label={openApiByDep[dep.id] ? t('Edit OpenAPI controllers…') : t('Generate from OpenAPI spec…')}
                      note={openApiByDep[dep.id] && t('spec attached')}
                    />
                  )}
                  {soapCapableDeps.includes(dep.id) && (
                    <WizardRow
                      icon="hub"
                      onOpen={() => openWizard('soap', dep.id)}
                      label={soapByDep[dep.id] ? t('Edit SOAP services…') : t('Generate from WSDL…')}
                      note={soapByDep[dep.id] && t('WSDL attached')}
                    />
                  )}
                  {eventsCapableDeps.includes(dep.id) && (
                    <WizardRow
                      icon="cell_tower"
                      onOpen={() => openWizard('events', dep.id)}
                      label={eventsByDep[dep.id] ? t('Edit events…') : t('Generate from AsyncAPI…')}
                      note={eventsByDep[dep.id] && t('document attached')}
                    />
                  )}
                </motion.div>
              )) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="min-h-[200px] border-2 border-dashed border-outline-variant/50 rounded-2xl flex flex-col items-center justify-center text-center p-8 bg-surface-container-low/30"
                >
                  <div className="w-16 h-16 rounded-full bg-surface-container-highest flex items-center justify-center mb-4">
                    <span className="material-symbols-outlined text-secondary opacity-50" style={{ fontSize: '32px' }}>inventory_2</span>
                  </div>
                  <h4 className="text-sm font-bold text-on-surface mb-1">{t('Your cart is empty')}</h4>
                  <p className="text-xs text-secondary max-w-[220px]">
                    {t('Tick dependencies in the catalog, or press')}{' '}
                    <kbd className="px-1.5 py-0.5 rounded border border-outline-variant bg-surface-container font-mono text-[10px] text-on-surface">/</kbd>{' '}
                    {t('and type a name.')}
                  </p>
                  <button
                    type="button"
                    onClick={focusSearch}
                    className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-outline-variant text-secondary hover:text-primary hover:border-primary/50 transition-colors"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">search</span>
                    {t('Search dependencies')}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Panel 2: All Available Dependencies */}
        <div className="glass-panel rounded-2xl p-6 flex flex-col overflow-hidden text-on-surface max-lg:max-h-[80vh]" data-dep-catalog>
          <div className="flex items-center gap-2 mb-4 pb-4 border-b border-outline-variant/50">
            <span className="material-symbols-outlined text-tertiary" style={{ fontSize: '20px' }}>explore</span>
            <h3 className="text-xs font-bold uppercase tracking-widest">{t('Explore Dependencies')}</h3>
          </div>

          {/* Aggregated recommendations */}
          {suggestions.length > 0 && (
            <Suspense fallback={null}>
              <SuggestionStrip
                suggestions={suggestions}
                onAdd={(depId) => onChange([...selected, depId])}
              />
            </Suspense>
          )}

          {/* Search */}
          <div className="relative mb-6 group" data-tour="dep-search">
            <span
              className="material-symbols-outlined absolute start-4 top-1/2 -translate-y-1/2 text-primary transition-transform group-focus-within:scale-110"
              style={{ fontSize: '20px' }}
            >
              search
            </span>
            <input
              ref={searchRef}
              type="search"
              aria-label={t('Search dependencies')}
              aria-keyshortcuts="/"
              className="w-full bg-surface-container-highest border border-outline-variant rounded-xl ps-12 pe-12 py-3.5 text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all placeholder-secondary/70 shadow-inner"
              placeholder={t('Search Web, Security, JPA...')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={wantMatcher}
              onKeyDown={onSearchKeyDown}
              data-dep-search
            />
            <div className="absolute end-4 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded border border-outline-variant text-[10px] font-bold text-secondary bg-surface-container">
              /
            </div>
          </div>

          {/* Grouped checkboxes */}
          <div ref={listRef} onKeyDown={onListKeyDown} className="flex-grow space-y-6 overflow-y-auto pe-2 tutorial-scroll pb-20">
            {!deferredSearch.trim() && quickPicks.length > 0 && (
              <div className="space-y-2" data-quick-picks>
                <div className="text-[10px] font-bold uppercase tracking-widest text-secondary">{t('Quick picks')}</div>
                <div className="flex flex-wrap gap-1.5">
                  {quickPicks.map(({ dep, kind }) => {
                    const picked = selectedSet.has(dep.id)
                    return (
                      <button
                        key={dep.id}
                        type="button"
                        onClick={() => toggle(dep.id)}
                        aria-pressed={picked}
                        title={`${pickTitle(kind)} — ${dep.description ?? dep.name}`}
                        className={`inline-flex items-center gap-1 ps-2 pe-2.5 py-1 rounded-full border text-[11px] font-semibold transition-colors ${
                          picked
                            ? 'border-primary bg-primary/15 text-primary'
                            : 'border-outline-variant text-secondary hover:text-on-surface hover:border-primary/50'
                        }`}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }} aria-hidden="true">
                          {picked ? 'check' : PICK_ICON[kind]}
                        </span>
                        {dep.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            {/* Plain elements: with hundreds of cards, a framer `layout` wrapper per group and a
                staggered motion card per row made every search keystroke measure the whole list. */}
            {filtered.map(group => {
              const collapsed = isCollapsed(group.name)
              const selectedCount = group.values.filter(d => selectedSet.has(d.id)).length
              const gridId = `dep-group-${group.name.replace(/\s+/g, '-').toLowerCase()}`
              return (
                <div key={group.name} className="space-y-3">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.name)}
                    aria-expanded={!collapsed}
                    aria-controls={gridId}
                    className="w-full flex items-center gap-3 cursor-pointer group/header"
                  >
                    <div className="factory-pipe h-px flex-1 bg-outline-variant/50"></div>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-secondary px-2 py-1 bg-surface-container-lowest rounded-full border border-outline-variant/30 group-hover/header:border-primary/50 group-hover/header:text-on-surface transition-colors">
                      <span
                        className={`material-symbols-outlined transition-transform ${collapsed ? '-rotate-90 rtl:rotate-90' : 'rotate-0'}`}
                        style={{ fontSize: '14px' }}
                      >
                        expand_more
                      </span>
                      {group.name}
                      {selectedCount > 0 && (
                        <span className="ms-1 px-1.5 py-px rounded-full bg-primary/15 text-primary text-[9px] font-bold">
                          {selectedCount}
                        </span>
                      )}
                    </div>
                    <div className="factory-pipe h-px flex-1 bg-outline-variant/50"></div>
                  </button>
                  <div id={gridId} className="collapse-rows" data-collapsed={collapsed}>
                    <div>
                      <div className="grid gap-2">
                        {group.values.map(dep => (
                          <DependencyCard
                            key={dep.id}
                            id={dep.id}
                            name={dep.name}
                            description={dep.description}
                            versionBadge={dep.versionRange ? `Boot ${dep.versionRange}` : undefined}
                            isSelected={selectedSet.has(dep.id)}
                            onToggle={toggle}
                            nameRanges={hits.get(dep.id)?.name}
                            descriptionRanges={hits.get(dep.id)?.description}
                            wizard={wizardOf.get(dep.id)}
                            favourite={favoriteSet.has(dep.id)}
                            onFavourite={toggleFavorite}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
            {filtered.length === 0 && matcher && (
              <matcher.Empty search={search} onClear={() => { setSearch(''); focusSearch() }} />
            )}
          </div>
        </div>

      </div>
      <Suspense fallback={null}>
        <DependencyWizards
          allDeps={allDeps}
          selectedDeps={selectedDeps}
          selected={selected}
          onChange={onChange}
          open={openWizards}
          onOpen={openWizard}
          focusSearch={focusSearch}
          sqlDialects={sqlDialects}
          sqlByDep={sqlByDep}
          onSqlByDepChange={onSqlByDepChange}
          openApiCapableDeps={openApiCapableDeps}
          openApiByDep={openApiByDep}
          onOpenApiByDepChange={onOpenApiByDepChange}
          soapCapableDeps={soapCapableDeps}
          soapByDep={soapByDep}
          onSoapByDepChange={onSoapByDepChange}
          eventsCapableDeps={eventsCapableDeps}
          eventsByDep={eventsByDep}
          onEventsByDepChange={onEventsByDepChange}
          sqlParseError={sqlParseError}
        />
      </Suspense>
    </>
  )
}
