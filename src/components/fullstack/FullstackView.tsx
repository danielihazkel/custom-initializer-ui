import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FullstackNav } from '../../types'
import { createPortal } from 'react-dom'
import type { FullstackEntityDef, FullstackStarterRequest, Toast } from '../../types'
import { EntitiesEditor, countEntityErrors, newEntity, type EditorDensity, type EntityServerIssue, type NoticeAction } from './EntitiesEditor'
import { EntityNavigator, entityMatches, useActiveEntity } from './EntityNavigator'
import { SectionNav } from './SectionNav'
import { focusWithoutClipping, scrollToElement } from './scroll'
import { cssEscape, focusRowWhenRendered } from './focus'
import { FullstackPresets, type SaveTarget } from './FullstackPresets'
import { ImportFromDdlDrawer, type ImportVariant } from './ImportFromDdlDrawer'
import type { DatabaseMode } from './DatabaseDrawer'
import { ViewSkeleton } from '../Skeletons'
import { ConfirmDialog } from '../ConfirmDialog'
import { PageHeader } from '../shared/PageHeader'
import { useBusy } from '../../utils/busy'
import { StatusToast } from '../admin/shared/StatusToast'
import { newUid, reconcileUids, withUids } from './uid'
import { toCamelCase, uniqueName } from './naming'
import {
  describeSnapshotChange, makeSnapshot, normalizeMeta, requestFromSnapshot, snapshotChangeKey, snapshotsEqual, toExportedModel,
  type FullstackSnapshot, type ProjectMeta,
} from './snapshot'
import { lintModel, type LintIssue } from './lint'
import { ModelLintPanel } from './ModelLintPanel'
import { ModelNotices } from './ModelNotices'
import { FullstackSetupPanel } from './FullstackSetupPanel'
import { EntitiesToolbar } from './EntitiesToolbar'
import { entityCodeFiles } from './entityCode'
import { HeaderActions } from './HeaderActions'
import { SetupSummaryBar } from './SetupSummaryBar'
import { describeSetup } from './setupSummary'
import { NextStepsPanel, type GeneratedRun } from './NextStepsPanel'
import { ShortcutsOverlay } from './ShortcutsOverlay'
import { frontendSetDefaults } from './frontendSetDefaults'
import { MAX_ENCODED_LENGTH, clearShareFromLocation, writeShareToLocation, type ShareWriteStatus } from './shareLink'
import { isTypingTarget } from './undo'
import { DEFAULT_ENTITIES, DEFAULT_ENTITIES_JSON, DEFAULT_META, DEFAULT_SCAFFOLD_OPTS, LS, loadJson, persist, resolveInitialModel } from './fullstackStorage'
import { useModelPersistence } from './useModelPersistence'
import { useFollowRenames } from './useFollowRenames'
import { useSnapshotHistory } from './useSnapshotHistory'
import { useTemplateSets } from './useTemplateSets'
import { useProjectUpdate } from './useProjectUpdate'
import { useGenerateFlow } from './useGenerateFlow'
import { useModelLoaders } from './useModelLoaders'
import { PagesSection } from './designer/PagesSection'
import type { DesignerTarget } from './designer/LayoutDesigner'
import type { FrontendAppearance } from './designer/FrontendSettings'
import { appliedBaseline } from './updateBaseline'
import { UpdatePanel } from './UpdatePanel'
import { locateServerIssue, type ServerIssue, type ServerTarget } from './serverIssue'
import { seedLayout, validatePages } from './pageLayout'
import { downloadBlob } from '../../utils/download'
import { copyToClipboard } from '../../utils/clipboard'
import { useFrontendMetadata } from '../../hooks/useFrontendMetadata'
import { useCompatibility } from '../../hooks/useCompatibility'
import { registerCommands } from '../../commands'
import { useStableCallback } from '../../hooks/useStableCallback'

// The preview modal drags in CodeMirror + every language grammar; load it on first Explore.
const ProjectPreview = lazy(() => import('../ProjectPreview').then(m => ({ default: m.ProjectPreview })))
// The relation graph (d3-force, drag, zoom) is shown only when it is switched on.
const DatabaseDrawer = lazy(() => import('./DatabaseDrawer').then(m => ({ default: m.DatabaseDrawer })))
const EntityRelationGraph = lazy(() => import('./EntityRelationGraph').then(m => ({ default: m.EntityRelationGraph })))
import { useFullstackPreview } from '../../hooks/useFullstackPreview'
import { useFullstackPresets } from '../../hooks/useFullstackPresets'
import { useTeamModels } from '../../hooks/useTeamModels'
import { notYours } from '../../utils/teamAuth'
import { useFullstackExamples } from '../../hooks/useFullstackExamples'
import type { FullstackPageDef } from '../../types'
import { useAdminMetadata } from '../../hooks/useAdminMetadata'
import { canonicalVersion, validateEntities, validateMeta, countMetaErrors, type MetaErrors } from './validation'
import { t, tn, useLang } from '../../i18n'

export function FullstackView({ onOpenGuide }: { onOpenGuide?: (topicId: string) => void } = {}) {
  const initRef = useRef<ReturnType<typeof resolveInitialModel> | undefined>(undefined)
  if (initRef.current === undefined) initRef.current = resolveInitialModel()
  const { shared, pendingShared } = initRef.current

  // normalizeMeta fills in settings that predate a stored model (name/version/packaging/locale…).
  const [meta, setMeta] = useState<ProjectMeta>(() => normalizeMeta(shared?.meta ?? loadJson<Partial<ProjectMeta>>(LS.meta, DEFAULT_META)))
  const [entities, setEntities] = useState<FullstackEntityDef[]>(() => withUids(shared?.entities ?? loadJson(LS.entities, DEFAULT_ENTITIES)))
  const [backendSet, setBackendSet] = useState(() => shared?.backendSet ?? localStorage.getItem(LS.backendSet) ?? 'spring-jpa-crud')
  const [frontendSet, setFrontendSet] = useState(() => shared?.frontendSet ?? localStorage.getItem(LS.frontendSet) ?? 'react-tailwind-crud')
  const [generating, setGenerating] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  // Validation, lint and the setup summary are in the site's language: they are worked out again
  // when it changes (the language is in their memo deps).
  const lang = useLang()
  const [importVariant, setImportVariant] = useState<ImportVariant | null>(null)
  // The model's tables drawer (export the DDL / create them on a source); null while closed.
  const [databaseMode, setDatabaseMode] = useState<DatabaseMode | null>(null)
  const [selectedDeps, setSelectedDeps] = useState<string[]>(() => shared?.selectedDeps ?? loadJson<string[]>(LS.deps, []))
  const [scaffoldOpts, setScaffoldOpts] = useState<string[]>(() => shared?.scaffoldOpts ?? loadJson<string[]>(LS.opts, DEFAULT_SCAFFOLD_OPTS))
  // '' = follow the frontend set's default palette (the backend resolves it; nothing is sent).
  const [colorPalette, setColorPalette] = useState<string>(() => shared ? (shared.colorPalette ?? '') : (localStorage.getItem(LS.palette) ?? ''))
  // The frontend page layout — empty = the classic shell. Arrives with an example / preset / link.
  const [pages, setPages] = useState<FullstackPageDef[]>(() => shared ? (shared.pages ?? []) : loadJson<FullstackPageDef[]>(LS.pages, []))
  // The generated shell's navigation for the layout (sidebar/top bar, folding sections).
  const [nav, setNav] = useState<FullstackNav | undefined>(() => shared ? shared.nav : (loadJson<FullstackNav | null>(LS.nav, null) ?? undefined))
  const [dismissedWarnings, setDismissedWarnings] = useState<string[]>(() => shared ? (shared.dismissedWarnings ?? []) : loadJson<string[]>(LS.dismissed, []))
  // A Generate / Explore 400 that says where it is (or names a page): shown on that entity, field
  // or page until the model changes.
  const [serverIssue, setServerIssue] = useState<ServerIssue | null>(null)
  useEffect(() => { setServerIssue(null) }, [pages, entities])
  const serverTarget = useMemo(() => locateServerIssue(serverIssue, pages), [serverIssue, pages])
  const pageServerIssue = useMemo(
    () => (serverIssue && serverTarget?.kind === 'page' ? { page: serverTarget.page, message: serverIssue.message } : null),
    [serverIssue, serverTarget])
  const entityServerIssue = useMemo<EntityServerIssue | null>(
    () => (serverIssue && serverTarget?.kind === 'entity'
      ? { entity: serverTarget.entity, field: serverTarget.field, relation: serverTarget.relation, panel: serverTarget.panel, message: serverIssue.message }
      : null),
    [serverIssue, serverTarget])
  // Bumped to make the page editor open its first problem (the sticky bar's "jump to error").
  const [pagesReveal, setPagesReveal] = useState(0)
  // Bumped by the command palette: open the "Add page" gallery / the layout preview.
  const [pagesAdd, setPagesAdd] = useState(0)
  const [pagesFind, setPagesFind] = useState(0)
  const [pagesPreview, setPagesPreview] = useState(0)
  // Opens the layout designer on a target — the Setup panel's frontend row lands on Appearance.
  const [designerRequest, setDesignerRequest] = useState<{ n: number; target: DesignerTarget } | null>(null)
  const openAppearance = () => setDesignerRequest(prev => ({ n: (prev?.n ?? 0) + 1, target: { panel: 'appearance' } }))
  // Collapsed cards survive a refresh: entities persist with their uids, so the uid set stays valid.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(shared ? [] : loadJson<string[]>(LS.collapsed, [])))
  const [confirmReset, setConfirmReset] = useState(false)
  const [shareStatus, setShareStatus] = useState<ShareWriteStatus>('written')
  const [showGraph, setShowGraph] = useState<boolean>(() => loadJson<boolean>(LS.graph, false))
  // Setup is a once-per-project job, so it collapses to a summary bar and gives the viewport to
  // the entity modeller. A first-ever visit (no stored model) opens it, because there is nothing
  // to model yet and the defaults deserve a look.
  const [setupOpen, setSetupOpen] = useState<boolean>(() => {
    const stored = localStorage.getItem(LS.setup)
    if (stored) return stored === 'open'
    return localStorage.getItem(LS.entities) === null
  })
  const [density, setDensity] = useState<EditorDensity>(() => (localStorage.getItem(LS.density) === 'compact' ? 'compact' : 'comfortable'))
  // The entity outline's filter — also narrows which cards render.
  const [entityFilter, setEntityFilter] = useState('')
  // The suggestions panel is controlled here so an entity card's amber badge can open it on
  // that entity's issues.
  const [lintOpen, setLintOpen] = useState(false)
  const [lintFilterUid, setLintFilterUid] = useState<string | null>(null)
  // The last successful Generate — drives the "Next steps" card. Memory only; a refresh clears it.
  const [lastGenerated, setLastGenerated] = useState<GeneratedRun | null>(null)
  // The model as it stood when the last preview was fetched — lets each entity's Code panel
  // say whether what it is showing still matches what the card says.
  const previewSnapshotRef = useRef<FullstackSnapshot | null>(null)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  // Opens the presets strip's save prompt from elsewhere (Ctrl+S, the Next steps card).
  const [saveRequest, setSaveRequest] = useState<{ target: SaveTarget; key: number; draft?: { name: string; description: string } } | null>(null)
  const {
    preview, previousPreview, loading: previewLoading, error: previewError,
    fetchPreview, fetchComparison, clearPreview, clearError, cancel: cancelPreview,
  } = useFullstackPreview()
  // The header's conveyor and gears run while a request is out (see utils/busy.ts).
  useBusy(generating || previewLoading)
  // A preview (Explore) 400 that names a page is shown on that page, like a Generate one is.
  useEffect(() => {
    if (!previewError) return
    const issue: ServerIssue = { message: previewError.message, path: previewError.path }
    if (locateServerIssue(issue, pages)) showServerIssue(issue)
    // Only when the answer arrives: `pages` is read as it was sent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewError])
  const { presets, recents, persistFailed: presetsPersistFailed, savePreset, deletePreset, restorePreset, deleteRecent, restoreRecent, pushRecent } = useFullstackPresets()
  const team = useTeamModels()
  const exampleModels = useFullstackExamples()

  const { bootVersions: rawBootVersions, javaVersions, packagings } = useAdminMetadata()
  // The client metadata spells Boot versions "3.2.1.RELEASE"; the fullstack endpoint and the template
  // sets pin the catalog id "3.2.1" — list and store the canonical form only.
  const bootVersions = useMemo(() => Array.from(new Set(rawBootVersions.map(canonicalVersion))), [rawBootVersions])
  const { metadata: feMetadata, error: feError, reload: reloadFe } = useFrontendMetadata()
  const { rules: compatibilityRules } = useCompatibility('BACKEND')
  const { availableSets, setsLoading, setsError, loadTemplateSets } = useTemplateSets()
  const currentBackendSet = availableSets.find(s => s.setKey === backendSet)
  const currentFrontendSet = availableSets.find(s => s.setKey === frontendSet)
  const currentDefaults = currentBackendSet?.defaultDeps ?? []
  const palettes = useMemo(() => feMetadata?.colorPalettes ?? [], [feMetadata])
  // What the generator will actually use: the explicit pick, else the set's default, else the
  // catalog default — mirrors FullstackStarterController's resolution so the swatch is truthful.
  const setDefaultPalette = currentFrontendSet?.defaultPaletteId
    ?? palettes.find(p => p.isDefault)?.id ?? palettes[0]?.id ?? ''
  const effectivePalette = colorPalette || setDefaultPalette
  const previewPalette = palettes.find(p => p.id === effectivePalette)
  // The layout preview draws the shell of the chosen frontend set, in the chosen chrome language
  // and colour palette.
  const pagesPreviewSettings = useMemo(() => ({
    locale: meta.locale,
    projectOpts: scaffoldOpts,
    skin: (currentFrontendSet?.designSystem === 'MENORA_DIGITAL' || frontendSet.includes('menora') ? 'menora' : 'tailwind') as 'menora' | 'tailwind',
    palette: previewPalette,
    dashboardTitle: meta.dashboardTitle,
    dashboardOverview: meta.dashboardOverview,
  }), [meta.locale, meta.dashboardTitle, meta.dashboardOverview, scaffoldOpts, currentFrontendSet, frontendSet, previewPalette])

  // Validation — mirrors the backend FullstackRequestValidator so problems surface inline
  // before submit. The server stays the source of truth.
  const ldapAuth = selectedDeps.some(d => d === 'ldap-auth' || d === 'ldap-auth-rest')
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the messages are in the site's language
  const entityErrors = useMemo(() => validateEntities(entities, scaffoldOpts, { ldapAuth, deps: selectedDeps }), [entities, scaffoldOpts, ldapAuth, selectedDeps, lang])
  const metaErrors: MetaErrors = useMemo(
    () => validateMeta(meta, { bootVersions, javaVersions }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the messages are in the site's language
    [meta, bootVersions, javaVersions, lang],
  )
  // A layout outlives the entities it names (rename / delete) — flagged here, not as a 400 later.
  // Page roles are enforced by the generated backend's LDAP groups, so they need an LDAP auth variant (ldap-auth-rest, the sets' default, or ldap-auth).
  const pageValidation = useMemo(() => validatePages(pages, entities, { ldapAuth, scaffoldOpts, dismissed: dismissedWarnings }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the messages are in the site's language
    [pages, entities, ldapAuth, scaffoldOpts, dismissedWarnings, lang])
  const errorCount = entityErrors.count + countMetaErrors(metaErrors) + pageValidation.count
  const hasErrors = errorCount > 0

  // The draft is kept in this browser as it changes (useModelPersistence.ts).
  const { persistFailed, flushEntities, lastWrittenEntitiesRef, externalDraft, setExternalDraft } = useModelPersistence({
    meta, entities, selectedDeps, backendSet, frontendSet, scaffoldOpts, colorPalette, pages, nav, dismissedWarnings,
    collapsed, showGraph, setupOpen, density,
  })

  // The whole editor state as one detached value — what presets/recents/undo/share links carry.
  const currentSnapshot = useMemo(
    () => makeSnapshot({ meta, entities, selectedDeps, scaffoldOpts, backendSet, frontendSet, colorPalette, pages, nav, dismissedWarnings }),
    [meta, entities, selectedDeps, scaffoldOpts, backendSet, frontendSet, colorPalette, pages, nav, dismissedWarnings],
  )
  const snapshotRef = useRef(currentSnapshot)
  snapshotRef.current = currentSnapshot
  // The snapshot a silent (already-recorded, or non-user) change starts from — matched by
  // identity when the undo history sees the change, then cleared.
  const silentFromRef = useRef<FullstackSnapshot | null>(null)
  // The live entity list (with uids) for callbacks that outlive a render — undo's uid reconciliation.
  const entitiesRef = useRef(entities)
  entitiesRef.current = entities

  // A rename is followed into the layout and the other entities (useFollowRenames.ts). The flag
  // is set when it rewrote something, so undo files the rename and what followed as one step.
  const followsModelRef = useRef(false)
  useFollowRenames(entities, setPages, setEntities, followsModelRef)

  // Keep the URL in step (debounced) so the header's Share button copies a link that reproduces
  // this model elsewhere. The frontend tab does the same with plain query params; the entity
  // model is too rich for that, so it rides as one encoded `fs` param.
  useEffect(() => {
    const t = setTimeout(() => setShareStatus(writeShareToLocation(currentSnapshot)), 400)
    return () => clearTimeout(t)
  }, [currentSnapshot])
  // Leaving the tab drops the payload from the URL so the other tabs' Share links stay short;
  // localStorage still restores the model when the user comes back.
  useEffect(() => () => clearShareFromLocation(), [])

  // "Unsaved work" guard for the loads that replace the model (examples, presets, recents).
  // Work counts as safe when it is the stock model, the thing most recently loaded, or already
  // captured by a preset/recent (Explore and Generate push recents) — only genuinely unsaved
  // edits get a confirm; the rest stays one click, with Undo as the fallback.
  const baselineRef = useRef<FullstackSnapshot | null>(null)
  useEffect(() => {
    if (baselineRef.current === null) baselineRef.current = currentSnapshot
  }, [currentSnapshot])
  const hasUnsavedWork = useMemo(() => {
    if (JSON.stringify(currentSnapshot.entities) === DEFAULT_ENTITIES_JSON) return false
    if (baselineRef.current && snapshotsEqual(currentSnapshot, baselineRef.current)) return false
    return ![...presets, ...recents].some(p => snapshotsEqual(p.snapshot, currentSnapshot))
  }, [currentSnapshot, presets, recents])

  // Closing the tab normally costs nothing — localStorage restores the draft. Once storage has
  // refused a write, that safety net is gone, so ask before the unsaved model is lost.
  useEffect(() => {
    if (!(hasUnsavedWork && persistFailed)) return
    const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [hasUnsavedWork, persistFailed])

  // Drop a stale preview error once the user changes any input, so the Explore button
  // doesn't stay error-styled (with the message hidden in a tooltip) after they've moved on.
  useEffect(() => { clearError() }, [meta, entities, selectedDeps, backendSet, frontendSet, scaffoldOpts, colorPalette, pages, clearError])

  // Reseed deps + pre-fill Boot/Java versions from the chosen backend set's pins. We only do
  // this on a *genuine* user change of the backend set — never on initial hydration, so a
  // restored selection (deps/versions) isn't clobbered when availableSets loads. The pins are
  // advisory: the user can still override the version dropdowns afterwards.
  const seededBackendSetRef = useRef<string | null>(null)
  useEffect(() => {
    if (!currentBackendSet) return
    if (seededBackendSetRef.current === null) {
      // First resolution after load — adopt without overwriting restored state. Only seed
      // defaults if we have no saved deps at all (first-ever visit). That seeding is setup,
      // not a user edit, so it must not become an undo step.
      seededBackendSetRef.current = currentBackendSet.setKey
      if (snapshotRef.current.selectedDeps.length === 0) {
        silentFromRef.current = snapshotRef.current
        setSelectedDeps([...currentBackendSet.defaultDeps])
      }
      return
    }
    if (seededBackendSetRef.current !== currentBackendSet.setKey) {
      const prevSet = availableSets.find(s => s.setKey === seededBackendSetRef.current)
      const prevDefaults = new Set(prevSet?.defaultDeps ?? [])
      seededBackendSetRef.current = currentBackendSet.setKey
      // Re-seed the new set's defaults but keep any user-added extras (deps the
      // user selected that weren't defaults of the previous set), so switching
      // sets doesn't silently discard their custom picks.
      setSelectedDeps(prev => {
        const extras = prev.filter(d => !prevDefaults.has(d))
        return Array.from(new Set([...currentBackendSet.defaultDeps, ...extras]))
      })
      setMeta(prev => ({
        ...prev,
        bootVersion: currentBackendSet.bootVersion ?? prev.bootVersion,
        javaVersion: currentBackendSet.javaVersion ?? prev.javaVersion,
      }))
    }
  }, [currentBackendSet, availableSets])

  // Frontend sets can also declare a javaVersion (rare). Apply only on a genuine change.
  const seededFrontendSetRef = useRef<string | null>(null)
  useEffect(() => {
    if (!currentFrontendSet) return
    if (seededFrontendSetRef.current === null) {
      seededFrontendSetRef.current = currentFrontendSet.setKey
      return
    }
    if (seededFrontendSetRef.current !== currentFrontendSet.setKey) {
      seededFrontendSetRef.current = currentFrontendSet.setKey
      if (currentFrontendSet.javaVersion) {
        setMeta(prev => ({ ...prev, javaVersion: currentFrontendSet.javaVersion! }))
      }
      // A brand set implies its language/direction (Menora Digital → Hebrew + RTL), like the
      // standalone Frontend tab. Only on an explicit pick; the user can switch either back.
      const defaults = frontendSetDefaults(currentFrontendSet)
      if (defaults.locale) setMeta(prev => ({ ...prev, locale: defaults.locale! }))
      if (defaults.rtl) setScaffoldOpts(prev => prev.includes('rtl') ? prev : [...prev, 'rtl'])
    }
  }, [currentFrontendSet])

  /** Replaces the whole editor state. `keepView` (undo/redo) re-uses the current rows' uids for
   *  the rows that survive, so collapsed cards and open panels stay put instead of every card
   *  springing open; a load (preset, example, link) starts from a clean view. */
  const applySnapshot = useCallback((s: FullstackSnapshot, keepView = false) => {
    // Adopt the snapshot's sets as "already seeded" so the set-change effects above don't
    // re-seed deps/versions over the snapshot's own values.
    seededBackendSetRef.current = s.backendSet
    seededFrontendSetRef.current = s.frontendSet
    const restored = JSON.parse(JSON.stringify(s.entities)) as FullstackEntityDef[]
    const next = keepView ? reconcileUids(entitiesRef.current, restored) : withUids(restored)
    setMeta(normalizeMeta(s.meta))
    setEntities(next)
    setSelectedDeps([...s.selectedDeps])
    setScaffoldOpts([...s.scaffoldOpts])
    setBackendSet(s.backendSet)
    setFrontendSet(s.frontendSet)
    setColorPalette(s.colorPalette ?? '')
    setPages(s.pages ? JSON.parse(JSON.stringify(s.pages)) as FullstackPageDef[] : [])
    setNav(s.nav ? { ...s.nav } : undefined)
    setDismissedWarnings(s.dismissedWarnings ? [...s.dismissedWarnings] : [])
    if (keepView) {
      const alive = new Set(next.map(e => e.uid))
      setCollapsed(prev => new Set([...prev].filter(uid => alive.has(uid))))
    } else {
      setCollapsed(new Set())
    }
    baselineRef.current = null // adopt the loaded state as the new "nothing unsaved" point
  }, [])

  // ── Undo / redo ────────────────────────────────────────────────────────────
  // Every change to the snapshot is recorded by useSnapshotHistory; destructive actions push a
  // labelled entry first (pushUndoEntry), and undo and redo restore through applySnapshot.
  const { history, pushUndoEntry, undo, redo, jumpHistory } = useSnapshotHistory<FullstackSnapshot>({
    current: currentSnapshot,
    apply: applySnapshot,
    equal: snapshotsEqual,
    changeKey: snapshotChangeKey,
    describe: describeSnapshotChange,
    silentFromRef,
    followsRef: followsModelRef,
    notify: message => setToast({ message, type: 'success' }),
  })

  function clearPageLayout() {
    pushUndoEntry(t('Switched to the classic page layout'))
    setPages([])
  }

  // ── Portable model: JSON export, curl (the import is a loader) ────────────
  function exportJson() {
    const json = JSON.stringify(toExportedModel(currentSnapshot), null, 2)
    downloadBlob(new Blob([json], { type: 'application/json' }), `${meta.artifactId || 'model'}.fullstack.json`)
    setToast({ message: t('Model exported'), type: 'success' })
  }

  async function copyCurl() {
    const body = JSON.stringify(buildBody())
    // Single-quoted for POSIX shells; an embedded ' becomes '\'' so the body survives verbatim.
    const quoted = `'${body.replace(/'/g, `'\\''`)}'`
    const cmd = [
      `curl -X POST ${window.location.origin}/starter-fullstack.zip`,
      `-H 'Content-Type: application/json'`,
      `-o ${meta.artifactId || 'project'}.zip`,
      `-d ${quoted}`,
    ].join(' \\\n  ')
    // The body rides inline; past the share-link limit it is a clipboard payload worth a warning.
    const large = body.length > MAX_ENCODED_LENGTH
    setToast(await copyToClipboard(cmd)
      ? { message: large ? t('curl command copied ({size} KB inline — Export JSON and -d @file may be handier)', { size: Math.round(body.length / 1024) }) : t('curl command copied to clipboard'), type: 'success' }
      : { message: t("Couldn't copy — clipboard access was refused"), type: 'error' })
  }

  /** The header's Share button copies `location.href`; this does the same from the Next steps
   *  card, syncing the URL first so the link carries the model as it is now. */
  async function copyShareLink() {
    if (writeShareToLocation(currentSnapshot) === 'too-large') {
      setToast({ message: t('This model is too large for a share link — Export JSON to hand it over'), type: 'error' })
      return
    }
    setToast(await copyToClipboard(window.location.href)
      ? { message: t('Share link copied to clipboard'), type: 'success' }
      : { message: t("Couldn't copy — clipboard access was refused"), type: 'error' })
  }

  /** Opens the presets strip's save prompt on the given target and brings it into view. A
   *  `draft` pre-fills it (the team-conflict "Rename…" path). */
  function requestSave(target: SaveTarget, draft?: { name: string; description: string }) {
    setSaveRequest({ target, key: Date.now(), draft })
    scrollToElement(document.querySelector<HTMLElement>('[data-start-from]'), 'start')
  }

  const backendSets = availableSets.filter(s => s.kind === 'BACKEND_JAVA')
  const frontendSets = availableSets.filter(s => s.kind === 'FRONTEND_REACT')

  function buildBody(): FullstackStarterRequest {
    return requestFromSnapshot(currentSnapshot)
  }

  // ── Updating a project that already exists (useProjectUpdate.ts) ────────────
  const { baseline, setBaseline, updating, previewIsUpdate, setPreviewIsUpdate, previewUpdate, downloadUpdate } = useProjectUpdate({
    currentSnapshot, snapshotRef, previewSnapshotRef, artifactId: meta.artifactId, validateBeforeSubmit, buildBody,
    fetchComparison, showServerIssue, setToast,
  })

  // ── Bringing a model in, keeping one somewhere (useModelLoaders.ts) ─────────
  const {
    pendingLoad, setPendingLoad, pendingJsonImport, setPendingJsonImport,
    teamConflict, setTeamConflict, confirmDeleteTeam, setConfirmDeleteTeam,
    handleImport, loadPreset, runLoad, dismissPendingLoad, requestLoad,
    saveToTeam, overwriteTeamModel, loadTeamModel, deleteTeamModel,
    importJson, appendJsonImport, deletePresetWithUndo, deleteRecentWithUndo, savePresetAndReport,
  } = useModelLoaders({
    currentSnapshot, entityCount: entities.length, hasUnsavedWork, pendingShared, applySnapshot, pushUndoEntry, baselineRef,
    set: {
      entities: setEntities, pages: setPages, nav: setNav, dismissedWarnings: setDismissedWarnings, meta: setMeta,
      scaffoldOpts: setScaffoldOpts, backendSet: setBackendSet, frontendSet: setFrontendSet, colorPalette: setColorPalette,
      collapsed: setCollapsed,
    },
    backendSets, frontendSets, palettes, revealRow, setToast, setBaseline,
    presets: { savePreset, deletePreset, restorePreset, deleteRecent, restoreRecent },
    team,
  })

  function toggleOpt(value: string) {
    setScaffoldOpts(prev => prev.includes(value) ? prev.filter(o => o !== value) : [...prev, value])
  }

  // ── Jump to the first problem ──────────────────────────────────────────────
  // The sticky bar's issue count is a button: metadata errors focus their input; entity errors
  // expand the offending card (if collapsed) and scroll its first flagged control/banner into view.
  function jumpToFirstError() {
    if (countMetaErrors(metaErrors) > 0) {
      // Setup is collapsed by default; open it (a no-op when already open) and let it lay out
      // before reaching for the offending control.
      setSetupOpen(true)
      requestAnimationFrame(() => {
        const metaInvalid = document.querySelector<HTMLElement>('#fs-meta [aria-invalid="true"]')
        if (metaInvalid) focusWithoutClipping(metaInvalid, 'center')
      })
      return
    }
    const firstIdx = Object.keys(entityErrors.entities).map(Number).sort((a, b) => a - b)[0]
    const uid = firstIdx == null ? undefined : entities[firstIdx]?.uid
    if (uid) {
      // The card may be collapsed or hidden by the outline filter — revealRow handles both.
      revealRow(uid, { focus: '[aria-invalid="true"], [data-error]' })
      return
    }
    if (entityErrors.count === 0 && pageValidation.count > 0) {
      // The editor opens the first page with a problem and focuses the offending control.
      setPagesReveal(n => n + 1)
      return
    }
    requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>('#fs-entities [aria-invalid="true"], #fs-entities [data-error]')
        ?? document.querySelector<HTMLElement>('#fs-entities')
      if (target?.matches('input, select, textarea')) focusWithoutClipping(target, 'center')
      else scrollToElement(target, 'center')
    })
  }

  function validateBeforeSubmit(): boolean {
    if (hasErrors) {
      setToast({ message: tn(errorCount, 'Fix {n} validation issue first', 'Fix {n} validation issues first'), type: 'error' })
      jumpToFirstError()
      return false
    }
    return true
  }

  function explore() {
    if (!validateBeforeSubmit()) return
    pushRecent(currentSnapshot)
    // Stamp the model the preview is being built from, so each card's Code panel can tell
    // whether the files it shows still match what the card describes.
    previewSnapshotRef.current = currentSnapshot
    setPreviewIsUpdate(false)
    fetchPreview(buildBody())
  }

  // Generate, and its Cancel (useGenerateFlow.ts).
  const { generate, cancelGenerate } = useGenerateFlow({
    currentSnapshot, snapshotRef, artifactId: meta.artifactId, entities, scaffoldOpts, validateBeforeSubmit, buildBody,
    setGenerating, pushRecent, setBaseline, setLastGenerated, showServerIssue, setToast,
  })

  function updateMeta(updates: Partial<ProjectMeta>) {
    setMeta(prev => ({ ...prev, ...updates }))
  }

  // ── Reset ──────────────────────────────────────────────────────────────────
  // The header's global Reset (App.tsx) is hidden on this tab; the Reset button lives in the
  // sticky action bar below instead. FullstackDepPicker is fully controlled, so resetting
  // selectedDeps re-renders it — no remount needed. Confirmed in-app (ConfirmDialog) and undoable.
  function doReset() {
    setConfirmReset(false)
    pushUndoEntry(t('Reset to defaults'))
    Object.values(LS).forEach(k => localStorage.removeItem(k))
    setMeta({ ...DEFAULT_META })
    setEntities(withUids(DEFAULT_ENTITIES.map(e => ({ ...e, fields: e.fields.map(f => ({ ...f })) }))))
    setBackendSet('spring-jpa-crud')
    setFrontendSet('react-tailwind-crud')
    setScaffoldOpts([...DEFAULT_SCAFFOLD_OPTS])
    setColorPalette('')
    setPages([])
    setCollapsed(new Set())
    setLastGenerated(null)
    baselineRef.current = null
    // Re-seed deps from whichever backend set resolves; the set-change effect won't
    // fire if the key is unchanged, so seed explicitly here.
    const target = availableSets.find(s => s.setKey === 'spring-jpa-crud')
    setSelectedDeps(target ? [...target.defaultDeps] : [])
    clearPreview()
    setToast({ message: t('Fullstack generator reset to defaults'), type: 'success' })
  }

  function toggleCollapsed(uid: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(uid) ? next.delete(uid) : next.add(uid)
      return next
    })
  }
  const allCollapsed = entities.length > 0 && entities.every(e => e.uid && collapsed.has(e.uid))

  /** Brings an entity card on screen whatever hides it — the outline filter (cleared), a
   *  collapsed card (expanded) — then focuses its name, or the first control matching
   *  `opts.focus` (jump-to-error). Used by the diagram, the suggestions panel, the coverage chips,
   *  the issue counter, and every add/duplicate/restore so a new row is never created off screen. */
  /**
   * Puts a server-side problem where it belongs — on the entity card (revealed and focused), or
   * on the page — and answers what it was about; null when it names nothing the editor can show
   * it on, which the caller reports as a plain message.
   */
  function showServerIssue(issue: ServerIssue): ServerTarget | null {
    const target = locateServerIssue(issue, pages)
    if (!target || target.kind === 'setting') return target
    setServerIssue(issue)
    if (target.kind === 'entity') {
      const uid = entities[target.entity]?.uid
      if (uid) revealRow(uid, { focus: '[data-server-issue]' })
    }
    return target
  }

  function revealRow(uid: string, opts?: { focus?: string }) {
    if (visibleUids && !visibleUids.has(uid)) setEntityFilter('')
    setCollapsed(prev => { if (!prev.has(uid)) return prev; const next = new Set(prev); next.delete(uid); return next })
    // Two frames: the first lets the filter/collapse change render the card, the second scrolls.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const card = document.querySelector<HTMLElement>(`[data-row-uid="${cssEscape(uid)}"]`)
      if (!card) return
      if (opts?.focus) {
        const control = card.querySelector<HTMLElement>(opts.focus)
        if (control?.matches('input, select, textarea')) focusWithoutClipping(control, 'center')
        else scrollToElement(control ?? card, 'center')
        return
      }
      scrollToElement(card, 'start')
      card.querySelector<HTMLElement>('input')?.focus({ preventScroll: true })
    }))
  }

  // ── Suggestions (non-blocking lint) ────────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the messages are in the site's language
  const lintIssues = useMemo(() => lintModel(entities, scaffoldOpts, selectedDeps), [entities, scaffoldOpts, selectedDeps, lang])
  const lintCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const issue of lintIssues) if (issue.entityUid) counts.set(issue.entityUid, (counts.get(issue.entityUid) ?? 0) + 1)
    return counts
  }, [lintIssues])
  // An entity card's amber badge: open the panel on that entity's suggestions.
  function showLintFor(uid: string) {
    setLintFilterUid(uid)
    setLintOpen(true)
    requestAnimationFrame(() => scrollToElement(document.querySelector<HTMLElement>('[data-model-lint]'), 'nearest'))
  }
  // Drop a stale filter once its entity is gone or has nothing left to say.
  useEffect(() => {
    if (lintFilterUid && !lintCounts.has(lintFilterUid)) setLintFilterUid(null)
  }, [lintFilterUid, lintCounts])

  // ── Entity outline ─────────────────────────────────────────────────────────
  const activeEntityUid = useActiveEntity(entities)
  const visibleUids = useMemo(() => {
    if (!entityFilter.trim()) return undefined
    return new Set(entities.filter(e => e.uid && entityMatches(e, entityFilter)).map(e => e.uid!))
  }, [entities, entityFilter])
  // Stable identities for the entity editor's props, so it (memoized) skips rendering every
  // card when something else on the page changes — the layout designer above all.
  const editorCallbacks = {
    toggleCollapsed: useStableCallback(toggleCollapsed),
    revealRow: useStableCallback(revealRow),
    showLintFor: useStableCallback(showLintFor),
    notice: useStableCallback((message: string, action?: NoticeAction) => setToast({ message, type: 'success', action })),
    goToOptions: useStableCallback(() => jumpToSection('fs-options')),
    addDep: useStableCallback((dep: string) => setSelectedDeps(prev => (prev.includes(dep) ? prev : [...prev, dep]))),
  }
  const entityPreviewRtl = scaffoldOpts.includes('rtl')
  const entityPreviewCtx = useMemo(() => ({ locale: meta.locale, rtl: entityPreviewRtl }), [meta.locale, entityPreviewRtl])
  const entityErrorCounts = useMemo(() => {
    const counts: Record<number, number> = {}
    for (const [idx, err] of Object.entries(entityErrors.entities)) counts[Number(idx)] = countEntityErrors(err)
    return counts
  }, [entityErrors])
  // Setup's own sections only. Entities is not in the list: it is the page's other surface, not
  // a section of this panel, and its error count lives on the workspace toolbar instead.
  /**
   * Adds a `MANY_TO_ONE` from one entity to another, dragged on the diagram. Goes through the
   * same `entity.relations` array the Relations table edits, so undo/redo, validation and lint
   * need no special case. The field name is the camel-cased target name, uniquified against the
   * entity's existing fields and relations — the same convention `SqlToEntityDefinitionConverter`
   * uses when a DDL import turns an FK column into a relation.
   */
  function createRelationFromGraph(sourceUid: string, targetUid: string) {
    const source = entities.find(e => e.uid === sourceUid)
    const target = entities.find(e => e.uid === targetUid)
    if (!source || !target) return
    const taken = [...source.fields.map(f => f.name), ...(source.relations ?? []).map(r => r.fieldName)]
    const fieldName = uniqueName(toCamelCase(target.name.trim() || 'related'), taken)
    pushUndoEntry(t('Linked {source} to {target}', { source: source.name.trim(), target: target.name.trim() }))
    setEntities(entities.map(e => (e.uid === sourceUid
      ? { ...e, relations: [...(e.relations ?? []), { uid: newUid(), type: 'MANY_TO_ONE' as const, fieldName, targetEntity: target.name.trim(), required: false }] }
      : e)))
    setToast({
      message: t('Added {relation}', { relation: `${source.name.trim()}.${fieldName} → ${target.name.trim()}` }),
      type: 'success',
      action: { label: t('Show'), onClick: () => revealRow(sourceUid) },
    })
  }

  const codeFilesFor = useCallback(
    (entity: FullstackEntityDef) => entityCodeFiles(entity, preview?.files),
    [preview],
  )
  const codeStale = Boolean(previewSnapshotRef.current) && !snapshotsEqual(previewSnapshotRef.current!, currentSnapshot)
  const stableExplore = useStableCallback(explore)
  // A boolean, not the snapshot, in the deps: the entity cards re-render only when staleness flips.
  const codeState = useMemo(() => ({
    hasPreview: Boolean(preview),
    loading: previewLoading,
    stale: codeStale,
    onExplore: stableExplore,
  }), [preview, previewLoading, codeStale, stableExplore])

  // Everything that decides the generated app's look, for the layout designer's Appearance view.
  const frontendAppearance: FrontendAppearance = {
    frontendSets, frontendSet, setFrontendSet, currentFrontendSet,
    setsLoading, setsError, loadTemplateSets,
    palettes, feError, reloadFe, effectivePalette, setDefaultPalette, colorPalette, setColorPalette,
    locale: meta.locale, dashboardTitle: meta.dashboardTitle, dashboardOverview: meta.dashboardOverview,
    artifactId: meta.artifactId, updateMeta: updates => updateMeta(updates),
    rtl: scaffoldOpts.includes('rtl'), toggleRtl: () => toggleOpt('rtl'),
  }

  const sections = [
    { id: 'fs-meta', label: t('Project'), errors: countMetaErrors(metaErrors) },
    { id: 'fs-backend', label: t('Backend') },
    { id: 'fs-frontend', label: t('Frontend') },
    { id: 'fs-options', label: t('Options') },
    { id: 'fs-deps', label: t('Dependencies') },
    { id: 'fs-entities', label: t('Entities'), errors: entityErrors.count },
    { id: 'fs-pages', label: t('Pages'), errors: pageValidation.count },
  ]
  // A metadata error must never hide inside a collapsed panel — same rule the entity cards use
  // for a blocked Settings panel, and it keeps `jumpToFirstError`'s `#fs-meta` query answerable.
  const setupForcedOpen = countMetaErrors(metaErrors) > 0
  const setupVisible = setupOpen || setupForcedOpen
  const setupChips = useMemo(() => describeSetup({
    meta, backendSet, frontendSet, currentBackendSet, currentFrontendSet,
    palettes, effectivePalette, paletteIsExplicit: Boolean(colorPalette), selectedDeps, scaffoldOpts,
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the chips are in the site's language
  }), [meta, backendSet, frontendSet, currentBackendSet, currentFrontendSet,
       palettes, effectivePalette, colorPalette, selectedDeps, scaffoldOpts, lang])

  /** Opens Setup and scrolls to one of its sections — every jump target lives inside it now. */
  function jumpToSection(id: string) {
    setSetupOpen(true)
    requestAnimationFrame(() => scrollToElement(document.getElementById(id), 'start'))
  }

  function applyLintFix(issue: LintIssue) {
    if (!issue.fix) return
    pushUndoEntry(t('Fixed: {fix}', { fix: issue.fix.label }))
    const next = issue.fix.apply({ entities, scaffoldOpts, selectedDeps })
    if (next.entities !== entities) setEntities(withUids(next.entities))
    if (next.scaffoldOpts !== scaffoldOpts) setScaffoldOpts(next.scaffoldOpts)
    if (next.selectedDeps !== selectedDeps) setSelectedDeps(next.selectedDeps)
    setToast({ message: t('Applied: {fix}', { fix: issue.fix.label }), type: 'success' })
  }

  const lastUndo = history.past[history.past.length - 1]
  const nextRedo = history.future[history.future.length - 1]
  const blockedReason = tn(errorCount, 'Fix {n} issue first — click to jump to the first one', 'Fix {n} issues first — click to jump to the first one')

  // ⌘K actions for this tab. Handlers are read through a ref so the registration effect runs
  // once per mount instead of on every render; the palette closes itself before `run`.
  const commandHandlers = {
    addEntity: () => {
      const entity = newEntity()
      setEntities(prev => [...prev, entity])
      revealRow(entity.uid!)
      focusRowWhenRendered(entity.uid)
    },
    importDdl: () => setImportVariant('ddl'),
    importSelect: () => setImportVariant('select'),
    openTables: (mode: DatabaseMode) => {
      if (!entities.some(e => e.name.trim())) {
        setToast({ message: t('Add an entity first — the tables are built from your entities'), type: 'error' })
        return
      }
      setDatabaseMode(mode)
    },
    explore, generate, exportJson, copyCurl, undo, redo,
    toggleCollapse: () => setCollapsed(allCollapsed ? new Set() : new Set(entities.map(e => e.uid).filter((u): u is string => Boolean(u)))),
    reset: () => setConfirmReset(true),
    findEntity: () => {
      scrollToElement(document.getElementById('fs-entities'), 'start')
      requestAnimationFrame(() => document.getElementById('fs-entity-filter')?.focus({ preventScroll: true }))
    },
    toggleDensity: () => setDensity(d => (d === 'compact' ? 'comfortable' : 'compact')),
    savePreset: (target: SaveTarget = 'browser') => requestSave(target),
    toggleShortcuts: () => setShortcutsOpen(v => !v),
    // The page layout — the same actions as the section's own buttons, reachable from ⌘K.
    findPage: () => {
      if (pages.length === 0) {
        setToast({ message: t('No pages yet — the layout is the classic one'), type: 'error' })
        return
      }
      setPagesFind(n => n + 1)
    },
    addPage: () => {
      if (!entities.some(e => e.name.trim())) {
        setToast({ message: t('Name an entity first — pages are built from your entities'), type: 'error' })
        return
      }
      setPagesAdd(n => n + 1)
    },
    seedPages: () => {
      if (!entities.some(e => e.name.trim())) {
        setToast({ message: t('Name an entity first — pages are built from your entities'), type: 'error' })
        return
      }
      if (pages.length > 0) {
        setToast({ message: t('There is already a page layout — switch to the classic layout first to start over'), type: 'error' })
        return
      }
      pushUndoEntry(t('Started a page layout from the entities'))
      setPages(seedLayout(entities, { title: meta.dashboardTitle, description: meta.dashboardOverview }))
      requestAnimationFrame(() => scrollToElement(document.getElementById('fs-pages'), 'start'))
    },
    classicLayout: () => {
      if (pages.length === 0) {
        setToast({ message: t('The layout is already the classic one'), type: 'success' })
        return
      }
      clearPageLayout()
      setToast({ message: t('Switched to the classic layout — undo with Ctrl+Z'), type: 'success' })
    },
    layoutPreview: () => {
      if (pages.length === 0) {
        setToast({ message: t('Nothing to preview yet — add a page, or start a layout from your entities'), type: 'error' })
        return
      }
      setPagesPreview(n => n + 1)
    },
  }
  const commandRef = useRef(commandHandlers)
  commandRef.current = commandHandlers

  // Keyboard shortcuts — the list lives in ShortcutsOverlay (FULLSTACK_SHORTCUTS). The chords fire
  // even while typing: Ctrl+S in particular has to beat the browser's Save dialog wherever focus
  // is. Undo/redo and the bare `?` wait until focus leaves the field, as before. A confirm dialog
  // (anything modal other than the cheat sheet itself) owns the keyboard while it is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()
      const h = commandRef.current
      const dialogOpen = document.querySelector('[role="dialog"][aria-modal="true"]:not([data-shortcuts])') !== null
      if (mod && key === 'enter') { e.preventDefault(); if (!dialogOpen) void h.generate(); return }
      if (mod && e.shiftKey && key === 'e') { e.preventDefault(); if (!dialogOpen) h.explore(); return }
      if (mod && !e.shiftKey && key === 's') { e.preventDefault(); if (!dialogOpen) h.savePreset(); return }
      if (isTypingTarget(e.target)) return
      if (mod && key === 'z' && !e.shiftKey) { e.preventDefault(); h.undo() }
      else if (mod && ((key === 'z' && e.shiftKey) || key === 'y')) { e.preventDefault(); h.redo() }
      else if (!mod && !e.altKey && e.key === '?' && !dialogOpen) { e.preventDefault(); h.toggleShortcuts() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Registered again when the language changes: the titles are in it.
  useEffect(() => registerCommands([
    { id: 'fs-add-entity', title: t('Add entity'), icon: 'add_box', group: t('Fullstack'), run: () => commandRef.current.addEntity() },
    { id: 'fs-import-ddl', title: t('Import entities from DDL'), icon: 'database', group: t('Fullstack'), run: () => commandRef.current.importDdl() },
    { id: 'fs-import-select', title: t('Import a view from SELECT'), icon: 'table_view', group: t('Fullstack'), run: () => commandRef.current.importSelect() },
    { id: 'fs-export-ddl', title: t('Export the model’s DDL (CREATE TABLE script)'), description: t('For H2, PostgreSQL, Oracle, SQL Server or DB2'), icon: 'description', group: t('Fullstack'), run: () => commandRef.current.openTables('export') },
    { id: 'fs-create-tables', title: t('Create the model’s tables in a database…'), description: t('On a database source an admin allowed it for'), icon: 'database_upload', group: t('Fullstack'), run: () => commandRef.current.openTables('create') },
    { id: 'fs-explore', title: t('Explore generated files'), description: t('Preview the file tree before downloading'), icon: 'travel_explore', group: t('Fullstack'), shortcut: 'Ctrl+Shift+E', run: () => commandRef.current.explore() },
    { id: 'fs-generate', title: t('Generate fullstack ZIP'), icon: 'download', group: t('Fullstack'), shortcut: 'Ctrl+Enter', run: () => { void commandRef.current.generate() } },
    { id: 'fs-save-preset', title: t('Save this model (browser or team)…'), icon: 'bookmark_add', group: t('Fullstack'), shortcut: 'Ctrl+S', run: () => commandRef.current.savePreset() },
    { id: 'fs-export', title: t('Export model as JSON'), icon: 'file_download', group: t('Fullstack'), run: () => commandRef.current.exportJson() },
    { id: 'fs-curl', title: t('Copy as curl'), icon: 'terminal', group: t('Fullstack'), run: () => { void commandRef.current.copyCurl() } },
    { id: 'fs-undo', title: t('Undo'), icon: 'undo', group: t('Fullstack'), shortcut: 'Ctrl+Z', run: () => commandRef.current.undo() },
    { id: 'fs-redo', title: t('Redo'), icon: 'redo', group: t('Fullstack'), shortcut: 'Ctrl+Shift+Z', run: () => commandRef.current.redo() },
    { id: 'fs-collapse', title: t('Collapse / expand all entities'), icon: 'unfold_less', group: t('Fullstack'), run: () => commandRef.current.toggleCollapse() },
    { id: 'fs-find', title: t('Find entity…'), description: t('Filter the entity list by name, label, table or field'), icon: 'search', group: t('Fullstack'), run: () => commandRef.current.findEntity() },
    { id: 'fs-find-page', title: t('Find page…'), description: t('Filter the frontend pages by title, route, entity or type'), icon: 'find_in_page', group: t('Fullstack'), shortcut: '/', run: () => commandRef.current.findPage() },
    { id: 'fs-add-page', title: t('Add a page to the layout'), description: t('Opens the page gallery of the frontend page layout'), icon: 'web', group: t('Fullstack'), run: () => commandRef.current.addPage() },
    { id: 'fs-seed-pages', title: t('Start a page layout from my entities'), description: t('A dashboard plus one list page per entity, ready to edit'), icon: 'auto_awesome', group: t('Fullstack'), run: () => commandRef.current.seedPages() },
    { id: 'fs-classic-layout', title: t('Use the classic page layout'), description: t('Drops the page layout (undoable)'), icon: 'restart_alt', group: t('Fullstack'), run: () => commandRef.current.classicLayout() },
    { id: 'fs-layout-preview', title: t('Open the layout preview'), description: t('A mock of the generated app with sample data'), icon: 'preview', group: t('Fullstack'), run: () => commandRef.current.layoutPreview() },
    { id: 'fs-density', title: t('Toggle compact field tables'), icon: 'density_small', group: t('Fullstack'), run: () => commandRef.current.toggleDensity() },
    { id: 'fs-reset', title: t('Reset the fullstack generator'), icon: 'restart_alt', group: t('Fullstack'), run: () => commandRef.current.reset() },
    { id: 'fs-shortcuts', title: t('Keyboard shortcuts'), icon: 'keyboard', group: t('Fullstack'), shortcut: '?', run: () => commandRef.current.toggleShortcuts() },
  ]), [lang])

  return (
    <div className="max-w-7xl mx-auto px-8 space-y-8">
      <PageHeader icon="stacks" title={t('Fullstack CRUD Generator')}>
        {t('Define entities and their fields, and get one ZIP with a Spring Boot backend (JPA and REST per entity) and a React frontend (Vite + Tailwind, a CRUD page per entity), already wired together.')}
      </PageHeader>

      <ModelNotices
        previewError={previewError}
        previewLoading={previewLoading}
        onRetryPreview={explore}
        onDismissPreviewError={clearError}
        shareStatus={shareStatus}
        externalDraft={externalDraft}
        entityCount={entities.length}
        onLoadTheirs={() => {
          const theirs = externalDraft
          if (!theirs) return
          setExternalDraft(null)
          pushUndoEntry(t("Loaded the other tab's draft"))
          setMeta(theirs.meta)
          setEntities(withUids(theirs.entities))
        }}
        onKeepMine={() => {
          setExternalDraft(null)
          flushEntities()
          if (lastWrittenEntitiesRef.current !== null) persist(LS.entities, lastWrittenEntitiesRef.current)
          persist(LS.meta, JSON.stringify(meta))
        }}
        persistFailed={persistFailed}
        presetsPersistFailed={presetsPersistFailed}
      />

      <FullstackPresets
        presets={presets}
        recents={recents}
        currentSnapshot={currentSnapshot}
        onLoad={snapshot => requestLoad({ kind: 'preset', snapshot })}
        onLoadExample={example => requestLoad({ kind: 'example', example })}
        onSave={savePresetAndReport}
        onDeletePreset={deletePresetWithUndo}
        onDeleteRecent={deleteRecentWithUndo}
        onExportJson={exportJson}
        onImportJson={importJson}
        onCopyCurl={copyCurl}
        examples={exampleModels.examples}
        examplesLoading={exampleModels.loading}
        examplesError={exampleModels.error}
        teamModels={team.models}
        teamLoading={team.loading}
        teamError={team.error}
        onRefreshTeam={() => { void team.refresh() }}
        onLoadTeam={loadTeamModel}
        onSaveTeam={(name, description) => { void saveToTeam(name, description) }}
        onDeleteTeam={setConfirmDeleteTeam}
        saveRequest={saveRequest}
      />

      {/* Project configuration: collapsed behind a summary bar once set, so the entity
          modeller below gets the viewport. */}
      <section id="fs-setup" className="glass-panel rounded-2xl overflow-hidden">
        <SetupSummaryBar
          open={setupVisible}
          forced={setupForcedOpen}
          onToggle={() => setSetupOpen(o => !o)}
          chips={setupChips}
          errorCount={countMetaErrors(metaErrors)}
          onChipJump={id => {
            // The frontend look lives in the designer's Appearance view now.
            if (id === 'fs-frontend') { openAppearance(); return }
            setSetupOpen(true)
            requestAnimationFrame(() => scrollToElement(document.getElementById(id), 'start'))
          }}
        />
        {setupVisible && (
        <div id="fs-setup-body" className="border-t border-outline-variant px-5 pb-5 pt-4">
      <FullstackSetupPanel
        nav={<SectionNav sections={sections} onJump={() => setSetupOpen(true)} />}
        meta={meta}
        metaErrors={metaErrors}
        updateMeta={updateMeta}
        javaVersions={javaVersions}
        bootVersions={bootVersions}
        packagings={packagings}
        backendSets={backendSets}
        backendSet={backendSet}
        frontendSet={frontendSet}
        setBackendSet={setBackendSet}
        currentBackendSet={currentBackendSet}
        currentFrontendSet={currentFrontendSet}
        setsLoading={setsLoading}
        setsError={setsError}
        loadTemplateSets={loadTemplateSets}
        palettes={palettes}
        effectivePalette={effectivePalette}
        colorPalette={colorPalette}
        onEditFrontend={openAppearance}
        scaffoldOpts={scaffoldOpts}
        toggleOpt={toggleOpt}
        selectedDeps={selectedDeps}
        setSelectedDeps={setSelectedDeps}
        currentDefaults={currentDefaults}
        compatibilityRules={compatibilityRules}
        entities={entities}
        revealRow={revealRow}
        hasPages={pages.length > 0}
      />
        </div>
        )}
      </section>

      <section id="fs-entities" className="space-y-4">
        <EntitiesToolbar
          entityCount={entities.length}
          density={density}
          onDensityChange={setDensity}
          layout={showGraph ? 'diagram' : 'cards'}
          onLayoutChange={l => setShowGraph(l === 'diagram')}
          allCollapsed={allCollapsed}
          onToggleCollapseAll={() => setCollapsed(allCollapsed ? new Set() : new Set(entities.map(e => e.uid).filter((u): u is string => Boolean(u))))}
          onImport={setImportVariant}
          onDatabase={() => commandRef.current.openTables('export')}
          onAddEntity={() => commandRef.current.addEntity()}
          canUndo={Boolean(lastUndo)}
          canRedo={Boolean(nextRedo)}
          undoLabel={lastUndo ? t('Undo: {change}', { change: lastUndo.label }) : null}
          redoLabel={nextRedo ? t('Redo: {change}', { change: nextRedo.label }) : null}
          onUndo={undo}
          onRedo={redo}
          onShortcuts={() => setShortcutsOpen(true)}
          errorCount={errorCount}
          onJumpToFirstError={jumpToFirstError}
        />
        <ModelLintPanel
          issues={lintIssues}
          onFix={applyLintFix}
          onJump={revealRow}
          open={lintOpen}
          onOpenChange={setLintOpen}
          filterUid={lintFilterUid}
          onFilterChange={setLintFilterUid}
          entityName={uid => entities.find(e => e.uid === uid)?.name.trim() ?? ''}
        />
        {showGraph && entities.length > 0 && (
          <Suspense fallback={null}>
            <EntityRelationGraph
              entities={entities}
              showInverse={scaffoldOpts.includes('inverseCollections')}
              onSelect={uid => { setShowGraph(false); revealRow(uid) }}
              onCreateRelation={createRelationFromGraph}
              onRefuseRelation={message => setToast({ message, type: 'error' })}
            />
          </Suspense>
        )}
        {/* The outline is always beside the cards on a wide screen. It used to appear only past
            four entities, which reflowed the whole workspace the moment a fourth was added. */}
        <div className="grid grid-cols-1 lg:grid-cols-[15rem_minmax(0,1fr)] gap-6 items-start">
            <div className="hidden lg:block lg:sticky lg:top-[7.5rem]">
              <EntityNavigator
                entities={entities}
                errorCounts={entityErrorCounts}
                lintCounts={lintCounts}
                filter={entityFilter}
                onFilterChange={setEntityFilter}
                onSelect={revealRow}
                activeUid={activeEntityUid}
              />
            </div>
          <div className="min-w-0">
            <EntitiesEditor
              entities={entities}
              onChange={setEntities}
              errors={entityErrors.entities}
              serverIssue={entityServerIssue}
              noEntities={entityErrors.noEntities}
              collapsed={collapsed}
              onToggleCollapsed={editorCallbacks.toggleCollapsed}
              onDestructive={pushUndoEntry}
              projectOpts={scaffoldOpts}
              onNotice={editorCallbacks.notice}
              onRowAdded={editorCallbacks.revealRow}
              lintCounts={lintCounts}
              onShowLint={editorCallbacks.showLintFor}
              density={density}
              visibleUids={visibleUids}
              previewCtx={entityPreviewCtx}
              onCodeFiles={codeFilesFor}
              codeState={codeState}
              onGoToOptions={editorCallbacks.goToOptions}
              ldapAuth={ldapAuth}
              onAddDep={editorCallbacks.addDep}
            />
          </div>
        </div>
      </section>

      {/* Pages are built from the entities, so the layout designer follows them. */}
      <PagesSection
        appearance={frontendAppearance}
        designerRequest={designerRequest}
        pages={pages}
        entities={entities}
        validation={pageValidation}
        onChange={setPages}
        pushUndo={pushUndoEntry}
        onClear={clearPageLayout}
        previewSettings={pagesPreviewSettings}
        revealRequest={pagesReveal}
        addRequest={pagesAdd}
        findRequest={pagesFind}
        previewRequest={pagesPreview}
        codeRequest={buildBody}
        serverIssue={pageServerIssue}
        ldapAuth={ldapAuth}
        onAddDep={dep => setSelectedDeps(prev => (prev.includes(dep) ? prev : [...prev, dep]))}
        onOpenGuide={onOpenGuide}
        nav={nav}
        onNavChange={setNav}
        dismissedWarnings={dismissedWarnings}
        onDismissedWarningsChange={setDismissedWarnings}
        history={{
          undoLabel: lastUndo ? t('Undo: {change}', { change: lastUndo.label }) : null,
          redoLabel: nextRedo ? t('Redo: {change}', { change: nextRedo.label }) : null,
          onUndo: undo,
          onRedo: redo,
          undoEntries: history.past.map(e => e.label),
          redoEntries: history.future.map(e => e.label),
          onJump: jumpHistory,
        }}
      />

      {/* A project is followed by its artifact id: another model loaded into the editor is not a
          change to the project in hand. */}
      {baseline && baseline.snapshot.meta.artifactId === meta.artifactId && !snapshotsEqual(baseline.snapshot, currentSnapshot) && (
        <UpdatePanel
          baseline={baseline}
          busy={updating || previewLoading}
          onPreview={previewUpdate}
          onDownload={() => { void downloadUpdate() }}
          onMarkApplied={() => {
            setBaseline(appliedBaseline(baseline, currentSnapshot))
            setToast({ message: t('Later updates will start from this model'), type: 'success' })
          }}
          onForget={() => setBaseline(null)}
        />
      )}

      {lastGenerated && (
        <NextStepsPanel
          run={lastGenerated}
          stale={!snapshotsEqual(lastGenerated.snapshot, currentSnapshot)}
          onDismiss={() => setLastGenerated(null)}
          onSavePreset={() => requestSave('browser')}
          onSaveTeam={() => requestSave('team')}
          onCopyCurl={() => { void copyCurl() }}
          onShareLink={() => { void copyShareLink() }}
          onCopied={(ok, what) => setToast(ok
            ? { message: t('{what} copied to clipboard', { what }), type: 'success' }
            : { message: t("Couldn't copy — clipboard access was refused"), type: 'error' })}
        />
      )}

      <HeaderActions
        previewLoading={previewLoading}
        generating={generating}
        previewError={previewError}
        hasErrors={hasErrors}
        blockedReason={blockedReason}
        onExplore={explore}
        onGenerate={() => { void generate() }}
        onCancel={previewLoading ? cancelPreview : cancelGenerate}
        onReset={() => setConfirmReset(true)}
      />

      <StatusToast toast={toast} onClear={() => setToast(null)} />

      {confirmReset && (
        <ConfirmDialog
          title={t('Reset the fullstack generator?')}
          message={t('This clears your entities, dependencies and options back to the defaults. You can undo it afterwards.')}
          confirmLabel={t('Reset')}
          tone="danger"
          onConfirm={doReset}
          onCancel={() => setConfirmReset(false)}
        />
      )}

      {/* The name is somebody else's model: it is theirs (or an admin's) to overwrite. */}
      {teamConflict && notYours(teamConflict.existing) !== undefined && (
        <ConfirmDialog
          title={t('"{name}" is taken', { name: teamConflict.existing.name })}
          message={`${notYours(teamConflict.existing)}. ${t('Save yours under another name.')}`}
          confirmLabel={t('Rename…')}
          onConfirm={() => {
            const conflict = teamConflict
            setTeamConflict(null)
            requestSave('team', { name: conflict.name, description: conflict.description })
          }}
          onCancel={() => setTeamConflict(null)}
        />
      )}
      {teamConflict && notYours(teamConflict.existing) === undefined && (
        <ConfirmDialog
          title={t('Replace the team model "{name}"?', { name: teamConflict.existing.name })}
          message={teamConflict.existing.createdBy
            ? t('A team model with this name already exists (saved by {user}). Overwriting it changes what everyone else loads.', { user: teamConflict.existing.createdBy })
            : t('A team model with this name already exists. Overwriting it changes what everyone else loads.')}
          confirmLabel={t('Overwrite')}
          tone="danger"
          secondaryLabel={t('Rename…')}
          onSecondary={() => {
            const conflict = teamConflict
            setTeamConflict(null)
            requestSave('team', { name: conflict.name, description: conflict.description })
          }}
          onConfirm={() => { void overwriteTeamModel() }}
          onCancel={() => setTeamConflict(null)}
        />
      )}

      {confirmDeleteTeam && (
        <ConfirmDialog
          title={t('Delete "{name}" for everyone?', { name: confirmDeleteTeam.name })}
          message={t('This removes the model from the server. Colleagues who rely on it will no longer see it, and this cannot be undone.')}
          confirmLabel={t('Delete')}
          tone="danger"
          onConfirm={() => { void deleteTeamModel() }}
          onCancel={() => setConfirmDeleteTeam(null)}
        />
      )}

      {pendingJsonImport && (
        <ConfirmDialog
          title={t('Import {name}?', { name: pendingJsonImport.meta.artifactId || t('this model') })}
          message={tn(pendingJsonImport.entities.length,
            'The file holds {n} entity. Replace loads the whole model (entities, dependencies and settings) in place of yours; Append adds only its entities to your current {current}. Either can be undone (Ctrl+Z).',
            'The file holds {n} entities. Replace loads the whole model (entities, dependencies and settings) in place of yours; Append adds only its entities to your current {current}. Either can be undone (Ctrl+Z).',
            { current: entities.length })}
          confirmLabel={t('Replace')}
          tone="danger"
          secondaryLabel={t('Append {n}', { n: pendingJsonImport.entities.length })}
          onSecondary={appendJsonImport}
          onConfirm={() => { const s = pendingJsonImport; setPendingJsonImport(null); loadPreset(s) }}
          onCancel={() => setPendingJsonImport(null)}
        />
      )}

      {pendingLoad && (
        <ConfirmDialog
          title={pendingLoad.kind === 'example'
            ? t('Load the {example} example?', { example: pendingLoad.example.name })
            : pendingLoad.kind === 'shared'
              ? t('Open the shared model?')
              : t('Load {name}?', { name: pendingLoad.snapshot.meta.artifactId || t('this preset') })}
          message={pendingLoad.kind === 'example'
            ? (pendingLoad.example.settings
              ? t("This replaces your current entities and page layout and applies the example's settings, which aren't saved as a preset yet. You can undo it afterwards (Ctrl+Z).")
              : t("This replaces your current entities and page layout, which aren't saved as a preset yet. You can undo it afterwards (Ctrl+Z)."))
            : pendingLoad.kind === 'shared'
              ? tn(pendingLoad.snapshot.entities.length,
                'This link carries "{name}" ({n} entity). Your draft here has edits that aren\'t saved as a preset — Replace loads the link over it (undoable with Ctrl+Z); Keep mine leaves your draft as it is.',
                'This link carries "{name}" ({n} entities). Your draft here has edits that aren\'t saved as a preset — Replace loads the link over it (undoable with Ctrl+Z); Keep mine leaves your draft as it is.',
                { name: pendingLoad.snapshot.meta.artifactId || t('a model') })
              : t('This replaces your current entities, dependencies and settings, which aren\'t saved as a preset yet. You can undo it afterwards (Ctrl+Z).')}
          confirmLabel={pendingLoad.kind === 'shared' ? t('Replace my draft') : t('Load')}
          cancelLabel={pendingLoad.kind === 'shared' ? t('Keep mine') : t('Cancel')}
          onConfirm={() => { const load = pendingLoad; setPendingLoad(null); runLoad(load) }}
          onCancel={dismissPendingLoad}
        />
      )}

      {shortcutsOpen && <ShortcutsOverlay onClose={() => setShortcutsOpen(false)} />}

      <ImportFromDdlDrawer
        isOpen={importVariant !== null}
        variant={importVariant ?? 'ddl'}
        onClose={() => setImportVariant(null)}
        hasExisting={entities.length > 0}
        existingCount={entities.length}
        onImport={handleImport}
      />

      {databaseMode !== null && (
        <Suspense fallback={null}>
          <DatabaseDrawer
            isOpen
            initialMode={databaseMode}
            onClose={() => setDatabaseMode(null)}
            buildRequest={buildBody}
            selectedDeps={selectedDeps}
            artifactId={meta.artifactId}
          />
        </Suspense>
      )}

      {preview && createPortal(
        <Suspense fallback={<ViewSkeleton />}>
          <ProjectPreview
            preview={preview}
            previousPreview={previousPreview}
            artifactId={meta.artifactId || 'demo'}
            onClose={clearPreview}
            onDownload={async () => { if (await (previewIsUpdate ? downloadUpdate() : generate())) clearPreview() }}
          />
        </Suspense>,
        document.body,
      )}
    </div>
  )
}
