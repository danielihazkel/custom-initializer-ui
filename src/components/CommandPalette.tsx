import { useState, useEffect, useMemo, useRef } from 'react'
import type { InitializrMetadata, ProjectFormValues, StarterTemplate } from '../types'

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
}

type PaletteActionType = 'template' | 'dependency' | 'config'

interface PaletteItem {
  id: string
  type: PaletteActionType
  group: string
  title: string
  description?: string
  icon: string
  active?: boolean
  payload?: any
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
  onFormChange
}: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Build items array
  const allItems = useMemo(() => {
    const items: PaletteItem[] = []

    // 1. Templates
    templates.forEach(t => {
      items.push({
        id: `tpl-${t.id}`,
        type: 'template',
        group: 'Starter Templates',
        title: t.name,
        description: t.description,
        icon: t.icon && t.icon !== '' ? t.icon : 'rocket_launch',
        payload: t
      })
    })

    // 2. Dependencies
    if (metadata) {
      metadata.dependencies.values.forEach(group => {
        group.values.forEach(dep => {
          items.push({
            id: `dep-${dep.id}`,
            type: 'dependency',
            group: 'Dependencies',
            title: dep.name,
            description: dep.description,
            icon: 'extension',
            active: selectedDeps.includes(dep.id),
            payload: dep.id
          })
        })
      })
    }

    // 3. Configurations
    if (metadata) {
      const addConfigs = (field: any, groupName: string, icon: string, formKey: keyof ProjectFormValues) => {
        if (!field) return
        field.values.forEach((val: any) => {
          items.push({
            id: `cfg-${formKey}-${val.id}`,
            type: 'config',
            group: groupName,
            title: `Set ${groupName} to ${val.name}`,
            icon,
            active: form[formKey] === val.id,
            payload: { [formKey]: val.id }
          })
        })
      }
      
      addConfigs(metadata.language, 'Language', 'code', 'language')
      addConfigs(metadata.javaVersion, 'Java Version', 'coffee', 'javaVersion')
      addConfigs(metadata.bootVersion, 'Spring Boot Version', 'power', 'bootVersion')
      addConfigs(metadata.packaging, 'Packaging', 'inventory_2', 'packaging')
    }

    return items
  }, [metadata, templates, form, selectedDeps])

  // Filter items
  const filteredItems = useMemo(() => {
    if (!query.trim()) return allItems

    const q = query.toLowerCase()
    
    // Sort and score
    return allItems
      .map(item => {
        let score = -1
        const title = item.title.toLowerCase()
        const desc = item.description?.toLowerCase() || ''
        
        if (title === q) score = 100
        else if (title.startsWith(q)) score = 50
        else if (title.includes(q)) score = 10
        else if (desc.includes(q)) score = 1

        return { item, score }
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(x => x.item)
  }, [allItems, query])

  // Reset selection on query change
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Ensure selected item is in view
  useEffect(() => {
    if (listRef.current && isOpen) {
      const selectedEl = listRef.current.querySelector('[data-selected="true"]') as HTMLElement
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex, isOpen, filteredItems])

  // Click & Enter handling
  const handleSelect = (item: PaletteItem) => {
    if (item.type === 'template') {
      onSelectTemplate(item.payload)
      onClose()
    } else if (item.type === 'dependency') {
      onToggleDependency(item.payload)
    } else if (item.type === 'config') {
      onFormChange(item.payload)
      onClose()
    }
  }

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => (prev + 1) % Math.max(1, filteredItems.length))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filteredItems[selectedIndex]) {
          handleSelect(filteredItems[selectedIndex])
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, filteredItems, selectedIndex, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-background/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Search Modal */}
      <div className="relative w-full max-w-2xl bg-surface-container/90 backdrop-blur-xl border border-outline-variant rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[60vh] animate-fade-in-up origin-top">
        {/* Search Input Container */}
        <div className="flex items-center px-4 border-b border-outline-variant/50">
          <span className="material-symbols-outlined text-secondary text-2xl ml-2">search</span>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none outline-none py-5 px-4 text-lg text-on-surface placeholder:text-on-surface-variant font-medium h-full"
            placeholder="Search dependencies, templates, or config... (e.g. 'web', 'kotlin')"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <div className="flex items-center gap-1.5 opacity-50 text-[10px] font-bold tracking-widest text-on-surface-variant hidden sm:flex">
            <kbd className="px-2 py-1 rounded bg-surface border border-outline-variant">ESC</kbd>
            <span>TO CLOSE</span>
          </div>
        </div>

        {/* Results List */}
        <div 
          ref={listRef}
          className="overflow-y-auto overflow-x-hidden py-2"
        >
          {filteredItems.length === 0 ? (
            <div className="py-12 px-6 text-center">
              <span className="material-symbols-outlined text-4xl text-on-surface-variant/50 mb-3 block">search_off</span>
              <p className="text-secondary font-medium">No results found for "{query}"</p>
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const isSelected = index === selectedIndex
              return (
                <div
                  key={item.id}
                  data-selected={isSelected}
                  className={`
                    flex items-center px-4 py-3 mx-2 my-0.5 rounded-lg cursor-pointer transition-colors
                    ${isSelected ? 'bg-primary/10 border-l-2 border-primary' : 'hover:bg-on-surface/5 border-l-2 border-transparent'}
                  `}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-secondary'}`}>
                    <span 
                      className={`material-symbols-outlined text-[18px] ${item.icon === 'star' || item.icon.startsWith('rocket') ? '!text-lg' : ''} ${item.icon === 'bug_report' ? '!text-red-500' : ''}`}
                    >
                      {item.icon}
                    </span>
                  </div>
                  <div className="ml-3 flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className={`text-sm tracking-tight truncate flex-1 ${isSelected ? 'font-bold text-on-surface' : 'font-medium text-on-surface/90'}`}>
                        {item.title}
                      </h4>
                      <span className="text-[10px] font-bold tracking-widest uppercase text-on-surface-variant/50 shrink-0 ml-4 hidden sm:block">
                        {item.group}
                      </span>
                    </div>
                    {item.description && (
                      <p className="text-xs text-on-surface-variant truncate mt-0.5">
                        {item.description}
                      </p>
                    )}
                  </div>
                  
                  {/* Action Icon / Status */}
                  <div className="ml-4 shrink-0 flex items-center justify-end w-8">
                    {item.type === 'dependency' && item.active && (
                      <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>
                    )}
                    {item.type === 'config' && item.active && (
                      <span className="material-symbols-outlined text-tertiary text-[20px]">radio_button_checked</span>
                    )}
                    {item.type === 'template' && (
                      <span className={`material-symbols-outlined text-[18px] ${isSelected ? 'text-primary' : 'opacity-0'}`}>arrow_forward</span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
