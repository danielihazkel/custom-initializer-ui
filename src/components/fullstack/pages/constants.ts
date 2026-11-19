import type { FullstackWidgetDef } from '../../../types'
import { t } from '../../../i18n'

export const CHIP = 'rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide'
export const ICON_BUTTON = 'shrink-0 rounded-lg p-1.5 text-secondary hover:text-primary hover:bg-primary/5 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-secondary'
export const SMALL_BUTTON = 'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-outline-variant text-secondary hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-colors disabled:opacity-40 disabled:hover:text-secondary disabled:hover:border-outline-variant disabled:hover:bg-transparent'
/** The widget kinds, in the library's order. The texts are getters: they read the site's language
 *  when shown, not when this module loads. */
export const WIDGET_KINDS: { kind: FullstackWidgetDef['kind']; icon: string; readonly label: string; readonly short: string; readonly hint: string }[] = [
  { kind: 'kpi', icon: 'counter_1', get label() { return t('Number tile') }, get short() { return t('Number') }, get hint() { return t('One number: a count or an aggregate') } },
  { kind: 'bar', icon: 'bar_chart', get label() { return t('Breakdown chart') }, get short() { return t('Breakdown') }, get hint() { return t('Bars per value of an enum or boolean field') } },
  { kind: 'donut', icon: 'donut_large', get label() { return t('Donut chart') }, get short() { return t('Donut') }, get hint() { return t('Shares of an enum or boolean field, as a ring') } },
  { kind: 'stacked', icon: 'stacked_bar_chart', get label() { return t('Stacked chart') }, get short() { return t('Stacked') }, get hint() { return t('Bars per value, each split by a second field') } },
  { kind: 'pivot', icon: 'table_chart', get label() { return t('Pivot table') }, get short() { return t('Pivot') }, get hint() { return t('One number per pair of values of two fields') } },
  { kind: 'line', icon: 'show_chart', get label() { return t('Trend over time') }, get short() { return t('Trend') }, get hint() { return t('A line over a date, per day, month or year') } },
  { kind: 'recent', icon: 'list', get label() { return t('Recent rows') }, get short() { return t('Recent') }, get hint() { return t('The latest rows, newest first') } },
  { kind: 'activity', icon: 'history', get label() { return t('Recent activity') }, get short() { return t('Activity') }, get hint() { return t('The latest changes across audited entities') } },
  { kind: 'top', icon: 'format_list_numbered', get label() { return t('Top list') }, get short() { return t('Top') }, get hint() { return t('The largest groups, ranked') } },
  { kind: 'progress', icon: 'data_usage', get label() { return t('Progress to target') }, get short() { return t('Progress') }, get hint() { return t('An aggregate against a fixed target') } },
  { kind: 'gauge', icon: 'speed', get label() { return t('Gauge') }, get short() { return t('Gauge') }, get hint() { return t('An aggregate against a full-scale value, as a dial') } },
  { kind: 'funnel', icon: 'filter_alt', get label() { return t('Funnel') }, get short() { return t('Funnel') }, get hint() { return t('An enum’s values as the stages of a pipeline: each stage is everything that got that far') } },
  { kind: 'timeInState', icon: 'hourglass_top', get label() { return t('Time in state') }, get short() { return t('Time in state') }, get hint() { return t('How long rows stay in each workflow state — needs the workflow’s log of moves') } },
  { kind: 'text', icon: 'notes', get label() { return t('Text note') }, get short() { return t('Text') }, get hint() { return t('A heading and paragraphs of your own — no data') } },
  { kind: 'links', icon: 'apps', get label() { return t('Page links') }, get short() { return t('Links') }, get hint() { return t('Tiles that open other pages') } },
  { kind: 'list', icon: 'table_rows', get label() { return t('Embedded list') }, get short() { return t('List') }, get hint() { return t('An entity’s rows in a card — your columns, sort and filter') } },
]

/** Widgets a dashboard has before its cards start collapsed; a short list reads fine open. */
export const COLLAPSE_WIDGETS_FROM = 4

export const aggHint = () => t('Count the rows, or sum / average / min / max a number column')
