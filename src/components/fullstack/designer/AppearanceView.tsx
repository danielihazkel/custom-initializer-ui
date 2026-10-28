import type { FullstackPageDef, FullstackStarterRequest } from '../../../types'
import type { PagesModel } from '../pages/usePagesModel'
import { pageIdOfHash } from '../../../designRuntime/payload'
import { AppCanvas } from './AppCanvas'
import { CanvasNotice } from './CanvasNotice'
import { DeviceSwitch, ZoomControl, type PreviewDevice } from './CanvasFrame'
import { FrontendSettings, type FrontendAppearance } from './FrontendSettings'

/**
 * The generated app's look, beside the app itself: template set, design kit, colours, language
 * and direction, and the classic dashboard's heading on the left; on the right the generated app
 * itself (AppCanvas), regenerated a moment after every change, so a kit or palette restyles the
 * real components. Without a page layout it is the classic shell those settings dress. When the
 * app cannot run (a layout with problems, no runtime) the canvas says why.
 */
export function AppearanceView({ pages, model, appearance, selected, onSelectPage, device, onDevice, zoom, onZoom, onEditStartDashboard, onShowProblems, request = null }: {
  pages: FullstackPageDef[]
  model: PagesModel
  appearance: FrontendAppearance
  selected: number
  onSelectPage: (index: number) => void
  device: PreviewDevice
  onDevice: (device: PreviewDevice) => void
  /** The canvas zoom, shared with the design view. */
  zoom?: number
  onZoom?: (zoom: number) => void
  onEditStartDashboard?: () => void
  /** Opens the layout's problems (the canvas offers it when they keep the app from generating). */
  onShowProblems?: () => void
  /** The request for the model as it stands; null when it cannot be generated. */
  request?: FullstackStarterRequest | null
}) {
  const hasPages = pages.length > 0

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
          <span className="ms-auto">{hasPages ? 'The generated app — use its menu to see another page' : 'Classic layout — the app you get without pages'}</span>
          {zoom != null && onZoom && <ZoomControl zoom={zoom} onChange={onZoom} />}
          <DeviceSwitch device={device} onChange={onDevice} />
        </div>
        <AppCanvas
          request={request}
          device={device}
          zoom={zoom}
          hash={hasPages && pages[selected] ? `#/${pages[selected].id}` : undefined}
          onRoute={hash => {
            const index = pages.findIndex(p => p.id === pageIdOfHash(hash))
            if (index >= 0 && index !== selected) onSelectPage(index)
          }}
          emptyReason="the model has problems to fix first"
          fallback={reason => <CanvasNotice reason={reason} problems={model.issues.length} onShowProblems={onShowProblems} />}
        />
      </main>
    </div>
  )
}
