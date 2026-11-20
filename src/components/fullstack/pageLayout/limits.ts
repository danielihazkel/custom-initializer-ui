import type { FullstackListView } from '../../../types'
import { t } from '../../../i18n'
import { CHOICES, LIMITS, NAME_RULES } from '../schema'

/**
 * The page layout's limits and fixed choices, as the server's schema document gives them
 * (`../schema`). Everything else in this folder reads them; this module reads none of the others.
 */

export const PAGE_ID = NAME_RULES.pageId

export const MAX_PAGES = LIMITS.maxPages

/** Every title in a layout — a page's, a widget's, a tab's, a step's, a header tile's (FullstackPageValidator.MAX_TITLE). */
export const MAX_TITLE = LIMITS.maxTitle

export const MAX_DESCRIPTION = LIMITS.maxDescription

export const MAX_WIDGETS = LIMITS.maxWidgets

export const MIN_TABS = LIMITS.minTabs

export const MAX_TABS = LIMITS.maxTabs

export const MAX_CHILD_TABS = MAX_TABS - 1

export const MAX_RECENT_LIMIT = LIMITS.maxRecentLimit

export const MAX_GROUP = LIMITS.maxGroup

export const MAX_SPAN = LIMITS.maxSpan

export const MAX_CHARTS = LIMITS.maxCharts

export const MAX_STEPS = LIMITS.maxSteps

export const DEFAULT_STEP_SIZE = LIMITS.defaultStepSize

export const MAX_HEADER_STATS = LIMITS.maxHeaderStats

export const MAX_TEXT = LIMITS.maxText

/** The pages one links widget can open. */
export const MAX_LINKS = LIMITS.maxLinks

/** A list widget's rows per page: the pager's own sizes that fit a card. */
export const LIST_WIDGET_LIMITS = [10, 20]

/** The rows-per-page choices the generated pager offers — what a list page may open on. */
export const LIST_PAGE_SIZES = CHOICES.listPageSizes

export const DEFAULT_PAGE_SIZE = 20

// The tables of labels below keep their texts behind getters: read when shown, in the site's
// language then, not when this module loads.
export const LIST_VIEWS: { value: FullstackListView; readonly label: string; icon: string }[] = [
  { value: 'table', get label() { return t('Table') }, icon: 'table' },
  { value: 'cards', get label() { return t('Cards') }, icon: 'grid_view' },
  { value: 'kanban', get label() { return t('Board') }, icon: 'view_kanban' },
  { value: 'calendar', get label() { return t('Calendar') }, icon: 'calendar_month' },
  { value: 'gallery', get label() { return t('Gallery') }, icon: 'photo_library' },
]
