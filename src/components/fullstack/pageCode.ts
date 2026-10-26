import type { FullstackPageDef, PreviewFile } from '../../types'
import type { EntityCodeFile } from './entityCode'
import { toKebabCase, toPascalCase } from './naming'

/**
 * Picks the generated files that make up one page out of a whole-project preview — the designer
 * inspector's Code tab. The page's own screen comes first (`src/app/screens/<PageName>Screen.tsx`,
 * `PageName` being the backend's `Naming.toPascalCase` of the page id), then the screens a tabs
 * page embeds, then the entity pages it draws, then the shell that routes to it.
 */
export interface PageCodeFile extends EntityCodeFile {
  /** Why the file is listed, said under the file name. */
  role: 'screen' | 'tab' | 'entity' | 'shell'
}

const SCREENS = 'frontend/src/app/screens/'
const SHELL = ['frontend/src/app/App.tsx', 'frontend/src/app/route.ts']

/** The path of a page's generated screen. */
export function screenPath(page: Pick<FullstackPageDef, 'id'>): string {
  return `${SCREENS}${toPascalCase(page.id.trim())}Screen.tsx`
}

/** The entities a page draws through their generated list page (`pages/<kebab>/ui/<Name>Page.tsx`). */
function pageEntities(page: FullstackPageDef): string[] {
  const names = page.type === 'master-detail' ? [page.parent, page.child] : [page.entity]
  return [...new Set(names.filter((n): n is string => Boolean(n?.trim())).map(n => n.trim()))]
}

export function pageCodeFiles(page: FullstackPageDef, pages: FullstackPageDef[], files: PreviewFile[] | undefined): PageCodeFile[] {
  if (!page.id.trim() || !files?.length) return []
  const byPath = new Map(files.map(f => [f.path, f]))
  const out: PageCodeFile[] = []
  const add = (path: string, role: PageCodeFile['role']) => {
    const file = byPath.get(path)
    if (!file || out.some(o => o.path === path)) return
    out.push({ path, content: file.content, name: path.split('/').pop() ?? path, side: 'frontend', role })
  }

  add(screenPath(page), 'screen')
  if (page.type === 'tabs') {
    for (const tab of page.tabs ?? []) {
      const target = pages.find(p => p.id === tab.page)
      if (target) add(screenPath(target), 'tab')
    }
  }
  for (const entity of pageEntities(page)) {
    add(`frontend/src/pages/${toKebabCase(entity)}/ui/${toPascalCase(entity)}Page.tsx`, 'entity')
  }
  for (const path of SHELL) add(path, 'shell')
  // Without its own screen the page did not render (an older server, or a renamed id the
  // preview has not caught up with) — the shell alone would only mislead.
  return out[0]?.role === 'screen' ? out : []
}

export const PAGE_CODE_ROLE: Record<PageCodeFile['role'], string> = {
  screen: 'This page',
  tab: 'Embedded as a tab',
  entity: 'The list it draws',
  shell: 'The app shell that routes to it',
}
