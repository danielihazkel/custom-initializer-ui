import { useMemo, useState } from 'react'
import type { FullstackEntityDef, FullstackNav, FullstackPageDef } from '../../../types'
import { buildLayoutPreview } from '../layoutPreviewModel'
import { LayoutPreview, type EditTarget } from '../LayoutPreview'
import { seedLayout } from '../pageLayout'
import { offNavNoteFor, type PagesModel } from '../pages/usePagesModel'
import { CanvasFrame, DeviceSwitch, type PreviewDevice } from './CanvasFrame'
import { FrontendSettings, type FrontendAppearance } from './FrontendSettings'

/**
 * The generated app's look, beside the app itself: template set, colours, language and
 * direction, and the classic dashboard's heading on the left; a live preview on the right that
 * follows every change. Without a page layout the preview is the classic shell those settings
 * dress.
 */
export function AppearanceView({ pages, entities, model, appearance, nav, selected, onSelectPage, onEdit, device, onDevice, onEditStartDashboard }: {
  pages: FullstackPageDef[]
  entities: FullstackEntityDef[]
  model: PagesModel
  appearance: FrontendAppearance
  nav?: FullstackNav
  selected: number
  onSelectPage: (index: number) => void
  /** A part of the preview clicked: edit it in the design view. */
  onEdit: (target: EditTarget) => void
  device: PreviewDevice
  onDevice: (device: PreviewDevice) => void
  onEditStartDashboard?: () => void
}) {
  const { settings, preview } = model
  const hasPages = pages.length > 0
  // Without pages, the classic shell: a dashboard (with the heading set here) plus a list per entity.
  const classic = useMemo(
    () => (hasPages ? null : buildLayoutPreview(seedLayout(entities, { title: settings.dashboardTitle, description: settings.dashboardOverview }), entities,
      { locale: settings.locale, projectOpts: settings.projectOpts })),
    [hasPages, entities, settings.dashboardTitle, settings.dashboardOverview, settings.locale, settings.projectOpts],
  )
  const [classicSelected, setClassicSelected] = useState(0)

  const setName = appearance.currentFrontendSet?.name ?? appearance.frontendSet
  const paletteName = appearance.palettes.find(p => p.id === appearance.effectivePalette)?.name
  const caption = [setName, paletteName && `${paletteName} palette`, appearance.locale === 'he' ? 'עברית' : 'English', appearance.rtl ? 'right-to-left' : 'left-to-right']
    .filter(Boolean).join(' · ')

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden" data-designer-appearance>
      <aside className="border-outline-variant bg-surface-container-lowest p-5 lg:w-[24rem] lg:shrink-0 lg:overflow-y-auto lg:border-e" aria-label="Appearance settings">
        <h2 className="text-sm font-semibold text-on-surface">Appearance</h2>
        <p className="mb-5 text-[11px] text-secondary">How the generated app looks. The preview follows every change.</p>
        <FrontendSettings appearance={appearance} hasPages={hasPages} onEditStartDashboard={onEditStartDashboard} />
      </aside>
      <main className="flex min-h-[28rem] min-w-0 flex-1 flex-col" aria-label="Appearance preview">
        <div className="flex flex-wrap items-center gap-2 border-b border-outline-variant bg-surface-container-lowest px-4 py-1.5 text-[11px] text-secondary">
          <span className="font-semibold text-on-surface" data-appearance-caption>{caption}</span>
          <span className="ms-auto">{hasPages ? 'Click the menu to see another page; click a part to edit it' : 'Classic layout — the app you get without pages'}</span>
          <DeviceSwitch device={device} onChange={onDevice} />
        </div>
        <CanvasFrame device={device}>
          {classic ? (
            <LayoutPreview
              preview={classic}
              selected={classicSelected}
              onSelect={setClassicSelected}
              onEdit={() => {}}
              skin={settings.skin}
              palette={settings.palette}
              navStyle={nav?.style}
              collapsibleGroups={nav?.collapsibleGroups}
              narrow={device === 'mobile'}
            />
          ) : (
            <LayoutPreview
              preview={preview}
              selected={selected}
              onSelect={onSelectPage}
              onEdit={onEdit}
              skin={settings.skin}
              palette={settings.palette}
              offNavNote={offNavNoteFor(pages[selected])}
              navStyle={nav?.style}
              collapsibleGroups={nav?.collapsibleGroups}
              narrow={device === 'mobile'}
            />
          )}
        </CanvasFrame>
      </main>
    </div>
  )
}
