import type { ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import type { FullstackEntityDef, FullstackPageDef, FullstackStarterRequest } from '../../../types'
import type { LayoutPreview as LayoutPreviewModel } from '../layoutPreviewModel'
import { captureScreens, fetchAppPayload, type ScreenCapture } from '../../../designRuntime/capture'
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
  /** The layout's view-model: the navigation as the generated shell lists it. */
  preview: LayoutPreviewModel
  /** The generator request for the model, for the screens' snapshots (null: none to take). */
  request: FullstackStarterRequest | null
  /** The look's name on the cover ("Menora Digital"). */
  look: string
  locale: 'en' | 'he'
}

/** The route a page's snapshot is taken on: a record page opens its first sample row. */
export const snapshotHash = (page: FullstackPageDef) => page.type === 'record' ? `#/${page.id}/1` : `#/${page.id}`

/** Every page as the generated app draws it, or why there are none. */
async function screens(input: SpecExportInput, capture: typeof captureScreens): Promise<{ shots: (ScreenCapture | null)[]; note?: string }> {
  const none = input.pages.map(() => null)
  if (!input.request) return { shots: none, note: 'The pages are not pictured: the model has problems to fix before the app can be generated.' }
  try {
    const app = await fetchAppPayload(input.request)
    return { shots: await capture(app, input.pages.map(snapshotHash)) }
  } catch (e) {
    return { shots: none, note: `The pages are not pictured: ${e instanceof Error ? e.message : String(e)}` }
  }
}

/** The whole spec sheet for the layout as it stands, with each page as the generated app draws it. */
export async function buildLayoutSpec(input: SpecExportInput, now = new Date(), capture = captureScreens): Promise<string> {
  const { shots, note } = await screens(input, capture)
  let flowHtml = ''
  try {
    flowHtml = staticMarkup(<PageFlowMap pages={input.pages} entities={input.entities} onOpenPage={() => {}} />)
  } catch {
    flowHtml = ''
  }
  return buildSpecSheet({
    project: input.project,
    date: now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    frontendSet: input.look,
    locale: input.locale,
    pages: input.pages,
    entities: input.entities,
    sections: input.preview.sections,
    flowHtml,
    canvases: shots,
    canvasNote: note,
    css: collectAppCss(),
  })
}

/** Builds the spec and hands it to the browser as a download; resolves to the file's name. */
export async function downloadLayoutSpec(input: SpecExportInput): Promise<string> {
  const html = await buildLayoutSpec(input)
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
