import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { ProjectPreset, ProjectSnapshot } from '../types'

interface PresetPickerProps {
  presets: ProjectPreset[]
  recents: ProjectPreset[]
  currentSnapshot: ProjectSnapshot
  onLoad: (snapshot: ProjectSnapshot) => void
  onSave: (name: string, snapshot: ProjectSnapshot) => void
  onDeletePreset: (id: string) => void
  onDeleteRecent: (id: string) => void
}

function relativeTime(ts: number): string {
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

export function PresetPicker({
  presets,
  recents,
  currentSnapshot,
  onLoad,
  onSave,
  onDeletePreset,
  onDeleteRecent,
}: PresetPickerProps) {
  const [tab, setTab] = useState<'presets' | 'recents'>('presets')
  const [savePromptOpen, setSavePromptOpen] = useState(false)
  const [draftName, setDraftName] = useState('')

  const list = tab === 'presets' ? presets : recents
  const onDelete = tab === 'presets' ? onDeletePreset : onDeleteRecent

  function commitSave() {
    const name = draftName.trim()
    if (!name) return
    onSave(name, currentSnapshot)
    setDraftName('')
    setSavePromptOpen(false)
    setTab('presets')
  }

  const hasAnything = presets.length > 0 || recents.length > 0 || savePromptOpen
  if (!hasAnything) {
    return (
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-secondary">My Presets</h2>
          <button
            onClick={() => setSavePromptOpen(true)}
            className="flex items-center gap-1 text-[11px] font-medium text-secondary hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>bookmark_add</span>
            Save current as preset…
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3 gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setTab('presets')}
            className={`text-xs font-bold uppercase tracking-widest transition-colors ${tab === 'presets' ? 'text-on-surface' : 'text-secondary hover:text-on-surface'}`}
          >
            My Presets
            {presets.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[9px] font-bold">
                {presets.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('recents')}
            className={`text-xs font-bold uppercase tracking-widest transition-colors ${tab === 'recents' ? 'text-on-surface' : 'text-secondary hover:text-on-surface'}`}
          >
            Recent
            {recents.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-tertiary/15 text-tertiary text-[9px] font-bold">
                {recents.length}
              </span>
            )}
          </button>
        </div>
        <button
          onClick={() => setSavePromptOpen(v => !v)}
          className="flex items-center gap-1 text-[11px] font-medium text-secondary hover:text-on-surface transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>bookmark_add</span>
          Save current as preset…
        </button>
      </div>

      <AnimatePresence>
        {savePromptOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-3"
          >
            <div className="flex items-center gap-2 p-3 rounded-lg border border-outline-variant bg-surface-container">
              <input
                autoFocus
                type="text"
                value={draftName}
                onChange={e => setDraftName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitSave()
                  if (e.key === 'Escape') { setSavePromptOpen(false); setDraftName('') }
                }}
                placeholder="Preset name (e.g. My microservice baseline)"
                className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-md px-3 py-1.5 text-sm text-on-surface focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none"
              />
              <button
                onClick={commitSave}
                disabled={!draftName.trim()}
                className="px-3 py-1.5 rounded-md text-xs font-bold bg-primary text-white disabled:opacity-40 active:scale-95 transition-transform"
              >
                Save
              </button>
              <button
                onClick={() => { setSavePromptOpen(false); setDraftName('') }}
                className="px-3 py-1.5 rounded-md text-xs font-medium text-secondary hover:text-on-surface transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {list.length === 0 ? (
        <div className="text-xs text-secondary py-4 px-4 rounded-lg border border-dashed border-outline-variant/50 bg-surface-container-low/30">
          {tab === 'presets'
            ? 'No presets yet. Configure a project and click "Save current as preset…" above.'
            : 'No recent projects yet. Generate or explore a project to see it here.'}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {list.map(item => {
            const depCount = item.snapshot.selected.length
            const moduleCount = item.snapshot.multiModuleEnabled ? item.snapshot.selectedModules.length : 0
            return (
              <div
                key={item.id}
                className="relative flex-shrink-0 w-52 rounded-lg border-2 border-outline-variant bg-surface-container hover:border-outline group transition-all"
              >
                <button
                  onClick={() => onLoad(item.snapshot)}
                  className="w-full p-4 text-left"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-secondary" style={{ fontSize: '20px' }}>
                      {tab === 'presets' ? 'bookmark' : 'history'}
                    </span>
                    <span className="font-semibold text-sm text-on-surface truncate">{item.name}</span>
                  </div>
                  <p className="text-[11px] text-secondary leading-relaxed">
                    {item.snapshot.form.groupId}:{item.snapshot.form.artifactId}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-secondary bg-surface-container-high px-1.5 py-0.5 rounded">
                      <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>widgets</span>
                      {depCount} deps
                    </span>
                    {moduleCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-secondary bg-surface-container-high px-1.5 py-0.5 rounded">
                        <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>account_tree</span>
                        {moduleCount}
                      </span>
                    )}
                    <span className="text-[10px] text-secondary ml-auto">{relativeTime(item.createdAt)}</span>
                  </div>
                </button>
                <button
                  onClick={() => onDelete(item.id)}
                  aria-label={`Delete ${item.name}`}
                  className="absolute top-1.5 right-1.5 p-1 rounded text-secondary opacity-0 group-hover:opacity-100 hover:bg-error/10 hover:text-error transition-all"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
