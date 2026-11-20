import type { FullstackNavIcon, FullstackPageDef, FullstackPageType } from '../../../types'
import { t } from '../../../i18n'

/**
 * The generated app's navigation: the icons a page may take, which pages are in the menu, and
 * the menu's sections — grouped exactly as the generated shell groups them.
 */

/** The nav icons a page may pick (the generated app draws the lucide icon; the editor shows the
 *  Material Symbol that looks like it). */
export const NAV_ICONS: Record<FullstackNavIcon, { symbol: string; readonly label: string }> = {
  LayoutDashboard: { symbol: 'dashboard', get label() { return t('Dashboard') } },
  Columns3: { symbol: 'view_week', get label() { return t('Board') } },
  Search: { symbol: 'search', get label() { return t('Search') } },
  Upload: { symbol: 'upload', get label() { return t('Upload') } },
  Table2: { symbol: 'table', get label() { return t('Table') } },
  Layers: { symbol: 'layers', get label() { return t('Layers') } },
  PanelLeft: { symbol: 'vertical_split', get label() { return t('Split panel') } },
  BarChart3: { symbol: 'bar_chart', get label() { return t('Chart') } },
  ListChecks: { symbol: 'checklist', get label() { return t('Checklist') } },
  Users: { symbol: 'group', get label() { return t('People') } },
  ShoppingCart: { symbol: 'shopping_cart', get label() { return t('Cart') } },
  Package: { symbol: 'package_2', get label() { return t('Package') } },
  Ticket: { symbol: 'confirmation_number', get label() { return t('Ticket') } },
  Inbox: { symbol: 'inbox', get label() { return t('Inbox') } },
  Calendar: { symbol: 'calendar_month', get label() { return t('Calendar') } },
  FileText: { symbol: 'description', get label() { return t('Document') } },
  FilePlus: { symbol: 'note_add', get label() { return t('New document') } },
  Settings: { symbol: 'settings', get label() { return t('Settings') } },
  Truck: { symbol: 'local_shipping', get label() { return t('Truck') } },
  Wallet: { symbol: 'account_balance_wallet', get label() { return t('Wallet') } },
  Building2: { symbol: 'apartment', get label() { return t('Building') } },
  Tag: { symbol: 'sell', get label() { return t('Tag') } },
  Star: { symbol: 'star', get label() { return t('Star') } },
  Wand2: { symbol: 'auto_fix_high', get label() { return t('Wand') } },
}

/** The icon a page shows in the nav when it names none (EntityScaffoldContext.putPageContext). */
export const DEFAULT_NAV_ICON: Record<FullstackPageType, FullstackNavIcon> = {
  dashboard: 'LayoutDashboard',
  'entity-list': 'Table2',
  tabs: 'Layers',
  'master-detail': 'PanelLeft',
  record: 'Table2',
  report: 'BarChart3',
  wizard: 'Wand2',
  form: 'FilePlus',
  calendar: 'Calendar',
  board: 'Columns3',
  content: 'FileText',
  import: 'Upload',
  search: 'Search',
  inbox: 'Inbox',
  tree: 'Layers',
}

/** Whether a page is listed in the generated nav (a record page never is). */
export function inNav(page: FullstackPageDef): boolean {
  return !page.hidden && page.type !== 'record'
}

/**
 * The nav as the generated shell groups it: pages sharing a group gathered where the group first
 * appears, ungrouped runs as label-less sections between them. Indices point into `pages`.
 */
export function navSections(pages: FullstackPageDef[]): { group?: string; items: number[] }[] {
  const sections: { group?: string; items: number[] }[] = []
  const byGroup = new Map<string, { group?: string; items: number[] }>()
  let loose: { items: number[] } | null = null
  pages.forEach((page, index) => {
    if (!inNav(page)) return
    const group = page.group?.trim()
    if (!group) {
      if (!loose) {
        loose = { items: [] }
        sections.push(loose)
      }
      loose.items.push(index)
      return
    }
    loose = null
    let section = byGroup.get(group)
    if (!section) {
      section = { group, items: [] }
      byGroup.set(group, section)
      sections.push(section)
    }
    section.items.push(index)
  })
  return sections
}

/** Renames a nav group on every page that carries it (a blank `to` ungroups them). */
export function renameGroupInPages(pages: FullstackPageDef[], from: string, to: string): FullstackPageDef[] {
  const f = from.trim()
  const t = to.trim()
  if (!f || f === t) return pages
  let changed = false
  const next = pages.map(page => {
    if (page.group?.trim() !== f) return page
    changed = true
    const { group: _group, ...rest } = page
    return t ? { ...rest, group: t } : rest
  })
  return changed ? next : pages
}

/** Moves one nav section past its neighbour (`delta` ±1) by reordering its pages as a block;
 *  hidden and record pages keep their slots. */
export function moveNavGroup(pages: FullstackPageDef[], sectionIndex: number, delta: number): FullstackPageDef[] {
  const sections = navSections(pages)
  const target = sectionIndex + delta
  if (sectionIndex < 0 || sectionIndex >= sections.length || target < 0 || target >= sections.length) return pages
  const order = sections.map(s => s.items)
  ;[order[sectionIndex], order[target]] = [order[target], order[sectionIndex]]
  const flat = order.flat()
  let k = 0
  return pages.map(page => (inNav(page) ? pages[flat[k++]] : page))
}

/** The group a page dropped at `index` should take: the one its nav neighbours above and below
 *  share, when that differs from its own — so a drag into the middle of a section joins it.
 *  Undefined when the page keeps its group. */
export function adoptedGroup(pages: FullstackPageDef[], index: number): string | undefined {
  const page = pages[index]
  if (!page || !inNav(page)) return undefined
  const above = pages.slice(0, index).reverse().find(inNav)
  const below = pages.slice(index + 1).find(inNav)
  const group = above?.group?.trim()
  if (!group || group !== below?.group?.trim()) return undefined
  return page.group?.trim() === group ? undefined : group
}
