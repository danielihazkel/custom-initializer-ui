import { useState, useMemo, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { DependencySelectorProps, DependencyGroup, MetadataOption } from '../types'
import { SqlWizardDrawer } from './SqlWizardDrawer'

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
}: DependencySelectorProps) {
  const [search, setSearch] = useState<string>('')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [wizardDepId, setWizardDepId] = useState<string | null>(null)

  const toggleGroup = useCallback((name: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }, [])

  const isCollapsed = (name: string) => !search.trim() && collapsedGroups.has(name)

  const groups = useMemo<DependencyGroup[]>(() => {
    if (!metadata?.dependencies?.values) return []
    return metadata.dependencies.values
  }, [metadata])

  const allDeps = useMemo<MetadataOption[]>(() => groups.flatMap(g => g.values ?? []), [groups])

  const filtered = useMemo<DependencyGroup[]>(() => {
    if (!search.trim()) return groups
    const q = search.toLowerCase()
    return groups
      .map(group => ({
        ...group,
        values: (group.values ?? []).filter(
          d => d.name.toLowerCase().includes(q) || (d.description ?? '').toLowerCase().includes(q)
        )
      }))
      .filter(g => g.values.length > 0)
  }, [groups, search])

  function toggle(depId: string): void {
    if (selected.includes(depId)) {
      onChange(selected.filter(id => id !== depId))
    } else {
      onChange([...selected, depId])
    }
  }

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

  const selectedDeps = allDeps.filter(d => selected.includes(d.id))

  const warnings = useMemo(() => {
    const conflicts: { source: string; target: string; desc: string }[] = []
    const requires: { source: string; target: string; desc: string }[] = []
    const recommends: { source: string; target: string; desc: string }[] = []
    const depName = (id: string) => allDeps.find(d => d.id === id)?.name ?? id
    for (const rule of compatibilityRules) {
      if (!selected.includes(rule.sourceDepId)) continue
      if (rule.relationType === 'CONFLICTS' && selected.includes(rule.targetDepId)) {
        conflicts.push({ source: rule.sourceDepId, target: rule.targetDepId, desc: rule.description ?? `${depName(rule.sourceDepId)} conflicts with ${depName(rule.targetDepId)}` })
      }
      if (rule.relationType === 'REQUIRES' && !selected.includes(rule.targetDepId)) {
        requires.push({ source: rule.sourceDepId, target: rule.targetDepId, desc: rule.description ?? `${depName(rule.sourceDepId)} requires ${depName(rule.targetDepId)}` })
      }
      if (rule.relationType === 'RECOMMENDS' && !selected.includes(rule.targetDepId)) {
        recommends.push({ source: rule.sourceDepId, target: rule.targetDepId, desc: rule.description ?? `${depName(rule.sourceDepId)} recommends ${depName(rule.targetDepId)}` })
      }
    }
    return { conflicts, requires, recommends }
  }, [selected, compatibilityRules, allDeps])

  const wizardDep = wizardDepId ? allDeps.find(d => d.id === wizardDepId) : null

  return (
    <>
    <div className="grid grid-cols-2 gap-6 sticky top-20" style={{ height: 'calc(100vh - 12rem)' }}>

      {/* Panel 1: Selected Dependencies */}
      <div className="glass-panel rounded-2xl p-6 flex flex-col overflow-hidden text-on-surface">
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-outline-variant/50">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: '20px' }}>shopping_cart</span>
            <h3 className="text-xs font-bold uppercase tracking-widest">Selected Dependencies</h3>
          </div>
          <span className="text-xs font-bold py-1 px-3 bg-primary/10 text-primary rounded-full">{selected.length}</span>
        </div>

        {/* Single scroll container — warnings + primary DB selector + deps list */}
        <div className="flex flex-col gap-3 flex-grow overflow-y-auto pr-2 tutorial-scroll">

          {/* Compatibility warnings */}
          <AnimatePresence>
            {(warnings.conflicts.length > 0 || warnings.requires.length > 0 || warnings.recommends.length > 0) && (
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
                  <div key={`req-${i}`} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 text-xs text-yellow-600 dark:text-yellow-400 shadow-sm">
                    <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '16px' }}>error</span>
                    <span className="flex-1 leading-relaxed font-medium">{w.desc}</span>
                    <button
                      type="button"
                      onClick={() => onChange([...selected, w.target])}
                      className="flex-shrink-0 text-[10px] font-bold px-3 py-1 rounded bg-yellow-500 text-white dark:text-gray-900 shadow-sm transition-transform active:scale-95 hover:brightness-110"
                    >
                      ADD IT
                    </button>
                  </div>
                ))}
                {warnings.recommends.map((w, i) => (
                  <div key={`rec-${i}`} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-primary/20 bg-primary/10 text-xs text-primary shadow-sm">
                    <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '16px' }}>info</span>
                    <span className="flex-1 leading-relaxed font-medium">{w.desc}</span>
                    <button
                      type="button"
                      onClick={() => onChange([...selected, w.target])}
                      className="flex-shrink-0 text-[10px] font-bold px-3 py-1 rounded bg-primary text-white shadow-sm transition-transform active:scale-95 hover:brightness-110"
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
                          {(selectedOptions[dep.id] ?? []).includes(opt.id) && <span className="material-symbols-outlined font-bold text-background" style={{ fontSize: '12px' }}>check</span>}
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
                <p className="text-xs text-secondary max-w-[200px]">Search and add dependencies from the panel on the right.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Panel 2: All Available Dependencies */}
      <div className="glass-panel rounded-2xl p-6 flex flex-col overflow-hidden text-on-surface">
        <div className="flex items-center gap-2 mb-4 pb-4 border-b border-outline-variant/50">
          <span className="material-symbols-outlined text-tertiary" style={{ fontSize: '20px' }}>explore</span>
          <h3 className="text-xs font-bold uppercase tracking-widest">Explore Dependencies</h3>
        </div>

        {/* Search */}
        <div className="relative mb-6 group">
          <span
            className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary transition-transform group-focus-within:scale-110"
            style={{ fontSize: '20px' }}
          >
            search
          </span>
          <input
            type="search"
            className="w-full bg-surface-container-highest border border-outline-variant rounded-xl pl-12 pr-12 py-3.5 text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all placeholder-secondary/70 shadow-inner"
            placeholder="Search Web, Security, JPA..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded border border-outline-variant text-[10px] font-bold text-secondary bg-surface-container">
            /
          </div>
        </div>

        {/* Grouped checkboxes */}
        <div className="flex-grow space-y-6 overflow-y-auto pr-2 tutorial-scroll pb-20">
          <AnimatePresence>
            {filtered.map(group => {
              const collapsed = isCollapsed(group.name)
              const selectedCount = group.values.filter(d => selected.includes(d.id)).length
              const gridId = `dep-group-${group.name.replace(/\s+/g, '-').toLowerCase()}`
              return (
                <motion.div
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  key={group.name}
                  className="space-y-3"
                >
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.name)}
                    aria-expanded={!collapsed}
                    aria-controls={gridId}
                    className="w-full flex items-center gap-3 cursor-pointer group/header"
                  >
                    <div className="h-px flex-1 bg-outline-variant/50"></div>
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
                    <div className="h-px flex-1 bg-outline-variant/50"></div>
                  </button>
                  <AnimatePresence initial={false}>
                    {!collapsed && (
                      <motion.div
                        key="grid"
                        id={gridId}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div className="grid gap-2">
                          {group.values.map(dep => {
                            const isSelected = selected.includes(dep.id)
                            return (
                              <motion.label
                                layout
                                key={dep.id}
                                className={`flex items-start gap-4 p-4 rounded-xl border relative cursor-pointer overflow-hidden group transition-all duration-300
                          ${isSelected
                                    ? 'border-primary bg-primary/10 shadow-[0_4px_20px_rgba(139,92,246,0.1)]'
                                    : 'border-outline-variant bg-surface-container-high hover:border-primary/50 hover:bg-surface-container-highest'}`}
                              >
                                {isSelected && (
                                  <motion.div layoutId="active-indicator" className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                                )}
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggle(dep.id)}
                                  className="sr-only"
                                />
                                <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-all duration-300
                          ${isSelected
                                    ? 'bg-primary border-primary text-white shadow-[0_0_10px_rgba(139,92,246,0.5)]'
                                    : 'bg-surface-container-lowest border-secondary/40 group-hover:border-primary/50'}`}>
                                  {isSelected && <span className="material-symbols-outlined font-bold" style={{ fontSize: '14px' }}>check</span>}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-bold text-on-surface flex items-center flex-wrap gap-2">
                                    {dep.name}
                                    {dep.versionRange && (
                                      <span className="text-[9px] font-bold text-secondary bg-surface-container px-1.5 py-0.5 rounded-full border border-outline-variant/50">
                                        Boot {dep.versionRange}
                                      </span>
                                    )}
                                  </div>
                                  {dep.description && (
                                    <div className="text-xs text-on-surface-variant leading-relaxed mt-1">{dep.description}</div>
                                  )}
                                </div>
                              </motion.label>
                            )
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </AnimatePresence>
          {filtered.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-16 text-center">
              <span className="material-symbols-outlined text-secondary opacity-30 mb-3" style={{ fontSize: '48px' }}>search_off</span>
              <p className="text-sm font-medium text-on-surface">No results found</p>
              <p className="text-xs text-secondary mt-1 max-w-[200px]">We couldn't find any dependencies matching &ldquo;{search}&rdquo;</p>
            </motion.div>
          )}
        </div>
      </div>

    </div>
    {wizardDep && (
      <SqlWizardDrawer
        isOpen={wizardDepId !== null}
        onClose={() => setWizardDepId(null)}
        depId={wizardDep.id}
        depName={wizardDep.name}
        dialectName={sqlDialects[wizardDep.id] ?? ''}
        initial={sqlByDep[wizardDep.id] ?? null}
        onSave={entry => onSqlByDepChange(wizardDep.id, entry)}
      />
    )}
    </>
  )
}
