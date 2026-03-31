import { useState } from 'react'
import type { StarterTemplate, InitializrMetadata, DependencyExtensions } from '../types'
import { useTemplateComparison } from '../hooks/useTemplateComparison'
import { TemplateCompareSelectionGrid } from './TemplateCompareSelectionGrid'
import { TemplateCompareTable } from './TemplateCompareTable'

interface Props {
  templates: StarterTemplate[]
  metadata: InitializrMetadata | null
  extensions: DependencyExtensions
  onClose: () => void
}

export function TemplateCompare({ templates, metadata, extensions, onClose }: Props) {
  const [phase, setPhase] = useState<'select' | 'compare'>('select')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const selectedTemplates = templates.filter(t => selectedIds.has(t.id))
  const comparison = useTemplateComparison(selectedTemplates, metadata, extensions)

  function toggleTemplate(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function handleConfirm() {
    if (selectedIds.size >= 2) setPhase('compare')
  }

  function handleBack() {
    setPhase('select')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-3">
      <div className="w-full h-full bg-surface-container border border-outline-variant rounded-2xl flex flex-col overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-outline-variant flex-shrink-0 bg-surface-container-high">
          <div className="flex items-center gap-3">
            {phase === 'compare' && (
              <button
                onClick={handleBack}
                className="p-1.5 rounded text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
                aria-label="Back to selection"
                title="Back to template selection"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>arrow_back</span>
              </button>
            )}
            <span className="material-symbols-outlined text-secondary" style={{ fontSize: '18px' }}>compare_arrows</span>
            <span className="text-sm font-bold text-on-surface">
              {phase === 'select' ? 'Compare Templates' : (
                <span className="flex items-center gap-2">
                  Compare Templates
                  <span className="text-xs font-normal text-secondary flex items-center gap-1">
                    {selectedTemplates.map((t, i) => (
                      <span key={t.id} className="flex items-center gap-1">
                        {i > 0 && <span className="text-outline-variant">vs</span>}
                        {t.icon && (
                          <span className="material-symbols-outlined" style={{ fontSize: '13px', color: t.color ?? undefined }}>{t.icon}</span>
                        )}
                        {t.name}
                      </span>
                    ))}
                  </span>
                </span>
              )}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
            aria-label="Close"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden">
          {phase === 'select' ? (
            <TemplateCompareSelectionGrid
              templates={templates}
              selectedIds={selectedIds}
              onToggle={toggleTemplate}
              onConfirm={handleConfirm}
            />
          ) : (
            <TemplateCompareTable
              templates={selectedTemplates}
              comparison={comparison}
            />
          )}
        </div>
      </div>
    </div>
  )
}
