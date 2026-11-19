import type { StarterTemplate } from '../types'
import { t, tn } from '../i18n'

interface TemplatePickerProps {
  templates: StarterTemplate[]
  activeTemplateId: string | null
  onSelect: (template: StarterTemplate | null) => void
  onCompare?: () => void
}

export function TemplatePicker({ templates, activeTemplateId, onSelect, onCompare }: TemplatePickerProps) {
  if (templates.length === 0) return null

  return (
    <div data-tour="quick-start" className="mb-6">
      <h2 className="text-xs font-bold uppercase tracking-widest text-secondary mb-3">{t('Quick Start')}</h2>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {/* Blank project card */}
        <button
          onClick={() => onSelect(null)}
          className={`flex-shrink-0 w-52 rounded-lg border-2 p-4 text-start transition-all hover:shadow-md ${
            activeTemplateId === null
              ? 'border-primary bg-primary/5 shadow-sm'
              : 'border-outline-variant bg-surface-container hover:border-outline'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-secondary" style={{ fontSize: '20px' }}>
              draft
            </span>
            <span className="font-semibold text-sm text-on-surface">{t('Blank Project')}</span>
          </div>
          <p className="text-xs text-secondary leading-relaxed">
            {t('Start from scratch with no dependencies')}
          </p>
        </button>

        {/* Template cards */}
        {templates.map(tpl => (
          <button
            key={tpl.id}
            onClick={() => onSelect(activeTemplateId === tpl.id ? null : tpl)}
            className={`flex-shrink-0 w-52 rounded-lg border-2 p-4 text-start transition-all hover:shadow-md ${
              activeTemplateId === tpl.id
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-outline-variant bg-surface-container hover:border-outline'
            }`}
            style={tpl.color ? { borderInlineStartColor: tpl.color, borderInlineStartWidth: '4px' } : undefined}
          >
            <div className="flex items-center gap-2 mb-2">
              {tpl.icon && (
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: '20px', color: tpl.color ?? undefined }}
                >
                  {tpl.icon}
                </span>
              )}
              <span dir="auto" className="font-semibold text-sm text-on-surface">{tpl.name}</span>
            </div>
            <p dir="auto" className="text-xs text-secondary leading-relaxed line-clamp-2">
              {tpl.description}
            </p>
            <div className="mt-2">
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-secondary bg-surface-container-high px-1.5 py-0.5 rounded">
                <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>widgets</span>
                {tn(tpl.dependencies.length, '{n} dep', '{n} deps')}
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
          {t('Compare templates')}
        </button>
      )}
    </div>
  )
}
