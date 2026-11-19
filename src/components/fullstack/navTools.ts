import type { FullstackEntityDef, FullstackNav } from '../../types'
import { t } from '../../i18n'

/** The tools a layout's header can carry (`nav.userMenu`, `nav.notifications`, `nav.commandPalette`). */
export type NavTool = 'commandPalette' | 'notifications' | 'userMenu'

export const NAV_TOOLS: { value: NavTool; readonly label: string; readonly hint: string }[] = [
  { value: 'commandPalette', get label() { return t('Go to anything (Ctrl+K)') }, get hint() { return t('Opens a page by its name and finds records by theirs') } },
  { value: 'notifications', get label() { return t('Notification bell') }, get hint() { return t('Counts the workflow tasks assigned to the user, overdue and not yet taken') } },
  { value: 'userMenu', get label() { return t('User menu') }, get hint() { return t('Who is signed in, their roles and the keyboard shortcuts') } },
]

/** Why a tool cannot be switched on for this model — the validator's rule — or undefined. */
export function navToolDisabledReason(tool: NavTool, entities: readonly FullstackEntityDef[]): string | undefined {
  if (tool === 'notifications' && !entities.some(e => e.workflow?.assigneeField)) {
    return t('Needs an entity whose workflow has an assignee — the bell counts the tasks assigned to the user')
  }
  return undefined
}

/** Whether a nav says anything a request has to carry. */
export function hasNavSettings(nav: FullstackNav | undefined): nav is FullstackNav {
  return Boolean(nav && (nav.style || nav.collapsibleGroups || nav.userMenu || nav.notifications || nav.commandPalette))
}

/**
 * A nav after an edit: the default style and every switched-off flag left out, and nothing at all
 * (undefined) when nothing is left — so a layout whose settings were all put back generates the
 * shell it did before.
 */
export function cleanNav(nav: FullstackNav | undefined): FullstackNav | undefined {
  if (!nav) return undefined
  const next: FullstackNav = {}
  if (nav.style && nav.style !== 'sidebar') next.style = nav.style
  if (nav.collapsibleGroups) next.collapsibleGroups = true
  if (nav.userMenu) next.userMenu = true
  if (nav.notifications) next.notifications = true
  if (nav.commandPalette) next.commandPalette = true
  return Object.keys(next).length > 0 ? next : undefined
}

/**
 * The nav a request carries. A bell with nothing to count — the workflow it relied on was removed
 * since it was switched on — is left out rather than sent to be refused.
 */
export function requestNav(nav: FullstackNav | undefined, entities: readonly FullstackEntityDef[]): FullstackNav | undefined {
  if (!hasNavSettings(nav)) return undefined
  if (!nav.notifications || !navToolDisabledReason('notifications', entities)) return nav
  const { notifications: _dropped, ...rest } = nav
  return hasNavSettings(rest) ? rest : undefined
}
