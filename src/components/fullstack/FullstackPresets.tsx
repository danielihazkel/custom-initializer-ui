import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { FullstackPreset } from '../../hooks/useFullstackPresets'
import type { TeamModelSummary } from '../../types'
import type { FullstackSnapshot } from './snapshot'
import { EXAMPLE_MODELS, type ExampleModel } from './examples'

interface Props {
  presets: FullstackPreset[]
  recents: FullstackPreset[]
  currentSnapshot: FullstackSnapshot
  onLoad: (snapshot: FullstackSnapshot) => void
  onLoadExample: (example: ExampleModel) => void
  onSave: (name: string, snapshot: FullstackSnapshot) => void
  onDeletePreset: (id: string) => void
  onDeleteRecent: (id: string) => void
  /** Portable model: download the whole editor state as a JSON file / load one back. Presets live
   *  in one browser's localStorage, so this is how a model travels to a colleague or into git. */
  onExportJson: () => void
  onImportJson: (file: File) => void
  /** Copies a ready-to-run curl for POST /starter-fullstack.zip with the current body. */
  onCopyCurl: () => void
  /** Models saved on the server for everyone (the "Team" tab). The list is summaries only; the
   *  parent fetches the snapshot on load and owns the confirm dialogs for delete/overwrite. */
  teamModels: TeamModelSummary[]
  teamLoading: boolean
  teamError: string | null
  onRefreshTeam: () => void
  onLoadTeam: (model: TeamModelSummary) => void
  onSaveTeam: (name: string, description: string, snapshot: FullstackSnapshot) => void
  onDeleteTeam: (model: TeamModelSummary) => void
  /** Opens the save prompt from outside (Ctrl+S, the Next steps card) on the given target; a new
   *  `key` re-opens it even when the target is unchanged. */
  saveRequest?: { target: SaveTarget; key: number; draft?: { name: string; description: string } } | null
}

export function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(ts).toLocaleDateString()
}

type Tab = 'examples' | 'presets' | 'recents' | 'team'
export type SaveTarget = 'browser' | 'team'

/**
 * "Start from" strip for the fullstack tab: built-in example models (Blog, Orders, …), the user's
 * saved presets, recently generated models, and the models shared on the server for the whole
 * team. Loading anything replaces the whole editor state (the caller pushes an undo entry first).
 */
export function FullstackPresets({
  presets, recents, currentSnapshot, onLoad, onLoadExample, onSave, onDeletePreset, onDeleteRecent,
  onExportJson, onImportJson, onCopyCurl,
  teamModels, teamLoading, teamError, onRefreshTeam, onLoadTeam, onSaveTeam, onDeleteTeam, saveRequest,
}: Props) {
  const [tab, setTab] = useState<Tab>('examples')
  const [savePromptOpen, setSavePromptOpen] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftDescription, setDraftDescription] = useState('')
  const [saveTarget, setSaveTarget] = useState<SaveTarget>('browser')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!saveRequest) return
    setSaveTarget(saveRequest.target)
    if (saveRequest.draft) {
      setDraftName(saveRequest.draft.name)
      setDraftDescription(saveRequest.draft.description)
    }
    setSavePromptOpen(true)
  }, [saveRequest])

  // Closing keeps what was typed (a name conflict's "Rename…" and a stray Escape both reopen with
  // it); only a completed save clears the draft.
  function closeSavePrompt() {
    setSavePromptOpen(false)
  }
  function clearDraft() {
    setDraftName('')
    setDraftDescription('')
  }

  function commitSave() {
    const name = draftName.trim()
    if (!name) return
    if (saveTarget === 'team') {
      onSaveTeam(name, draftDescription, currentSnapshot)
      setTab('team')
    } else {
      onSave(name, currentSnapshot)
      setTab('presets')
    }
    closeSavePrompt()
    clearDraft()
  }

  const tabButton = (key: Tab, label: string, count: number, tone: 'primary' | 'tertiary') => (
    <button
      type="button"
      onClick={() => setTab(key)}
      className={`text-xs font-bold uppercase tracking-widest transition-colors ${tab === key ? 'text-on-surface' : 'text-secondary hover:text-on-surface'}`}
      aria-pressed={tab === key}
    >
      {label}
      {count > 0 && (
        <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${tone === 'primary' ? 'bg-primary/15 text-primary' : 'bg-tertiary/15 text-tertiary'}`}>
          {count}
        </span>
      )}
    </button>
  )

  return (
    <section className="space-y-3" aria-label="Start from">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          {tabButton('examples', 'Examples', EXAMPLE_MODELS.length, 'primary')}
          {tabButton('presets', 'My Presets', presets.length, 'primary')}
          {tabButton('team', 'Team', teamModels.length, 'primary')}
          {tabButton('recents', 'Recent', recents.length, 'tertiary')}
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <button
            type="button"
            onClick={() => setSavePromptOpen(v => !v)}
            className="flex items-center gap-1 text-[11px] font-medium text-secondary hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>bookmark_add</span>
            Save this model…
          </button>
          <span className="h-3 w-px bg-outline-variant" aria-hidden="true" />
          <button
            type="button"
            onClick={onExportJson}
            className="flex items-center gap-1 text-[11px] font-medium text-secondary hover:text-on-surface transition-colors"
            title="Download the whole model (entities, settings, dependencies) as a JSON file you can commit or send"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>download</span>
            Export JSON
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 text-[11px] font-medium text-secondary hover:text-on-surface transition-colors"
            title="Load a model exported from this tab"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>upload</span>
            Import JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            aria-label="Import model JSON"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) onImportJson(file)
              e.target.value = '' // allow re-importing the same file
            }}
          />
          <button
            type="button"
            onClick={onCopyCurl}
            className="flex items-center gap-1 text-[11px] font-medium text-secondary hover:text-on-surface transition-colors"
            title="Copy a curl command that generates this exact project — handy for CI scripts"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>terminal</span>
            Copy as curl
          </button>
        </div>
      </div>

      <AnimatePresence>
        {savePromptOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-3 rounded-lg border border-outline-variant bg-surface-container space-y-2">
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  type="text"
                  aria-label="Preset name"
                  value={draftName}
                  onChange={e => setDraftName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitSave()
                    if (e.key === 'Escape') closeSavePrompt()
                  }}
                  placeholder="Preset name (e.g. Billing domain v2)"
                  className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-md px-3 py-1.5 text-sm text-on-surface focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none"
                />
                <div className="inline-flex rounded-md border border-outline-variant overflow-hidden text-xs" role="group" aria-label="Save to">
                  {([['browser', 'This browser', 'bookmark'], ['team', 'Team', 'groups']] as const).map(([key, label, icon]) => (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={saveTarget === key}
                      onClick={() => setSaveTarget(key)}
                      title={key === 'team' ? 'Saved on the server — everyone who opens the generator sees it' : 'Saved in this browser only'}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 transition-colors ${saveTarget === key ? 'bg-primary/15 text-primary font-semibold' : 'text-secondary hover:text-on-surface'}`}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{icon}</span>
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={commitSave}
                  disabled={!draftName.trim()}
                  className="px-3 py-1.5 rounded-md text-xs font-bold bg-primary text-on-primary disabled:opacity-40 active:scale-95 transition-transform"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={closeSavePrompt}
                  className="px-3 py-1.5 rounded-md text-xs font-medium text-secondary hover:text-on-surface transition-colors"
                >
                  Cancel
                </button>
              </div>
              {saveTarget === 'team' && (
                <input
                  type="text"
                  aria-label="Team model description"
                  value={draftDescription}
                  onChange={e => setDraftDescription(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitSave()
                    if (e.key === 'Escape') closeSavePrompt()
                  }}
                  placeholder="Description for your colleagues (optional)"
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-md px-3 py-1.5 text-sm text-on-surface focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none"
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {tab === 'examples' && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {EXAMPLE_MODELS.map(ex => (
            <button
              key={ex.id}
              type="button"
              onClick={() => onLoadExample(ex)}
              className="flex-shrink-0 w-56 rounded-lg border-2 border-outline-variant bg-surface-container hover:border-primary/60 hover:bg-primary/[0.03] p-4 text-left transition-all group"
              title={`Replace the current entities with the ${ex.name} example`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: '20px' }}>{ex.icon}</span>
                <span className="font-semibold text-sm text-on-surface">{ex.name}</span>
              </div>
              <p className="text-[11px] text-secondary leading-relaxed line-clamp-3">{ex.description}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {ex.entities.map(e => (
                  <span key={e.name} className="text-[10px] font-mono text-secondary bg-surface-container-high px-1.5 py-0.5 rounded">{e.name}</span>
                ))}
              </div>
            </button>
          ))}
        </div>
      )}

      {tab === 'team' && (
        <div data-team-models>
          {teamError && (
            <div className="flex items-center justify-between gap-3 text-[11px] text-error border border-error/30 bg-error/10 rounded px-3 py-2 mb-2">
              <span>Couldn't load the team models ({teamError}).</span>
              <button type="button" onClick={onRefreshTeam} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-error/40 text-error hover:bg-error/10 transition-colors">
                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>refresh</span>
                Retry
              </button>
            </div>
          )}
          {teamLoading && teamModels.length === 0 ? (
            <div className="h-[104px] rounded-lg bg-surface-container-low animate-pulse" aria-hidden="true" />
          ) : teamModels.length === 0 ? (
            !teamError && (
              <div className="text-xs text-secondary py-4 px-4 rounded-lg border border-dashed border-outline-variant/50 bg-surface-container-low/30">
                Nothing shared yet. Save the current model with "Save this model…" → Team and everyone who opens the generator will see it here.
              </div>
            )
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {teamModels.map(model => (
                <div
                  key={model.id}
                  className="relative flex-shrink-0 w-56 rounded-lg border-2 border-outline-variant bg-surface-container hover:border-outline group transition-all"
                >
                  <button type="button" onClick={() => onLoadTeam(model)} className="w-full p-4 text-left" title={model.description ?? undefined}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-secondary" style={{ fontSize: '20px' }}>groups</span>
                      <span className="font-semibold text-sm text-on-surface truncate">{model.name}</span>
                    </div>
                    <p className="text-[11px] text-secondary truncate">
                      {model.description || (model.createdBy ? `by ${model.createdBy}` : 'No description')}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-secondary bg-surface-container-high px-1.5 py-0.5 rounded">
                        <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>table</span>
                        {model.entityCount} entit{model.entityCount === 1 ? 'y' : 'ies'}
                      </span>
                      {model.description && model.createdBy && (
                        <span className="text-[10px] text-secondary truncate max-w-[6rem]" title={`Saved by ${model.createdBy}`}>{model.createdBy}</span>
                      )}
                      <span className="text-[10px] text-secondary ml-auto" title={new Date(model.updatedAt).toLocaleString()}>
                        {relativeTime(Date.parse(model.updatedAt))}
                      </span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteTeam(model)}
                    aria-label={`Delete ${model.name} for everyone`}
                    title="Delete for everyone"
                    className="absolute top-1.5 right-1.5 p-1 rounded text-secondary opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-error/10 hover:text-error transition-all"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {(tab === 'presets' || tab === 'recents') && (() => {
        const list = tab === 'presets' ? presets : recents
        const onDelete = tab === 'presets' ? onDeletePreset : onDeleteRecent
        if (list.length === 0) {
          return (
            <div className="text-xs text-secondary py-4 px-4 rounded-lg border border-dashed border-outline-variant/50 bg-surface-container-low/30">
              {tab === 'presets'
                ? 'No presets yet. Model your entities and click "Save this model…" above.'
                : 'No recent models yet. Explore or generate a project to see it here.'}
            </div>
          )
        }
        return (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {list.map(item => (
              <div
                key={item.id}
                className="relative flex-shrink-0 w-52 rounded-lg border-2 border-outline-variant bg-surface-container hover:border-outline group transition-all"
              >
                <button type="button" onClick={() => onLoad(item.snapshot)} className="w-full p-4 text-left">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-secondary" style={{ fontSize: '20px' }}>
                      {tab === 'presets' ? 'bookmark' : 'history'}
                    </span>
                    <span className="font-semibold text-sm text-on-surface truncate">{item.name}</span>
                  </div>
                  <p className="text-[11px] text-secondary font-mono truncate">
                    {item.snapshot.meta.groupId}:{item.snapshot.meta.artifactId}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-secondary bg-surface-container-high px-1.5 py-0.5 rounded">
                      <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>table</span>
                      {item.snapshot.entities.length} entit{item.snapshot.entities.length === 1 ? 'y' : 'ies'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-secondary bg-surface-container-high px-1.5 py-0.5 rounded">
                      <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>widgets</span>
                      {item.snapshot.selectedDeps.length} deps
                    </span>
                    <span className="text-[10px] text-secondary ml-auto">{relativeTime(item.createdAt)}</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(item.id)}
                  aria-label={`Delete ${item.name}`}
                  className="absolute top-1.5 right-1.5 p-1 rounded text-secondary opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-error/10 hover:text-error transition-all"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
                </button>
              </div>
            ))}
          </div>
        )
      })()}
    </section>
  )
}
