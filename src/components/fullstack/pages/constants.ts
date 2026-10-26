import type { FullstackWidgetDef } from '../../../types'

export const CHIP = 'rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide'
export const ICON_BUTTON = 'shrink-0 rounded-lg p-1.5 text-secondary hover:text-primary hover:bg-primary/5 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-secondary'
export const SMALL_BUTTON = 'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-outline-variant text-secondary hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-colors disabled:opacity-40 disabled:hover:text-secondary disabled:hover:border-outline-variant disabled:hover:bg-transparent'
export const WIDGET_KINDS: { kind: FullstackWidgetDef['kind']; icon: string; label: string; short: string; hint: string }[] = [
  { kind: 'kpi', icon: 'counter_1', label: 'Number tile', short: 'Number', hint: 'One number: a count or an aggregate' },
  { kind: 'bar', icon: 'bar_chart', label: 'Breakdown chart', short: 'Breakdown', hint: 'Bars per value of an enum or boolean field' },
  { kind: 'donut', icon: 'donut_large', label: 'Donut chart', short: 'Donut', hint: 'Shares of an enum or boolean field, as a ring' },
  { kind: 'stacked', icon: 'stacked_bar_chart', label: 'Stacked chart', short: 'Stacked', hint: 'Bars per value, each split by a second field' },
  { kind: 'pivot', icon: 'table_chart', label: 'Pivot table', short: 'Pivot', hint: 'One number per pair of values of two fields' },
  { kind: 'line', icon: 'show_chart', label: 'Trend over time', short: 'Trend', hint: 'A line over a date, per day, month or year' },
  { kind: 'recent', icon: 'list', label: 'Recent rows', short: 'Recent', hint: 'The latest rows, newest first' },
  { kind: 'activity', icon: 'history', label: 'Recent activity', short: 'Activity', hint: 'The latest changes across audited entities' },
  { kind: 'top', icon: 'format_list_numbered', label: 'Top list', short: 'Top', hint: 'The largest groups, ranked' },
  { kind: 'progress', icon: 'data_usage', label: 'Progress to target', short: 'Progress', hint: 'An aggregate against a fixed target' },
  { kind: 'text', icon: 'notes', label: 'Text note', short: 'Text', hint: 'A heading and paragraphs of your own — no data' },
  { kind: 'links', icon: 'apps', label: 'Page links', short: 'Links', hint: 'Tiles that open other pages' },
  { kind: 'list', icon: 'table_rows', label: 'Embedded list', short: 'List', hint: 'An entity’s rows in a card — your columns, sort and filter' },
]

/** Widgets a dashboard has before its cards start collapsed; a short list reads fine open. */
export const COLLAPSE_WIDGETS_FROM = 4

export const AGG_HINT = 'Count the rows, or sum / average / min / max a number column'
