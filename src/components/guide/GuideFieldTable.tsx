import type { GuideField } from './guide-types'
import type { UiStrings } from './guide-i18n'

interface GuideFieldTableProps {
  fields: GuideField[]
  labels: UiStrings
}

export function GuideFieldTable({ fields, labels }: GuideFieldTableProps) {
  const h = labels.fieldTableHeaders
  const leg = labels.fieldTableLegend
  return (
    <div className="mt-6 mb-8 overflow-x-auto rounded-xl border border-outline-variant">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-variant/50 border-b border-outline-variant">
            <th className="text-left px-4 py-3 text-xs font-bold text-secondary uppercase tracking-wider">{h.field}</th>
            <th className="text-left px-4 py-3 text-xs font-bold text-secondary uppercase tracking-wider">{h.type}</th>
            <th className="text-left px-4 py-3 text-xs font-bold text-secondary uppercase tracking-wider">{h.req}</th>
            <th className="text-left px-4 py-3 text-xs font-bold text-secondary uppercase tracking-wider">{h.description}</th>
            <th className="text-left px-4 py-3 text-xs font-bold text-secondary uppercase tracking-wider">{h.example}</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field, i) => (
            <tr key={field.name} className={`border-b border-outline-variant/50 ${i % 2 === 0 ? '' : 'bg-surface-container-low/30'}`}>
              <td className="px-4 py-3 font-mono text-xs text-primary whitespace-nowrap font-semibold">{field.name}</td>
              <td className="px-4 py-3 font-mono text-xs text-tertiary whitespace-nowrap">{field.type}</td>
              <td className="px-4 py-3 text-center">
                {field.required ? (
                  <span className="inline-block w-2 h-2 rounded-full bg-primary" title={leg.required} />
                ) : (
                  <span className="inline-block w-2 h-2 rounded-full bg-outline-variant" title={leg.optional} />
                )}
              </td>
              <td className="px-4 py-3 text-on-surface-variant text-xs leading-relaxed">{field.description}</td>
              <td className="px-4 py-3 font-mono text-xs text-secondary whitespace-nowrap">
                {field.example !== undefined && field.example !== '' ? field.example : <span className="text-outline">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-4 py-2 bg-surface-variant/20 border-t border-outline-variant/50 flex items-center gap-4 text-[11px] text-secondary">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-primary" /> {leg.required}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-outline-variant" /> {leg.optional}
        </span>
      </div>
    </div>
  )
}
