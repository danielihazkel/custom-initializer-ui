import { Suspense, lazy, useCallback, useState } from 'react'
import type { ProjectPreset, ProjectSnapshot } from '../types'
import { PresetChip, relativeTime } from './presetCards'
import { t, tn, useLang } from '../i18n'

// This strip is on the Backend tab's first paint, so what it does not need to draw its cards is
// in lazy chunks: the Team tab (the server's presets, their cards and palette entries), and the
// save prompt with Ctrl+S and the ⌘K entries.
const TeamPresetsPanel = lazy(() => import('./TeamPresetsPanel'))
const PresetExtras = lazy(() => import('./PresetExtras'))

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
  useLang()
  const [tab, setTab] = useState<Tab>('presets')
  const [savePromptOpen, setSavePromptOpen] = useState(false)
  const [teamCount, setTeamCount] = useState(0)
  const [teamReload, setTeamReload] = useState(0)
  const onTeamCount = useCallback((n: number) => setTeamCount(n), [])
  const openPrompt = useCallback(() => setSavePromptOpen(true), [])
  const closePrompt = useCallback(() => setSavePromptOpen(false), [])
  const onSaved = useCallback((forTeam: boolean) => {
    if (forTeam) setTeamReload(n => n + 1)
    setTab(forTeam ? 'team' : 'presets')
  }, [])

  // The save prompt, Ctrl+S and the ⌘K entries. Keyed like the team panel below: it keeps its
  // draft while the strip switches between its two layouts.
  const extras = (
    <Suspense key="preset-extras" fallback={null}>
      <PresetExtras
        open={savePromptOpen}
        onOpen={openPrompt}
        onClose={closePrompt}
        presets={presets}
        recents={recents}
        currentSnapshot={currentSnapshot}
        onLoad={onLoad}
        onSave={onSave}
        onSaved={onSaved}
      />
    </Suspense>
  )

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
        {extras}
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

      {extras}
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
