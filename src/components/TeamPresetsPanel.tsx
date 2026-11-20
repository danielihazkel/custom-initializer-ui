import { useEffect, useRef, useState } from 'react'
import type { ProjectSnapshot, TeamPresetSummary } from '../types'
import { useTeamPresets } from '../hooks/useTeamPresets'
import { registerCommands, type PaletteAction } from '../commands'
import { PresetChip, relativeTime } from './presetCards'
import { t, tn, useLang } from '../i18n'
import { notYours } from '../utils/teamAuth'

interface TeamPresetsPanelProps {
  /** Whether the Team tab is open: the panel is mounted from the start (for the count and the
   *  palette) but draws its cards only when shown. */
  visible: boolean
  /** Changes after a save for the team, to fetch the list again. */
  reloadKey: number
  onLoad: (snapshot: ProjectSnapshot) => void
  /** The number of team presets, for the tab's badge. */
  onCount: (count: number) => void
}

/**
 * The presets strip's "Team" tab: the Backend-tab setups kept on the server for everyone. A lazy
 * chunk — the strip itself is first-paint code — that also puts each team preset in the command
 * palette.
 */
export default function TeamPresetsPanel({ visible, reloadKey, onLoad, onCount }: TeamPresetsPanelProps) {
  const lang = useLang()
  const team = useTeamPresets(reloadKey)
  // A team preset is deleted for everyone, so its × asks first, in the card.
  const [confirmingDelete, setConfirmingDelete] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => { onCount(team.presets.length) }, [team.presets.length, onCount])

  async function loadPreset(id: number) {
    setActionError(null)
    try {
      onLoad(await team.load(id))
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err))
    }
  }

  async function deletePreset(id: number) {
    setConfirmingDelete(null)
    setActionError(null)
    try {
      await team.remove(id)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err))
    }
  }

  // Through a ref, as the strip does: registering re-renders the palette's subscribers.
  const loadRef = useRef(loadPreset)
  loadRef.current = loadPreset
  useEffect(() => {
    const list: PaletteAction[] = team.presets.map(p => ({
      id: `backend-team-preset-${p.id}`, title: t('Load team preset: {name}', { name: p.name }), description: p.createdBy ?? undefined,
      icon: 'groups', group: t('Presets'), run: () => { void loadRef.current(p.id) },
    }))
    return registerCommands(list, 'backend-team-presets')
  }, [team.presets, lang])

  if (!visible) return null

  function card(item: TeamPresetSummary) {
    if (confirmingDelete === item.id) {
      return (
        <div key={item.id} className="relative flex-shrink-0 w-52 rounded-lg border-2 border-error/50 bg-surface-container p-4"
          role="alertdialog" aria-label={t('Delete {name} for everyone?', { name: item.name })}>
          <p className="text-xs font-semibold text-on-surface mb-1">{t('Delete “{name}”?', { name: item.name })}</p>
          <p className="text-[11px] text-secondary mb-3">{t('It is gone for the whole team.')}</p>
          <div className="flex gap-2">
            <button onClick={() => { void deletePreset(item.id) }}
              className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-error text-white active:scale-95 transition-transform">
              {t('Delete')}
            </button>
            <button autoFocus onClick={() => setConfirmingDelete(null)}
              className="px-2.5 py-1 rounded-md text-[11px] font-medium text-secondary hover:text-on-surface transition-colors">
              {t('Keep')}
            </button>
          </div>
        </div>
      )
    }
    return (
      <div key={item.id}
        className="relative flex-shrink-0 w-52 rounded-lg border-2 border-outline-variant bg-surface-container hover:border-outline group transition-all">
        <button onClick={() => { void loadPreset(item.id) }} className="w-full p-4 text-start" title={item.description ?? undefined}>
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-secondary" style={{ fontSize: '20px' }}>groups</span>
            <span dir="auto" className="font-semibold text-sm text-on-surface truncate">{item.name}</span>
          </div>
          <p className="text-[11px] text-secondary leading-relaxed truncate" dir="ltr">{item.coordinates}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <PresetChip icon="widgets">{tn(item.dependencyCount, '{n} dep', '{n} deps')}</PresetChip>
            {item.moduleCount > 0 && <PresetChip icon="account_tree">{item.moduleCount}</PresetChip>}
            <span className="text-[10px] text-secondary ms-auto">{relativeTime(Date.parse(item.updatedAt))}</span>
          </div>
          {item.createdBy && <p className="mt-1.5 text-[10px] text-secondary truncate">{t('by {user}', { user: item.createdBy })}</p>}
        </button>
        {/* Somebody else's: the × stays, disabled, and says whose it is. */}
        <button onClick={() => setConfirmingDelete(item.id)} aria-label={t('Delete {name}', { name: item.name })}
          disabled={notYours(item) !== undefined} title={notYours(item)}
          className="absolute top-1.5 end-1.5 p-1 rounded text-secondary opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-error/10 hover:text-error disabled:hover:bg-transparent disabled:hover:text-secondary disabled:cursor-not-allowed transition-all">
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
        </button>
      </div>
    )
  }

  const empty = team.loading ? t('Loading team presets…')
    : team.error ? t('Team presets are unavailable: {error}', { error: team.error })
      : t('No team presets yet. Save a setup "for the team" to share it — wizard documents and modules included.')

  return (
    <>
      {actionError && <p className="mb-2 text-[11px] text-error" role="alert">{actionError}</p>}
      {team.presets.length === 0 ? (
        <div className="text-xs text-secondary py-4 px-4 rounded-lg border border-dashed border-outline-variant/50 bg-surface-container-low/30">
          {empty}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">{team.presets.map(card)}</div>
      )}
    </>
  )
}
