import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type {
  EntityTemplateSetSummary, FullstackEntityDef, FullstackStarterRequest, Toast,
} from '../../types'
import { EntitiesEditor } from './EntitiesEditor'
import { FullstackDepPicker } from './FullstackDepPicker'
import { FullstackPresets } from './FullstackPresets'
import { ImportFromDdlDrawer, type ImportMode, type ImportVariant } from './ImportFromDdlDrawer'
import { ViewSkeleton } from '../Skeletons'
import { ConfirmDialog } from '../ConfirmDialog'
import { StatusToast } from '../admin/shared/StatusToast'
import { stripUids, withUids } from './uid'
import {
  describeSnapshotChange, makeSnapshot, parseExportedModel, snapshotsEqual, toExportedModel,
  type FullstackSnapshot, type ProjectMeta,
} from './snapshot'
import { clearShareFromLocation, readShareFromLocation, writeShareToLocation, type ShareWriteStatus } from './shareLink'
import { emptyHistory, isTypingTarget, record, redoStep, undoStep, type History } from './undo'
import { cloneExample, type ExampleModel } from './examples'
import { PalettePicker } from '../shared/PalettePicker'
import { downloadBlob } from '../../utils/projectUtils'
import { copyToClipboard } from '../../utils/clipboard'
import { useFrontendMetadata } from '../../hooks/useFrontendMetadata'

// The preview modal drags in CodeMirror + every language grammar; load it on first Explore.
const ProjectPreview = lazy(() => import('../ProjectPreview').then(m => ({ default: m.ProjectPreview })))
import { useFullstackPreview } from '../../hooks/useFullstackPreview'
import { useFullstackPresets } from '../../hooks/useFullstackPresets'
import { useAdminMetadata } from '../../hooks/useAdminMetadata'
import { validateEntities, validateMeta, countMetaErrors, type MetaErrors } from './validation'

const DEFAULT_META: ProjectMeta = {
  groupId: 'com.menora',
  artifactId: 'demo',
  packageName: 'com.menora.demo',
  domainPackage: '',
  bootVersion: '3.2.1',
  javaVersion: '21',
  dashboardTitle: '',
  dashboardOverview: '',
}

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
} as const

// Opt-in scaffolding extras, sent as opts.scaffold. Each value matches a backend optScaffold<Option>
// gate — keep this list in step with FullstackProjectGenerationConfiguration (backend) and
// FullstackStarterController.renderFrontend (frontend): an opt missing here is unreachable from the UI.
// `requiresAnyDep`: the backend silently no-ops the opt unless one of these deps is selected, so the
// editor warns inline instead of letting the user discover the missing scaffolding in the ZIP.
const SCAFFOLD_OPTIONS: { value: string; label: string; hint: string; requiresAnyDep?: string[] }[] = [
  { value: 'audit', label: 'Audit timestamps', hint: 'createdAt / updatedAt via JPA auditing' },
  { value: 'softDelete', label: 'Soft delete', hint: 'deleted flag + Hibernate @SQLDelete/@SQLRestriction; delete toast gets a real Undo' },
  { value: 'inverseCollections', label: 'Inverse collections', hint: 'Read-only @OneToMany on the referenced side' },
  { value: 'tests', label: 'Controller tests', hint: 'Per-entity @WebMvcTest' },
  { value: 'openapi', label: 'OpenAPI annotations', hint: 'springdoc @Tag/@Operation on every controller; adds the openapi starter' },
  { value: 'secured', label: 'Permission hints', hint: 'Commented @RequiresPermission per endpoint; needs ldap-auth or ldap-auth-rest selected', requiresAnyDep: ['ldap-auth', 'ldap-auth-rest'] },
  { value: 'csvExport', label: 'CSV export', hint: 'GET /export.csv (streamed, honors search/filters/sort) + Export button' },
  { value: 'bulkDelete', label: 'Bulk delete', hint: 'Select rows, DELETE /bulk across all' },
  { value: 'bulkUpdate', label: 'Bulk edit', hint: 'Select rows, set one field, PATCH /bulk across all' },
  { value: 'seedData', label: 'Demo data', hint: 'Seeds 8 rows per entity on first start (parents before children); off via app.demo-data.enabled=false' },
  { value: 'rtl', label: 'RTL layout', hint: 'dir="rtl" + Hebrew lang; mirrored right-to-left UI' },
]

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
 *  keystroke. Losing the refresh-restore is the acceptable failure. */
function persist(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* quota exceeded / storage disabled — keep editing, just don't restore on refresh */
  }
}

/** The stock entity model, normalized like a snapshot so "still untouched" is a plain compare. */
const DEFAULT_ENTITIES_JSON = JSON.stringify(stripUids(DEFAULT_ENTITIES))

/** A load that replaces the editor's model, held while the user confirms it. */
type PendingLoad =
  | { kind: 'example'; example: ExampleModel }
  | { kind: 'preset'; snapshot: FullstackSnapshot }

export function FullstackView() {
  // A share link (?fs=…) beats localStorage on first render — that is the whole point of the link.
  const sharedRef = useRef<FullstackSnapshot | null | undefined>(undefined)
  if (sharedRef.current === undefined) sharedRef.current = readShareFromLocation()
  const shared = sharedRef.current

  const [meta, setMeta] = useState<ProjectMeta>(() => shared?.meta ?? loadJson(LS.meta, DEFAULT_META))
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
  const [pendingLoad, setPendingLoad] = useState<PendingLoad | null>(null)
  const [shareStatus, setShareStatus] = useState<ShareWriteStatus>('written')
  const {
    preview, previousPreview, loading: previewLoading, error: previewError,
    fetchPreview, clearPreview, clearError,
  } = useFullstackPreview()
  const { presets, recents, savePreset, deletePreset, deleteRecent, pushRecent } = useFullstackPresets()

  const { bootVersions, javaVersions } = useAdminMetadata()
  const { metadata: feMetadata } = useFrontendMetadata()
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
  const metaErrors: MetaErrors = useMemo(() => validateMeta(meta), [meta])
  const errorCount = entityErrors.count + countMetaErrors(metaErrors)
  const hasErrors = errorCount > 0

  // Persist form state so a refresh doesn't lose the user's work (mirrors useProjectState).
  useEffect(() => { persist(LS.meta, JSON.stringify(meta)) }, [meta])
  useEffect(() => { persist(LS.entities, JSON.stringify(entities)) }, [entities])
  useEffect(() => { persist(LS.deps, JSON.stringify(selectedDeps)) }, [selectedDeps])
  useEffect(() => { persist(LS.backendSet, backendSet) }, [backendSet])
  useEffect(() => { persist(LS.frontendSet, frontendSet) }, [frontendSet])
  useEffect(() => { persist(LS.opts, JSON.stringify(scaffoldOpts)) }, [scaffoldOpts])
  useEffect(() => { persist(LS.palette, colorPalette) }, [colorPalette])
  useEffect(() => { persist(LS.collapsed, JSON.stringify([...collapsed])) }, [collapsed])

  // The whole editor state as one detached value — what presets/recents/undo/share links carry.
  const currentSnapshot = useMemo(
    () => makeSnapshot({ meta, entities, selectedDeps, scaffoldOpts, backendSet, frontendSet, colorPalette }),
    [meta, entities, selectedDeps, scaffoldOpts, backendSet, frontendSet, colorPalette],
  )
  const snapshotRef = useRef(currentSnapshot)
  snapshotRef.current = currentSnapshot

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
    }
  }, [currentFrontendSet])

  // ── Undo / redo ────────────────────────────────────────────────────────────
  // Every change to the snapshot is recorded automatically: the effect below sees the new
  // snapshot, and files the *previous* one as the "before" state. Rapid successive changes
  // (typing a name, ticking a few boxes) coalesce into one entry — a burst stays open while
  // changes keep arriving within BURST_IDLE_MS and is committed when they stop. Destructive
  // actions (remove, import, load, reset) still push an explicitly labelled entry first via
  // pushUndoEntry; the state change they cause is then skipped so it isn't recorded twice.
  // Undo/redo restore through applySnapshot and are skipped the same way.
  const BURST_IDLE_MS = 600
  const historyRef = useRef(history)
  historyRef.current = history
  const lastSnapshotRef = useRef(currentSnapshot)
  // The snapshot a silent (already-recorded, or non-user) change starts from — matched by
  // identity in the recording effect, then cleared.
  const silentFromRef = useRef<FullstackSnapshot | null>(null)
  const burstRef = useRef<{ before: FullstackSnapshot; label: string } | null>(null)
  const burstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flushBurst = useCallback(() => {
    if (burstTimerRef.current) { clearTimeout(burstTimerRef.current); burstTimerRef.current = null }
    const burst = burstRef.current
    if (!burst) return
    burstRef.current = null
    setHistory(h => record(h, { label: burst.label, snapshot: burst.before }))
  }, [])

  useEffect(() => {
    const prev = lastSnapshotRef.current
    if (prev === currentSnapshot) return
    lastSnapshotRef.current = currentSnapshot
    if (silentFromRef.current === prev) { silentFromRef.current = null; return }
    if (snapshotsEqual(prev, currentSnapshot)) return
    if (!burstRef.current) burstRef.current = { before: prev, label: describeSnapshotChange(prev, currentSnapshot) }
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

  const applySnapshot = useCallback((s: FullstackSnapshot) => {
    // Adopt the snapshot's sets as "already seeded" so the set-change effects above don't
    // re-seed deps/versions over the snapshot's own values.
    seededBackendSetRef.current = s.backendSet
    seededFrontendSetRef.current = s.frontendSet
    setMeta({ ...s.meta })
    setEntities(withUids(JSON.parse(JSON.stringify(s.entities)) as FullstackEntityDef[]))
    setSelectedDeps([...s.selectedDeps])
    setScaffoldOpts([...s.scaffoldOpts])
    setBackendSet(s.backendSet)
    setFrontendSet(s.frontendSet)
    setColorPalette(s.colorPalette ?? '')
    setCollapsed(new Set())
    baselineRef.current = null // adopt the loaded state as the new "nothing unsaved" point
  }, [])

  const undo = useCallback(() => {
    flushBurst()
    const step = undoStep(historyRef.current, snapshotRef.current)
    if (!step) return
    silentFromRef.current = snapshotRef.current
    setHistory(step.history)
    applySnapshot(step.restore.snapshot)
    setToast({ message: `Undid: ${step.restore.label}`, type: 'success' })
  }, [applySnapshot, flushBurst])

  const redo = useCallback(() => {
    flushBurst()
    const step = redoStep(historyRef.current, snapshotRef.current)
    if (!step) return
    silentFromRef.current = snapshotRef.current
    setHistory(step.history)
    applySnapshot(step.restore.snapshot)
    setToast({ message: `Redid: ${step.restore.label}`, type: 'success' })
  }, [applySnapshot, flushBurst])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || isTypingTarget(e.target)) return
      const key = e.key.toLowerCase()
      if (key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      else if ((key === 'z' && e.shiftKey) || key === 'y') { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  function handleImport(imported: FullstackEntityDef[], mode: ImportMode, note?: string) {
    pushUndoEntry(mode === 'replace' ? 'Replaced entities from import' : 'Appended imported entities')
    const stamped = withUids(imported)
    setEntities(prev => (mode === 'replace' ? stamped : [...prev, ...stamped]))
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

  function loadPreset(snapshot: FullstackSnapshot) {
    pushUndoEntry('Loaded a preset')
    applySnapshot(snapshot)
    setToast({ message: `Loaded ${snapshot.meta.artifactId || 'preset'}`, type: 'success' })
  }

  function runLoad(load: PendingLoad) {
    if (load.kind === 'example') loadExample(load.example)
    else loadPreset(load.snapshot)
  }
  /** Entry point for the presets strip: confirms first when it would discard unsaved edits. */
  function requestLoad(load: PendingLoad) {
    if (hasUnsavedWork) setPendingLoad(load)
    else runLoad(load)
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
      requestLoad({ kind: 'preset', snapshot: result.snapshot })
    }).catch(() => setToast({ message: `Couldn't read ${file.name}`, type: 'error' }))
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
    setToast(await copyToClipboard(cmd)
      ? { message: 'curl command copied to clipboard', type: 'success' }
      : { message: "Couldn't copy — clipboard access was refused", type: 'error' })
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
    const metaInvalid = document.querySelector<HTMLElement>('#fs-meta [aria-invalid="true"]')
    if (metaInvalid) {
      metaInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' })
      metaInvalid.focus()
      return
    }
    const firstIdx = Object.keys(entityErrors.entities).map(Number).sort((a, b) => a - b)[0]
    const uid = firstIdx == null ? undefined : entities[firstIdx]?.uid
    if (uid && collapsed.has(uid)) {
      setCollapsed(prev => { const next = new Set(prev); next.delete(uid); return next })
    }
    requestAnimationFrame(() => {
      const scope = firstIdx == null ? '#fs-entities' : `[data-entity-index="${firstIdx}"]`
      const target = document.querySelector<HTMLElement>(`${scope} [aria-invalid="true"], ${scope} [data-error]`)
        ?? document.querySelector<HTMLElement>('#fs-entities')
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      if (target?.matches('input, select, textarea')) target.focus()
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
    fetchPreview(buildBody())
  }

  /** Returns true when the ZIP downloaded successfully — lets the preview modal stay
   *  open (and show the error toast) on failure, and close only on success. */
  async function generate(): Promise<boolean> {
    if (!validateBeforeSubmit()) return false
    setGenerating(true)
    try {
      const body = buildBody()
      const res = await fetch('/starter-fullstack.zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
      return true
    } catch (err) {
      setToast({ message: `Generation failed: ${(err as Error).message}`, type: 'error' })
      return false
    } finally {
      setGenerating(false)
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

  const lastUndo = history.past[history.past.length - 1]
  const nextRedo = history.future[history.future.length - 1]
  const blockedReason = `Fix ${errorCount} issue${errorCount === 1 ? '' : 's'} first (see the list to the left)`

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

      <FullstackPresets
        presets={presets}
        recents={recents}
        currentSnapshot={currentSnapshot}
        onLoad={snapshot => requestLoad({ kind: 'preset', snapshot })}
        onLoadExample={example => requestLoad({ kind: 'example', example })}
        onSave={(name, snapshot) => { savePreset(name, snapshot); setToast({ message: `Saved preset "${name}"`, type: 'success' }) }}
        onDeletePreset={deletePreset}
        onDeleteRecent={deleteRecent}
        onExportJson={exportJson}
        onImportJson={importJson}
        onCopyCurl={copyCurl}
      />

      {/* Two-column config row: compact settings on the left, the taller dependency
          picker on the right. Collapses to a single column below lg (mirrors the
          Backend/Frontend tabs) so wide screens don't leave the right half empty. */}
      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-5 space-y-8 lg:h-[480px] lg:overflow-y-auto lg:pr-2">
      <section id="fs-meta" className="space-y-3">
        <SectionHeading icon="tune" title="Project Metadata" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Labeled label="Group ID" htmlFor="fs-groupId" error={metaErrors.groupId}>
            <input id="fs-groupId" className={inputClass(metaErrors.groupId)} value={meta.groupId}
                   aria-invalid={Boolean(metaErrors.groupId)}
                   onChange={e => updateMeta({ groupId: e.target.value })} />
          </Labeled>
          <Labeled label="Artifact ID" htmlFor="fs-artifactId" error={metaErrors.artifactId}>
            <input id="fs-artifactId" className={inputClass(metaErrors.artifactId)} value={meta.artifactId}
                   aria-invalid={Boolean(metaErrors.artifactId)}
                   onChange={e => updateMeta({ artifactId: e.target.value })} />
          </Labeled>
          <Labeled label="Package Name" htmlFor="fs-packageName" error={metaErrors.packageName}>
            <input id="fs-packageName" className={inputClass(metaErrors.packageName)} value={meta.packageName}
                   aria-invalid={Boolean(metaErrors.packageName)}
                   onChange={e => updateMeta({ packageName: e.target.value })} />
          </Labeled>
          <Labeled label="Domain Package" htmlFor="fs-domainPackage" error={metaErrors.domainPackage}>
            <input id="fs-domainPackage" className={inputClass(metaErrors.domainPackage)} value={meta.domainPackage}
                   aria-invalid={Boolean(metaErrors.domainPackage)}
                   placeholder={meta.packageName || 'com.menora.demo'}
                   onChange={e => updateMeta({ domainPackage: e.target.value })} />
            <p className="text-[11px] text-on-surface-variant">
              Where entities/repositories/controllers go, split into <code>.entity</code>, <code>.repository</code>,
              <code>.dto</code>, <code>.service</code>, <code>.controller</code>. Blank = same as Package Name; must be under it.
            </p>
          </Labeled>
          <Labeled label="Java Version" htmlFor="fs-javaVersion">
            <select id="fs-javaVersion" className={inputClass()} value={meta.javaVersion}
                    onChange={e => updateMeta({ javaVersion: e.target.value })}>
              {javaVersions.length === 0 && <option value={meta.javaVersion}>{meta.javaVersion}</option>}
              {javaVersions.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </Labeled>
          <Labeled label="Boot Version" htmlFor="fs-bootVersion">
            <select id="fs-bootVersion" className={inputClass()} value={meta.bootVersion}
                    onChange={e => updateMeta({ bootVersion: e.target.value })}>
              {bootVersions.length === 0 && <option value={meta.bootVersion}>{meta.bootVersion}</option>}
              {bootVersions.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </Labeled>
          <Labeled label="Dashboard Title" htmlFor="fs-dashboardTitle">
            <input id="fs-dashboardTitle" className={inputClass()} value={meta.dashboardTitle}
                   placeholder={`Welcome to ${meta.artifactId || 'demo'}`}
                   onChange={e => updateMeta({ dashboardTitle: e.target.value })} />
          </Labeled>
          <Labeled label="Dashboard Overview" htmlFor="fs-dashboardOverview">
            <input id="fs-dashboardOverview" className={inputClass()} value={meta.dashboardOverview}
                   placeholder="Manage your data below…"
                   onChange={e => updateMeta({ dashboardOverview: e.target.value })} />
          </Labeled>
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeading icon="dashboard_customize" title="Template Sets" />
        <p className="text-[11px] text-on-surface-variant">
          Generated files come from the selected backend + frontend template sets. Edit them in the
          Config admin panel under "Entity CRUD".
        </p>
        {setsError && (
          <div className="flex items-center justify-between gap-3 text-[11px] text-error border border-error/30 bg-error/10 rounded px-3 py-2">
            <span>Couldn't load template sets ({setsError}); showing defaults.</span>
            <button
              type="button"
              onClick={loadTemplateSets}
              disabled={setsLoading}
              className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-error/40 text-error hover:bg-error/10 transition-colors disabled:opacity-60"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>refresh</span>
              Retry
            </button>
          </div>
        )}
        {setsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" aria-hidden="true">
            <div className="h-[58px] rounded bg-surface-container-low animate-pulse" />
            <div className="h-[58px] rounded bg-surface-container-low animate-pulse" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Labeled label="Backend" htmlFor="fs-backendSet">
              {/* Only one set per kind is seeded today, so a single-option <select> is just
                  visual noise — show read-only text until a second set exists (then #5). */}
              {backendSets.length > 1 ? (
                <select id="fs-backendSet" className={inputClass()} value={backendSet} onChange={e => setBackendSet(e.target.value)}>
                  {backendSets.map(s => <option key={s.setKey} value={s.setKey}>{s.name} ({s.setKey})</option>)}
                </select>
              ) : (
                <SetLabel name={currentBackendSet?.name} setKey={backendSet} />
              )}
            </Labeled>
            <Labeled label="Frontend" htmlFor="fs-frontendSet">
              {frontendSets.length > 1 ? (
                <select id="fs-frontendSet" className={inputClass()} value={frontendSet} onChange={e => setFrontendSet(e.target.value)}>
                  {frontendSets.map(s => <option key={s.setKey} value={s.setKey}>{s.name} ({s.setKey})</option>)}
                </select>
              ) : (
                <SetLabel name={currentFrontendSet?.name} setKey={frontendSet} />
              )}
            </Labeled>
          </div>
        )}
        {palettes.length > 0 && (
          <div className="pt-1 space-y-1.5">
            <PalettePicker
              label="Frontend colour palette"
              palettes={palettes}
              selectedId={effectivePalette}
              onChange={id => setColorPalette(id === setDefaultPalette ? '' : id)}
              caption={colorPalette
                ? (
                  <button type="button" onClick={() => setColorPalette('')} className="underline hover:no-underline">
                    use the set's default
                  </button>
                )
                : '(set default)'}
            />
            {currentFrontendSet?.designSystem === 'MENORA_DIGITAL' && (
              <p className="text-[11px] text-on-surface-variant">
                The Menora Digital set uses the fixed brand tokens for its colours; the palette only feeds
                the success/danger accents.
              </p>
            )}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <SectionHeading icon="toggle_on" title="Options" />
        <p className="text-[11px] text-on-surface-variant">
          Opt-in scaffolding extras applied to every entity. Off by default.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SCAFFOLD_OPTIONS.map(opt => {
            const checked = scaffoldOpts.includes(opt.value)
            const missingDep = checked && opt.requiresAnyDep && !opt.requiresAnyDep.some(d => selectedDeps.includes(d))
            return (
            <label
              key={opt.value}
              className={`flex items-start gap-2.5 p-3 rounded-lg border hover:border-primary/50 cursor-pointer transition-colors ${missingDep ? 'border-warning/50 bg-warning/5' : 'border-outline-variant'}`}
            >
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-primary"
                checked={checked}
                onChange={() => toggleOpt(opt.value)}
              />
              <span className="flex flex-col min-w-0">
                <span className="text-sm text-on-surface">{opt.label}</span>
                <span className="text-[11px] text-secondary">{opt.hint}</span>
                {missingDep && opt.requiresAnyDep && (
                  <span className="mt-1.5 flex items-center gap-1.5 text-[11px] text-warning" role="alert">
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>warning</span>
                    <span>Has no effect without <code className="font-mono">{opt.requiresAnyDep[0]}</code>.</span>
                    <button
                      type="button"
                      onClick={e => { e.preventDefault(); setSelectedDeps(prev => [...prev, opt.requiresAnyDep![0]]) }}
                      className="font-semibold underline hover:no-underline"
                    >
                      Add it
                    </button>
                  </span>
                )}
              </span>
            </label>
            )
          })}
        </div>
      </section>

        </div>

        <div className="col-span-12 lg:col-span-7 lg:flex lg:flex-col lg:h-[480px]">
      <section className="space-y-3 lg:flex lg:flex-col lg:flex-1 lg:min-h-0">
        <div className="flex items-center justify-between gap-4">
          <SectionHeading icon="inventory_2" title="Dependencies" />
          <span className="text-[11px] text-secondary">{selectedDeps.length} selected</span>
        </div>
        <p className="text-[11px] text-on-surface-variant">
          Pre-checked from the chosen backend set's defaults. You can uncheck
          anything — the generator respects your final selection. To change what
          a set ships pre-checked, edit it under Admin → Entity CRUD.
        </p>
        <FullstackDepPicker
          selected={selectedDeps}
          defaults={currentDefaults}
          onChange={setSelectedDeps}
        />
      </section>
        </div>
      </div>

      <section id="fs-entities" className="space-y-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <SectionHeading icon="table" title="Entities" primary />
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[11px] text-secondary">{entities.length} entit{entities.length === 1 ? 'y' : 'ies'}</span>
            {entities.length > 1 && (
              <button
                type="button"
                onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(entities.map(e => e.uid).filter((u): u is string => Boolean(u))))}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-secondary hover:text-primary hover:bg-primary/5 transition-colors"
                title={allCollapsed ? 'Expand every entity card' : 'Collapse every entity card to its header'}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{allCollapsed ? 'unfold_more' : 'unfold_less'}</span>
                {allCollapsed ? 'Expand all' : 'Collapse all'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setImportVariant('ddl')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-outline-variant text-secondary hover:text-primary hover:border-primary hover:bg-primary/5 transition-colors"
              title="Parse CREATE TABLE DDL into entities"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>database</span>
              Import from DDL
            </button>
            <button
              type="button"
              onClick={() => setImportVariant('select')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-outline-variant text-secondary hover:text-primary hover:border-primary hover:bg-primary/5 transition-colors"
              title="Parse a SELECT query into a read-only view entity"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>table_view</span>
              Import from SELECT
            </button>
          </div>
        </div>
        <EntitiesEditor
          entities={entities}
          onChange={setEntities}
          errors={entityErrors.entities}
          noEntities={entityErrors.noEntities}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          onDestructive={pushUndoEntry}
        />
      </section>

      {/* Pinned to the viewport bottom so Generate/Explore stay reachable while editing a long
          entity list. The negative-margin/px pair lets the glass backdrop bleed to the column edges. */}
      <section className="sticky bottom-0 z-20 -mx-8 px-8 py-4 flex flex-col gap-3 glass-header border-t border-outline-variant">
        {previewError && (
          <div role="alert" className="flex items-start gap-3 rounded-lg border border-error/30 bg-error/10 px-3 py-2">
            <span className="material-symbols-outlined text-error mt-0.5" style={{ fontSize: '18px' }}>error</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-on-surface">Couldn't build the preview</p>
              <p className="text-[11px] text-secondary break-words">
                {previewError.kind ? `${previewError.kind}: ` : ''}{previewError.message}
              </p>
            </div>
            <button
              type="button"
              onClick={explore}
              disabled={previewLoading}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-primary text-on-primary hover:opacity-90 disabled:opacity-60 shrink-0"
            >
              Retry
            </button>
            <button type="button" onClick={clearError} aria-label="Dismiss preview error" className="p-0.5 rounded text-secondary hover:text-on-surface shrink-0">
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
            </button>
          </div>
        )}
        {shareStatus === 'too-large' && (
          <p className="flex items-center gap-1.5 text-[11px] text-secondary" role="status">
            <span className="material-symbols-outlined text-warning" style={{ fontSize: '14px' }}>link_off</span>
            This model is too large for a share link — the header's Share button copies a link without it.
            Use Export JSON (above) to hand it to someone.
          </p>
        )}
        <div className="flex items-center gap-3">
        <button
          onClick={() => setConfirmReset(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium border border-outline-variant text-secondary hover:text-error hover:border-error/50 hover:bg-error/5 transition-all active:scale-95"
          title="Reset the fullstack generator to defaults"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>restart_alt</span>
          Reset
        </button>
        <button
          type="button"
          onClick={undo}
          disabled={!lastUndo}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium border border-outline-variant text-secondary hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all active:scale-95 disabled:opacity-40 disabled:hover:text-secondary disabled:hover:border-outline-variant disabled:hover:bg-transparent"
          title={lastUndo ? `Undo: ${lastUndo.label} (Ctrl+Z)` : 'Nothing to undo'}
          aria-label={lastUndo ? `Undo: ${lastUndo.label}` : 'Undo (nothing to undo)'}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>undo</span>
          Undo
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={!nextRedo}
          className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium border border-outline-variant text-secondary hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all active:scale-95 disabled:opacity-40 disabled:hover:text-secondary disabled:hover:border-outline-variant disabled:hover:bg-transparent"
          title={nextRedo ? `Redo: ${nextRedo.label} (Ctrl+Shift+Z / Ctrl+Y)` : 'Nothing to redo'}
          aria-label={nextRedo ? `Redo: ${nextRedo.label}` : 'Redo (nothing to redo)'}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>redo</span>
        </button>
        {hasErrors && (
          <button
            type="button"
            onClick={jumpToFirstError}
            className="text-[11px] text-error flex items-center gap-1 rounded px-1.5 py-1 hover:bg-error/10 transition-colors"
            title="Jump to the first problem"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>error</span>
            {errorCount} issue{errorCount === 1 ? '' : 's'} to fix before generating
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_forward</span>
          </button>
        )}
        <button
          onClick={explore}
          disabled={previewLoading || hasErrors}
          title={hasErrors ? blockedReason : 'Preview the generated file tree before downloading'}
          className={`ml-auto inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-medium border transition-all duration-200 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed ${previewError
            ? 'border-error/50 text-error hover:bg-error/5'
            : 'border-outline-variant text-secondary hover:text-primary hover:border-primary hover:bg-primary/5'}`}
        >
          {previewLoading
            ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: '16px' }}>progress_activity</span>
            : <><span className="material-symbols-outlined" style={{ fontSize: '16px' }}>travel_explore</span>Explore</>}
        </button>
        <button
          onClick={generate}
          disabled={generating || hasErrors}
          title={hasErrors ? blockedReason : 'Generate and download the backend + frontend ZIP'}
          className="px-8 py-3 rounded-xl text-sm font-bold transition-all duration-300 active:scale-95 animated-gradient-btn shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {generating ? 'Generating…' : 'Generate Fullstack ZIP'}
        </button>
        </div>
      </section>

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

      {pendingLoad && (
        <ConfirmDialog
          title={pendingLoad.kind === 'example'
            ? `Load the ${pendingLoad.example.name} example?`
            : `Load ${pendingLoad.snapshot.meta.artifactId || 'this preset'}?`}
          message={pendingLoad.kind === 'example'
            ? 'This replaces your current entities, which aren\'t saved as a preset yet. You can undo it afterwards (Ctrl+Z).'
            : 'This replaces your current entities, dependencies and settings, which aren\'t saved as a preset yet. You can undo it afterwards (Ctrl+Z).'}
          confirmLabel="Load"
          onConfirm={() => { const load = pendingLoad; setPendingLoad(null); runLoad(load) }}
          onCancel={() => setPendingLoad(null)}
        />
      )}

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

/** Section label with a leading icon. `primary` bumps the weight/size so the Entities
 *  workspace visibly outranks the surrounding config sections. */
function SectionHeading({ icon, title, primary }: { icon: string; title: string; primary?: boolean }) {
  return (
    <h2 className={`flex items-center gap-2 font-bold uppercase tracking-widest ${
      primary ? 'text-sm text-on-surface' : 'text-xs text-secondary'}`}>
      <span className={`material-symbols-outlined ${primary ? 'text-primary' : 'text-secondary'}`}
            style={{ fontSize: primary ? '18px' : '15px' }}>{icon}</span>
      {title}
    </h2>
  )
}

function inputClass(error?: string): string {
  const base = 'w-full bg-background border rounded px-3 py-2 text-sm text-on-surface outline-none transition-all'
  return error
    ? `${base} border-error focus:ring-2 focus:ring-error/20 focus:border-error`
    : `${base} border-outline-variant focus:ring-2 focus:ring-primary/20 focus:border-primary`
}

function SetLabel({ name, setKey }: { name?: string; setKey: string }) {
  return (
    <div className="w-full bg-surface-container-low border border-outline-variant rounded px-3 py-2 text-sm text-on-surface">
      {name ?? setKey}
      <span className="ml-2 text-[11px] text-secondary font-mono">{setKey}</span>
    </div>
  )
}

function Labeled({ label, htmlFor, error, children }: {
  label: string; htmlFor?: string; error?: string; children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-[11px] font-semibold uppercase tracking-wider text-secondary">{label}</label>
      {children}
      {error && <p className="text-[11px] text-error">{error}</p>}
    </div>
  )
}
