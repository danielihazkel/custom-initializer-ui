import { useState } from 'react'
import type { StarterTemplate } from '../types'
import type { ComparisonResult } from '../hooks/useTemplateComparison'

type Filter = 'all' | 'shared' | 'differences'

interface Props {
  templates: StarterTemplate[]
  comparison: ComparisonResult
}

export function TemplateCompareTable({ templates, comparison }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  function toggleGroup(group: string) {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(group)) next.delete(group); else next.add(group)
      return next
    })
  }

  const filteredDeps = comparison.dependencies.filter(d => {
    if (filter === 'shared') return d.shared
    if (filter === 'differences') return !d.shared
    return true
  })

  // Group deps
  const groups: { name: string; deps: typeof filteredDeps }[] = []
  const groupOrder: string[] = []
  const groupMap = new Map<string, typeof filteredDeps>()
  for (const dep of filteredDeps) {
    if (!groupMap.has(dep.groupName)) {
      groupMap.set(dep.groupName, [])
      groupOrder.push(dep.groupName)
    }
    groupMap.get(dep.groupName)!.push(dep)
  }
  for (const name of groupOrder) {
    groups.push({ name, deps: groupMap.get(name)! })
  }

  const colCount = templates.length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Filter bar + summary */}
      <div className="px-6 py-3 border-b border-outline-variant flex-shrink-0 flex items-center justify-between gap-4 flex-wrap bg-surface-container-low">
        <div className="flex items-center gap-1 bg-surface-container rounded-lg p-1">
          {(['all', 'shared', 'differences'] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded text-xs font-medium transition-all capitalize ${
                filter === f
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-secondary hover:text-on-surface'
              }`}
            >
              {f === 'all' && `All (${comparison.dependencies.length})`}
              {f === 'shared' && `Shared (${comparison.sharedCount})`}
              {f === 'differences' && `Differences (${comparison.differenceCount})`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4 text-[11px] text-secondary">
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-tertiary" style={{ fontSize: '14px' }}>check_circle</span>
            Shared by all
          </span>
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: '14px' }}>check_circle</span>
            Template-specific
          </span>
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-secondary/30" style={{ fontSize: '14px' }}>horizontal_rule</span>
            Not included
          </span>
        </div>
      </div>

      {/* Scrollable comparison table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm min-w-[600px]">
          {/* Template header columns */}
          <thead className="sticky top-0 z-10">
            <tr className="bg-surface-container-high border-b border-outline-variant">
              <th className="sticky left-0 z-20 bg-surface-container-high w-48 min-w-[160px] px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-secondary border-r border-outline-variant">
                Dependency
              </th>
              {templates.map(t => (
                <th
                  key={t.id}
                  className="px-4 py-3 text-left border-l border-outline-variant"
                  style={{ borderTopColor: t.color ?? undefined, borderTopWidth: '3px' }}
                >
                  <div className="flex items-center gap-2">
                    {t.icon && (
                      <span
                        className="material-symbols-outlined flex-shrink-0"
                        style={{ fontSize: '18px', color: t.color ?? undefined }}
                      >
                        {t.icon}
                      </span>
                    )}
                    <div>
                      <div className="font-bold text-on-surface text-sm leading-tight">{t.name}</div>
                      <div className="text-[11px] text-secondary font-normal mt-0.5 line-clamp-1">{t.description}</div>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {/* Settings section */}
            <tr className="bg-surface-container/50">
              <td
                colSpan={colCount + 1}
                className="sticky left-0 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-secondary border-b border-outline-variant"
              >
                Settings
              </td>
            </tr>
            {comparison.settings.map(s => (
              <tr key={s.field} className="border-b border-outline-variant/50 hover:bg-surface-container/30 transition-colors">
                <td className="sticky left-0 z-10 bg-surface-container px-4 py-2.5 text-xs font-medium text-on-surface-variant border-r border-outline-variant">
                  {s.field}
                </td>
                {s.values.map((val, i) => (
                  <td
                    key={i}
                    className={`px-4 py-2.5 text-xs border-l border-outline-variant/50 ${
                      !s.allSame ? 'font-semibold text-on-surface' : 'text-secondary'
                    }`}
                  >
                    {val ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${
                        !s.allSame
                          ? 'bg-tertiary/10 text-tertiary font-semibold'
                          : 'text-secondary'
                      }`}>
                        {val}
                      </span>
                    ) : (
                      <span className="text-secondary/40">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}

            {/* Dependency groups */}
            {groups.length === 0 ? (
              <tr>
                <td colSpan={colCount + 1} className="px-4 py-8 text-center text-sm text-secondary">
                  No dependencies match the current filter.
                </td>
              </tr>
            ) : (
              groups.map(group => (
                <>
                  {/* Group header */}
                  <tr
                    key={`group-${group.name}`}
                    className="bg-surface-container/50 cursor-pointer select-none"
                    onClick={() => toggleGroup(group.name)}
                  >
                    <td
                      colSpan={colCount + 1}
                      className="px-4 py-2 border-b border-outline-variant"
                    >
                      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-secondary">
                        <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                          {collapsedGroups.has(group.name) ? 'chevron_right' : 'expand_more'}
                        </span>
                        {group.name}
                        <span className="ml-1 text-secondary/60 normal-case font-normal tracking-normal">
                          ({group.deps.length})
                        </span>
                      </div>
                    </td>
                  </tr>

                  {!collapsedGroups.has(group.name) && group.deps.map(dep => (
                    <>
                      <tr
                        key={dep.depId}
                        className={`border-b border-outline-variant/50 hover:bg-surface-container/20 transition-colors ${
                          dep.shared ? 'bg-tertiary/5' : ''
                        }`}
                      >
                        <td className="sticky left-0 z-10 bg-inherit px-4 py-2.5 border-r border-outline-variant">
                          <div className="text-xs font-semibold text-on-surface">{dep.depName}</div>
                          {dep.depDescription && (
                            <div className="text-[11px] text-secondary leading-tight mt-0.5 line-clamp-1 max-w-[140px]">
                              {dep.depDescription}
                            </div>
                          )}
                        </td>
                        {dep.presence.map((present, i) => (
                          <td
                            key={i}
                            className="px-4 py-2.5 border-l border-outline-variant/50 text-center"
                          >
                            {present ? (
                              <span
                                className={`material-symbols-outlined ${dep.shared ? 'text-tertiary' : 'text-primary'}`}
                                style={{ fontSize: '18px' }}
                              >
                                check_circle
                              </span>
                            ) : (
                              <span
                                className="material-symbols-outlined text-secondary/25"
                                style={{ fontSize: '18px' }}
                              >
                                horizontal_rule
                              </span>
                            )}
                          </td>
                        ))}
                      </tr>

                      {/* Sub-option rows */}
                      {dep.subOptions.map(opt => (
                        <tr
                          key={`${dep.depId}-${opt.optId}`}
                          className={`border-b border-outline-variant/30 text-[11px] ${dep.shared ? 'bg-tertiary/5' : ''}`}
                        >
                          <td className="sticky left-0 z-10 bg-inherit pl-8 pr-4 py-1.5 border-r border-outline-variant">
                            <div className="flex items-center gap-1 text-secondary">
                              <span className="material-symbols-outlined text-secondary/40" style={{ fontSize: '11px' }}>subdirectory_arrow_right</span>
                              {opt.optLabel}
                            </div>
                          </td>
                          {opt.presence.map((present, i) => (
                            <td
                              key={i}
                              className="px-4 py-1.5 border-l border-outline-variant/30 text-center"
                            >
                              {present ? (
                                <span className="material-symbols-outlined text-primary/60" style={{ fontSize: '14px' }}>check</span>
                              ) : (
                                <span className="material-symbols-outlined text-secondary/20" style={{ fontSize: '14px' }}>remove</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </>
                  ))}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
