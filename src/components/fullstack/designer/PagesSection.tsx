import { LayoutDesigner } from './LayoutDesigner'
import { PagesCard, type PagesSectionProps } from './PagesCard'

export type { PagesSectionProps }

/**
 * The Fullstack tab's page layout: the pages card with the layout designer it opens. Takes the
 * inline editor's props, so the tab hands either the same state.
 */
export function PagesSection(props: PagesSectionProps) {
  return <PagesCard {...props} designer={(target, onClose) => <LayoutDesigner {...props} target={target} onClose={onClose} />} />
}
