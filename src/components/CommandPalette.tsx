import { useState, useEffect, useMemo, useRef } from 'react'
import type { InitializrMetadata, ProjectFormValues, StarterTemplate } from '../types'
import type { PaletteAction } from '../commands'
import { fuzzyMatch, substringMatch } from '../utils/fuzzy'
import { useModal } from '../hooks/useModal'
import { Highlight } from './shared/Highlight'
import { t, useLang } from '../i18n'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  metadata: InitializrMetadata | null
  templates: StarterTemplate[]
  form: ProjectFormValues
  selectedDeps: string[]
  onSelectTemplate: (template: StarterTemplate | null) => void
  onToggleDependency: (depId: string) => void
  onFormChange: (updates: Partial<ProjectFormValues>) => void
  /** Registered actions (see commands.ts) — listed first, run on select, close the palette. */
  actions?: PaletteAction[]
}

type PaletteActionType = 'template' | 'dependency' | 'config' | 'action'

interface PaletteItem {
  id: string
  type: PaletteActionType
  group: string
  title: string
  description?: string
  icon: string
  shortcut?: string
  payload?: unknown
}

interface Row {
  item: PaletteItem
  /** Matched stretches of the title, when the query hit it. */
  ranges?: [number, number][]
  /** Heading drawn above this row (the empty-query view is grouped; results are ranked). */
  heading?: string
}

/** Rows drawn at once. The catalog alone is hundreds of dependencies; nobody reads past a screen
 *  or two, and rendering them all made the palette slow to open. Typing narrows it. */
export const MAX_ROWS = 50
const RECENT_KEY = 'palette:recent'
const MAX_RECENT = 8

function readRecent(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as unknown
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string').slice(0, MAX_RECENT) : []
  } catch {
    return []
  }
}

function rememberRecent(id: string): void {
  try {
    const next = [id, ...readRecent().filter(x => x !== id)].slice(0, MAX_RECENT)
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch { /* private mode: the list simply does not persist */ }
}

export function CommandPalette({
  isOpen,
  onClose,
  metadata,
  templates,
  form,
  selectedDeps,
  onSelectTemplate,
  onToggleDependency,
  onFormChange,
  actions = [],
}: CommandPaletteProps) {
  const lang = useLang()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  // Read once per opening: the order must not jump while the palette is in use.
  const [recent] = useState(readRecent)
  const dialogRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Escape closes, Tab stays in the palette, and focus goes back to where it was.
  useModal(dialogRef, { onClose, active: isOpen, lockScroll: false })

  // Everything the palette can do. This depends only on the (rarely changing) metadata,
  // templates and registered actions — a row's "active" mark is derived at render time, so
  // typing in the project form does not rebuild the list.
  const allItems = useMemo(() => {
    const items: PaletteItem[] = []

    actions.forEach(a => {
      items.push({
        id: `act-${a.id}`,
        type: 'action',
        group: a.group,
        title: a.title,
        description: a.description,
        icon: a.icon,
        shortcut: a.shortcut,
        payload: a,
      })
    })

    templates.forEach(tpl => {
      items.push({
        id: `tpl-${tpl.id}`,
        type: 'template',
        group: t('Starter Templates'),
        title: tpl.name,
        description: tpl.description,
        icon: tpl.icon && tpl.icon !== '' ? tpl.icon : 'rocket_launch',
        payload: tpl,
      })
    })

    if (metadata) {
      metadata.dependencies.values.forEach(group => {
        group.values.forEach(dep => {
          items.push({
            id: `dep-${dep.id}`,
            type: 'dependency',
            group: t('Dependencies'),
            title: dep.name,
            description: dep.description,
            icon: 'extension',
            payload: dep.id,
          })
        })
      })

      const addConfigs = (
        field: { values: { id: string; name: string }[] } | undefined,
        groupName: string,
        icon: string,
        formKey: keyof ProjectFormValues,
      ) => {
        if (!field) return
        field.values.forEach(val => {
          items.push({
            id: `cfg-${formKey}-${val.id}`,
            type: 'config',
            group: groupName,
            title: t('Set {setting} to {value}', { setting: groupName, value: val.name }),
            icon,
            payload: { [formKey]: val.id },
          })
        })
      }

      addConfigs(metadata.language, t('Language'), 'code', 'language')
      addConfigs(metadata.javaVersion, t('Java Version'), 'coffee', 'javaVersion')
      addConfigs(metadata.bootVersion, t('Spring Boot Version'), 'power', 'bootVersion')
      addConfigs(metadata.packaging, t('Packaging'), 'inventory_2', 'packaging')
    }

    return items
    // `lang`: the group names and titles are translated, so a language switch rebuilds them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metadata, templates, actions, lang])

  const selectedSet = useMemo(() => new Set(selectedDeps), [selectedDeps])
  function isActive(item: PaletteItem): boolean {
    if (item.type === 'dependency') return selectedSet.has(item.payload as string)
    if (item.type === 'config') {
      const [key, value] = Object.entries(item.payload as Partial<ProjectFormValues>)[0] ?? []
      return key !== undefined && form[key as keyof ProjectFormValues] === value
    }
    return false
  }

  // No query: what was used last, then everything in its groups. A query: the best matches
  // first, whatever group they are in.
  const { rows, total } = useMemo((): { rows: Row[]; total: number } => {
    const q = query.trim()
    if (!q) {
      const byId = new Map(allItems.map(i => [i.id, i]))
      const recentItems = recent.map(id => byId.get(id)).filter((i): i is PaletteItem => i !== undefined)
      const recentIds = new Set(recentItems.map(i => i.id))
      const ordered: Row[] = [
        ...recentItems.map(item => ({ item, section: t('Recent') })),
        ...allItems.filter(i => !recentIds.has(i.id)).map(item => ({ item, section: item.group })),
      ].map((row, i, list) => ({
        item: row.item,
        heading: i === 0 || list[i - 1].section !== row.section ? row.section : undefined,
      }))
      return { rows: ordered.slice(0, MAX_ROWS), total: ordered.length }
    }

    const recentIds = new Set(recent)
    const scored: { row: Row; score: number }[] = []
    for (const item of allItems) {
      const inTitle = fuzzyMatch(q, item.title)
      // A description is prose: letters-in-order there would match almost anything.
      const inDescription = inTitle ? null : substringMatch(q, item.description ?? '')
      if (!inTitle && !inDescription) continue
      const base = inTitle ? inTitle.score : 5
      // Ties go to what was used before, then to actions over catalog entries.
      const score = base + (recentIds.has(item.id) ? 3 : 0) + (item.type === 'action' ? 1 : 0)
      scored.push({ row: { item, ranges: inTitle?.ranges }, score })
    }
    scored.sort((a, b) => b.score - a.score)
    return { rows: scored.slice(0, MAX_ROWS).map(s => s.row), total: scored.length }
    // `lang`: the Recent heading is translated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allItems, query, recent, lang])

  useEffect(() => { setSelectedIndex(0) }, [query])

  // Keep the selected row in view.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')
    el?.scrollIntoView?.({ block: 'nearest' })
  }, [selectedIndex, rows])

  function handleSelect(item: PaletteItem) {
    rememberRecent(item.id)
    if (item.type === 'action') {
      onClose()
      ;(item.payload as PaletteAction).run()
    } else if (item.type === 'template') {
      onSelectTemplate(item.payload as StarterTemplate)
      onClose()
    } else if (item.type === 'dependency') {
      // Stays open: picking several dependencies in a row is the common case.
      onToggleDependency(item.payload as string)
    } else if (item.type === 'config') {
      onFormChange(item.payload as Partial<ProjectFormValues>)
      onClose()
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev + 1) % Math.max(1, rows.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev - 1 + rows.length) % Math.max(1, rows.length))
    } else if (e.key === 'Home' && rows.length > 0) {
      e.preventDefault()
      setSelectedIndex(0)
    } else if (e.key === 'End' && rows.length > 0) {
      e.preventDefault()
      setSelectedIndex(rows.length - 1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const row = rows[selectedIndex]
      if (row) handleSelect(row.item)
    }
  }

  if (!isOpen) return null

  const actionsOnly = actions.length > 0 && !metadata
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-3">
      <div className="fixed inset-0 bg-background/60 backdrop-blur-sm" onClick={onClose} />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('Command palette')}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="relative w-full max-w-2xl bg-surface-container/90 backdrop-blur-xl border border-outline-variant rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[60vh] animate-fade-in-up origin-top outline-none"
      >
        <div className="flex items-center px-4 border-b border-outline-variant/50">
          <span className="material-symbols-outlined text-secondary text-2xl ms-2" aria-hidden="true">search</span>
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={rows[selectedIndex] ? `palette-opt-${selectedIndex}` : undefined}
            aria-autocomplete="list"
            aria-label={t('Search actions, dependencies, templates and settings')}
            autoComplete="off"
            spellCheck={false}
            className="flex-1 bg-transparent border-none outline-none py-5 px-4 text-lg text-on-surface placeholder:text-on-surface-variant font-medium h-full"
            placeholder={actionsOnly
              ? t("Search actions… (e.g. 'add entity', 'generate')")
              : t("Search actions, dependencies, templates… (e.g. 'web', 'generate')")}
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <div className="items-center gap-1.5 opacity-50 text-[10px] font-bold tracking-widest text-on-surface-variant hidden sm:flex">
            <kbd className="px-2 py-1 rounded bg-surface border border-outline-variant">ESC</kbd>
            <span>{t('TO CLOSE')}</span>
          </div>
        </div>

        <div ref={listRef} id="palette-list" role="listbox" aria-label={t('Results')} className="overflow-y-auto overflow-x-hidden py-2">
          {rows.length === 0 ? (
            <div className="py-12 px-6 text-center">
              <span className="material-symbols-outlined text-4xl text-on-surface-variant/50 mb-3 block" aria-hidden="true">search_off</span>
              <p className="text-secondary font-medium">{t('No results found for "{query}"', { query })}</p>
            </div>
          ) : (
            rows.map(({ item, ranges, heading }, index) => {
              const isSelected = index === selectedIndex
              const active = isActive(item)
              return (
                <div key={item.id}>
                  {heading && (
                    <div role="presentation" className="px-6 pt-3 pb-1 text-[10px] font-bold tracking-widest uppercase text-on-surface-variant/60">
                      {heading}
                    </div>
                  )}
                  <div
                    id={`palette-opt-${index}`}
                    role="option"
                    aria-selected={isSelected}
                    className={`flex items-center px-4 py-3 mx-2 my-0.5 rounded-lg cursor-pointer transition-colors border-s-2 ${
                      isSelected ? 'bg-primary/10 border-primary' : 'hover:bg-on-surface/5 border-transparent'
                    }`}
                    onClick={() => handleSelect(item)}
                    onMouseMove={() => { if (!isSelected) setSelectedIndex(index) }}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-secondary'}`}>
                      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">{item.icon}</span>
                    </div>
                    <div className="ms-3 flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className={`text-sm tracking-tight truncate flex-1 ${isSelected ? 'font-bold text-on-surface' : 'font-medium text-on-surface/90'}`}>
                          <Highlight text={item.title} ranges={ranges} />
                        </h4>
                        {/* Ranked results mix groups, so each row says its own; the grouped view has headings. */}
                        {!heading && query.trim() && (
                          <span className="text-[10px] font-bold tracking-widest uppercase text-on-surface-variant/50 shrink-0 ms-4 hidden sm:block">
                            {item.group}
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <p dir="auto" className="text-xs text-on-surface-variant truncate mt-0.5">{item.description}</p>
                      )}
                    </div>

                    <div className="ms-4 shrink-0 flex items-center justify-end gap-2 min-w-8">
                      {item.shortcut && (
                        <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded border border-outline-variant bg-surface-container-low font-mono text-[10px] text-secondary whitespace-nowrap">
                          {item.shortcut}
                        </kbd>
                      )}
                      {item.type === 'dependency' && active && (
                        <span className="material-symbols-outlined text-primary text-[20px]" aria-label={t('Selected')}>check_circle</span>
                      )}
                      {item.type === 'config' && active && (
                        <span className="material-symbols-outlined text-tertiary text-[20px]" aria-label={t('Current')}>radio_button_checked</span>
                      )}
                      {(item.type === 'template' || item.type === 'action') && !item.shortcut && (
                        <span className={`material-symbols-outlined flip-rtl text-[18px] ${isSelected ? 'text-primary' : 'opacity-0'}`} aria-hidden="true">arrow_forward</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {total > rows.length && (
          <div className="px-6 py-2 border-t border-outline-variant/50 text-[11px] text-on-surface-variant" data-palette-more>
            {t('Showing {shown} of {total} — type to narrow it down.', { shown: rows.length, total })}
          </div>
        )}
      </div>
    </div>
  )
}
