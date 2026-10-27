import type { ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import type { FullstackEntityDef, FullstackPageDef } from '../../../types'
import { LayoutPreview, type PreviewPalette } from '../LayoutPreview'
import type { LayoutPreview as LayoutPreviewModel } from '../layoutPreviewModel'
import { PageFlowMap } from './PageFlowMap'
import { buildSpecSheet, specFileName } from './specSheet'

/**
 * Static markup of `node`: rendered once into a detached element, read, and unmounted. Icons are
 * left out — they are a font the spec does not carry, so they would read as their names ("home").
 * Event handlers, ids for aria wiring and the like go too; what stays is the picture.
 */
export function staticMarkup(node: ReactNode): string {
  const host = document.createElement('div')
  const root = createRoot(host)
  try {
    flushSync(() => root.render(node))
    host.querySelectorAll('.material-symbols-outlined').forEach(el => el.remove())
    // The edit overlays are transparent buttons: nothing to press on paper.
    host.querySelectorAll('button[data-rename-owner]').forEach(el => el.remove())
    return host.innerHTML
  } finally {
    root.unmount()
  }
}

/**
 * The page's own stylesheet rules (same-origin sheets only), without its web fonts and imports:
 * a downloaded file cannot reach them, and nothing in it may ask the network for anything.
 */
export function collectAppCss(doc: Document = document): string {
  const out: string[] = []
  for (const sheet of Array.from(doc.styleSheets)) {
    let rules: CSSRuleList
    try {
      rules = sheet.cssRules
    } catch {
      continue // a cross-origin sheet: not ours to read
    }
    for (const rule of Array.from(rules)) {
      const text = rule.cssText
      if (text.startsWith('@font-face') || text.startsWith('@import')) continue
      out.push(text.replace(/url\((?!['"]?data:)[^)]*\)/g, 'none'))
    }
  }
  return out.join('\n')
}

export interface SpecExportInput {
  project: string
  pages: FullstackPageDef[]
  entities: FullstackEntityDef[]
  preview: LayoutPreviewModel
  skin: 'tailwind' | 'menora'
  palette?: PreviewPalette
  locale: 'en' | 'he'
  navStyle?: 'sidebar' | 'topbar'
}

/** The whole spec sheet for the layout as it stands. */
export function buildLayoutSpec(input: SpecExportInput, now = new Date()): string {
  const canvasHtml = input.pages.map((_, i) => {
    try {
      return staticMarkup(
        <LayoutPreview preview={input.preview} selected={i} onSelect={() => {}} onEdit={() => {}} skin={input.skin} palette={input.palette} navStyle={input.navStyle} />,
      )
    } catch {
      return null
    }
  })
  let flowHtml = ''
  try {
    flowHtml = staticMarkup(<PageFlowMap pages={input.pages} entities={input.entities} onOpenPage={() => {}} />)
  } catch {
    flowHtml = ''
  }
  return buildSpecSheet({
    project: input.project,
    date: now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    frontendSet: input.skin === 'menora' ? 'Menora Digital' : 'Tailwind',
    locale: input.locale,
    pages: input.pages,
    entities: input.entities,
    sections: input.preview.sections,
    flowHtml,
    canvasHtml,
    css: collectAppCss(),
  })
}

/** Builds the spec and hands it to the browser as a download. */
export function downloadLayoutSpec(input: SpecExportInput): string {
  const html = buildLayoutSpec(input)
  const name = specFileName(input.project)
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
  return name
}
