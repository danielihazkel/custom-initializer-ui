import type { FullstackPageDef } from '../../../types'
import { buildLayoutTemplate, type LayoutTemplate } from '../layoutTemplates'
import { pageLabel } from '../pageLayout'

/** The whole-layout templates: what each builds (its pages, listed), or why the model cannot fill it. */
export function TemplateGallery({ templates, onPick }: {
  templates: { template: LayoutTemplate; result: ReturnType<typeof buildLayoutTemplate> }[]
  onPick: (label: string, pages: FullstackPageDef[]) => void
}) {
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4" data-layout-templates>
      {templates.map(({ template, result }) => {
        const reason = 'reason' in result ? result.reason : undefined
        const built = 'pages' in result ? result.pages : []
        const names = built.map(p => pageLabel(p)).join(' · ')
        return (
          <li key={template.key}>
            <button
              type="button"
              disabled={Boolean(reason)}
              title={reason ?? `Builds: ${names}`}
              onClick={() => { if (!reason) onPick(template.label, built) }}
              className="h-full w-full rounded-lg border border-outline-variant px-3 py-2 text-start transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-outline-variant disabled:hover:bg-transparent"
              data-layout-template={template.key}
            >
              <span className="flex items-center gap-1.5 text-xs font-semibold text-on-surface">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: '16px' }} aria-hidden="true">{template.icon}</span>
                {template.label}
                {!reason && <span className="text-[10px] font-normal text-secondary">· {built.length} pages</span>}
              </span>
              <span className="mt-0.5 block text-[11px] text-secondary">{reason ?? template.blurb}</span>
              {!reason && <span className="mt-1 block line-clamp-2 text-[10px] text-secondary/80" data-template-pages>{names}</span>}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
