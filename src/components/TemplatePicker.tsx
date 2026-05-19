import type { StarterTemplate } from '../types'

interface TemplatePickerProps {
  templates: StarterTemplate[]
  activeTemplateId: string | null
  onSelect: (template: StarterTemplate | null) => void
  onCompare?: () => void
  /** Use 2-col grid + smaller cards when embedded in a narrow column (e.g. Paired view). */
  compact?: boolean
}

interface CardProps {
  active: boolean
  icon: string
  iconColor?: string | null
  title: string
  description: string
  depCount: number
  onClick: () => void
  compact?: boolean
}

function QuickStartCard({ active, icon, iconColor, title, description, depCount, onClick, compact = false }: CardProps) {
  const toneColor = iconColor ?? 'var(--color-jewel-azure)'
  const activeGlow = `0 0 32px color-mix(in srgb, ${toneColor} 28%, transparent), inset 0 0 26px color-mix(in srgb, ${toneColor} 10%, transparent)`
  // Override the .glass-card 14px chamfer when compact so small cards don't look squished.
  const compactClip = 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)'
  return (
    <button
      onClick={onClick}
      className={`group glass-card relative text-left flex flex-col justify-between transition-transform duration-200 hover:-translate-y-0.5 ${
        active ? 'ring-1 ring-primary/40' : ''
      } ${compact ? 'p-4 min-h-[140px]' : 'p-6 min-h-[180px]'}`}
      style={{
        boxShadow: active ? activeGlow : undefined,
        ...(compact ? { clipPath: compactClip } : null),
      }}
    >
      {/* Corner brackets — only in the wide layout; too noisy at compact size */}
      {!compact && (
        <>
          <span aria-hidden className="absolute top-1.5 left-1.5 w-3.5 h-3.5 border-t border-l" style={{ borderColor: 'rgba(150, 195, 255, 0.55)' }} />
          <span aria-hidden className="absolute top-1.5 right-1.5 w-3.5 h-3.5 border-t border-r" style={{ borderColor: 'rgba(150, 195, 255, 0.55)' }} />
          <span aria-hidden className="absolute bottom-1.5 left-1.5 w-3.5 h-3.5 border-b border-l" style={{ borderColor: 'rgba(150, 195, 255, 0.55)' }} />
          <span aria-hidden className="absolute bottom-1.5 right-1.5 w-3.5 h-3.5 border-b border-r" style={{ borderColor: 'rgba(150, 195, 255, 0.55)' }} />
        </>
      )}

      <div className={compact ? 'space-y-2' : 'space-y-3'}>
        <span
          className="material-symbols-outlined block"
          style={{
            fontSize: compact ? '24px' : '32px',
            color: toneColor,
            filter: `drop-shadow(0 0 12px color-mix(in srgb, ${toneColor} 50%, transparent))`,
          }}
        >
          {icon}
        </span>
        <h3 className="display text-on-surface" style={{ fontSize: compact ? '18px' : '24px', fontWeight: 500 }}>
          {title}
        </h3>
        {!compact && (
          <p className="text-sm text-secondary leading-relaxed line-clamp-2">{description}</p>
        )}
      </div>

      <div className={compact ? 'mt-2' : 'mt-4'}>
        <span
          className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded-md"
          style={{
            background: `color-mix(in srgb, ${toneColor} 14%, transparent)`,
            color: toneColor,
            border: `1px solid color-mix(in srgb, ${toneColor} 35%, transparent)`,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>widgets</span>
          {depCount === 0 ? 'No deps' : `${depCount} deps`}
        </span>
      </div>
    </button>
  )
}

export function TemplatePicker({ templates, activeTemplateId, onSelect, onCompare, compact = false }: TemplatePickerProps) {
  // Compact (Paired view): 2-col grid, 2 rows of 2 (Blank + 3 templates), scroll for the rest.
  // Normal: 4-col grid (Blank + 3 templates), scroll for the rest.
  const visibleCount = 3
  const visibleTemplates = templates.slice(0, visibleCount)
  const overflowTemplates = templates.slice(visibleCount)

  return (
    <div className={compact ? 'mb-5' : 'mb-8'}>
      <h2 className="label-runic-sm text-primary mb-3 flex items-center gap-2">
        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>bolt</span>
        Quick Start
      </h2>
      <div className={`grid gap-3 ${compact ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5'}`}>
        <QuickStartCard
          active={activeTemplateId === null}
          icon="draft"
          iconColor="var(--color-jewel-violet)"
          title="Blank Project"
          description="Start from scratch with no dependencies."
          depCount={0}
          onClick={() => onSelect(null)}
          compact={compact}
        />
        {visibleTemplates.map(t => (
          <QuickStartCard
            key={t.id}
            active={activeTemplateId === t.id}
            icon={t.icon ?? 'category'}
            iconColor={t.color}
            title={t.name}
            description={t.description}
            depCount={t.dependencies.length}
            onClick={() => onSelect(activeTemplateId === t.id ? null : t)}
            compact={compact}
          />
        ))}
      </div>

      {overflowTemplates.length > 0 && (
        <div className={`flex gap-3 overflow-x-auto pb-2 ${compact ? 'mt-3' : 'mt-5'}`}>
          {overflowTemplates.map(t => (
            <div key={t.id} className={`flex-shrink-0 ${compact ? 'w-[180px]' : 'w-[260px]'}`}>
              <QuickStartCard
                active={activeTemplateId === t.id}
                icon={t.icon ?? 'category'}
                iconColor={t.color}
                title={t.name}
                description={t.description}
                depCount={t.dependencies.length}
                onClick={() => onSelect(activeTemplateId === t.id ? null : t)}
                compact={compact}
              />
            </div>
          ))}
        </div>
      )}

      {onCompare && templates.length >= 2 && !compact && (
        <button
          onClick={onCompare}
          className="mt-4 flex items-center gap-1.5 text-xs text-secondary hover:text-on-surface transition-colors duration-200"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>compare_arrows</span>
          Compare templates
        </button>
      )}
    </div>
  )
}
