import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { motion, AnimatePresence, MotionConfig } from 'framer-motion'
import { useMetadata } from './hooks/useMetadata'
import { useExtensions } from './hooks/useExtensions'
import { useSqlDialects } from './hooks/useSqlDialects'
import { useOpenApiCapable } from './hooks/useOpenApiCapable'
import { useSoapCapable } from './hooks/useSoapCapable'
import { useEventsCapable } from './hooks/useEventsCapable'
import { useCompatibility } from './hooks/useCompatibility'
import { useProjectPreview } from './hooks/useProjectPreview'
import { useStarterTemplates } from './hooks/useStarterTemplates'
import { useModuleTemplates } from './hooks/useModuleTemplates'
import { useProjectState } from './hooks/useProjectState'
import { useProjectPresets } from './hooks/useProjectPresets'

import { InitializrView } from './components/InitializrView'
import { BackendModelBar } from './components/backend/BackendModelBar'
import { useBackendUpdate } from './components/backend/useBackendUpdate'
import { Suspense, lazy } from 'react'

// Modals opened on demand — keep CodeMirror + its grammars + the diff engine out of the initial chunk.
const ProjectPreview = lazy(() => import('./components/ProjectPreview').then(m => ({ default: m.ProjectPreview })))
const TemplateCompare = lazy(() => import('./components/TemplateCompare').then(m => ({ default: m.TemplateCompare })))
const TutorialView = lazy(() => import('./components/tutorial/TutorialView').then(m => ({ default: m.TutorialView })))
const AdminPage = lazy(() => import('./components/admin/AdminPage').then(m => ({ default: m.AdminPage })))
const GuideView = lazy(() => import('./components/guide/GuideView').then(m => ({ default: m.GuideView })))
const FrontendView = lazy(() => import('./components/FrontendView').then(m => ({ default: m.FrontendView })))
const FullstackView = lazy(() => import('./components/fullstack/FullstackView').then(m => ({ default: m.FullstackView })))
// Not needed to paint the page: the palette exists only while it is open, the confirm only while
// it asks, and the "cannot reach backend" screen only when the catalog failed to load.
const loadCommandPalette = () => import('./components/CommandPalette')
const CommandPalette = lazy(() => loadCommandPalette().then(m => ({ default: m.CommandPalette })))
const ConfirmDialog = lazy(() => import('./components/ConfirmDialog').then(m => ({ default: m.ConfirmDialog })))
const BackendUnreachable = lazy(() => import('./components/BackendUnreachable').then(m => ({ default: m.BackendUnreachable })))
const AccessBlocked = lazy(() => import('./components/AccessBlocked').then(m => ({ default: m.AccessBlocked })))
import { registerCommands, runCommand, useRegisteredCommands } from './commands'
import { useBusy } from './utils/busy'
import { withViewTransition } from './utils/viewTransition'
import { livePreviewFor } from './utils/livePreviewCache'
import type { BackendRun } from './components/backend/BackendNextSteps'
// The card after a successful Generate: exists only once a project has been generated.
// The file dock (its tree, and the hook that keeps it current) is not needed to paint the tab.
const FileDock = lazy(() => import('./components/backend/FileDock').then(m => ({ default: m.FileDock })))
// A tab's guided tour (see components/tours.tsx): opened once per browser, then from Help.
const Tour = lazy(() => import('./components/tours').then(m => ({ default: m.Tour })))
/** The tabs that have a tour, and a part of each that is on screen once the tab has loaded. */
const TOUR_READY: Partial<Record<View, { id: 'backend' | 'frontend' | 'fullstack'; anchor: string }>> = {
  initializr: { id: 'backend', anchor: '[data-tour="dep-search"]' },
  frontend: { id: 'frontend', anchor: '[data-tour="fe-deps"]' },
  fullstack: { id: 'fullstack', anchor: '#fs-entities' },
}
const BackendNextSteps = lazy(() => import('./components/backend/BackendNextSteps').then(m => ({ default: m.BackendNextSteps })))
import { useHotkeys } from './hooks/useHotkeys'
// The `?` sheet with the Backend tab's list. The list lives in the sheet's own module, so
// neither is in the entry chunk.
const BackendShortcuts = lazy(() => import('./components/fullstack/ShortcutsOverlay').then(m => ({
  default: (props: { onClose: () => void }) => <m.ShortcutsOverlay {...props} shortcuts={m.BACKEND_SHORTCUTS} />,
})))
import { AppToast } from './components/AppToast'
import { InitializrSkeleton, ViewSkeleton } from './components/Skeletons'
import { PageHeader } from './components/shared/PageHeader'
import { PopoverMenu, type MenuItem } from './components/shared/PopoverMenu'

import { triggerDownload, buildProjectRequest, captureSnapshot, validateForm } from './utils/projectUtils'
import type { PreviewResponse, Toast } from './types'

type View = 'initializr' | 'tutorial' | 'admin' | 'guide' | 'frontend' | 'fullstack'

/** The header's tabs, in order — one list for the row on a wide window and the menu on a narrow
 *  one. A `toggle` tab (the reference views) returns to Backend when clicked while open. */
const NAV: { view: View; label: string; icon: string; toggle?: boolean }[] = [
  { view: 'initializr', label: 'Backend', icon: 'dns' },
  { view: 'frontend', label: 'Frontend', icon: 'web' },
  { view: 'fullstack', label: 'Fullstack', icon: 'stacks' },
  { view: 'tutorial', label: 'Training', icon: 'school', toggle: true },
  { view: 'guide', label: 'Guide', icon: 'menu_book', toggle: true },
  { view: 'admin', label: 'Config', icon: 'tune', toggle: true },
]

export default function App() {
  // The guide topic another tab asked to open (the page editor's help button).
  const [guideTopic, setGuideTopic] = useState<{ id: string; n: number } | undefined>(undefined)
  const [view, setView] = useState<View>(() => {
    const tab = new URLSearchParams(window.location.search).get('tab')
    if (tab === 'frontend') return 'frontend'
    if (tab === 'fullstack') return 'fullstack'
    if (tab === 'admin') return 'admin'
    return 'initializr'
  })

  // Keep `?tab=` truthful for the Fullstack tab so its share link (the encoded `fs` model, written
  // by FullstackView) opens on the right tab; the Frontend hook writes its own `?tab=frontend`, and
  // the Backend hook rewrites the whole query. Leaving the Fullstack tab also drops the multi-KB
  // `fs` payload so the other tabs' Share links don't carry it. The Config tab is written too, so
  // a genuine reload (F5, HMR, the error boundary) comes back to Config instead of Backend.
  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      if (view === 'fullstack') url.searchParams.set('tab', 'fullstack')
      else {
        url.searchParams.delete('fs')
        if (view === 'admin') url.searchParams.set('tab', 'admin')
        else {
          const tab = url.searchParams.get('tab')
          if (tab === 'fullstack' || tab === 'admin') url.searchParams.delete('tab')
        }
      }
      const next = url.pathname + url.search + url.hash
      if (next !== window.location.pathname + window.location.search + window.location.hash) {
        window.history.replaceState(window.history.state, '', next)
      }
    } catch { /* history API unavailable */ }
  }, [view])

  const { metadata, loading, error, blocked, retrying, reload: reloadMetadata } = useMetadata()
  const { extensions } = useExtensions()
  const { dialects: sqlDialects } = useSqlDialects()
  const { depIds: openApiCapableDeps } = useOpenApiCapable()
  const { depIds: soapCapableDeps } = useSoapCapable()
  const { depIds: eventsCapableDeps } = useEventsCapable()
  const { rules: compatibilityRules } = useCompatibility('BACKEND')
  const { templates } = useStarterTemplates('BACKEND')
  const { modules: moduleTemplates } = useModuleTemplates()
  const { preview, previousPreview, loading: previewLoading, error: previewError, fetchPreview, showPreview, clearPreview, clearError: clearPreviewError } = useProjectPreview()

  const {
    form,
    selected: selectedDeps,
    selectedOptions,
    sqlByDep,
    openApiByDep,
    soapByDep,
    eventsByDep,
    multiModuleEnabled,
    selectedModules,
    activeTemplate,
    setMultiModuleEnabled,
    handleFormChange,
    handleDepsChange,
    handleOptionsChange,
    handleSqlByDepChange,
    handleOpenApiByDepChange,
    handleSoapByDepChange,
    handleEventsByDepChange,
    handleTemplateSelect,
    applySnapshot,
    resetAll,
    setSelectedModules,
    shareStatus: backendShareStatus,
  } = useProjectState(metadata, view === 'initializr')

  const {
    presets,
    recents,
    savePreset,
    deletePreset,
    deleteRecent,
    pushRecent,
  } = useProjectPresets()

  const { valid: formValid, errors: formErrors } = useMemo(() => validateForm(form), [form])
  const firstFormError = Object.values(formErrors)[0]

  // A wizard error names a specific dependency (or its kind mentions SQL/OpenAPI/WSDL);
  // those belong in the dependency selector's inline banner. Everything else is a generic
  // preview/network failure and gets the top-level banner with Retry.
  const isWizardPreviewError = Boolean(
    previewError && (previewError.dep || /sql|openapi|wsdl/i.test(previewError.kind ?? ''))
  )
  const genericPreviewError = previewError && !isWizardPreviewError ? previewError : null

  // Deep-clones the wizard payloads (SQL / OpenAPI / WSDL text), so only rebuild when an input changes.
  const currentSnapshot = useMemo(() => captureSnapshot({
    form,
    selected: selectedDeps,
    selectedOptions,
    sqlByDep,
    openApiByDep,
    soapByDep,
    eventsByDep,
    multiModuleEnabled,
    selectedModules,
  }), [form, selectedDeps, selectedOptions, sqlByDep, openApiByDep, soapByDep, eventsByDep, multiModuleEnabled, selectedModules])

  const [shareCopied, setShareCopied] = useState(false)
  const [generateSuccess, setGenerateSuccess] = useState(false)
  const [appToast, setAppToast] = useState<Toast | null>(null)
  
  const [isDark, setIsDark] = useState<boolean>(() => {
    // The inline script in index.html already resolved & applied the theme class
    // pre-paint (localStorage → prefers-color-scheme). Mirror its decision here.
    if (document.documentElement.classList.contains('light')) return false
    if (document.documentElement.classList.contains('dark')) return true
    const saved = localStorage.getItem('theme')
    if (saved === 'light' || saved === 'dark') return saved === 'dark'
    return !window.matchMedia('(prefers-color-scheme: light)').matches
  })
  
  // The inline script in index.html already resolved the motion preference pre-paint
  // (localStorage → prefers-reduced-motion). Mirror its decision here.
  const [motionEnabled, setMotionEnabled] = useState<boolean>(
    () => !document.documentElement.classList.contains('motion-off')
  )

  const [compareOpen, setCompareOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  // Actions the active view contributed to ⌘K (the Fullstack tab registers its own).
  const paletteActions = useRegisteredCommands()
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)

  // Fetch the palette's chunk once the page is idle, so the first Ctrl+K opens without a wait.
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1500))
    const cancel = window.cancelIdleCallback ?? window.clearTimeout
    const handle = idle(() => { void loadCommandPalette() })
    return () => cancel(handle)
  }, [])

  // Command Palette global hotkey
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(o => !o)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Sync html class with theme
  useEffect(() => {
    const html = document.documentElement
    if (isDark) {
      html.classList.add('dark')
      html.classList.remove('light')
    } else {
      html.classList.add('light')
      html.classList.remove('dark')
    }
    localStorage.setItem('theme', isDark ? 'dark' : 'light')
  }, [isDark])

  // Sync html class + storage with the motion preference
  useEffect(() => {
    document.documentElement.classList.toggle('motion-off', !motionEnabled)
    localStorage.setItem('motion', motionEnabled ? 'on' : 'off')
  }, [motionEnabled])

  function handleShare(): void {
    const url = window.location.href
    const onCopied = (): void => {
      setShareCopied(true)
      setAppToast({ message: 'Link copied to clipboard', type: 'success' })
      setTimeout(() => setShareCopied(false), 2000)
    }
    // Fallback for insecure contexts (plain-http intranet hosts have no navigator.clipboard)
    // and denied permissions.
    const fallback = (): void => {
      try {
        const ta = document.createElement('textarea')
        ta.value = url
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        const ok = document.execCommand('copy')
        document.body.removeChild(ta)
        if (ok) onCopied()
        else throw new Error('copy command rejected')
      } catch {
        setAppToast({ message: "Couldn't copy link — copy it from the address bar", type: 'error' })
      }
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(onCopied).catch(fallback)
    } else {
      fallback()
    }
  }

  // What the Backend tab knows of the project it last generated or imported (menora-model.json).
  const backendUpdate = useBackendUpdate(currentSnapshot, applySnapshot, setAppToast)

  const downloadArgs = () => [
    form, selectedDeps, selectedOptions,
    { enabled: multiModuleEnabled, modules: selectedModules },
    sqlByDep, openApiByDep, soapByDep, eventsByDep,
  ] as const

  // Generating: the button says so, a second click cannot start another, and — once it has
  // taken long enough to be worth it — a Cancel appears.
  const [generating, setGenerating] = useState(false)
  const [generatingSlow, setGeneratingSlow] = useState(false)
  const generateAbort = useRef<AbortController | null>(null)
  // What the last successful Generate made, for the next-steps card (memory only).
  const [lastRun, setLastRun] = useState<BackendRun | null>(null)

  const currentRequest = () => buildProjectRequest('zip', ...downloadArgs())

  async function downloadProject(): Promise<boolean> {
    if (generateAbort.current) return false
    const ctrl = new AbortController()
    generateAbort.current = ctrl
    setGenerating(true)
    const slow = window.setTimeout(() => setGeneratingSlow(true), 700)
    try {
      const request = currentRequest()
      await triggerDownload(...downloadArgs(), ctrl.signal)
      pushRecent(currentSnapshot)
      // The project now exists: a later change of the model is an update of it.
      backendUpdate.rememberGenerated(currentSnapshot)
      const wizards = [sqlByDep, openApiByDep, soapByDep, eventsByDep]
        .flatMap(byDep => Object.keys(byDep ?? {}))
        .filter(depId => selectedDeps.includes(depId))
      setLastRun({
        artifactId: form.artifactId,
        dependencyCount: selectedDeps.length,
        dependencies: selectedDeps,
        wizardCount: wizards.length,
        moduleCount: request.kind === 'multimodule' ? selectedModules.length : 0,
        key: request.key,
      })
      return true
    } catch (err) {
      // Cancelled on purpose: nothing to report.
      if (!ctrl.signal.aborted) {
        setAppToast({ message: `Couldn't generate project: ${err instanceof Error ? err.message : String(err)}`, type: 'error' })
      }
      return false
    } finally {
      window.clearTimeout(slow)
      generateAbort.current = null
      setGenerating(false)
      setGeneratingSlow(false)
    }
  }

  function cancelGenerate(): void {
    generateAbort.current?.abort()
  }

  // The call Generate makes, as a command to run from a script or a CI job.
  async function copyCurl(): Promise<void> {
    const { curlFor } = await import('./utils/curl')
    const { copyToClipboard } = await import('./utils/clipboard')
    const ok = await copyToClipboard(curlFor(currentRequest(), window.location.origin, `${form.artifactId}.zip`))
    setAppToast(ok
      ? { message: 'curl command copied', type: 'success' }
      : { message: "Couldn't copy the curl command", type: 'error' })
  }

  // The header's conveyor and gears run while a request is out (see utils/busy.ts).
  useBusy(generating || previewLoading)

  async function handleGenerate(): Promise<void> {
    if (!formValid) {
      setAppToast({ message: firstFormError ? `Fix project metadata: ${firstFormError}` : 'Fix project metadata before generating', type: 'error' })
      return
    }
    if (!(await downloadProject())) return
    setGenerateSuccess(true)
    setAppToast({ message: 'Project downloaded!', type: 'success' })
    setTimeout(() => setGenerateSuccess(false), 2000)
  }

  function retryPreview(): void {
    void fetchPreview(...downloadArgs())
  }

  function handleReset(): void {
    setResetConfirmOpen(true)
  }

  function confirmReset(): void {
    setResetConfirmOpen(false)
    resetAll()
    setAppToast({ message: 'Project reset to defaults', type: 'success' })
  }

  // ── The file dock: the project's files, live, at the right edge of the Backend tab ─────────
  // From 1440px it is a column of its own (`<main>` makes room below); narrower, it is a drawer
  // over the dependency panels, so there it never opens by itself: a stored "open" is honoured
  // only where it is a column, and it is open by default only on a wide window.
  const [dockOpen, setDockOpen] = useState<boolean>(() => {
    const atLeast = (px: number) => window.matchMedia?.(`(min-width: ${px}px)`).matches ?? false
    try {
      const stored = localStorage.getItem('backend:fileDock')
      if (stored === 'closed') return false
      if (stored === 'open') return atLeast(1440)
    } catch { /* fall through to the default */ }
    return atLeast(1600)
  })
  function changeDock(open: boolean): void {
    setDockOpen(open)
    try { localStorage.setItem('backend:fileDock', open ? 'open' : 'closed') } catch { /* this visit only */ }
  }
  // The preview request of the setup on screen (what Explore would ask); null while it cannot generate.
  const previewRequest = useMemo(
    () => (formValid
      ? buildProjectRequest('preview', form, selectedDeps, selectedOptions,
        { enabled: multiModuleEnabled, modules: selectedModules }, sqlByDep, openApiByDep, soapByDep, eventsByDep)
      : null),
    [formValid, form, selectedDeps, selectedOptions, multiModuleEnabled, selectedModules, sqlByDep, openApiByDep, soapByDep, eventsByDep],
  )
  const depNames = useMemo(() => {
    const names = new Map<string, string>()
    for (const group of metadata?.dependencies?.values ?? []) for (const dep of group.values ?? []) names.set(dep.id, dep.name)
    return names
  }, [metadata])
  const depName = useCallback((id: string) => depNames.get(id) ?? id, [depNames])
  // The file Explore opens on, when it was opened from the dock's tree.
  const [previewPath, setPreviewPath] = useState<string | undefined>(undefined)
  const openDockFile = useCallback((path: string, data: PreviewResponse) => {
    setPreviewPath(path)
    showPreview(data)
  }, [showPreview])

  function handleExplore(): void {
    if (!formValid) {
      setAppToast({ message: firstFormError ? `Fix project metadata: ${firstFormError}` : 'Fix project metadata first', type: 'error' })
      return
    }
    setPreviewPath(undefined)
    // The dock may already hold exactly this preview: then Explore opens at once.
    const inHand = previewRequest ? livePreviewFor(previewRequest.key) : undefined
    if (inHand) showPreview(inHand)
    else void fetchPreview(...downloadArgs())
    pushRecent(currentSnapshot)
  }

  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  // ── Guidance: a tour per generator tab, once per browser, and a Help menu to run it again ──
  const [tour, setTour] = useState<'backend' | 'frontend' | 'fullstack' | null>(null)
  useEffect(() => {
    const ready = TOUR_READY[view]
    if (!ready) return
    try {
      if (localStorage.getItem(`tour:${ready.id}`) === 'done') return
    } catch {
      return
    }
    // Someone who followed a shared link came for that setup, not for a tour.
    const params = new URLSearchParams(window.location.search)
    params.delete('tab')
    if ([...params.keys()].length > 0) return
    // The tab may still be loading (a lazy chunk, the catalog): wait for one of its parts, and
    // never open over a dialog.
    let tries = 0
    const timer = window.setInterval(() => {
      tries += 1
      if (document.querySelector(ready.anchor) && !document.querySelector('[role="dialog"]')) {
        window.clearInterval(timer)
        setTour(ready.id)
      } else if (tries > 20) {
        window.clearInterval(timer)
      }
    }, 600)
    return () => window.clearInterval(timer)
  }, [view])

  function openShortcuts(): void {
    // Each generator tab owns its sheet; the other two register it as a command.
    if (view === 'initializr') setShortcutsOpen(true)
    else if (!runCommand('fe-shortcuts')) runCommand('fs-shortcuts')
  }

  // What the palette and the keyboard can ask of the shell. Through a ref, so the commands are
  // registered once and still run the latest closures — and registering (which re-renders this
  // component, a subscriber of the registry) can never depend on something that render changed.
  const toggleDock = () => changeDock(!dockOpen)
  const shellNow = {
    generate: handleGenerate, explore: handleExplore, reset: handleReset, share: handleShare, toggleDock,
    goToView: (next: View) => withViewTransition(() => setView(next), { name: 'view' }),
    toggleTheme: () => withViewTransition(() => setIsDark(d => !d), { name: 'theme', origin: { x: window.innerWidth - 80, y: 32 } }),
    startTour: () => {
      const id = TOUR_READY[view]?.id
      if (id) setTour(id)
      else setAppToast({ message: 'Open the Backend, Frontend or Fullstack tab to take its tour', type: 'error' })
    },
  }
  const shell = useRef(shellNow)
  shell.current = shellNow

  // ⌘K, on every tab: the tabs themselves and the app's own switches.
  useEffect(() => registerCommands([
    ...NAV.map(item => ({
      id: `go-${item.view}`, title: `Go to ${item.label}`, icon: item.icon, group: 'Go to',
      run: () => shell.current.goToView(item.view),
    })),
    { id: 'app-theme', title: 'Switch between light and dark', icon: 'contrast', group: 'App', run: () => shell.current.toggleTheme() },
    { id: 'app-motion', title: 'Turn animations on or off', icon: 'motion_photos_on', group: 'App', run: () => setMotionEnabled(m => !m) },
    { id: 'app-share', title: 'Copy a link to this setup', icon: 'share', group: 'App', run: () => shell.current.share() },
    { id: 'app-tour', title: 'Take the tour of this tab', icon: 'tour', group: 'App', run: () => shell.current.startTour() },
  ], 'global'), [])

  // ⌘K on the Backend tab: the header's actions. The dependency picker, the presets and the model
  // bar register their own (`backend-deps`, `backend-presets`, `backend-model`).
  useEffect(() => {
    if (view !== 'initializr') return
    return registerCommands([
      { id: 'backend-generate', title: 'Generate and download the project', icon: 'download', group: 'Backend', shortcut: 'Ctrl+Enter', run: () => { void shell.current.generate() } },
      { id: 'backend-explore', title: 'Explore the generated files', icon: 'folder_open', group: 'Backend', shortcut: 'Ctrl+Shift+E', run: () => shell.current.explore() },
      { id: 'backend-compare', title: 'Compare starter templates', icon: 'compare_arrows', group: 'Backend', run: () => setCompareOpen(true) },
      { id: 'backend-multi-module', title: 'Turn the multi-module project on or off', icon: 'account_tree', group: 'Backend', run: () => setMultiModuleEnabled(v => !v) },
      { id: 'backend-file-dock', title: 'Show or hide the project files', description: 'The files this setup generates, kept current as you change it', icon: 'account_tree', group: 'Backend', run: () => shell.current.toggleDock() },
      { id: 'backend-reset', title: 'Reset the project to defaults', icon: 'restart_alt', group: 'Backend', run: () => shell.current.reset() },
      { id: 'backend-shortcuts', title: 'Keyboard shortcuts', icon: 'keyboard', group: 'Backend', shortcut: '?', run: () => setShortcutsOpen(true) },
    ], 'backend')
  }, [view, setMultiModuleEnabled])

  // The Backend tab's keys ("/" is the dependency picker's, Ctrl+S the preset picker's).
  useHotkeys([
    { key: 'Enter', ctrl: true, run: () => { void shell.current.generate() } },
    { key: 'e', ctrl: true, shift: true, run: () => shell.current.explore() },
    { key: '?', run: () => setShortcutsOpen(true) },
  ], view === 'initializr')

  // The backend answered, and refused: its access gate is on and this browser carries no sign-in
  // header. Not the "cannot reach" screen — that one keeps knocking, which would never help here.
  if (error && blocked) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-background" />}>
        <AccessBlocked detail={error} retrying={retrying} onRetry={reloadMetadata} />
      </Suspense>
    )
  }

  if (error) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-background" />}>
        <BackendUnreachable error={error} retrying={retrying} onRetry={reloadMetadata} />
      </Suspense>
    )
  }

  function goTo(item: (typeof NAV)[number]): void {
    withViewTransition(() => setView(v => (item.toggle && v === item.view ? 'initializr' : item.view)), { name: 'view' })
  }

  // The theme changes in a circle growing from wherever it was asked for.
  function toggleTheme(from?: { x: number; y: number }): void {
    withViewTransition(() => setIsDark(d => !d), { name: 'theme', origin: from ?? { x: window.innerWidth - 80, y: 32 } })
  }

  // The Frontend and Fullstack tabs portal their own Reset / Explore / Generate into the header;
  // on every other view the header shows the Backend generator's.
  const backendActions = view !== 'frontend' && view !== 'fullstack'
  const navItems: MenuItem[] = NAV.map(item => ({
    id: item.view, label: item.label, icon: item.icon, current: view === item.view, onSelect: () => goTo(item),
  }))
  // The header's secondary actions, for the "more" menu that stands in for them below `lg`.
  const tourOfView = TOUR_READY[view]?.id
  const helpItems: MenuItem[] = [
    ...(tourOfView ? [
      { id: 'tour', label: 'Take the tour', icon: 'tour', onSelect: () => setTour(tourOfView) },
      { id: 'keys', label: 'Keyboard shortcuts', icon: 'keyboard', onSelect: openShortcuts },
    ] : []),
    { id: 'guide', label: 'Guide', icon: 'menu_book', onSelect: () => shell.current.goToView('guide') },
    { id: 'training', label: 'Training', icon: 'school', onSelect: () => shell.current.goToView('tutorial') },
  ]
  const moreItems: MenuItem[] = [
    { id: 'share', label: 'Copy share link', icon: 'share', onSelect: handleShare },
    ...(backendActions ? [{ id: 'reset', label: 'Reset to defaults', icon: 'restart_alt', onSelect: handleReset }] : []),
    {
      id: 'motion', label: motionEnabled ? 'Disable animations' : 'Enable animations',
      icon: motionEnabled ? 'motion_photos_on' : 'motion_photos_paused', onSelect: () => setMotionEnabled(m => !m),
    },
    {
      id: 'theme', label: isDark ? 'Switch to light mode' : 'Switch to dark mode',
      icon: isDark ? 'light_mode' : 'dark_mode', onSelect: () => toggleTheme(),
    },
  ]

  return (
    <MotionConfig reducedMotion={motionEnabled ? 'user' : 'always'}>
    <div className="min-h-screen bg-background text-on-background">
      {/* Top Nav */}
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-16 glass-header">
        {/* Conveyor belt accent running along the bottom of the header */}
        <div className="factory-conveyor absolute bottom-0 left-0 right-0 h-[3px] pointer-events-none" aria-hidden="true" />
        <div className="flex items-center gap-2 lg:gap-6 xl:gap-8 min-w-0">
          {/* Below `lg` the tabs do not fit in a row beside the actions: the same list, as a menu. */}
          <PopoverMenu className="lg:hidden" label="Open navigation" icon="menu" items={navItems} align="left" />
          <span className="flex items-center gap-2 text-xl font-bold text-on-surface tracking-tighter whitespace-nowrap">
            <span className="relative inline-flex items-center justify-center w-6 h-5 text-primary" aria-hidden="true">
              <span className="factory-gear-cw material-symbols-outlined absolute -left-0.5" style={{ fontSize: '18px' }}>settings</span>
              <span className="factory-gear-ccw material-symbols-outlined absolute right-0 bottom-0 text-primary/70" style={{ fontSize: '12px' }}>settings</span>
            </span>
            <span className="hidden sm:inline">Menora Initializr</span>
          </span>
          <nav className="hidden lg:flex items-center gap-4 xl:gap-6" aria-label="Sections">
            {NAV.map(item => (
              <button
                key={item.view}
                type="button"
                onClick={() => goTo(item)}
                aria-current={view === item.view ? 'page' : undefined}
                className={`relative py-1 text-sm transition-colors duration-200 ${view === item.view ? 'text-on-surface font-semibold' : 'text-secondary hover:text-on-surface'}`}
              >
                {item.label}
                {view === item.view && <span className="nav-indicator" aria-hidden="true" />}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* Search button */}
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest hover:bg-surface-container-high transition-colors duration-200 text-secondary hover:text-on-surface group shadow-sm"
            aria-label="Open the command palette"
            data-tip="Search and commands · Ctrl+K"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>search</span>
            <span className="hidden sm:inline lg:hidden xl:inline text-xs font-medium">Search</span>
            <span className="hidden sm:flex border border-outline-variant bg-surface-container rounded px-1.5 py-0.5 text-[10px] font-bold text-secondary group-hover:text-on-surface">⌘K</span>
          </button>

          {/* Share, Reset, animations and theme sit in the row from `xl` up; below it they are
              the "more" menu further down, so the row keeps room for Explore and Generate. */}
          <div className="hidden xl:contents">
          {/* Share button */}
          <button
            onClick={handleShare}
            className="p-2 rounded text-secondary hover:text-on-surface transition-colors duration-200"
            aria-label="Copy share link"
            data-tip="Copy a link to this setup"
          >
            <AnimatePresence mode="wait">
              {shareCopied ? (
                <motion.span
                  key="check"
                  className="material-symbols-outlined"
                  style={{ fontSize: '20px', display: 'block' }}
                  initial={{ opacity: 0, scale: 0.3, rotate: 90 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.3 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                >
                  check
                </motion.span>
              ) : (
                <motion.span
                  key="share"
                  className="material-symbols-outlined"
                  style={{ fontSize: '20px', display: 'block' }}
                  initial={{ opacity: 0, scale: 0.3, rotate: -90 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.3, rotate: 90 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                >
                  share
                </motion.span>
              )}
            </AnimatePresence>
          </button>
          {/* Reset button — backend views only; FrontendView portals its own reset into header-frontend-reset (same slot) */}
          {backendActions && (
          <button
            onClick={handleReset}
            className="p-2 rounded text-secondary hover:text-on-surface transition-colors duration-200"
            aria-label="Reset to defaults"
            data-tip="Reset to defaults"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>restart_alt</span>
          </button>
          )}
          </div>
          <div id="header-frontend-reset" className="contents" />
          <div className="hidden xl:contents">
          {/* Animations toggle */}
          <button
            onClick={() => setMotionEnabled(m => !m)}
            className="p-2 rounded text-secondary hover:text-on-surface transition-colors duration-200"
            aria-label="Toggle animations"
            aria-pressed={motionEnabled}
            data-tip={motionEnabled ? 'Disable animations' : 'Enable animations'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
              {motionEnabled ? 'motion_photos_on' : 'motion_photos_paused'}
            </span>
          </button>
          {/* Theme toggle */}
          <button
            onClick={e => {
              const box = e.currentTarget.getBoundingClientRect()
              toggleTheme({ x: box.left + box.width / 2, y: box.top + box.height / 2 })
            }}
            className="p-2 rounded text-secondary hover:text-on-surface transition-colors duration-200"
            aria-label="Toggle theme"
            data-tip={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
              {isDark ? 'light_mode' : 'dark_mode'}
            </span>
          </button>
          </div>
          <PopoverMenu className="xl:hidden" label="More actions" icon="more_vert" items={moreItems} />
          <PopoverMenu label="Help" icon="help" items={helpItems} />
          {/* The tours point at this group: Explore and Generate, whichever tab drew them. */}
          <div className="flex items-center gap-1.5 sm:gap-3" data-tour="actions">
          {backendActions && (
          <button
            onClick={handleExplore}
            disabled={previewLoading || !formValid}
            title={!formValid ? (firstFormError ? `Fix project metadata: ${firstFormError}` : 'Fix project metadata first') : previewError ? (previewError.kind ? `${previewError.kind}: ${previewError.message}` : previewError.message) : 'Preview project files before downloading'}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${previewError && formValid ? 'text-error' : 'text-secondary hover:text-on-surface'}`}
          >
            {previewLoading
              ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: '16px' }}>progress_activity</span>
              : 'Explore'}
          </button>
          )}
          {backendActions && generatingSlow && (
          <button
            type="button"
            onClick={cancelGenerate}
            className="px-3 py-1.5 rounded text-sm font-medium text-secondary hover:text-on-surface transition-colors animate-fade-in"
          >
            Cancel
          </button>
          )}
          {backendActions && (
          <button
            onClick={handleGenerate}
            disabled={!formValid || generating}
            aria-disabled={!formValid || generating}
            aria-busy={generating}
            title={!formValid ? (firstFormError ? `Fix project metadata: ${firstFormError}` : 'Fix project metadata first') : 'Generate and download the project (Ctrl+Enter)'}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all duration-300 active:scale-95 animated-gradient-btn ${generateSuccess ? 'generate-success' : ''} ${!formValid ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''} ${generating ? 'cursor-progress' : ''}`}
            style={{ minWidth: '110px' }}
          >
            <AnimatePresence mode="wait">
              {generating ? (
                <motion.span
                  key="building"
                  className="flex items-center justify-center gap-1.5"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12 }}
                >
                  <span className="material-symbols-outlined animate-spin" style={{ fontSize: '16px' }} aria-hidden="true">progress_activity</span>
                  Building…
                </motion.span>
              ) : generateSuccess ? (
                <motion.span
                  key="success"
                  className="flex items-center justify-center gap-1.5"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check_circle</span>
                  Done!
                </motion.span>
              ) : (
                <motion.span
                  key="generate"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  Generate
                </motion.span>
              )}
            </AnimatePresence>
          </button>
          )}
          <div id="header-frontend-actions" className="contents" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      {/* With the file dock open, the page makes room for it from 1440px: a column of its own, never
          on top of the dependency panels. (Narrower, the dock is a drawer with a scrim — FileDock.) */}
      <main className={`pt-20 pb-8 min-h-screen bg-background relative overflow-clip transition-[padding] duration-200 ${view === 'initializr' && dockOpen ? 'min-[1440px]:pr-[300px]' : ''}`}>
        {/* Blueprint factory-floor grid behind the glow blobs */}
        <div className="factory-grid absolute inset-0 pointer-events-none" aria-hidden="true" />
        {/* Decorative ambient background blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-tertiary/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-[30%] right-[15%] w-[28%] h-[28%] bg-secondary/10 rounded-full blur-[120px] pointer-events-none" />

        {view === 'frontend' ? (
          <div className="relative z-10 animate-fade-in-up">
            <Suspense fallback={<ViewSkeleton />}>
              <FrontendView
                onGenerated={() => setAppToast({ message: 'Frontend project downloaded!', type: 'success' })}
                onError={(message) => setAppToast({ message, type: 'error' })}
                onReset={() => setAppToast({ message: 'Project reset to defaults', type: 'success' })}
              />
            </Suspense>
          </div>
        ) : view === 'fullstack' ? (
          <div className="relative z-10 animate-fade-in-up">
            <Suspense fallback={<ViewSkeleton />}>
              <FullstackView onOpenGuide={id => { setGuideTopic(prev => ({ id, n: (prev?.n ?? 0) + 1 })); setView('guide') }} />
            </Suspense>
          </div>
        ) : view === 'tutorial' ? (
          <div className="relative z-10 animate-fade-in-up">
            <Suspense fallback={<ViewSkeleton />}>
              <TutorialView onClose={() => setView('initializr')} />
            </Suspense>
          </div>
        ) : view === 'guide' ? (
          <div className="relative z-10 animate-fade-in-up">
            <Suspense fallback={<ViewSkeleton />}>
              <GuideView onClose={() => setView('initializr')} initialTopic={guideTopic} />
            </Suspense>
          </div>
        ) : view === 'admin' ? (
          <div className="relative z-10">
            <Suspense fallback={<ViewSkeleton />}>
              <AdminPage />
            </Suspense>
          </div>
        ) : loading ? (
          <div className="relative z-10">
            <InitializrSkeleton />
          </div>
        ) : (
          <>
          {genericPreviewError && (
            <div className="max-w-7xl mx-auto px-4 sm:px-8 relative z-10 mb-6">
              <div role="alert" className="glass-panel border-error-container rounded-xl px-4 py-3 flex items-start gap-3">
                <span className="material-symbols-outlined text-error mt-0.5" style={{ fontSize: '20px' }}>error</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-on-surface">Couldn't generate preview</p>
                  <p className="text-xs text-secondary mt-0.5 break-words">{genericPreviewError.message}</p>
                </div>
                <button
                  onClick={retryPreview}
                  disabled={previewLoading}
                  className="px-3 py-1 rounded-lg text-xs font-medium bg-primary text-on-primary hover:opacity-90 transition-opacity active:scale-95 disabled:opacity-60 shrink-0"
                >
                  {previewLoading ? 'Retrying…' : 'Retry'}
                </button>
                <button
                  onClick={clearPreviewError}
                  aria-label="Dismiss error"
                  className="p-1 rounded text-secondary hover:text-on-surface transition-colors shrink-0"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                </button>
              </div>
            </div>
          )}
          <div className="max-w-7xl mx-auto px-4 sm:px-8 relative z-10">
            <BackendModelBar update={backendUpdate}>
              <PageHeader icon="dns" title="Spring Boot Generator">
                Pick a stack and its dependencies and get a Menora-standard Spring Boot project as a ZIP.
              </PageHeader>
            </BackendModelBar>
            {lastRun && (
              <div className="mb-6">
                <Suspense fallback={null}>
                  <BackendNextSteps
                    run={lastRun}
                    stale={formValid && currentRequest().key !== lastRun.key}
                    onDismiss={() => setLastRun(null)}
                    onSavePreset={() => { runCommand('backend-save-preset') }}
                    onCopyCurl={() => { void copyCurl() }}
                    onShareLink={handleShare}
                    onExplore={handleExplore}
                    onCopied={(ok, what) => setAppToast(ok
                      ? { message: `${what} copied`, type: 'success' }
                      : { message: `Couldn't copy the ${what.toLowerCase()}`, type: 'error' })}
                  />
                </Suspense>
              </div>
            )}
          </div>
          <InitializrView
            metadata={metadata}
            templates={templates}
            moduleTemplates={moduleTemplates}
            extensions={extensions}
            compatibilityRules={compatibilityRules}
            sqlDialects={sqlDialects}
            sqlByDep={sqlByDep}
            onSqlByDepChange={handleSqlByDepChange}
            openApiCapableDeps={openApiCapableDeps}
            openApiByDep={openApiByDep}
            onOpenApiByDepChange={handleOpenApiByDepChange}
            soapCapableDeps={soapCapableDeps}
            soapByDep={soapByDep}
            onSoapByDepChange={handleSoapByDepChange}
            eventsCapableDeps={eventsCapableDeps}
            eventsByDep={eventsByDep}
            onEventsByDepChange={handleEventsByDepChange}
            sqlParseError={isWizardPreviewError ? previewError : null}
            form={form}
            formErrors={formErrors}
            selectedDeps={selectedDeps}
            selectedOptions={selectedOptions}
            activeTemplate={activeTemplate}
            multiModuleEnabled={multiModuleEnabled}
            selectedModules={selectedModules}
            onFormChange={handleFormChange}
            onDepsChange={handleDepsChange}
            onOptionsChange={handleOptionsChange}
            onTemplateSelect={handleTemplateSelect}
            onMultiModuleToggle={() => setMultiModuleEnabled(v => !v)}
            onModulesChange={setSelectedModules}
            onCompareOpen={() => setCompareOpen(true)}
            presets={presets}
            recents={recents}
            currentSnapshot={currentSnapshot}
            onPresetLoad={applySnapshot}
            onPresetSave={savePreset}
            onPresetDelete={deletePreset}
            onRecentDelete={deleteRecent}
            shareTooLarge={backendShareStatus === 'too-large'}
          />
          </>
        )}
      </main>

      {/* Compare Templates modal */}
      {compareOpen && (
        <Suspense fallback={<ViewSkeleton />}>
          <TemplateCompare
            templates={templates}
            metadata={metadata}
            extensions={extensions}
            onClose={() => setCompareOpen(false)}
          />
        </Suspense>
      )}

      {/* Project Preview modal */}
      {preview && (
        <Suspense fallback={<ViewSkeleton />}>
          <ProjectPreview
            preview={preview}
            previousPreview={previousPreview}
            artifactId={form.artifactId}
            onClose={clearPreview}
            onDownload={() => { void downloadProject(); clearPreview() }}
            initialPath={previewPath}
          />
        </Suspense>
      )}

      {view === 'initializr' && !loading && metadata && (
        <Suspense fallback={null}>
          <FileDock
            open={dockOpen}
            onOpenChange={changeDock}
            request={previewRequest}
            invalidReason={firstFormError}
            selected={selectedDeps}
            depName={depName}
            onOpenFile={openDockFile}
          />
        </Suspense>
      )}

      {/* Command Palette — mounted only while open so its catalog memos don't run on every keystroke */}
      {commandPaletteOpen && (
      <Suspense fallback={null}>
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        // The catalog items (deps/templates/config) act on the Backend tab's form; on the
        // Fullstack tab the palette lists that tab's own actions instead.
        metadata={view === 'initializr' ? metadata : null}
        templates={view === 'initializr' ? templates : []}
        actions={paletteActions}
        form={form}
        selectedDeps={selectedDeps}
        onSelectTemplate={handleTemplateSelect}
        onToggleDependency={(depId) => {
          const newSelected = selectedDeps.includes(depId)
            ? selectedDeps.filter(id => id !== depId)
            : [...selectedDeps, depId];
          handleDepsChange(newSelected);
        }}
        onFormChange={handleFormChange}
      />
      </Suspense>
      )}

      {shortcutsOpen && (
        <Suspense fallback={null}>
          <BackendShortcuts onClose={() => setShortcutsOpen(false)} />
        </Suspense>
      )}

      {tour && (
        <Suspense fallback={null}>
          <Tour tour={tour} onClose={() => setTour(null)} />
        </Suspense>
      )}

      {resetConfirmOpen && (
        <Suspense fallback={null}>
          <ConfirmDialog
            title="Reset project to defaults?"
            message="Your current form values and selected dependencies will be lost."
            confirmLabel="Reset"
            tone="danger"
            onConfirm={confirmReset}
            onCancel={() => setResetConfirmOpen(false)}
          />
        </Suspense>
      )}

      <AppToast toast={appToast} onClear={() => setAppToast(null)} />
    </div>
    </MotionConfig>
  )
}
