import type { FullstackEntityDef, FullstackPageDef, FullstackWidgetDef } from '../../../types'
import { PAGE_TYPE_META, describePage, describePresetValue, pageLabel } from '../pageLayout'
import { WIDGET_KINDS } from '../pages/constants'
import type { PreviewNavSection } from '../layoutPreviewModel'

/**
 * The layout as a spec sheet for the people who will review it: one self-contained HTML file
 * (no request leaves it — the deployed UI and its readers may be offline) that prints one page
 * per section. The builder is pure; the canvas snapshots and the stylesheet are made by the
 * caller (`specSnapshot.tsx`) and passed in as markup.
 */
export interface SpecSheetInput {
  project: string
  /** Shown on the cover, e.g. "27 October 2026". */
  date: string
  frontendSet: string
  locale: 'en' | 'he'
  pages: FullstackPageDef[]
  entities: FullstackEntityDef[]
  /** The navigation as the generated shell lists it. */
  sections: PreviewNavSection[]
  /** The page-flow map, as static markup (empty when it could not be drawn). */
  flowHtml: string
  /** Per page, its canvas as static markup (null: none). */
  canvasHtml: (string | null)[]
  /** The app's stylesheet, inlined so the snapshots look as they do in the designer. */
  css: string
}

const escapeMap: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => escapeMap[c])

/** The file name the spec downloads as. */
export function specFileName(project: string): string {
  const slug = project.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'layout'
  return `${slug}-layout-spec.html`
}

function widgetLine(w: FullstackWidgetDef): string {
  const kind = WIDGET_KINDS.find(k => k.kind === w.kind)?.label ?? w.kind
  const parts = [w.title ? `“${w.title}”` : '', w.entity, w.groupBy ? `by ${w.groupBy}` : '', w.agg && w.agg !== 'count' ? `${w.agg} of ${w.field ?? '?'}` : '',
    w.trend ? `trend per ${w.trend}` : '']
    .filter(Boolean)
  return parts.length ? `${kind} — ${parts.join(' · ')}` : kind
}

/** What a page is set to, as label → value rows (only what is set). */
export function pageSettings(page: FullstackPageDef, pages: FullstackPageDef[], entities: FullstackEntityDef[]): [string, string][] {
  const rows: [string, string][] = [
    ['Type', PAGE_TYPE_META[page.type]?.label ?? page.type],
    ['Route', `#/${page.id}`],
  ]
  const add = (label: string, value: string | undefined | false) => { if (value) rows.push([label, value]) }
  add('In the menu', page.hidden ? 'No — opened from other pages' : page.group ? `Yes, under “${page.group}”` : 'Yes')
  add('Entity', page.entity)
  add('Parent', page.parent)
  add('Child', page.child)
  const entity = entities.find(x => x.name.trim().toLowerCase() === page.entity?.trim().toLowerCase())
  add('Opens filtered on', page.presetFilter && Object.entries(page.presetFilter).map(([name, v]) => {
    const field = entity?.fields.find(f => f.name === name)
    return `${name} = ${field ? describePresetValue(field, v) : v}`
  }).join(', '))
  add('Columns', page.columns?.join(', '))
  add('Sorted by', page.sort && `${page.sort.field} ${page.sort.dir === 'desc' ? '(newest/largest first)' : '(ascending)'}`)
  add('View', page.view)
  add('Tabs', page.tabs?.map(t => t.title || pageLabel(pages.find(p => p.id === t.page) ?? { id: t.page, type: 'entity-list' })).join(', '))
  add('Steps', page.steps?.map((s, i) => s.title || `Step ${i + 1}`).join(', '))
  add('Who may open it', page.roles?.length ? page.roles.join(' or ') : false)
  add('Summary', describePage(page, pages))
  return rows
}

export function buildSpecSheet(input: SpecSheetInput): string {
  const { pages } = input
  const e = escapeHtml
  const nav = input.sections.map(section => `
      <li>${section.group ? `<strong>${e(section.group)}</strong><ul>` : ''}${section.items.map(item =>
        `<li><a href="#page-${item.index}">${e(item.label)}</a>${item.start ? ' <span class="tag">start page</span>' : ''}${item.roles.length ? ` <span class="tag">${e(item.roles.join(' / '))}</span>` : ''}</li>`).join('')}${section.group ? '</ul>' : ''}</li>`).join('')
  const offNav = pages.map((p, i) => ({ p, i })).filter(({ i }) => !input.sections.some(s => s.items.some(item => item.index === i)))
  const pageSections = pages.map((page, i) => {
    const widgets = page.type === 'dashboard' && (page.widgets?.length ?? 0) > 0
      ? `<h3>Widgets</h3><ol class="widgets">${(page.widgets ?? []).map(w => `<li>${e(widgetLine(w))}</li>`).join('')}</ol>` : ''
    const canvas = input.canvasHtml[i]
    return `
  <section class="page" id="page-${i}">
    <p class="eyebrow">Page ${i + 1} of ${pages.length}</p>
    <h2>${e(pageLabel(page))}</h2>
    ${page.description ? `<p class="lead">${e(page.description)}</p>` : ''}
    <div class="cols">
      <dl>${pageSettings(page, pages, input.entities).map(([k, v]) => `<dt>${e(k)}</dt><dd>${e(v)}</dd>`).join('')}</dl>
      ${canvas ? `<figure class="canvas"><div class="snapshot">${canvas}</div><figcaption>As the designer previews it, with sample rows</figcaption></figure>` : ''}
    </div>
    ${widgets}
  </section>`
  }).join('')

  return `<!doctype html>
<html lang="en" class="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(input.project)} — page layout</title>
<style>
${input.css}
</style>
<style>
  :root { color-scheme: light; }
  body.spec { margin: 0; background: #fff; color: #1f2430; font: 14px/1.5 system-ui, -apple-system, 'Segoe UI', Arial, sans-serif; }
  .spec main { max-width: 1100px; margin: 0 auto; padding: 32px 24px 64px; }
  .spec h1 { font-size: 28px; margin: 0 0 4px; }
  .spec h2 { font-size: 20px; margin: 0 0 6px; }
  .spec h3 { font-size: 14px; margin: 18px 0 6px; }
  .spec .eyebrow { margin: 0; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: #6b7080; }
  .spec .lead { margin: 0 0 12px; color: #4a5060; }
  .spec .cover { border-bottom: 1px solid #e3e5ec; padding-bottom: 20px; margin-bottom: 24px; }
  .spec .facts { display: flex; flex-wrap: wrap; gap: 8px 24px; margin: 12px 0 0; padding: 0; list-style: none; color: #4a5060; }
  .spec .tag { display: inline-block; padding: 0 6px; border-radius: 999px; background: #eef0f5; font-size: 11px; color: #4a5060; }
  .spec nav ul { margin: 4px 0; padding-inline-start: 20px; }
  .spec a { color: #3b4cc0; }
  .spec .page { padding-top: 24px; margin-top: 24px; border-top: 1px solid #e3e5ec; }
  .spec .cols { display: grid; grid-template-columns: minmax(0, 320px) minmax(0, 1fr); gap: 24px; align-items: start; }
  .spec dl { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 4px 12px; margin: 0; font-size: 13px; }
  .spec dt { color: #6b7080; }
  .spec dd { margin: 0; overflow-wrap: anywhere; }
  .spec figure { margin: 0; }
  .spec figcaption { margin-top: 6px; font-size: 11px; color: #6b7080; }
  .spec .snapshot { pointer-events: none; }
  .spec .flow { overflow: auto; border: 1px solid #e3e5ec; border-radius: 12px; padding: 12px; }
  .spec .widgets { margin: 0; padding-inline-start: 20px; font-size: 13px; }
  @media (max-width: 760px) { .spec .cols { grid-template-columns: 1fr; } }
  @media print {
    .spec main { padding: 0; max-width: none; }
    .spec .page { break-before: page; border-top: 0; margin-top: 0; }
    .spec .flow { overflow: visible; }
    .spec a { color: inherit; text-decoration: none; }
  }
</style>
</head>
<body class="spec">
<main>
  <header class="cover">
    <p class="eyebrow">Page layout spec</p>
    <h1>${e(input.project)}</h1>
    <ul class="facts">
      <li>${pages.length} page${pages.length === 1 ? '' : 's'}</li>
      <li>${input.entities.filter(x => x.name.trim()).length} entities</li>
      <li>Frontend: ${e(input.frontendSet)}</li>
      <li>Language: ${input.locale === 'he' ? 'Hebrew' : 'English'}</li>
      <li>${e(input.date)}</li>
    </ul>
  </header>
  <section>
    <h2>Navigation</h2>
    <nav><ul>${nav}</ul></nav>
    ${offNav.length ? `<p class="lead">Opened from other pages: ${offNav.map(({ p, i }) => `<a href="#page-${i}">${e(pageLabel(p))}</a>`).join(', ')}</p>` : ''}
  </section>
  ${input.flowHtml ? `<section><h2>How the pages connect</h2><div class="flow">${input.flowHtml}</div></section>` : ''}
  ${pageSections}
</main>
</body>
</html>
`
}
