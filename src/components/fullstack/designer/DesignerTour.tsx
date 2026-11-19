import { CoachTour, tourSeen as seen, type TourStep } from '../../shared/CoachTour'
import { t, useLang } from '../../../i18n'

export type { TourStep }

/** The tour's stops, in the site's language. */
export function designerTour(): TourStep[] {
  return [
    {
      anchor: '[data-designer-library]',
      title: t('The library'),
      body: t('Page types, widgets and whole-layout templates. Click a card to add it, or drag it onto the canvas or the page strip. Press / to search it.'),
    },
    {
      anchor: '[data-page-strip]',
      title: t('Your pages'),
      body: t('Every page of the app in menu order. Click one to open it, drag to reorder, right-click for more; Ctrl- or Shift-click picks several at once.'),
    },
    {
      anchor: '[data-canvas-device]',
      title: t('The canvas'),
      body: t('The page as the generated app draws it, with sample rows. Click a part to edit it, double-click a title to rename it, drag a widget’s edge to resize it.'),
    },
    {
      anchor: 'aside[data-inspector]',
      title: t('Settings'),
      body: t('Everything about the selected page or widget: its basics, its layout, who may open it, and the code it generates.'),
    },
    {
      anchor: '[data-canvas-mode]',
      title: t('Play'),
      body: t('Click through the layout as its users will — rows, tiles and charts go where the app goes. P switches between Design and Play.'),
    },
    {
      anchor: '[data-designer-issues-toggle]',
      title: t('Problems and tips'),
      body: t('What would stop Generate, and advice on the layout — each with a jump to the part, and often a one-click fix.'),
    },
  ]
}

const STORAGE_KEY = 'fullstack:designerTour'

/** Whether this browser has seen (or skipped) the designer tour. */
export function tourSeen(): boolean {
  return seen(STORAGE_KEY)
}

/**
 * The layout designer's tour: six stops on its own parts, once per browser, again from its help
 * menu. The tour itself is the shared `CoachTour`, which grew out of this file.
 */
export function DesignerTour({ root, steps, onClose }: { root: HTMLElement | null; steps?: TourStep[]; onClose: () => void }) {
  useLang()
  return <CoachTour root={root} steps={steps ?? designerTour()} storageKey={STORAGE_KEY} label={t('Designer tour')} onClose={onClose} />
}
