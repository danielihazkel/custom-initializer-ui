import { LayoutDesigner } from './LayoutDesigner'
import { PagesCard, type PagesSectionProps } from './PagesCard'

export type { PagesSectionProps }

/**
 * The Fullstack tab's page layout: the pages card with the layout designer it opens.
 */
export function PagesSection(props: PagesSectionProps) {
  return <PagesCard {...props} designer={(target, onClose) => <LayoutDesigner {...props} target={target} onClose={onClose} />} />
}
