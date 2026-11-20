import { useEffect, useMemo, useRef } from 'react'
import { useFrontendMetadata } from '../../../hooks/useFrontendMetadata'
import { LayoutDesigner, type DesignerTarget } from '../../fullstack/designer/LayoutDesigner'
import { isMenoraSet, type FrontendAppearance } from '../../fullstack/designer/FrontendSettings'
import { isTypingTarget } from '../../fullstack/undo'
import { useTemplateSets } from '../../fullstack/useTemplateSets'
import { t } from '../../../i18n'
import type { ExampleDesign } from './useExampleDesign'

/**
 * The full-screen layout designer over an example in the Admin form. A chunk of its own, fetched
 * when the designer is first opened: it brings the designer, and asks for the template sets and
 * the palettes only then. Everything it edits is the form's (`useExampleDesign`).
 */
export default function ExampleDesigner({ design, artifactId, target, onClose }: {
  design: ExampleDesign
  /** The example's id — the project name the Appearance view's placeholder and the Code tab show. */
  artifactId: string
  target: DesignerTarget
  onClose: () => void
}) {
  const { metadata: feMetadata, error: feError, reload: reloadFe } = useFrontendMetadata()
  const { availableSets, setsLoading, setsError, loadTemplateSets } = useTemplateSets()
  const { look, history } = design
  const frontendSet = look?.frontendSet ?? ''
  const frontendSets = availableSets.filter(s => s.kind === 'FRONTEND_REACT')
  const currentFrontendSet = availableSets.find(s => s.setKey === frontendSet)
  const backendDeps = availableSets.find(s => s.setKey === design.backendSet)?.defaultDeps
  const palettes = useMemo(() => feMetadata?.colorPalettes ?? [], [feMetadata])
  // What the generator will use: the explicit pick, else the set's default, else the catalog's.
  const setDefaultPalette = currentFrontendSet?.defaultPaletteId ?? palettes.find(p => p.isDefault)?.id ?? palettes[0]?.id ?? ''
  const effectivePalette = look?.colorPalette || setDefaultPalette
  const previewPalette = palettes.find(p => p.id === effectivePalette)

  const previewSettings = useMemo(() => ({
    locale: design.locale,
    projectOpts: design.scaffold,
    skin: (isMenoraSet(currentFrontendSet, frontendSet) ? 'menora' : 'tailwind') as 'menora' | 'tailwind',
    palette: previewPalette,
    dashboardTitle: look?.dashboardTitle,
    dashboardOverview: look?.dashboardOverview,
  }), [design.locale, design.scaffold, currentFrontendSet, frontendSet, previewPalette, look?.dashboardTitle, look?.dashboardOverview])

  const appearance: FrontendAppearance | undefined = look ? {
    frontendSets, frontendSet,
    setFrontendSet: setKey => look.setFrontendSet(setKey, availableSets.find(s => s.setKey === setKey)),
    currentFrontendSet, setsLoading, setsError, loadTemplateSets,
    palettes, feError, reloadFe, effectivePalette, setDefaultPalette,
    colorPalette: look.colorPalette, setColorPalette: look.setColorPalette,
    locale: look.locale, dashboardTitle: look.dashboardTitle, dashboardOverview: look.dashboardOverview,
    artifactId, updateMeta: look.updateMeta,
    rtl: look.rtl, toggleRtl: look.toggleRtl,
  } : undefined

  // Undo and redo from the keyboard while the designer is open, as on the Fullstack tab: outside
  // a field, where the keys are the browser's own.
  const keysRef = useRef(history)
  keysRef.current = history
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || !(e.ctrlKey || e.metaKey) || isTypingTarget(e.target)) return
      const key = e.key.toLowerCase()
      if (key === 'z' && !e.shiftKey) { e.preventDefault(); keysRef.current.undo() }
      else if ((key === 'z' && e.shiftKey) || key === 'y') { e.preventDefault(); keysRef.current.redo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const lastUndo = history.history.past[history.history.past.length - 1]
  const nextRedo = history.history.future[history.history.future.length - 1]

  return (
    <LayoutDesigner
      pages={design.pages}
      entities={design.entities}
      validation={design.validation}
      onChange={design.setPages}
      pushUndo={design.pushUndo}
      onClear={design.clearPages}
      previewSettings={previewSettings}
      nav={design.nav}
      onNavChange={design.setNav}
      appearance={appearance}
      codeRequest={() => design.request(backendDeps ?? [])}
      history={{
        undoLabel: lastUndo ? t('Undo: {change}', { change: lastUndo.label }) : null,
        redoLabel: nextRedo ? t('Redo: {change}', { change: nextRedo.label }) : null,
        onUndo: history.undo,
        onRedo: history.redo,
        undoEntries: history.history.past.map(e => e.label),
        redoEntries: history.history.future.map(e => e.label),
        onJump: history.jumpHistory,
      }}
      target={target}
      onClose={onClose}
    />
  )
}
