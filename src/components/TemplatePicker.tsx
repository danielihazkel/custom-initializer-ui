import type { StarterTemplate } from '../types'

interface TemplatePickerProps {
  templates: StarterTemplate[]
  activeTemplateId: string | null
  onSelect: (template: StarterTemplate | null) => void
  onCompare?: () => void
}

export function TemplatePicker({ templates, activeTemplateId, onSelect, onCompare }: TemplatePickerProps) {
  if (templates.length === 0) return null

  return (
    <div className="mb-6">
      <h2 className="text-xs font-bold uppercase tracking-widest text-secondary mb-3">Quick Start</h2>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {/* Blank project card */}
        <button
          onClick={() => onSelect(null)}
          className={`flex-shrink-0 w-52 rounded-lg border-2 p-4 text-left transition-all hover:shadow-md ${
            activeTemplateId === null
              ? 'border-primary bg-primary/5 shadow-sm'
              : 'border-outline-variant bg-surface-container hover:border-outline'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-secondary" style={{ fontSize: '20px' }}>
              draft
            </span>
            <span className="font-semibold text-sm text-on-surface">Blank Project</span>
          </div>
          <p className="text-xs text-secondary leading-relaxed">
            Start from scratch with no dependencies
          </p>
        </button>

        {/* Template cards */}
        {templates.map(t => (
          <button
            key={t.id}
            onClick={() => onSelect(activeTemplateId === t.id ? null : t)}
            className={`flex-shrink-0 w-52 rounded-lg border-2 p-4 text-left transition-all hover:shadow-md ${
              activeTemplateId === t.id
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-outline-variant bg-surface-container hover:border-outline'
            }`}
            style={t.color ? { borderLeftColor: t.color, borderLeftWidth: '4px' } : undefined}
          >
            <div className="flex items-center gap-2 mb-2">
              {t.icon && (
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: '20px', color: t.color ?? undefined }}
                >
                  {t.icon}
                </span>
              )}
              <span className="font-semibold text-sm text-on-surface">{t.name}</span>
            </div>
            <p className="text-xs text-secondary leading-relaxed line-clamp-2">
              {t.description}
            </p>
            <div className="mt-2">
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-secondary bg-surface-container-high px-1.5 py-0.5 rounded">
                <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>widgets</span>
                {t.dependencies.length} deps
              </span>
            </div>
          </button>
        ))}
      </div>
      {onCompare && templates.length >= 2 && (
        <button
          onClick={onCompare}
          className="mt-2 flex items-center gap-1 text-xs text-secondary hover:text-on-surface transition-colors duration-200"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>compare_arrows</span>
          Compare templates
        </button>
      )}
    </div>
  )
}
