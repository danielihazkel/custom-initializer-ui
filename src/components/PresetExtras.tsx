import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { ProjectPreset, ProjectSnapshot } from '../types'
import { useHotkeys } from '../hooks/useHotkeys'
import { registerCommands, type PaletteAction } from '../commands'
import { relativeTime } from './presetCards'
import { t, useLang } from '../i18n'

interface Props {
  /** Whether the save prompt is open — kept by the strip, whose button toggles it. */
  open: boolean
  onOpen: () => void
  onClose: () => void
  presets: ProjectPreset[]
  recents: ProjectPreset[]
  currentSnapshot: ProjectSnapshot
  onLoad: (snapshot: ProjectSnapshot) => void
  /** Saves a preset in this browser. */
  onSave: (name: string, snapshot: ProjectSnapshot) => void
  /** A preset was saved: here (`false`) or for the team (`true`). */
  onSaved: (forTeam: boolean) => void
}

/**
 * What the presets strip does beyond showing its cards: the save prompt, Ctrl+S, and the ⌘K
 * entries (save, and every preset and recent project by name). The strip is on the Backend
 * tab's first paint and none of this is, so it is a chunk of its own, mounted from the start.
 */
export default function PresetExtras({ open, onOpen, onClose, presets, recents, currentSnapshot, onLoad, onSave, onSaved }: Props) {
  const lang = useLang()
  const [draftName, setDraftName] = useState('')
  // Where a new preset goes: this browser, or the server for everyone.
  const [forTeam, setForTeam] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  function closePrompt() {
    onClose()
    setDraftName('')
    setSaveError(null)
  }

  async function commitSave() {
    const name = draftName.trim()
    if (!name || saving) return
    if (!forTeam) {
      onSave(name, currentSnapshot)
      closePrompt()
      onSaved(false)
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const { saveTeamPreset } = await import('../hooks/useTeamPresets')
      await saveTeamPreset(name, currentSnapshot)
      closePrompt()
      onSaved(true)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  // Ctrl+S opens the save prompt (and beats the browser's "save page" dialog); ⌘K offers the
  // same, plus every preset and recent project by name (the Team panel adds the team's).
  useHotkeys([{ key: 's', ctrl: true, run: onOpen }])
  // Through refs: registering re-renders the palette's subscribers (App among them), so the
  // effect must not depend on a callback whose identity could change with that render.
  const onLoadRef = useRef(onLoad)
  onLoadRef.current = onLoad
  const onOpenRef = useRef(onOpen)
  onOpenRef.current = onOpen
  useEffect(() => {
    const onLoad = (snapshot: ProjectSnapshot) => onLoadRef.current(snapshot)
    const list: PaletteAction[] = [{
      id: 'backend-save-preset', title: t('Save the current setup as a preset…'), icon: 'bookmark_add',
      group: t('Backend'), shortcut: 'Ctrl+S', run: () => onOpenRef.current(),
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

  return (
    <AnimatePresence>
      {open && (
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
  )
}
