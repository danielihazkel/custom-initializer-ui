import type { FullstackPageDef, FullstackStarterRequest } from '../../../types'
import type { DesignIntent } from '../../../designRuntime/PreviewFrame'
import { pageIdOfHash } from '../../../designRuntime/payload'
import { AppCanvas } from '../designer/AppCanvas'
import { CanvasNotice } from '../designer/CanvasNotice'
import { previewPartOf } from '../layoutPreviewModel'

/**
 * The generated app beside (or over) the Pages card's list: the page being edited, with design
 * mode's editing layer on — a part the editor control under the pointer belongs to is ringed,
 * a part clicked opens its control, a title double-clicked renames in place — and the app's own
 * menu moves the list to the page it opens. Without a page (`page` null) it is the app as it is,
 * the classic shell before there is a layout.
 */
export function PagesAppPreview({ request, pages, page, ring, problems, texts, problemCount, onPick, onIntent, onOpenPage, className = 'h-[34rem]' }: {
  request: FullstackStarterRequest | null
  pages: FullstackPageDef[]
  page: FullstackPageDef | null
  /** The control the editor's pointer or focus is on: its part is ringed. */
  ring?: string | null
  problems?: Record<string, string>
  texts?: Record<string, string>
  problemCount: number
  onPick?: (control: string | null) => void
  onIntent?: (intent: DesignIntent) => void
  onOpenPage?: (index: number) => void
  className?: string
}) {
  return (
    <div className={`flex flex-col overflow-hidden rounded-xl border border-outline-variant ${className}`} data-pages-app-preview>
      <AppCanvas
        request={request}
        device="desktop"
        hash={page ? `#/${page.id}` : undefined}
        onRoute={hash => {
          const index = pages.findIndex(p => p.id === pageIdOfHash(hash))
          if (index >= 0) onOpenPage?.(index)
        }}
        emptyReason="the layout has problems to fix first"
        design={page && onPick ? {
          state: { pageType: page.type, selected: previewPartOf(ring ?? undefined) ?? null, problems: problems ?? {}, drag: null, texts },
          onIntent: intent => (intent.type === 'pick' ? onPick(intent.control) : onIntent?.(intent)),
        } : undefined}
        fallback={reason => <CanvasNotice reason={reason} problems={problemCount} />}
      />
    </div>
  )
}
