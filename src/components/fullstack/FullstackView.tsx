import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type {
  EntityTemplateSetSummary, FullstackEntityDef, FullstackStarterRequest, Toast,
} from '../../types'
import { EntitiesEditor, countEntityErrors, newEntity, type EditorDensity } from './EntitiesEditor'
import { EntityRelationGraph } from './EntityRelationGraph'
import { EntityNavigator, entityMatches, useActiveEntity } from './EntityNavigator'
import { SectionNav } from './SectionNav'
import { focusWithoutClipping, scrollToElement } from './scroll'
import { cssEscape, focusRowWhenRendered } from './focus'
import { FullstackPresets, type SaveTarget } from './FullstackPresets'
import { ImportFromDdlDrawer, type ImportMode, type ImportVariant } from './ImportFromDdlDrawer'
import { ViewSkeleton } from '../Skeletons'
import { ConfirmDialog } from '../ConfirmDialog'
import { StatusToast } from '../admin/shared/StatusToast'
import { newUid, reconcileUids, stripUids, withUids } from './uid'
import { toCamelCase, uniqueName } from './naming'
import {
  DEFAULT_PROJECT_META, describeSnapshotChange, makeSnapshot, normalizeMeta, parseExportedModel, snapshotChangeKey, snapshotsEqual, toExportedModel,
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
import { draftHasUnsavedWork } from './shareGuard'
import { summarizeEntity } from './summary'
import { frontendSetDefaults } from './frontendSetDefaults'
import { MAX_ENCODED_LENGTH, clearShareFromLocation, readShareFromLocation, writeShareToLocation, type ShareWriteStatus } from './shareLink'
import { emptyHistory, isTypingTarget, record, redoStep, undoStep, type History } from './undo'
import { cloneExample, type ExampleModel } from './examples'
import { downloadBlob } from '../../utils/projectUtils'
import { copyToClipboard } from '../../utils/clipboard'
import { useFrontendMetadata } from '../../hooks/useFrontendMetadata'
import { useCompatibility } from '../../hooks/useCompatibility'
import { registerCommands } from '../../commands'

// The preview modal drags in CodeMirror + every language grammar; load it on first Explore.
const ProjectPreview = lazy(() => import('../ProjectPreview').then(m => ({ default: m.ProjectPreview })))
import { useFullstackPreview } from '../../hooks/useFullstackPreview'
import { readStoredPresetSnapshots, useFullstackPresets } from '../../hooks/useFullstackPresets'
import { TeamModelError, useTeamModels } from '../../hooks/useTeamModels'
import type { TeamModelSummary } from '../../types'
import { useAdminMetadata } from '../../hooks/useAdminMetadata'
import { canonicalVersion, validateEntities, validateMeta, countMetaErrors, type MetaErrors } from './validation'

const DEFAULT_META: ProjectMeta = DEFAULT_PROJECT_META

const DEFAULT_ENTITIES: FullstackEntityDef[] = [
  {
    name: 'User',
    fields: [
      { name: 'id', type: 'LONG', primaryKey: true, generated: true },
      { name: 'email', type: 'STRING', required: true, unique: true, length: 200 },
      { name: 'fullName', type: 'STRING', required: true, length: 120 },
      { name: 'active', type: 'BOOLEAN' },
    ],
  },
]

// localStorage keys — namespaced so they don't collide with the Backend/Frontend tabs.
const LS = {
  meta: 'fullstack:meta',
  entities: 'fullstack:entities',
  deps: 'fullstack:deps',
  backendSet: 'fullstack:backendSet',
  frontendSet: 'fullstack:frontendSet',
  opts: 'fullstack:opts',
  palette: 'fullstack:palette',
  collapsed: 'fullstack:collapsed',
  setup: 'fullstack:setup',
  graph: 'fullstack:graph',
  density: 'fullstack:density',
} as const

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) as T : fallback
  } catch {
    return fallback
  }
}

/** localStorage write that never throws: a model carrying imported `sourceSql` can exceed the
 *  quota, and an exception from inside a persist effect would take the whole view down on every
 *  keystroke. Losing the refresh-restore is the acceptable failure — but a visible one: the
 *  caller tracks the returned flag and the sticky bar says the draft is no longer being saved. */
function persist(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

/** The stock entity model, normalized like a snapshot so "still untouched" is a plain compare. */
const DEFAULT_ENTITIES_JSON = JSON.stringify(stripUids(DEFAULT_ENTITIES))

/** A load that replaces the editor's model, held while the user confirms it. */
type PendingLoad =
  | { kind: 'example'; example: ExampleModel }
  | { kind: 'preset'; snapshot: FullstackSnapshot }
  | { kind: 'shared'; snapshot: FullstackSnapshot }

/** The draft as localStorage holds it, in snapshot form — what a share link would replace. */
function readStoredSnapshot(): FullstackSnapshot {
  const item = (key: string) => { try { return localStorage.getItem(key) } catch { return null } }
  return makeSnapshot({
    meta: normalizeMeta(loadJson<Partial<ProjectMeta>>(LS.meta, DEFAULT_META)),
    entities: loadJson<FullstackEntityDef[]>(LS.entities, DEFAULT_ENTITIES),
    selectedDeps: loadJson<string[]>(LS.deps, []),
    scaffoldOpts: loadJson<string[]>(LS.opts, []),
    backendSet: item(LS.backendSet) ?? 'spring-jpa-crud',
    frontendSet: item(LS.frontendSet) ?? 'react-tailwind-crud',
    colorPalette: item(LS.palette) ?? '',
  })
}

/** What the editor starts from. A share link (?fs=…) beats localStorage — that is the whole point
 *  of the link — unless the stored draft holds unsaved work (shareGuard.ts): then the draft loads
 *  and the link waits in a confirm dialog as `pendingShared`. */
function resolveInitialModel(): { shared: FullstackSnapshot | null; pendingShared: FullstackSnapshot | null } {
  const link = readShareFromLocation()
  if (!link) return { shared: null, pendingShared: null }
  const linked = makeSnapshot({ ...link, meta: normalizeMeta(link.meta) })
  if (!draftHasUnsavedWork(readStoredSnapshot(), linked, readStoredPresetSnapshots(), DEFAULT_ENTITIES_JSON)) {
    return { shared: link, pendingShared: null }
  }
  return { shared: null, pendingShared: linked }
}

export function FullstackView() {
  const initRef = useRef<ReturnType<typeof resolveInitialModel> | undefined>(undefined)
  if (initRef.current === undefined) initRef.current = resolveInitialModel()
  const { shared, pendingShared } = initRef.current

  // normalizeMeta fills in settings that predate a stored model (name/version/packaging/locale…).
  const [meta, setMeta] = useState<ProjectMeta>(() => normalizeMeta(shared?.meta ?? loadJson<Partial<ProjectMeta>>(LS.meta, DEFAULT_META)))
  const [entities, setEntities] = useState<FullstackEntityDef[]>(() => withUids(shared?.entities ?? loadJson(LS.entities, DEFAULT_ENTITIES)))
  const [backendSet, setBackendSet] = useState(() => shared?.backendSet ?? localStorage.getItem(LS.backendSet) ?? 'spring-jpa-crud')
  const [frontendSet, setFrontendSet] = useState(() => shared?.frontendSet ?? localStorage.getItem(LS.frontendSet) ?? 'react-tailwind-crud')
  const [availableSets, setAvailableSets] = useState<EntityTemplateSetSummary[]>([])
  const [setsLoading, setSetsLoading] = useState(true)
  const [setsError, setSetsError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const [importVariant, setImportVariant] = useState<ImportVariant | null>(null)
  const [selectedDeps, setSelectedDeps] = useState<string[]>(() => shared?.selectedDeps ?? loadJson<string[]>(LS.deps, []))
  const [scaffoldOpts, setScaffoldOpts] = useState<string[]>(() => shared?.scaffoldOpts ?? loadJson<string[]>(LS.opts, []))
  // '' = follow the frontend set's default palette (the backend resolves it; nothing is sent).
  const [colorPalette, setColorPalette] = useState<string>(() => shared ? (shared.colorPalette ?? '') : (localStorage.getItem(LS.palette) ?? ''))
  // Collapsed cards survive a refresh: entities persist with their uids, so the uid set stays valid.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(shared ? [] : loadJson<string[]>(LS.collapsed, [])))
  const [history, setHistory] = useState<History<FullstackSnapshot>>(() => emptyHistory())
  const [confirmReset, setConfirmReset] = useState(false)
  const [pendingLoad, setPendingLoad] = useState<PendingLoad | null>(() => (pendingShared ? { kind: 'shared', snapshot: pendingShared } : null))
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
  // The localStorage keys whose last write was refused (quota / disabled). Tracked per key: the
  // entity list is what blows the quota, and a later *successful* write of the small meta key
  // must not hide the notice while the model itself is still unsaved. Non-empty = the draft is no
  // longer being saved, so the sticky bar says so and leaving the page asks first.
  const [persistFailedKeys, setPersistFailedKeys] = useState<ReadonlySet<string>>(() => new Set())
  const persistFailed = persistFailedKeys.size > 0
  // What this tab last wrote for the entity list, so a `storage` event from another tab can be
  // told apart from the echo of our own write.
  const lastWrittenEntitiesRef = useRef<string | null>(null)
  // Another tab saved a different draft under the same keys — held until the user picks a side.
  const [externalDraft, setExternalDraft] = useState<{ meta: ProjectMeta; entities: FullstackEntityDef[] } | null>(null)
  // A JSON file parsed by Import JSON, held while the user picks Replace / Append.
  const [pendingJsonImport, setPendingJsonImport] = useState<FullstackSnapshot | null>(null)
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
    fetchPreview, clearPreview, clearError, cancel: cancelPreview,
  } = useFullstackPreview()
  const { presets, recents, persistFailed: presetsPersistFailed, savePreset, deletePreset, restorePreset, deleteRecent, restoreRecent, pushRecent } = useFullstackPresets()
  const team = useTeamModels()
  // A team save that hit an existing name, held while the user decides whether to overwrite it.
  const [teamConflict, setTeamConflict] = useState<{ name: string; description: string; existing: TeamModelSummary } | null>(null)
  const [confirmDeleteTeam, setConfirmDeleteTeam] = useState<TeamModelSummary | null>(null)

  const { bootVersions: rawBootVersions, javaVersions, packagings } = useAdminMetadata()
  // The client metadata spells Boot versions "3.2.1.RELEASE"; the fullstack endpoint and the template
  // sets pin the catalog id "3.2.1" — list and store the canonical form only.
  const bootVersions = useMemo(() => Array.from(new Set(rawBootVersions.map(canonicalVersion))), [rawBootVersions])
  const { metadata: feMetadata, error: feError, reload: reloadFe } = useFrontendMetadata()
  const { rules: compatibilityRules } = useCompatibility('BACKEND')
  const currentBackendSet = availableSets.find(s => s.setKey === backendSet)
  const currentFrontendSet = availableSets.find(s => s.setKey === frontendSet)
  const currentDefaults = currentBackendSet?.defaultDeps ?? []
  const palettes = feMetadata?.colorPalettes ?? []
  // What the generator will actually use: the explicit pick, else the set's default, else the
  // catalog default — mirrors FullstackStarterController's resolution so the swatch is truthful.
  const setDefaultPalette = currentFrontendSet?.defaultPaletteId
    ?? palettes.find(p => p.isDefault)?.id ?? palettes[0]?.id ?? ''
  const effectivePalette = colorPalette || setDefaultPalette

  // Validation — mirrors the backend FullstackRequestValidator so problems surface inline
  // before submit. The server stays the source of truth.
  const entityErrors = useMemo(() => validateEntities(entities), [entities])
  const metaErrors: MetaErrors = useMemo(
    () => validateMeta(meta, { bootVersions, javaVersions }),
    [meta, bootVersions, javaVersions],
  )
  const errorCount = entityErrors.count + countMetaErrors(metaErrors)
  const hasErrors = errorCount > 0

  // Persist form state so a refresh doesn't lose the user's work (mirrors useProjectState).
  // The model itself (meta + entities) is what matters for the storage-full notice; the small
  // UI-state keys just try their luck.
  useEffect(() => { setPersistFailedKeys(prev => trackPersist(prev, LS.meta, persist(LS.meta, JSON.stringify(meta)))) }, [meta])
  // `sourceSql` (the imported DDL) stays in memory only: it is the one prop big enough to blow
  // the quota, and the server discards it anyway. The uids do persist — `collapsed` keys on them.
  useEffect(() => {
    const json = JSON.stringify(entities.map(({ sourceSql: _s, ...e }) => e))
    lastWrittenEntitiesRef.current = json
    setPersistFailedKeys(prev => trackPersist(prev, LS.entities, persist(LS.entities, json)))
  }, [entities])
  // Two tabs on this page share the draft keys, and the last one to type used to win silently.
  // A write we did not make ourselves surfaces as a banner with both drafts on offer — never an
  // automatic merge.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== LS.entities || e.newValue == null || e.newValue === lastWrittenEntitiesRef.current) return
      try {
        const theirs = JSON.parse(e.newValue) as FullstackEntityDef[]
        if (!Array.isArray(theirs)) return
        setExternalDraft({ meta: normalizeMeta(loadJson<Partial<ProjectMeta>>(LS.meta, DEFAULT_META)), entities: theirs })
      } catch { /* not ours to interpret */ }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
  useEffect(() => { persist(LS.deps, JSON.stringify(selectedDeps)) }, [selectedDeps])
  useEffect(() => { persist(LS.backendSet, backendSet) }, [backendSet])
  useEffect(() => { persist(LS.frontendSet, frontendSet) }, [frontendSet])
  useEffect(() => { persist(LS.opts, JSON.stringify(scaffoldOpts)) }, [scaffoldOpts])
  useEffect(() => { persist(LS.palette, colorPalette) }, [colorPalette])
  useEffect(() => { persist(LS.collapsed, JSON.stringify([...collapsed])) }, [collapsed])
  useEffect(() => { persist(LS.graph, JSON.stringify(showGraph)) }, [showGraph])
  useEffect(() => { persist(LS.setup, setupOpen ? 'open' : 'closed') }, [setupOpen])
  useEffect(() => { persist(LS.density, density) }, [density])

  // The whole editor state as one detached value — what presets/recents/undo/share links carry.
  const currentSnapshot = useMemo(
    () => makeSnapshot({ meta, entities, selectedDeps, scaffoldOpts, backendSet, frontendSet, colorPalette }),
    [meta, entities, selectedDeps, scaffoldOpts, backendSet, frontendSet, colorPalette],
  )
  const snapshotRef = useRef(currentSnapshot)
  snapshotRef.current = currentSnapshot
  // The live entity list (with uids) for callbacks that outlive a render — undo's uid reconciliation.
  const entitiesRef = useRef(entities)
  entitiesRef.current = entities

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
  useEffect(() => { clearError() }, [meta, entities, selectedDeps, backendSet, frontendSet, scaffoldOpts, colorPalette, clearError])

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

  // ── Undo / redo ────────────────────────────────────────────────────────────
  // Every change to the snapshot is recorded automatically: the effect below sees the new
  // snapshot, and files the *previous* one as the "before" state. Rapid successive changes to
  // the *same thing* (typing a name, retyping a default) coalesce into one entry — a burst stays
  // open while changes keep arriving within BURST_IDLE_MS and keep hitting the same change key;
  // an edit elsewhere (another field's checkbox) commits the burst and starts a new one, so
  // three quick ticks on three fields stay three undo steps. Destructive actions (remove,
  // import, load, reset) still push an explicitly labelled entry first via pushUndoEntry; the
  // state change they cause is then skipped so it isn't recorded twice. Undo/redo restore
  // through applySnapshot and are skipped the same way.
  const BURST_IDLE_MS = 600
  const historyRef = useRef(history)
  historyRef.current = history
  const lastSnapshotRef = useRef(currentSnapshot)
  // The snapshot a silent (already-recorded, or non-user) change starts from — matched by
  // identity in the recording effect, then cleared.
  const silentFromRef = useRef<FullstackSnapshot | null>(null)
  const burstRef = useRef<{ before: FullstackSnapshot; label: string; key: string } | null>(null)
  const burstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flushBurst = useCallback(() => {
    if (burstTimerRef.current) { clearTimeout(burstTimerRef.current); burstTimerRef.current = null }
    const burst = burstRef.current
    if (!burst) return
    burstRef.current = null
    // Update the ref as well as the state: undo() reads the ref right after flushing, and a
    // Ctrl+Z within the burst window must see the entry it just closed, not the pre-render one.
    const next = record(historyRef.current, { label: burst.label, snapshot: burst.before })
    historyRef.current = next
    setHistory(next)
  }, [])

  useEffect(() => {
    const prev = lastSnapshotRef.current
    if (prev === currentSnapshot) return
    lastSnapshotRef.current = currentSnapshot
    if (silentFromRef.current === prev) { silentFromRef.current = null; return }
    if (snapshotsEqual(prev, currentSnapshot)) return
    const key = snapshotChangeKey(prev, currentSnapshot)
    if (burstRef.current && burstRef.current.key !== key) flushBurst()
    if (!burstRef.current) burstRef.current = { before: prev, label: describeSnapshotChange(prev, currentSnapshot), key }
    if (burstTimerRef.current) clearTimeout(burstTimerRef.current)
    burstTimerRef.current = setTimeout(flushBurst, BURST_IDLE_MS)
  }, [currentSnapshot, flushBurst])
  useEffect(() => () => { if (burstTimerRef.current) clearTimeout(burstTimerRef.current) }, [])

  const pushUndoEntry = useCallback((label: string) => {
    flushBurst()
    const before = snapshotRef.current
    silentFromRef.current = before
    setHistory(h => record(h, { label, snapshot: before }))
  }, [flushBurst])

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
    if (keepView) {
      const alive = new Set(next.map(e => e.uid))
      setCollapsed(prev => new Set([...prev].filter(uid => alive.has(uid))))
    } else {
      setCollapsed(new Set())
    }
    baselineRef.current = null // adopt the loaded state as the new "nothing unsaved" point
  }, [])

  const undo = useCallback(() => {
    flushBurst()
    const step = undoStep(historyRef.current, snapshotRef.current)
    if (!step) return
    silentFromRef.current = snapshotRef.current
    setHistory(step.history)
    applySnapshot(step.restore.snapshot, true)
    setToast({ message: `Undid: ${step.restore.label}`, type: 'success' })
  }, [applySnapshot, flushBurst])

  const redo = useCallback(() => {
    flushBurst()
    const step = redoStep(historyRef.current, snapshotRef.current)
    if (!step) return
    silentFromRef.current = snapshotRef.current
    setHistory(step.history)
    applySnapshot(step.restore.snapshot, true)
    setToast({ message: `Redid: ${step.restore.label}`, type: 'success' })
  }, [applySnapshot, flushBurst])

  function handleImport(imported: FullstackEntityDef[], mode: ImportMode, note?: string) {
    pushUndoEntry(mode === 'replace' ? 'Replaced entities from import' : 'Appended imported entities')
    const stamped = withUids(imported)
    setEntities(prev => (mode === 'replace' ? stamped : [...prev, ...stamped]))
    if (stamped[0]?.uid) revealRow(stamped[0].uid)
    const verb = mode === 'replace' ? 'Replaced with' : 'Appended'
    const n = imported.length
    const base = `${verb} ${n} entit${n === 1 ? 'y' : 'ies'}`
    setToast({ message: note ? `${base}. ${note}` : base, type: 'success' })
  }

  function loadExample(example: ExampleModel) {
    pushUndoEntry(`Loaded the ${example.name} example`)
    setEntities(withUids(cloneExample(example)))
    setCollapsed(new Set())
    baselineRef.current = null
    setToast({ message: `Loaded the ${example.name} example (${example.entities.length} entities)`, type: 'success' })
  }

  function loadPreset(snapshot: FullstackSnapshot, label = 'Loaded a preset') {
    pushUndoEntry(label)
    applySnapshot(snapshot)
    setToast({ message: `Loaded ${snapshot.meta.artifactId || 'preset'}`, type: 'success' })
  }

  function runLoad(load: PendingLoad) {
    if (load.kind === 'example') loadExample(load.example)
    else if (load.kind === 'shared') loadPreset(load.snapshot, 'Opened the shared model')
    else loadPreset(load.snapshot)
  }
  /** "Keep mine" on a share link: the draft stays, the link leaves the URL. */
  function dismissPendingLoad() {
    if (pendingLoad?.kind === 'shared') clearShareFromLocation()
    setPendingLoad(null)
  }
  /** Entry point for the presets strip: confirms first when it would discard unsaved edits. */
  function requestLoad(load: PendingLoad) {
    if (hasUnsavedWork) setPendingLoad(load)
    else runLoad(load)
  }

  // ── Team models (server-side, shared with everyone) ───────────────────────
  async function saveToTeam(name: string, description: string) {
    const snapshot = currentSnapshot
    try {
      await team.save(name, description, snapshot)
      baselineRef.current = snapshot // now captured somewhere — no "unsaved work" prompt for it
      setToast({ message: `Saved "${name}" for the team`, type: 'success' })
    } catch (err) {
      const existing = err instanceof TeamModelError && err.status === 409
        ? team.models.find(m => m.name.toLowerCase() === name.toLowerCase())
        : undefined
      if (existing) {
        setTeamConflict({ name, description, existing })
        return
      }
      setToast({ message: `Couldn't save to the team: ${(err as Error).message}`, type: 'error' })
    }
  }
  async function overwriteTeamModel() {
    const conflict = teamConflict
    if (!conflict) return
    setTeamConflict(null)
    const snapshot = currentSnapshot
    try {
      await team.update(conflict.existing.id, conflict.name, conflict.description, snapshot)
      baselineRef.current = snapshot
      setToast({ message: `Updated "${conflict.name}" for the team`, type: 'success' })
    } catch (err) {
      setToast({ message: `Couldn't update the team model: ${(err as Error).message}`, type: 'error' })
    }
  }
  function loadTeamModel(model: TeamModelSummary) {
    team.load(model.id)
      .then(snapshot => requestLoad({ kind: 'preset', snapshot }))
      .catch((err: Error) => setToast({ message: `Couldn't load "${model.name}": ${err.message}`, type: 'error' }))
  }
  async function deleteTeamModel() {
    const model = confirmDeleteTeam
    if (!model) return
    setConfirmDeleteTeam(null)
    try {
      await team.remove(model.id)
      setToast({ message: `Deleted "${model.name}" for everyone`, type: 'success' })
    } catch (err) {
      setToast({ message: `Couldn't delete "${model.name}": ${(err as Error).message}`, type: 'error' })
    }
  }

  // ── Portable model: JSON export / import, curl ────────────────────────────
  function exportJson() {
    const json = JSON.stringify(toExportedModel(currentSnapshot), null, 2)
    downloadBlob(new Blob([json], { type: 'application/json' }), `${meta.artifactId || 'model'}.fullstack.json`)
    setToast({ message: 'Model exported', type: 'success' })
  }

  function importJson(file: File) {
    file.text().then(text => {
      const result = parseExportedModel(text)
      if ('error' in result) {
        setToast({ message: `Couldn't import ${file.name}: ${result.error}`, type: 'error' })
        return
      }
      // With a model already in the editor, offer Append (its entities join yours) as well as
      // the whole-model Replace — the same choice the DDL import gives.
      if (entities.length > 0 && result.snapshot.entities.length > 0) setPendingJsonImport(result.snapshot)
      else requestLoad({ kind: 'preset', snapshot: result.snapshot })
    }).catch(() => setToast({ message: `Couldn't read ${file.name}`, type: 'error' }))
  }
  function appendJsonImport() {
    const snapshot = pendingJsonImport
    if (!snapshot) return
    setPendingJsonImport(null)
    handleImport(JSON.parse(JSON.stringify(snapshot.entities)) as FullstackEntityDef[], 'append')
  }

  // Deleting a browser preset is one click, so it is undoable from the toast instead of confirmed.
  function deletePresetWithUndo(id: string) {
    const removed = deletePreset(id)
    if (!removed) return
    setToast({
      message: `Deleted preset "${removed.preset.name}"`,
      type: 'success',
      action: { label: 'Undo', onClick: () => restorePreset(removed.preset, removed.index) },
    })
  }

  function deleteRecentWithUndo(id: string) {
    const removed = deleteRecent(id)
    if (!removed) return
    setToast({
      message: `Removed "${removed.preset.name}" from recents`,
      type: 'success',
      action: { label: 'Undo', onClick: () => restoreRecent(removed.preset, removed.index) },
    })
  }

  function savePresetAndReport(name: string, snapshot: FullstackSnapshot) {
    const { persisted } = savePreset(name, snapshot)
    setToast(persisted
      ? { message: `Saved preset "${name}"`, type: 'success' }
      : { message: `Saved preset "${name}" for this session only — browser storage is full, so it won't survive a refresh. Export JSON to keep it.`, type: 'error' })
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
      ? { message: large ? `curl command copied (${Math.round(body.length / 1024)} KB inline — Export JSON and -d @file may be handier)` : 'curl command copied to clipboard', type: 'success' }
      : { message: "Couldn't copy — clipboard access was refused", type: 'error' })
  }

  /** The header's Share button copies `location.href`; this does the same from the Next steps
   *  card, syncing the URL first so the link carries the model as it is now. */
  async function copyShareLink() {
    if (writeShareToLocation(currentSnapshot) === 'too-large') {
      setToast({ message: 'This model is too large for a share link — Export JSON to hand it over', type: 'error' })
      return
    }
    setToast(await copyToClipboard(window.location.href)
      ? { message: 'Share link copied to clipboard', type: 'success' }
      : { message: "Couldn't copy — clipboard access was refused", type: 'error' })
  }

  /** Opens the presets strip's save prompt on the given target and brings it into view. A
   *  `draft` pre-fills it (the team-conflict "Rename…" path). */
  function requestSave(target: SaveTarget, draft?: { name: string; description: string }) {
    setSaveRequest({ target, key: Date.now(), draft })
    scrollToElement(document.querySelector<HTMLElement>('[aria-label="Start from"]'), 'start')
  }

  // Load the template-set list. Extracted so the inline Retry can re-run it; on failure
  // we keep the hardcoded fallback options (the screen stays usable) and surface a
  // persistent inline notice rather than a one-shot toast the user might miss.
  // Each call aborts the previous in-flight request (Retry while loading, or unmount), so a
  // slow earlier response can't land after a newer one or after the view is gone.
  const setsAbortRef = useRef<AbortController | null>(null)
  const loadTemplateSets = useCallback(() => {
    setsAbortRef.current?.abort()
    const controller = new AbortController()
    setsAbortRef.current = controller
    setSetsLoading(true)
    setSetsError(null)
    fetch('/metadata/entity-template-sets', { signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data: EntityTemplateSetSummary[]) => { if (!controller.signal.aborted) setAvailableSets(data) })
      .catch((err: Error) => { if (!controller.signal.aborted) setSetsError(err.message) })
      .finally(() => { if (!controller.signal.aborted) setSetsLoading(false) })
  }, [])

  useEffect(() => {
    loadTemplateSets()
    return () => setsAbortRef.current?.abort()
  }, [loadTemplateSets])

  const backendSets = availableSets.filter(s => s.kind === 'BACKEND_JAVA')
  const frontendSets = availableSets.filter(s => s.kind === 'FRONTEND_REACT')

  function buildBody(): FullstackStarterRequest {
    return {
      ...meta,
      backendTemplateSet: backendSet,
      frontendTemplateSet: frontendSet,
      dependencies: selectedDeps,
      opts: scaffoldOpts.length ? { scaffold: scaffoldOpts } : undefined,
      colorPalette: colorPalette || undefined,
      entities: stripUids(entities),
    }
  }

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
    requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>('#fs-entities [aria-invalid="true"], #fs-entities [data-error]')
        ?? document.querySelector<HTMLElement>('#fs-entities')
      if (target?.matches('input, select, textarea')) focusWithoutClipping(target, 'center')
      else scrollToElement(target, 'center')
    })
  }

  function validateBeforeSubmit(): boolean {
    if (hasErrors) {
      setToast({ message: `Fix ${errorCount} validation issue${errorCount === 1 ? '' : 's'} first`, type: 'error' })
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
    fetchPreview(buildBody())
  }

  // The in-flight Generate request, so the sticky bar's Cancel can abort it (and unmount does).
  const generateAbortRef = useRef<AbortController | null>(null)
  useEffect(() => () => generateAbortRef.current?.abort(), [])
  function cancelGenerate() {
    generateAbortRef.current?.abort()
  }

  /** Returns true when the ZIP downloaded successfully — lets the preview modal stay
   *  open (and show the error toast) on failure, and close only on success. */
  async function generate(): Promise<boolean> {
    if (!validateBeforeSubmit()) return false
    generateAbortRef.current?.abort()
    const controller = new AbortController()
    generateAbortRef.current = controller
    setGenerating(true)
    try {
      const body = buildBody()
      const res = await fetch('/starter-fullstack.zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null) as { detail?: string; error?: string } | null
        throw new Error(err?.detail || err?.error || `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${meta.artifactId}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      pushRecent(currentSnapshot)
      setToast({ message: 'Fullstack project downloaded', type: 'success' })
      setLastGenerated({
        at: Date.now(),
        artifactId: meta.artifactId || 'demo',
        entityCount: entities.length,
        endpoints: entities.flatMap(e => summarizeEntity(e, scaffoldOpts).endpoints.map(ep => ({ entity: e.name.trim() || 'Entity', ...ep }))),
        snapshot: currentSnapshot,
      })
      requestAnimationFrame(() => scrollToElement(document.querySelector<HTMLElement>('[data-next-steps]'), 'nearest'))
      return true
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setToast({ message: 'Generation cancelled', type: 'success' })
        return false
      }
      setToast({ message: `Generation failed: ${(err as Error).message}`, type: 'error' })
      return false
    } finally {
      // A newer Generate may already own the ref — only the request that set it clears the state.
      if (generateAbortRef.current === controller) {
        generateAbortRef.current = null
        setGenerating(false)
      }
    }
  }

  function updateMeta(updates: Partial<ProjectMeta>) {
    setMeta(prev => ({ ...prev, ...updates }))
  }

  // ── Reset ──────────────────────────────────────────────────────────────────
  // The header's global Reset (App.tsx) is hidden on this tab; the Reset button lives in the
  // sticky action bar below instead. FullstackDepPicker is fully controlled, so resetting
  // selectedDeps re-renders it — no remount needed. Confirmed in-app (ConfirmDialog) and undoable.
  function doReset() {
    setConfirmReset(false)
    pushUndoEntry('Reset to defaults')
    Object.values(LS).forEach(k => localStorage.removeItem(k))
    setMeta({ ...DEFAULT_META })
    setEntities(withUids(DEFAULT_ENTITIES.map(e => ({ ...e, fields: e.fields.map(f => ({ ...f })) }))))
    setBackendSet('spring-jpa-crud')
    setFrontendSet('react-tailwind-crud')
    setScaffoldOpts([])
    setColorPalette('')
    setCollapsed(new Set())
    setLastGenerated(null)
    baselineRef.current = null
    // Re-seed deps from whichever backend set resolves; the set-change effect won't
    // fire if the key is unchanged, so seed explicitly here.
    const target = availableSets.find(s => s.setKey === 'spring-jpa-crud')
    setSelectedDeps(target ? [...target.defaultDeps] : [])
    clearPreview()
    setToast({ message: 'Fullstack generator reset to defaults', type: 'success' })
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
  const lintIssues = useMemo(() => lintModel(entities, scaffoldOpts, selectedDeps), [entities, scaffoldOpts, selectedDeps])
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
    pushUndoEntry(`Linked ${source.name.trim()} to ${target.name.trim()}`)
    setEntities(entities.map(e => (e.uid === sourceUid
      ? { ...e, relations: [...(e.relations ?? []), { uid: newUid(), type: 'MANY_TO_ONE' as const, fieldName, targetEntity: target.name.trim(), required: false }] }
      : e)))
    setToast({
      message: `Added ${source.name.trim()}.${fieldName} → ${target.name.trim()}`,
      type: 'success',
      action: { label: 'Show', onClick: () => revealRow(sourceUid) },
    })
  }

  const codeFilesFor = useCallback(
    (entity: FullstackEntityDef) => entityCodeFiles(entity, preview?.files),
    [preview],
  )
  const codeState = useMemo(() => ({
    hasPreview: Boolean(preview),
    loading: previewLoading,
    stale: Boolean(previewSnapshotRef.current) && !snapshotsEqual(previewSnapshotRef.current!, currentSnapshot),
    onExplore: explore,
  }), [preview, previewLoading, currentSnapshot, explore])

  const sections = [
    { id: 'fs-meta', label: 'Project', errors: countMetaErrors(metaErrors) },
    { id: 'fs-backend', label: 'Backend' },
    { id: 'fs-frontend', label: 'Frontend' },
    { id: 'fs-options', label: 'Options' },
    { id: 'fs-deps', label: 'Dependencies' },
  ]
  // A metadata error must never hide inside a collapsed panel — same rule the entity cards use
  // for a blocked Settings panel, and it keeps `jumpToFirstError`'s `#fs-meta` query answerable.
  const setupForcedOpen = countMetaErrors(metaErrors) > 0
  const setupVisible = setupOpen || setupForcedOpen
  const setupChips = useMemo(() => describeSetup({
    meta, backendSet, frontendSet, currentBackendSet, currentFrontendSet,
    palettes, effectivePalette, paletteIsExplicit: Boolean(colorPalette), selectedDeps, scaffoldOpts,
  }), [meta, backendSet, frontendSet, currentBackendSet, currentFrontendSet,
       palettes, effectivePalette, colorPalette, selectedDeps, scaffoldOpts])

  /** Opens Setup and scrolls to one of its sections — every jump target lives inside it now. */
  function jumpToSection(id: string) {
    setSetupOpen(true)
    requestAnimationFrame(() => scrollToElement(document.getElementById(id), 'start'))
  }

  function applyLintFix(issue: LintIssue) {
    if (!issue.fix) return
    pushUndoEntry(`Fixed: ${issue.fix.label}`)
    const next = issue.fix.apply({ entities, scaffoldOpts, selectedDeps })
    if (next.entities !== entities) setEntities(withUids(next.entities))
    if (next.scaffoldOpts !== scaffoldOpts) setScaffoldOpts(next.scaffoldOpts)
    if (next.selectedDeps !== selectedDeps) setSelectedDeps(next.selectedDeps)
    setToast({ message: `Applied: ${issue.fix.label}`, type: 'success' })
  }

  const lastUndo = history.past[history.past.length - 1]
  const nextRedo = history.future[history.future.length - 1]
  const blockedReason = `Fix ${errorCount} issue${errorCount === 1 ? '' : 's'} first — click to jump to the first one`

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

  useEffect(() => registerCommands([
    { id: 'fs-add-entity', title: 'Add entity', icon: 'add_box', group: 'Fullstack', run: () => commandRef.current.addEntity() },
    { id: 'fs-import-ddl', title: 'Import entities from DDL', icon: 'database', group: 'Fullstack', run: () => commandRef.current.importDdl() },
    { id: 'fs-import-select', title: 'Import a view from SELECT', icon: 'table_view', group: 'Fullstack', run: () => commandRef.current.importSelect() },
    { id: 'fs-explore', title: 'Explore generated files', description: 'Preview the file tree before downloading', icon: 'travel_explore', group: 'Fullstack', shortcut: 'Ctrl+Shift+E', run: () => commandRef.current.explore() },
    { id: 'fs-generate', title: 'Generate fullstack ZIP', icon: 'download', group: 'Fullstack', shortcut: 'Ctrl+Enter', run: () => { void commandRef.current.generate() } },
    { id: 'fs-save-preset', title: 'Save this model (browser or team)…', icon: 'bookmark_add', group: 'Fullstack', shortcut: 'Ctrl+S', run: () => commandRef.current.savePreset() },
    { id: 'fs-export', title: 'Export model as JSON', icon: 'file_download', group: 'Fullstack', run: () => commandRef.current.exportJson() },
    { id: 'fs-curl', title: 'Copy as curl', icon: 'terminal', group: 'Fullstack', run: () => { void commandRef.current.copyCurl() } },
    { id: 'fs-undo', title: 'Undo', icon: 'undo', group: 'Fullstack', shortcut: 'Ctrl+Z', run: () => commandRef.current.undo() },
    { id: 'fs-redo', title: 'Redo', icon: 'redo', group: 'Fullstack', shortcut: 'Ctrl+Shift+Z', run: () => commandRef.current.redo() },
    { id: 'fs-collapse', title: 'Collapse / expand all entities', icon: 'unfold_less', group: 'Fullstack', run: () => commandRef.current.toggleCollapse() },
    { id: 'fs-find', title: 'Find entity…', description: 'Filter the entity list by name, label, table or field', icon: 'search', group: 'Fullstack', run: () => commandRef.current.findEntity() },
    { id: 'fs-density', title: 'Toggle compact field tables', icon: 'density_small', group: 'Fullstack', run: () => commandRef.current.toggleDensity() },
    { id: 'fs-reset', title: 'Reset the fullstack generator', icon: 'restart_alt', group: 'Fullstack', run: () => commandRef.current.reset() },
    { id: 'fs-shortcuts', title: 'Keyboard shortcuts', icon: 'keyboard', group: 'Fullstack', shortcut: '?', run: () => commandRef.current.toggleShortcuts() },
  ]), [])

  return (
    <div className="max-w-7xl mx-auto px-8 space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-on-surface tracking-tight">Fullstack CRUD Generator</h1>
        <p className="text-sm text-secondary max-w-2xl">
          Define a set of entities with their fields. Get a single ZIP containing a Spring Boot backend
          (JPA + REST controllers per entity) and a React frontend (Vite + Tailwind, with a table-driven
          CRUD page per entity), already wired together end-to-end.
        </p>
      </header>

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
          pushUndoEntry("Loaded the other tab's draft")
          setMeta(theirs.meta)
          setEntities(withUids(theirs.entities))
        }}
        onKeepMine={() => {
          setExternalDraft(null)
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
          onChipJump={id => { setSetupOpen(true); requestAnimationFrame(() => scrollToElement(document.getElementById(id), 'start')) }}
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
        frontendSets={frontendSets}
        backendSet={backendSet}
        frontendSet={frontendSet}
        setBackendSet={setBackendSet}
        setFrontendSet={setFrontendSet}
        currentBackendSet={currentBackendSet}
        currentFrontendSet={currentFrontendSet}
        setsLoading={setsLoading}
        setsError={setsError}
        loadTemplateSets={loadTemplateSets}
        palettes={palettes}
        feError={feError}
        reloadFe={reloadFe}
        effectivePalette={effectivePalette}
        setDefaultPalette={setDefaultPalette}
        colorPalette={colorPalette}
        setColorPalette={setColorPalette}
        scaffoldOpts={scaffoldOpts}
        toggleOpt={toggleOpt}
        selectedDeps={selectedDeps}
        setSelectedDeps={setSelectedDeps}
        currentDefaults={currentDefaults}
        compatibilityRules={compatibilityRules}
        entities={entities}
        revealRow={revealRow}
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
          onAddEntity={() => commandRef.current.addEntity()}
          canUndo={Boolean(lastUndo)}
          canRedo={Boolean(nextRedo)}
          undoLabel={lastUndo ? `Undo: ${lastUndo.label}` : null}
          redoLabel={nextRedo ? `Redo: ${nextRedo.label}` : null}
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
          <EntityRelationGraph
            entities={entities}
            showInverse={scaffoldOpts.includes('inverseCollections')}
            onSelect={uid => { setShowGraph(false); revealRow(uid) }}
            onCreateRelation={createRelationFromGraph}
            onRefuseRelation={message => setToast({ message, type: 'error' })}
          />
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
              noEntities={entityErrors.noEntities}
              collapsed={collapsed}
              onToggleCollapsed={toggleCollapsed}
              onDestructive={pushUndoEntry}
              projectOpts={scaffoldOpts}
              onNotice={(message, action) => setToast({ message, type: 'success', action })}
              onRowAdded={revealRow}
              lintCounts={lintCounts}
              onShowLint={showLintFor}
              density={density}
              visibleUids={visibleUids}
              previewCtx={{ locale: meta.locale, rtl: scaffoldOpts.includes('rtl') }}
              onCodeFiles={codeFilesFor}
              codeState={codeState}
              onGoToOptions={() => jumpToSection('fs-options')}
            />
          </div>
        </div>
      </section>

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
            ? { message: `${what} copied to clipboard`, type: 'success' }
            : { message: "Couldn't copy — clipboard access was refused", type: 'error' })}
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
          title="Reset the fullstack generator?"
          message="This clears your entities, dependencies and options back to the defaults. You can undo it afterwards."
          confirmLabel="Reset"
          tone="danger"
          onConfirm={doReset}
          onCancel={() => setConfirmReset(false)}
        />
      )}

      {teamConflict && (
        <ConfirmDialog
          title={`Replace the team model "${teamConflict.existing.name}"?`}
          message={`A team model with this name already exists${teamConflict.existing.createdBy ? ` (saved by ${teamConflict.existing.createdBy})` : ''}. Overwriting it changes what everyone else loads.`}
          confirmLabel="Overwrite"
          tone="danger"
          secondaryLabel="Rename…"
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
          title={`Delete "${confirmDeleteTeam.name}" for everyone?`}
          message="This removes the model from the server. Colleagues who rely on it will no longer see it, and this cannot be undone."
          confirmLabel="Delete"
          tone="danger"
          onConfirm={() => { void deleteTeamModel() }}
          onCancel={() => setConfirmDeleteTeam(null)}
        />
      )}

      {pendingJsonImport && (
        <ConfirmDialog
          title={`Import ${pendingJsonImport.meta.artifactId || 'this model'}?`}
          message={`The file holds ${pendingJsonImport.entities.length} entit${pendingJsonImport.entities.length === 1 ? 'y' : 'ies'}. Replace loads the whole model (entities, dependencies and settings) in place of yours; Append adds only its entities to your current ${entities.length}. Either can be undone (Ctrl+Z).`}
          confirmLabel="Replace"
          tone="danger"
          secondaryLabel={`Append ${pendingJsonImport.entities.length}`}
          onSecondary={appendJsonImport}
          onConfirm={() => { const s = pendingJsonImport; setPendingJsonImport(null); loadPreset(s) }}
          onCancel={() => setPendingJsonImport(null)}
        />
      )}

      {pendingLoad && (
        <ConfirmDialog
          title={pendingLoad.kind === 'example'
            ? `Load the ${pendingLoad.example.name} example?`
            : pendingLoad.kind === 'shared'
              ? 'Open the shared model?'
              : `Load ${pendingLoad.snapshot.meta.artifactId || 'this preset'}?`}
          message={pendingLoad.kind === 'example'
            ? 'This replaces your current entities, which aren\'t saved as a preset yet. You can undo it afterwards (Ctrl+Z).'
            : pendingLoad.kind === 'shared'
              ? `This link carries "${pendingLoad.snapshot.meta.artifactId || 'a model'}" (${pendingLoad.snapshot.entities.length} entit${pendingLoad.snapshot.entities.length === 1 ? 'y' : 'ies'}). Your draft here has edits that aren't saved as a preset — Replace loads the link over it (undoable with Ctrl+Z); Keep mine leaves your draft as it is.`
              : 'This replaces your current entities, dependencies and settings, which aren\'t saved as a preset yet. You can undo it afterwards (Ctrl+Z).'}
          confirmLabel={pendingLoad.kind === 'shared' ? 'Replace my draft' : 'Load'}
          cancelLabel={pendingLoad.kind === 'shared' ? 'Keep mine' : 'Cancel'}
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

      {preview && createPortal(
        <Suspense fallback={<ViewSkeleton />}>
          <ProjectPreview
            preview={preview}
            previousPreview={previousPreview}
            artifactId={meta.artifactId || 'demo'}
            onClose={clearPreview}
            onDownload={async () => { if (await generate()) clearPreview() }}
          />
        </Suspense>,
        document.body,
      )}
    </div>
  )
}



/** Adds or clears `key` in the failed-writes set, returning the same set when nothing changed. */
function trackPersist(prev: ReadonlySet<string>, key: string, ok: boolean): ReadonlySet<string> {
  if (ok === !prev.has(key)) return prev
  const next = new Set(prev)
  if (ok) next.delete(key)
  else next.add(key)
  return next
}



