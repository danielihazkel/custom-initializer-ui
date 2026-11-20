import { useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import type {
  EntityTemplateSetSummary, ExampleSettings, FullstackEntityDef, FullstackNav, FullstackPageDef, TeamModelSummary, Toast,
} from '../../types'
import type { FeColorPalette } from '../../hooks/useFrontendMetadata'
import type { useFullstackPresets } from '../../hooks/useFullstackPresets'
import { TeamModelError, type useTeamModels } from '../../hooks/useTeamModels'
import { cloneExample, cloneExamplePages, type ExampleModel } from './examples'
import type { PendingLoad } from './fullstackStorage'
import type { ImportMode } from './ImportFromDdlDrawer'
import { clearShareFromLocation } from './shareLink'
import { parseExportedModel, type FullstackSnapshot, type ProjectMeta } from './snapshot'
import { withUids } from './uid'
import type { UpdateBaseline } from './updateBaseline'
import { t, tn } from '../../i18n'

/** The setters of the model state `FullstackView` holds — a load writes through them. */
export interface ModelSetters {
  entities: Dispatch<SetStateAction<FullstackEntityDef[]>>
  pages: Dispatch<SetStateAction<FullstackPageDef[]>>
  nav: Dispatch<SetStateAction<FullstackNav | undefined>>
  dismissedWarnings: Dispatch<SetStateAction<string[]>>
  meta: Dispatch<SetStateAction<ProjectMeta>>
  scaffoldOpts: Dispatch<SetStateAction<string[]>>
  backendSet: Dispatch<SetStateAction<string>>
  frontendSet: Dispatch<SetStateAction<string>>
  colorPalette: Dispatch<SetStateAction<string>>
  collapsed: Dispatch<SetStateAction<Set<string>>>
}

export interface ModelLoadersOptions {
  /** The model as it stands — what a team save stores. */
  currentSnapshot: FullstackSnapshot
  entityCount: number
  /** Whether a load would discard edits kept nowhere: it then asks first. */
  hasUnsavedWork: boolean
  /** A share link held back at start because the stored draft had unsaved work. */
  pendingShared: FullstackSnapshot | null
  /** Replaces the whole editor state (a load starts from a clean view). */
  applySnapshot: (snapshot: FullstackSnapshot) => void
  pushUndoEntry: (label: string) => void
  /** The "nothing unsaved" point: a load clears it, a team save moves it. */
  baselineRef: MutableRefObject<FullstackSnapshot | null>
  set: ModelSetters
  /** What this installation has — an example's set or palette that is not among them is skipped. */
  backendSets: EntityTemplateSetSummary[]
  frontendSets: EntityTemplateSetSummary[]
  palettes: FeColorPalette[]
  revealRow: (uid: string) => void
  setToast: (toast: Toast) => void
  /** The model a project was generated from — an imported project's own model file sets it. */
  setBaseline: (baseline: UpdateBaseline) => void
  presets: Pick<ReturnType<typeof useFullstackPresets>, 'savePreset' | 'deletePreset' | 'restorePreset' | 'deleteRecent' | 'restoreRecent'>
  team: ReturnType<typeof useTeamModels>
}

/**
 * Everything that brings a model into the Fullstack editor or keeps one somewhere: imported
 * entities, examples, presets and recents, team models, a JSON file, a share link held back at
 * start — with the questions they ask first (replace unsaved work? overwrite the team's model?
 * replace or append?). The model's state stays in `FullstackView`; this writes through its setters.
 */
export function useModelLoaders(options: ModelLoadersOptions) {
  const {
    currentSnapshot, entityCount, hasUnsavedWork, pendingShared, applySnapshot, pushUndoEntry, baselineRef, set,
    backendSets, frontendSets, palettes, revealRow, setToast, setBaseline, presets, team,
  } = options
  const [pendingLoad, setPendingLoad] = useState<PendingLoad | null>(() => (pendingShared ? { kind: 'shared', snapshot: pendingShared } : null))
  // A JSON file parsed by Import JSON, held while the user picks Replace / Append.
  const [pendingJsonImport, setPendingJsonImport] = useState<FullstackSnapshot | null>(null)
  // A team save that hit an existing name, held while the user decides whether to overwrite it.
  const [teamConflict, setTeamConflict] = useState<{ name: string; description: string; existing: TeamModelSummary } | null>(null)
  const [confirmDeleteTeam, setConfirmDeleteTeam] = useState<TeamModelSummary | null>(null)

  function handleImport(imported: FullstackEntityDef[], mode: ImportMode, note?: string) {
    pushUndoEntry(mode === 'replace' ? t('Replaced entities from import') : t('Appended imported entities'))
    const stamped = withUids(imported)
    set.entities(prev => (mode === 'replace' ? stamped : [...prev, ...stamped]))
    if (stamped[0]?.uid) revealRow(stamped[0].uid)
    const n = imported.length
    const base = mode === 'replace'
      ? tn(n, 'Replaced with {n} entity', 'Replaced with {n} entities')
      : tn(n, 'Appended {n} entity', 'Appended {n} entities')
    setToast({ message: note ? `${base}. ${note}` : base, type: 'success' })
  }

  function loadExample(example: ExampleModel) {
    pushUndoEntry(t('Loaded the {example} example', { example: example.name }))
    set.entities(withUids(cloneExample(example)))
    // An example replaces the model, layout included: one without pages means the classic shell.
    set.pages(cloneExamplePages(example))
    applyExampleSettings(example.settings)
    set.collapsed(new Set())
    baselineRef.current = null
    setToast({
      message: example.pages?.length
        ? t('Loaded the {example} example ({entities} entities and {pages} pages)', { example: example.name, entities: example.entities.length, pages: example.pages.length })
        : t('Loaded the {example} example ({entities} entities)', { example: example.name, entities: example.entities.length }),
      type: 'success',
    })
  }

  /** The editor settings an example carries. Only the keys present change; a template set or
   *  palette this installation doesn't have is skipped rather than selected blind. */
  function applyExampleSettings(settings: ExampleSettings | null | undefined) {
    // An example replaces the navigation too: one without says the default sidebar.
    set.nav(settings?.nav ? { ...settings.nav } : undefined)
    set.dismissedWarnings([])
    if (!settings) return
    const metaPatch: Partial<ProjectMeta> = {}
    if (settings.locale) metaPatch.locale = settings.locale
    if (settings.dashboardTitle !== undefined) metaPatch.dashboardTitle = settings.dashboardTitle
    if (settings.dashboardOverview !== undefined) metaPatch.dashboardOverview = settings.dashboardOverview
    if (Object.keys(metaPatch).length > 0) set.meta(m => ({ ...m, ...metaPatch }))
    if (settings.scaffold) set.scaffoldOpts([...settings.scaffold])
    if (settings.backendTemplateSet && backendSets.some(x => x.setKey === settings.backendTemplateSet)) {
      set.backendSet(settings.backendTemplateSet)
    }
    if (settings.frontendTemplateSet && frontendSets.some(x => x.setKey === settings.frontendTemplateSet)) {
      set.frontendSet(settings.frontendTemplateSet)
    }
    if (settings.colorPalette && palettes.some(x => x.id === settings.colorPalette)) {
      set.colorPalette(settings.colorPalette)
    }
  }

  function loadPreset(snapshot: FullstackSnapshot, label = t('Loaded a preset')) {
    pushUndoEntry(label)
    applySnapshot(snapshot)
    setToast({ message: t('Loaded {name}', { name: snapshot.meta.artifactId || t('preset') }), type: 'success' })
  }

  function runLoad(load: PendingLoad) {
    if (load.kind === 'example') loadExample(load.example)
    else if (load.kind === 'shared') loadPreset(load.snapshot, t('Opened the shared model'))
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
      setToast({ message: t('Saved "{name}" for the team', { name }), type: 'success' })
    } catch (err) {
      const existing = err instanceof TeamModelError && err.status === 409
        ? team.models.find(m => m.name.toLowerCase() === name.toLowerCase())
        : undefined
      if (existing) {
        setTeamConflict({ name, description, existing })
        return
      }
      setToast({ message: t("Couldn't save to the team: {error}", { error: (err as Error).message }), type: 'error' })
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
      setToast({ message: t('Updated "{name}" for the team', { name: conflict.name }), type: 'success' })
    } catch (err) {
      setToast({ message: t("Couldn't update the team model: {error}", { error: (err as Error).message }), type: 'error' })
    }
  }
  function loadTeamModel(model: TeamModelSummary) {
    team.load(model.id)
      .then(snapshot => requestLoad({ kind: 'preset', snapshot }))
      .catch((err: Error) => setToast({ message: t('Couldn\'t load "{name}": {error}', { name: model.name, error: err.message }), type: 'error' }))
  }
  async function deleteTeamModel() {
    const model = confirmDeleteTeam
    if (!model) return
    setConfirmDeleteTeam(null)
    try {
      await team.remove(model.id)
      setToast({ message: t('Deleted "{name}" for everyone', { name: model.name }), type: 'success' })
    } catch (err) {
      setToast({ message: t('Couldn\'t delete "{name}": {error}', { name: model.name, error: (err as Error).message }), type: 'error' })
    }
  }

  // ── A model file ──────────────────────────────────────────────────────────
  function importJson(file: File) {
    file.text().then(text => {
      const result = parseExportedModel(text)
      if ('error' in result) {
        setToast({ message: t("Couldn't import {file}: {error}", { file: file.name, error: result.error }), type: 'error' })
        return
      }
      // A generated project's own model file: what its code was made from, so later changes to
      // the model can be offered as an update to that code.
      if (result.fromProject) {
        setBaseline({
          snapshot: result.snapshot, templatesHash: result.templatesHash, snapshotId: result.snapshotId,
          schemaVersion: result.schemaVersion, source: 'imported', at: Date.now(),
        })
      }
      // With a model already in the editor, offer Append (its entities join yours) as well as
      // the whole-model Replace — the same choice the DDL import gives.
      if (entityCount > 0 && result.snapshot.entities.length > 0) setPendingJsonImport(result.snapshot)
      else requestLoad({ kind: 'preset', snapshot: result.snapshot })
    }).catch(() => setToast({ message: t("Couldn't read {file}", { file: file.name }), type: 'error' }))
  }
  function appendJsonImport() {
    const snapshot = pendingJsonImport
    if (!snapshot) return
    setPendingJsonImport(null)
    handleImport(JSON.parse(JSON.stringify(snapshot.entities)) as FullstackEntityDef[], 'append')
  }

  // ── Browser presets and recents ───────────────────────────────────────────
  // Deleting a browser preset is one click, so it is undoable from the toast instead of confirmed.
  function deletePresetWithUndo(id: string) {
    const removed = presets.deletePreset(id)
    if (!removed) return
    setToast({
      message: t('Deleted preset "{name}"', { name: removed.preset.name }),
      type: 'success',
      action: { label: t('Undo'), onClick: () => presets.restorePreset(removed.preset, removed.index) },
    })
  }

  function deleteRecentWithUndo(id: string) {
    const removed = presets.deleteRecent(id)
    if (!removed) return
    setToast({
      message: t('Removed "{name}" from recents', { name: removed.preset.name }),
      type: 'success',
      action: { label: t('Undo'), onClick: () => presets.restoreRecent(removed.preset, removed.index) },
    })
  }

  function savePresetAndReport(name: string, snapshot: FullstackSnapshot) {
    const { persisted } = presets.savePreset(name, snapshot)
    setToast(persisted
      ? { message: t('Saved preset "{name}"', { name }), type: 'success' }
      : { message: t('Saved preset "{name}" for this session only — browser storage is full, so it won\'t survive a refresh. Export JSON to keep it.', { name }), type: 'error' })
  }

  return {
    pendingLoad, setPendingLoad, pendingJsonImport, setPendingJsonImport,
    teamConflict, setTeamConflict, confirmDeleteTeam, setConfirmDeleteTeam,
    handleImport, loadPreset, runLoad, dismissPendingLoad, requestLoad,
    saveToTeam, overwriteTeamModel, loadTeamModel, deleteTeamModel,
    importJson, appendJsonImport, deletePresetWithUndo, deleteRecentWithUndo, savePresetAndReport,
  }
}
