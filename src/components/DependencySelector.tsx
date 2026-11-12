import { useState, useMemo, useEffect, useCallback, useRef, useDeferredValue, lazy, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { DependencySelectorProps, DependencyGroup, EventsByDep, MetadataOption } from '../types'
import { DependencyCard } from './DependencyCard'
// The wizard drawers embed a CodeMirror editor (~1 MB of grammars); load them only when a
// wizard is actually opened so the editor stack stays out of the initial bundle.
const SqlWizardDrawer = lazy(() => import('./SqlWizardDrawer').then(m => ({ default: m.SqlWizardDrawer })))
const OpenApiWizardDrawer = lazy(() => import('./OpenApiWizardDrawer').then(m => ({ default: m.OpenApiWizardDrawer })))
const SoapWizardDrawer = lazy(() => import('./SoapWizardDrawer').then(m => ({ default: m.SoapWizardDrawer })))
const EventsWizardDrawer = lazy(() => import('./EventsWizardDrawer').then(m => ({ default: m.EventsWizardDrawer })))

const NO_EVENTS_DEPS: string[] = []
const NO_EVENTS: EventsByDep = {}
import { SuggestionStrip } from './SuggestionStrip'
import { useDependencyCompatibility } from '../hooks/useDependencyCompatibility'
import { requiredSqlDeps, isSqlDepSatisfied } from '../utils/projectUtils'
import { fuzzyMatch, substringMatch } from '../utils/fuzzy'
import { useHotkeys } from '../hooks/useHotkeys'
import { useDepFavorites } from '../hooks/useDepFavorites'
import { usePopularDeps } from '../hooks/usePopularDeps'
import { registerCommands, type PaletteAction } from '../commands'

/** Where a search matched one dependency. */
interface Hit { name?: [number, number][]; description?: [number, number][] }
const NO_HITS = new Map<string, Hit>()
const NO_RECENT: string[] = []

/** Why a dependency is among the Quick picks. */
type PickKind = 'favourite' | 'recent' | 'popular'
const PICK_ICON: Record<PickKind, string> = { favourite: 'star', recent: 'history', popular: 'trending_up' }
const PICK_TITLE: Record<PickKind, string> = {
  favourite: 'One of your favourites',
  recent: 'In a project you generated or explored lately',
  popular: 'Among the most used here',
}
/** Dependency checkboxes Tab and the arrows can reach: those of the groups that are open. */
const OPEN_CARD_INPUTS = '.collapse-rows:not([data-collapsed="true"]) input[data-dep-card]'

const DB_DRIVERS = ['postgresql', 'mssql', 'db2', 'oracle', 'mongodb', 'h2'] as const
const DB_PRIMARY_OPTIONS: Record<string, string> = {
  postgresql: 'pg-primary',
  mssql: 'mssql-primary',
  db2: 'db2-primary',
  oracle: 'oracle-primary',
  mongodb: 'mongodb-primary',
  h2: 'h2-primary'
}
const DB_SECONDARY_OPTIONS: Record<string, string> = {
  postgresql: 'pg-secondary',
  mssql: 'mssql-secondary',
  db2: 'db2-secondary',
  oracle: 'oracle-secondary',
  mongodb: 'mongodb-secondary',
  h2: 'h2-secondary'
}
const DB_SUB_OPTION_IDS = new Set([
  ...Object.values(DB_PRIMARY_OPTIONS),
  ...Object.values(DB_SECONDARY_OPTIONS),
])
const DB_DRIVER_KINDS: Record<string, 'jdbc' | 'mongodb'> = {
  postgresql: 'jdbc',
  mssql: 'jdbc',
  db2: 'jdbc',
  oracle: 'jdbc',
  h2: 'jdbc',
  mongodb: 'mongodb',
}
const DB_KIND_LABELS: Record<string, string> = {
  jdbc: 'Primary JDBC Database',
  mongodb: 'Primary MongoDB Connection',
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
  const [search, setSearch] = useState<string>('')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [wizardDepId, setWizardDepId] = useState<string | null>(null)
  const [openApiWizardDepId, setOpenApiWizardDepId] = useState<string | null>(null)
  const [soapWizardDepId, setSoapWizardDepId] = useState<string | null>(null)
  const [eventsWizardDepId, setEventsWizardDepId] = useState<string | null>(null)

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
  const isCollapsed = (name: string) => !deferredSearch.trim() && collapsedGroups.has(name)

  const groups = useMemo<DependencyGroup[]>(() => {
    if (!metadata?.dependencies?.values) return []
    return metadata.dependencies.values
  }, [metadata])

  const allDeps = useMemo<MetadataOption[]>(() => groups.flatMap(g => g.values ?? []), [groups])

  // A name matches loosely ("sdj" finds Spring Data JPA); a description, being prose, only by
  // the words typed. The catalog keeps its order — a list that reshuffles while typing is hard
  // to scan — and each hit remembers where it matched, for the highlight.
  const { filtered, hits } = useMemo((): { filtered: DependencyGroup[]; hits: Map<string, Hit> } => {
    const q = deferredSearch.trim()
    if (!q) return { filtered: groups, hits: NO_HITS }
    const lowered = q.toLowerCase()
    const found = new Map<string, Hit>()
    const narrowed = groups
      .map(group => ({
        ...group,
        values: (group.values ?? []).filter(d => {
          const name = fuzzyMatch(q, d.name)
          const description = substringMatch(q, d.description ?? '')
          if (!name && !description && !d.id.toLowerCase().includes(lowered)) return false
          found.set(d.id, { name: name?.ranges, description: description?.ranges })
          return true
        }),
      }))
      .filter(g => g.values.length > 0)
    return { filtered: narrowed, hits: found }
  }, [groups, deferredSearch])

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

  const primaryByKind = useMemo(() => {
    const map: Record<string, string | null> = {}
    for (const [kind, drivers] of Object.entries(driversByKind)) {
      map[kind] = drivers.find(d => (selectedOptions[d] ?? []).includes(DB_PRIMARY_OPTIONS[d])) ?? null
    }
    return map
  }, [driversByKind, selectedOptions])

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
  const warnings = { conflicts, requires }

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
      const first = filtered[0]?.values[0]
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

  // ⌘K: the search box, and the wizard of every selected dependency that has one.
  useEffect(() => {
    const list: PaletteAction[] = [{
      id: 'backend-search-deps', title: 'Search dependencies', icon: 'search', group: 'Backend',
      shortcut: '/', run: focusSearch,
    }]
    for (const dep of selectedDeps) {
      const wizard = (id: string, title: string, icon: string, open: (depId: string) => void) => list.push({
        id: `backend-wizard-${id}-${dep.id}`, title: `${dep.name}: ${title}`, icon, group: 'Wizards', run: () => open(dep.id),
      })
      if (sqlDialects[dep.id]) wizard('sql', 'generate entities from SQL…', 'auto_fix_high', setWizardDepId)
      if (openApiCapableDeps.includes(dep.id)) wizard('openapi', 'generate from an OpenAPI spec…', 'integration_instructions', setOpenApiWizardDepId)
      if (soapCapableDeps.includes(dep.id)) wizard('soap', 'generate from a WSDL…', 'hub', setSoapWizardDepId)
      if (eventsCapableDeps.includes(dep.id)) wizard('events', 'generate from an AsyncAPI document…', 'cell_tower', setEventsWizardDepId)
    }
    return registerCommands(list, 'backend-deps')
  }, [selectedDeps, sqlDialects, openApiCapableDeps, soapCapableDeps, eventsCapableDeps, focusSearch])

  const wizardDep = wizardDepId ? allDeps.find(d => d.id === wizardDepId) : null
  const openApiWizardDep = openApiWizardDepId ? allDeps.find(d => d.id === openApiWizardDepId) : null
  const soapWizardDep = soapWizardDepId ? allDeps.find(d => d.id === soapWizardDepId) : null
  const eventsWizardDep = eventsWizardDepId ? allDeps.find(d => d.id === eventsWizardDepId) : null

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
              <h3 className="text-xs font-bold uppercase tracking-widest">Selected Dependencies</h3>
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
          <div className="flex flex-col gap-3 flex-grow overflow-y-auto pr-2 tutorial-scroll">

            {/* Compatibility warnings (conflicts + requires only; recommends live above search) */}
            <AnimatePresence>
              {(warnings.conflicts.length > 0 || warnings.requires.length > 0) && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 overflow-hidden flex-shrink-0"
                >
                  {warnings.conflicts.map((w, i) => (
                    <div key={`c-${i}`} className="flex items-start gap-2 px-4 py-3 rounded-xl border border-error/30 bg-error/10 text-xs text-error shadow-sm">
                      <span className="material-symbols-outlined flex-shrink-0 mt-0.5" style={{ fontSize: '16px' }}>warning</span>
                      <span className="leading-relaxed font-medium">{w.desc}</span>
                    </div>
                  ))}
                  {warnings.requires.map((w, i) => (
                    <div key={`req-${i}`} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-warning/30 bg-warning/10 text-xs text-warning shadow-sm">
                      <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '16px' }}>error</span>
                      <span className="flex-1 leading-relaxed font-medium">{w.desc}</span>
                      <button
                        type="button"
                        onClick={() => onChange([...selected, w.target])}
                        className="flex-shrink-0 text-[10px] font-bold px-3 py-1 rounded bg-warning text-background shadow-sm transition-transform active:scale-95 hover:brightness-110"
                      >
                        ADD IT
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
                      <span className="text-xs font-bold uppercase tracking-widest text-secondary">{DB_KIND_LABELS[kind] ?? 'Primary Database'}</span>
                    </div>
                    <div className="space-y-2">
                      {drivers.map(drv => {
                        const dep = allDeps.find(d => d.id === drv)
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
                              onChange={() => handlePrimaryChange(kind, drv)}
                              className="sr-only"
                            />
                            <span className="text-on-surface-variant font-medium group-hover:text-on-surface transition-colors">
                              {dep?.name ?? drv}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </motion.div>
                ))}
            </AnimatePresence>

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
                    <h4 className="text-sm font-bold text-on-surface">{dep.name}</h4>
                    <button
                      type="button"
                      onClick={() => toggle(dep.id)}
                      className="text-secondary hover:text-error bg-surface-container hover:bg-error/10 p-1.5 rounded-lg transition-colors ml-2 flex-shrink-0"
                      aria-label={`Remove ${dep.name}`}
                    >
                      <span className="material-symbols-outlined block" style={{ fontSize: '14px' }}>close</span>
                    </button>
                  </div>
                  {dep.description && (
                    <p className="text-xs text-on-surface-variant leading-relaxed opacity-80">{dep.description}</p>
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
                    <div className="mt-3 pt-3 border-t border-outline-variant/60 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setWizardDepId(dep.id)}
                        className="flex items-center gap-1.5 text-[11px] font-bold py-1.5 px-3 rounded-lg bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-all active:scale-95"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>auto_fix_high</span>
                        {sqlByDep[dep.id] ? 'Edit SQL entities…' : 'Generate entities from SQL…'}
                      </button>
                      {sqlByDep[dep.id] && (
                        <span className="text-[10px] text-secondary font-medium whitespace-nowrap">
                          ✓ {sqlByDep[dep.id].tables.length} {sqlByDep[dep.id].tables.length === 1 ? 'table' : 'tables'}
                        </span>
                      )}
                    </div>
                  )}
                  {openApiCapableDeps.includes(dep.id) && (
                    <div className="mt-3 pt-3 border-t border-outline-variant/60 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setOpenApiWizardDepId(dep.id)}
                        className="flex items-center gap-1.5 text-[11px] font-bold py-1.5 px-3 rounded-lg bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-all active:scale-95"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>integration_instructions</span>
                        {openApiByDep[dep.id] ? 'Edit OpenAPI controllers…' : 'Generate from OpenAPI spec…'}
                      </button>
                      {openApiByDep[dep.id] && (
                        <span className="text-[10px] text-secondary font-medium whitespace-nowrap">
                          ✓ spec attached
                        </span>
                      )}
                    </div>
                  )}
                  {soapCapableDeps.includes(dep.id) && (
                    <div className="mt-3 pt-3 border-t border-outline-variant/60 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setSoapWizardDepId(dep.id)}
                        className="flex items-center gap-1.5 text-[11px] font-bold py-1.5 px-3 rounded-lg bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-all active:scale-95"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>hub</span>
                        {soapByDep[dep.id] ? 'Edit SOAP services…' : 'Generate from WSDL…'}
                      </button>
                      {soapByDep[dep.id] && (
                        <span className="text-[10px] text-secondary font-medium whitespace-nowrap">
                          ✓ WSDL attached
                        </span>
                      )}
                    </div>
                  )}
                  {eventsCapableDeps.includes(dep.id) && (
                    <div className="mt-3 pt-3 border-t border-outline-variant/60 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setEventsWizardDepId(dep.id)}
                        className="flex items-center gap-1.5 text-[11px] font-bold py-1.5 px-3 rounded-lg bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-all active:scale-95"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>cell_tower</span>
                        {eventsByDep[dep.id] ? 'Edit events…' : 'Generate from AsyncAPI…'}
                      </button>
                      {eventsByDep[dep.id] && (
                        <span className="text-[10px] text-secondary font-medium whitespace-nowrap">
                          ✓ document attached
                        </span>
                      )}
                    </div>
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
                  <h4 className="text-sm font-bold text-on-surface mb-1">Your cart is empty</h4>
                  <p className="text-xs text-secondary max-w-[220px]">
                    Tick dependencies in the catalog, or press{' '}
                    <kbd className="px-1.5 py-0.5 rounded border border-outline-variant bg-surface-container font-mono text-[10px] text-on-surface">/</kbd>{' '}
                    and type a name.
                  </p>
                  <button
                    type="button"
                    onClick={focusSearch}
                    className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-outline-variant text-secondary hover:text-primary hover:border-primary/50 transition-colors"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">search</span>
                    Search dependencies
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
            <h3 className="text-xs font-bold uppercase tracking-widest">Explore Dependencies</h3>
          </div>

          {/* Aggregated recommendations */}
          <SuggestionStrip
            suggestions={suggestions}
            onAdd={(depId) => onChange([...selected, depId])}
          />

          {/* Search */}
          <div className="relative mb-6 group" data-tour="dep-search">
            <span
              className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary transition-transform group-focus-within:scale-110"
              style={{ fontSize: '20px' }}
            >
              search
            </span>
            <input
              ref={searchRef}
              type="search"
              aria-label="Search dependencies"
              aria-keyshortcuts="/"
              className="w-full bg-surface-container-highest border border-outline-variant rounded-xl pl-12 pr-12 py-3.5 text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all placeholder-secondary/70 shadow-inner"
              placeholder="Search Web, Security, JPA..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={onSearchKeyDown}
              data-dep-search
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded border border-outline-variant text-[10px] font-bold text-secondary bg-surface-container">
              /
            </div>
          </div>

          {/* Grouped checkboxes */}
          <div ref={listRef} onKeyDown={onListKeyDown} className="flex-grow space-y-6 overflow-y-auto pr-2 tutorial-scroll pb-20">
            {!deferredSearch.trim() && quickPicks.length > 0 && (
              <div className="space-y-2" data-quick-picks>
                <div className="text-[10px] font-bold uppercase tracking-widest text-secondary">Quick picks</div>
                <div className="flex flex-wrap gap-1.5">
                  {quickPicks.map(({ dep, kind }) => {
                    const picked = selectedSet.has(dep.id)
                    return (
                      <button
                        key={dep.id}
                        type="button"
                        onClick={() => toggle(dep.id)}
                        aria-pressed={picked}
                        title={`${PICK_TITLE[kind]} — ${dep.description ?? dep.name}`}
                        className={`inline-flex items-center gap-1 pl-2 pr-2.5 py-1 rounded-full border text-[11px] font-semibold transition-colors ${
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
                        className={`material-symbols-outlined transition-transform ${collapsed ? '-rotate-90' : 'rotate-0'}`}
                        style={{ fontSize: '14px' }}
                      >
                        expand_more
                      </span>
                      {group.name}
                      {selectedCount > 0 && (
                        <span className="ml-1 px-1.5 py-px rounded-full bg-primary/15 text-primary text-[9px] font-bold">
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
            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
                <span className="material-symbols-outlined text-secondary opacity-30 mb-3" style={{ fontSize: '48px' }}>search_off</span>
                <p className="text-sm font-medium text-on-surface">No results found</p>
                <p className="text-xs text-secondary mt-1 max-w-[200px]">We couldn't find any dependencies matching &ldquo;{search}&rdquo;</p>
                <button
                  type="button"
                  onClick={() => { setSearch(''); focusSearch() }}
                  className="mt-3 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-outline-variant text-secondary hover:text-primary hover:border-primary/50 transition-colors"
                >
                  Clear search
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
      <Suspense fallback={null}>
      {wizardDep && (
        <SqlWizardDrawer
          isOpen={wizardDepId !== null}
          onClose={() => setWizardDepId(null)}
          depId={wizardDep.id}
          depName={wizardDep.name}
          dialectName={sqlDialects[wizardDep.id] ?? ''}
          initial={sqlByDep[wizardDep.id] ?? null}
          selected={selected}
          onSave={entry => {
            onSqlByDepChange(wizardDep.id, entry)
            if (entry) {
              const missing = requiredSqlDeps(entry.apiMode ?? 'NONE')
                .filter(d => !isSqlDepSatisfied(d, selected))
              if (missing.length) onChange([...selected, ...missing])
            }
          }}
          parseError={sqlParseError && sqlParseError.dep === wizardDep.id ? sqlParseError : null}
        />
      )}
      {openApiWizardDep && (
        <OpenApiWizardDrawer
          isOpen={openApiWizardDepId !== null}
          onClose={() => setOpenApiWizardDepId(null)}
          depId={openApiWizardDep.id}
          depName={openApiWizardDep.name}
          initial={openApiByDep[openApiWizardDep.id] ?? null}
          onSave={entry => onOpenApiByDepChange(openApiWizardDep.id, entry)}
        />
      )}
      {soapWizardDep && (
        <SoapWizardDrawer
          isOpen={soapWizardDepId !== null}
          onClose={() => setSoapWizardDepId(null)}
          depId={soapWizardDep.id}
          depName={soapWizardDep.name}
          initial={soapByDep[soapWizardDep.id] ?? null}
          onSave={entry => onSoapByDepChange(soapWizardDep.id, entry)}
        />
      )}
      {eventsWizardDep && (
        <EventsWizardDrawer
          isOpen={eventsWizardDepId !== null}
          onClose={() => setEventsWizardDepId(null)}
          depId={eventsWizardDep.id}
          depName={eventsWizardDep.name}
          initial={eventsByDep[eventsWizardDep.id] ?? null}
          onSave={entry => onEventsByDepChange?.(eventsWizardDep.id, entry)}
        />
      )}
      </Suspense>
    </>
  )
}
