import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { ProjectPreset, ProjectSnapshot } from '../types'
import { useHotkeys } from '../hooks/useHotkeys'
import { registerCommands, type PaletteAction } from '../commands'
import { PresetChip, relativeTime } from './presetCards'
import { t, tn, useLang } from '../i18n'

// The Team tab — the server's presets, their cards and palette entries — is a lazy chunk: this
// strip is on the Backend tab's first paint.
const TeamPresetsPanel = lazy(() => import('./TeamPresetsPanel'))

interface PresetPickerProps {
  presets: ProjectPreset[]
  recents: ProjectPreset[]
  currentSnapshot: ProjectSnapshot
  onLoad: (snapshot: ProjectSnapshot) => void
  onSave: (name: string, snapshot: ProjectSnapshot) => void
  onDeletePreset: (id: string) => void
  onDeleteRecent: (id: string) => void
}

type Tab = 'presets' | 'team' | 'recents'

export function PresetPicker({
  presets,
  recents,
  currentSnapshot,
  onLoad,
  onSave,
  onDeletePreset,
  onDeleteRecent,
}: PresetPickerProps) {
  const lang = useLang()
  const [tab, setTab] = useState<Tab>('presets')
  const [savePromptOpen, setSavePromptOpen] = useState(false)
  const [draftName, setDraftName] = useState('')
  // Where a new preset goes: this browser, or the server for everyone.
  const [forTeam, setForTeam] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [teamCount, setTeamCount] = useState(0)
  const [teamReload, setTeamReload] = useState(0)
  const onTeamCount = useCallback((n: number) => setTeamCount(n), [])

  function closePrompt() {
    setSavePromptOpen(false)
    setDraftName('')
    setSaveError(null)
  }

  async function commitSave() {
    const name = draftName.trim()
    if (!name || saving) return
    if (!forTeam) {
      onSave(name, currentSnapshot)
      closePrompt()
      setTab('presets')
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const { saveTeamPreset } = await import('../hooks/useTeamPresets')
      await saveTeamPreset(name, currentSnapshot)
      closePrompt()
      setTeamReload(n => n + 1)
      setTab('team')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  // Ctrl+S opens the save prompt (and beats the browser's "save page" dialog); ⌘K offers the
  // same, plus every preset and recent project by name (the Team panel adds the team's).
  useHotkeys([{ key: 's', ctrl: true, run: () => setSavePromptOpen(true) }])
  // Through a ref: registering re-renders the palette's subscribers (App among them), so the
  // effect must not depend on a callback whose identity could change with that render.
  const onLoadRef = useRef(onLoad)
  onLoadRef.current = onLoad
  useEffect(() => {
    const onLoad = (snapshot: ProjectSnapshot) => onLoadRef.current(snapshot)
    const list: PaletteAction[] = [{
      id: 'backend-save-preset', title: t('Save the current setup as a preset…'), icon: 'bookmark_add',
      group: t('Backend'), shortcut: 'Ctrl+S', run: () => setSavePromptOpen(true),
    }]
    for (const p of presets) {
      list.push({ id: `backend-preset-${p.id}`, title: t('Load preset: {name}', { name: p.name }), icon: 'bookmark', group: t('Presets'), run: () => onLoad(p.snapshot) })
    }
    for (const r of recents) {
      list.push({
        id: `backend-recent-${r.id}`, title: t('Load recent: {name}', { name: r.name }), description: relativeTime(r.createdAt),
        icon: 'history', group: t('Recent projects'), run: () => onLoad(r.snapshot),
      })
    }
    return registerCommands(list, 'backend-presets')
  }, [presets, recents, lang])

  // Keyed, so it stays mounted when the strip switches between its empty and full layouts (a
  // remount would report no presets while it refetched, and switch the layout back).
  const teamPanel = (
    <Suspense key="team-panel" fallback={null}>
      <TeamPresetsPanel visible={tab === 'team'} reloadKey={teamReload} onLoad={onLoad} onCount={onTeamCount} />
    </Suspense>
  )

  const hasAnything = presets.length > 0 || recents.length > 0 || teamCount > 0 || savePromptOpen
  if (!hasAnything) {
    return (
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-secondary">{t('My Presets')}</h2>
          <button
            onClick={() => setSavePromptOpen(true)}
            className="flex items-center gap-1 text-[11px] font-medium text-secondary hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>bookmark_add</span>
            {t('Save current as preset…')}
          </button>
        </div>
        {/* Mounted for the count: when the team has presets, the strip opens up. */}
        {teamPanel}
      </div>
    )
  }

  const tabs: { id: Tab; label: string; count: number; badge: string }[] = [
    { id: 'presets', label: t('My Presets'), count: presets.length, badge: 'bg-primary/15 text-primary' },
    { id: 'team', label: t('Team'), count: teamCount, badge: 'bg-secondary/15 text-secondary' },
    { id: 'recents', label: t('Recent'), count: recents.length, badge: 'bg-tertiary/15 text-tertiary' },
  ]
  const local = tab === 'presets' ? presets : recents
  const onDelete = tab === 'presets' ? onDeletePreset : onDeleteRecent

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3 gap-4">
        <div className="flex items-center gap-4" role="tablist" aria-label={t('Presets')}>
          {tabs.map(item => (
            <button
              key={item.id}
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={`text-xs font-bold uppercase tracking-widest transition-colors ${tab === item.id ? 'text-on-surface' : 'text-secondary hover:text-on-surface'}`}
            >
              {item.label}
              {item.count > 0 && (
                <span className={`ms-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${item.badge}`}>{item.count}</span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={() => setSavePromptOpen(v => !v)}
          className="flex items-center gap-1 text-[11px] font-medium text-secondary hover:text-on-surface transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>bookmark_add</span>
          {t('Save current as preset…')}
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
            <div className="p-3 rounded-lg border border-outline-variant bg-surface-container">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  autoFocus
                  type="text"
                  value={draftName}
                  onChange={e => { setDraftName(e.target.value); setSaveError(null) }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') void commitSave()
                    if (e.key === 'Escape') closePrompt()
                  }}
                  placeholder={t('Preset name (e.g. My microservice baseline)')}
                  aria-label={t('Preset name')}
                  className="flex-1 min-w-[12rem] bg-surface-container-lowest border border-outline-variant rounded-md px-3 py-1.5 text-sm text-on-surface focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none"
                />
                <label className="flex items-center gap-1.5 text-[11px] font-medium text-secondary cursor-pointer select-none">
                  <input type="checkbox" checked={forTeam} onChange={e => { setForTeam(e.target.checked); setSaveError(null) }} />
                  {t('For the team')}
                </label>
                <button
                  onClick={() => { void commitSave() }}
                  disabled={!draftName.trim() || saving}
                  className="px-3 py-1.5 rounded-md text-xs font-bold bg-primary text-white disabled:opacity-40 active:scale-95 transition-transform"
                >
                  {saving ? t('Saving…') : t('Save')}
                </button>
                <button
                  onClick={closePrompt}
                  className="px-3 py-1.5 rounded-md text-xs font-medium text-secondary hover:text-on-surface transition-colors"
                >
                  {t('Cancel')}
                </button>
              </div>
              {saveError ? <p className="mt-2 text-[11px] text-error" role="alert">{saveError}</p>
                : forTeam && <p className="mt-2 text-[11px] text-secondary">{t('Everyone who opens the generator will see it — the wizard documents and modules too.')}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {teamPanel}
      {tab !== 'team' && (local.length === 0 ? (
        <div className="text-xs text-secondary py-4 px-4 rounded-lg border border-dashed border-outline-variant/50 bg-surface-container-low/30">
          {tab === 'presets'
            ? t('No presets yet. Configure a project and click "Save current as preset…" above.')
            : t('No recent projects yet. Generate or explore a project to see it here.')}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {local.map(item => {
            const moduleCount = item.snapshot.multiModuleEnabled ? item.snapshot.selectedModules.length : 0
            return (
              <div
                key={item.id}
                className="relative flex-shrink-0 w-52 rounded-lg border-2 border-outline-variant bg-surface-container hover:border-outline group transition-all"
              >
                <button onClick={() => onLoad(item.snapshot)} className="w-full p-4 text-start">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-secondary" style={{ fontSize: '20px' }}>
                      {tab === 'presets' ? 'bookmark' : 'history'}
                    </span>
                    <span dir="auto" className="font-semibold text-sm text-on-surface truncate">{item.name}</span>
                  </div>
                  <p className="text-[11px] text-secondary leading-relaxed" dir="ltr">
                    {item.snapshot.form.groupId}:{item.snapshot.form.artifactId}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <PresetChip icon="widgets">{tn(item.snapshot.selected.length, '{n} dep', '{n} deps')}</PresetChip>
                    {moduleCount > 0 && <PresetChip icon="account_tree">{moduleCount}</PresetChip>}
                    <span className="text-[10px] text-secondary ms-auto">{relativeTime(item.createdAt)}</span>
                  </div>
                </button>
                <button
                  onClick={() => onDelete(item.id)}
                  aria-label={t('Delete {name}', { name: item.name })}
                  className="absolute top-1.5 end-1.5 p-1 rounded text-secondary opacity-0 group-hover:opacity-100 hover:bg-error/10 hover:text-error transition-all"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
                </button>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
