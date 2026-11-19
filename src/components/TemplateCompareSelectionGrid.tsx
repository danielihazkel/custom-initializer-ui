import type { StarterTemplate } from '../types'
import { t, tn } from '../i18n'

interface Props {
  templates: StarterTemplate[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
  onConfirm: () => void
}

export function TemplateCompareSelectionGrid({ templates, selectedIds, onToggle, onConfirm }: Props) {
  const count = selectedIds.size
  const canConfirm = count >= 2
  const atMax = count >= 3

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-outline-variant flex-shrink-0">
        <p className="text-sm text-secondary">
          {t('Select 2 or 3 templates to compare side-by-side.')}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {templates.map(tpl => {
            const isSelected = selectedIds.has(tpl.id)
            const isDisabled = atMax && !isSelected

            return (
              <button
                key={tpl.id}
                onClick={() => !isDisabled && onToggle(tpl.id)}
                disabled={isDisabled}
                className={`relative rounded-xl border-2 p-4 text-start transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-md'
                    : isDisabled
                    ? 'border-outline-variant bg-surface-container opacity-40 cursor-not-allowed'
                    : 'border-outline-variant bg-surface-container hover:border-outline hover:shadow-sm cursor-pointer'
                }`}
                style={tpl.color && !isSelected ? { borderInlineStartColor: tpl.color, borderInlineStartWidth: '4px' } : undefined}
              >
                {/* Checkbox indicator */}
                <span
                  className={`absolute top-3 end-3 material-symbols-outlined transition-colors ${
                    isSelected ? 'text-primary' : 'text-secondary/30'
                  }`}
                  style={{ fontSize: '18px' }}
                >
                  {isSelected ? 'check_circle' : 'radio_button_unchecked'}
                </span>

                <div className="flex items-center gap-2 mb-2 pe-6">
                  {tpl.icon && (
                    <span
                      className="material-symbols-outlined flex-shrink-0"
                      style={{ fontSize: '20px', color: tpl.color ?? undefined }}
                    >
                      {tpl.icon}
                    </span>
                  )}
                  <span dir="auto" className="font-semibold text-sm text-on-surface leading-tight">{tpl.name}</span>
                </div>

                <p dir="auto" className="text-xs text-secondary leading-relaxed line-clamp-2 mb-3">
                  {tpl.description}
                </p>

                <div className="flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-secondary bg-surface-container-high px-1.5 py-0.5 rounded">
                    <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>widgets</span>
                    {tn(tpl.dependencies.length, '{n} dep', '{n} deps')}
                  </span>
                  {tpl.bootVersion && (
                    <span dir="ltr" className="inline-flex items-center gap-1 text-[10px] font-medium text-secondary bg-surface-container-high px-1.5 py-0.5 rounded">
                      Boot {tpl.bootVersion}
                    </span>
                  )}
                  {tpl.javaVersion && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-secondary bg-surface-container-high px-1.5 py-0.5 rounded">
                      Java {tpl.javaVersion}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="px-6 py-4 border-t border-outline-variant flex-shrink-0 flex items-center justify-between bg-surface-container-low">
        <span className="text-xs text-secondary">
          {count === 0 && t('Select at least 2 templates')}
          {count === 1 && t('Select 1 more template')}
          {count === 2 && t('Ready to compare — or add 1 more')}
          {count === 3 && t('Comparing 3 templates')}
        </span>
        <button
          onClick={onConfirm}
          disabled={!canConfirm}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all active:scale-95 ${
            canConfirm
              ? 'animated-gradient-btn shadow'
              : 'bg-surface-container-high text-secondary cursor-not-allowed opacity-50'
          }`}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>compare_arrows</span>
          {count >= 2 ? t('Compare {n} Templates', { n: count }) : t('Compare Templates')}
        </button>
      </div>
    </div>
  )
}
