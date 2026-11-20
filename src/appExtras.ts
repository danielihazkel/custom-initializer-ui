// What `App` does that the first paint does not need: its ⌘K commands and the tour that opens by
// itself once. Fetched right after the first render (see App.tsx), so none of it — the titles
// above all — is in the entry chunk.
import { registerCommands } from './commands'
import { t } from './i18n'

/** A header tab, as `App` lists them. */
export interface NavEntry<V extends string> {
  view: V
  label: () => string
  icon: string
}

/** What the commands ask of the shell, read through a ref so they always run the latest closures. */
export interface ShellActions<V extends string> {
  generate: () => unknown
  explore: () => void
  reset: () => void
  share: () => void
  toggleDock: () => void
  goToView: (view: V) => void
  toggleTheme: () => void
  startTour: () => void
}

/** ⌘K, on every tab: the tabs themselves and the app's own switches. */
export function registerGlobalCommands<V extends string>(
  nav: NavEntry<V>[],
  shell: { current: ShellActions<V> },
  lang: string,
  toggleMotion: () => void,
  switchLanguage: (next: 'en' | 'he') => void,
): () => void {
  return registerCommands([
    ...nav.map(item => ({
      id: `go-${item.view}`, title: t('Go to {tab}', { tab: item.label() }), icon: item.icon, group: t('Go to'),
      run: () => shell.current.goToView(item.view),
    })),
    { id: 'app-theme', title: t('Switch between light and dark'), icon: 'contrast', group: t('App'), run: () => shell.current.toggleTheme() },
    { id: 'app-motion', title: t('Turn animations on or off'), icon: 'motion_photos_on', group: t('App'), run: toggleMotion },
    { id: 'app-share', title: t('Copy a link to this setup'), icon: 'share', group: t('App'), run: () => shell.current.share() },
    { id: 'app-tour', title: t('Take the tour of this tab'), icon: 'tour', group: t('App'), run: () => shell.current.startTour() },
    {
      // Not translated: whoever needs it may not read the language the site is in.
      id: 'app-language', title: lang === 'he' ? 'Switch to English' : 'Switch to Hebrew', description: 'עברית · English · language · שפה',
      icon: 'translate', group: t('App'), run: () => switchLanguage(lang === 'he' ? 'en' : 'he'),
    },
  ], 'global')
}

/**
 * ⌘K on the Backend tab: the header's actions. The dependency picker, the presets and the model
 * bar register their own (`backend-deps`, `backend-presets`, `backend-model`).
 */
export function registerBackendCommands<V extends string>(
  shell: { current: ShellActions<V> },
  openCompare: () => void,
  toggleMultiModule: () => void,
  openShortcuts: () => void,
): () => void {
  return registerCommands([
    { id: 'backend-generate', title: t('Generate and download the project'), icon: 'download', group: t('Backend'), shortcut: 'Ctrl+Enter', run: () => { void shell.current.generate() } },
    { id: 'backend-explore', title: t('Explore the generated files'), icon: 'folder_open', group: t('Backend'), shortcut: 'Ctrl+Shift+E', run: () => shell.current.explore() },
    { id: 'backend-compare', title: t('Compare starter templates'), icon: 'compare_arrows', group: t('Backend'), run: openCompare },
    { id: 'backend-multi-module', title: t('Turn the multi-module project on or off'), icon: 'account_tree', group: t('Backend'), run: toggleMultiModule },
    { id: 'backend-file-dock', title: t('Show or hide the project files'), description: t('The files this setup generates, kept current as you change it'), icon: 'account_tree', group: t('Backend'), run: () => shell.current.toggleDock() },
    { id: 'backend-reset', title: t('Reset the project to defaults'), icon: 'restart_alt', group: t('Backend'), run: () => shell.current.reset() },
    { id: 'backend-shortcuts', title: t('Keyboard shortcuts'), icon: 'keyboard', group: t('Backend'), shortcut: '?', run: openShortcuts },
  ], 'backend')
}

/**
 * Opens a tab's tour by itself, once per browser: waits for a part of the tab to be on screen
 * (it may still be loading — a lazy chunk, the catalog) and never opens over a dialog. Returns
 * what stops the waiting, or nothing when there is no tour to open.
 */
export function watchForTour<T extends string>(
  ready: { id: T; anchor: string },
  open: (id: T) => void,
): (() => void) | undefined {
  try {
    if (localStorage.getItem(`tour:${ready.id}`) === 'done') return undefined
  } catch {
    return undefined
  }
  // Someone who followed a shared link came for that setup, not for a tour.
  const params = new URLSearchParams(window.location.search)
  params.delete('tab')
  if ([...params.keys()].length > 0) return undefined
  let tries = 0
  const timer = window.setInterval(() => {
    tries += 1
    if (document.querySelector(ready.anchor) && !document.querySelector('[role="dialog"]')) {
      window.clearInterval(timer)
      open(ready.id)
    } else if (tries > 20) {
      window.clearInterval(timer)
    }
  }, 600)
  return () => window.clearInterval(timer)
}
