import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { FullstackPreset } from '../../hooks/useFullstackPresets'
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

/**
 * "Start from" strip for the fullstack tab: built-in example models (Blog, Orders, …), the user's
 * saved presets and recently generated models. Loading anything replaces the whole editor state
 * (the caller pushes an undo entry first).
 */
export function FullstackPresets({
  presets, recents, currentSnapshot, onLoad, onLoadExample, onSave, onDeletePreset, onDeleteRecent,
}: Props) {
  const [tab, setTab] = useState<'examples' | 'presets' | 'recents'>('examples')
  const [savePromptOpen, setSavePromptOpen] = useState(false)
  const [draftName, setDraftName] = useState('')

  function commitSave() {
    const name = draftName.trim()
    if (!name) return
    onSave(name, currentSnapshot)
    setDraftName('')
    setSavePromptOpen(false)
    setTab('presets')
  }

  const tabButton = (key: typeof tab, label: string, count: number, tone: 'primary' | 'tertiary') => (
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
          {tabButton('recents', 'Recent', recents.length, 'tertiary')}
        </div>
        <button
          type="button"
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
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 p-3 rounded-lg border border-outline-variant bg-surface-container">
              <input
                autoFocus
                type="text"
                aria-label="Preset name"
                value={draftName}
                onChange={e => setDraftName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitSave()
                  if (e.key === 'Escape') { setSavePromptOpen(false); setDraftName('') }
                }}
                placeholder="Preset name (e.g. Billing domain v2)"
                className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-md px-3 py-1.5 text-sm text-on-surface focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none"
              />
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
                onClick={() => { setSavePromptOpen(false); setDraftName('') }}
                className="px-3 py-1.5 rounded-md text-xs font-medium text-secondary hover:text-on-surface transition-colors"
              >
                Cancel
              </button>
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

      {tab !== 'examples' && (() => {
        const list = tab === 'presets' ? presets : recents
        const onDelete = tab === 'presets' ? onDeletePreset : onDeleteRecent
        if (list.length === 0) {
          return (
            <div className="text-xs text-secondary py-4 px-4 rounded-lg border border-dashed border-outline-variant/50 bg-surface-container-low/30">
              {tab === 'presets'
                ? 'No presets yet. Model your entities and click "Save current as preset…" above.'
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
