import type { FullstackAgg, FullstackBucket, FullstackEntityDef, FullstackFieldDef, FullstackListDetail, FullstackListSort, FullstackListView, FullstackPageDef, FullstackPageType } from '../../types'
import { enumLabel } from './enumLabels'
import { humanize } from './naming'
import { describePresetValue, pageLabel as linkLabel } from './pageLayout'
import {
  DEFAULT_NAV_ICON,
  auditOn,
  enabledListViews,
  defaultSpan,
  defaultWizardSteps,
  defaultTopGroupBy,
  reportCharts,
  NAV_ICONS,
  defaultBarGroupBy,
  defaultSeries,
  defaultLineGroupBy,
  defaultReportGroupBy,
  dateFields,
  navSections,
  relationsTo,
  childTabEntity,
  childTabVia,
  reloads,
} from './pageLayout'
import { buildUiPreview, fieldLabel } from './uiPreview'
import { parseContent, type ContentBlock } from './contentMarkdown'
import {
  CALENDAR_MODES, cardFieldOptions, defaultCardFields, defaultLaneField, defaultSearchEntities, laneValues,
} from './newPageTypes'

/**
 * View-model for the Fullstack tab's layout preview: a wireframe of the app the page layout
 * generates — the nav in order, and each screen as the templates draw it (ScreenDashboard,
 * ScreenEntityList, ScreenTabs, ScreenMasterDetail, ScreenRecord, ScreenReport, ScreenWizard). Titles follow
 * the backend defaults (EntityScaffoldContext.putPageContext) in the chosen chrome language;
 * the numbers and rows are sample data made up from the model, seeded by name so they stay put
 * between renders. Pure so it can be unit tested; LayoutPreview.tsx only draws it.
 */

export interface LayoutPreviewContext {
  locale: 'en' | 'he'
  /** Project-wide scaffold opts (csvExport, audit, bulk…) — the list pages' toolbars follow them. */
  projectOpts: string[]
  /** The pages the layout validation warns about — their nav entries carry a marker. */
  warnPages?: ReadonlySet<number>
}

export interface PreviewNavItem {
  /** Index into the layout's pages. */
  index: number
  label: string
  icon: string
  start: boolean
  /** The layout validation has advice about this page. */
  warning: boolean
  /** The roles that may open the page (any of); empty for everyone. */
  roles: string[]
}

export interface PreviewBar { label: string; value: number }

/** What every widget carries: where it sits and how wide it is (grid columns out of four). */
interface WidgetBase {
  index: number
  title: string
  span: number
  /** "Status: Open" chips for the rows the widget is limited to. */
  filters: string[]
}

export type PreviewWidget = WidgetBase & (
  | { kind: 'kpi'; value: string; /** "▲ 12%" when the tile compares periods. */ delta: string | null }
  | { kind: 'progress'; value: string; target: string; percent: number }
  | { kind: 'top'; rows: PreviewBar[] }
  | { kind: 'bar'; bars: PreviewBar[] }
  | { kind: 'donut'; bars: PreviewBar[] }
  | { kind: 'stacked'; rows: { label: string; parts: number[] }[]; series: string[] }
  | { kind: 'text'; paragraphs: string[] }
  | { kind: 'links'; tiles: { label: string; icon: string }[] }
  | { kind: 'list'; table: PreviewTable }
  | { kind: 'line'; points: PreviewBar[] }
  | { kind: 'recent'; rows: string[]; /** "Newest by Placed on" — the column the rows are sorted by. */ by: string }
  | { kind: 'broken'; message: string }
)

export interface PreviewTable {
  /** The entity's plural label. */
  title: string
  columns: string[]
  rows: string[][]
  /** The view the list opens in (the page's, else the entity's first). */
  view: FullstackListView
  /** Lane headings for a board (the breakdown field's first values); empty otherwise. */
  lanes: string[]
  /** Per row, the lane it sits in on a board (its breakdown value), or -1 when that value's lane
   *  is not drawn; empty when the list is not a board. */
  rowLanes: number[]
  /** "Placed on ↓" when the page opens sorted; null for the default order. */
  sort: string | null
  showSearch: boolean
  filters: string[]
  /** "Status: Open" chips for the filters the page opens with. */
  presetChips: string[]
  /** The page opens rows in a pane beside the table: the first row's cells, labelled. */
  sidePane: { label: string; value: string }[] | null
  newLabel: string | null
  hasExport: boolean
  /** Under the rows: rows per page, and where a row opens ("20 per page · rows open their page"). */
  footer: string
}

export type PreviewScreen =
  | {
    type: 'dashboard'; title: string; description?: string; widgets: PreviewWidget[]; period: string | null
    /** The generated Refresh button, when a widget shows data; with the timer's interval when set. */
    refresh: { label: string; every: string | null } | null
  }
  | { type: 'entity-list'; title: string; description?: string; table: PreviewTable }
  | { type: 'tabs'; title: string; description?: string; tabs: { label: string; target: number | null }[] }
  | {
    type: 'master-detail'; title: string; description?: string; parentTitle: string; parentItems: string[]; child: PreviewTable; childTitle: string
    /** The selected parent's card above the child rows: its first fields, labelled; null without the card. */
    parentDetails: { label: string; value: string }[] | null
  }
  | {
    type: 'record'; title: string; description?: string; heading: string; back: string | null; tabs: string[]
    /** The details tab: fields in the entity's form sections (a section's first field carries its
     *  title), else its first fields. */
    details: { label: string; value: string; section?: string }[]
    /** Per related tab (tabs[1..]), the rows it lists — the child's table without the link back. */
    tabTables: (PreviewTable | null)[]
    /** The number tiles above the tabs. */
    stats: { title: string; value: string }[]
  }
  | {
    type: 'wizard'; title: string; description?: string
    /** The step titles, then the review. */
    steps: string[]
    /** The first step's field labels, as its form shows them. */
    fields: string[]
    /** Every step's field labels, in order (the review is not among them). */
    stepFields: string[][]
    /** What the review step shows: each asked field with a sample value. */
    review: { label: string; value: string }[]
    /** The review step's button. */
    save: string
    next: string
    back: string
  }
  | {
    type: 'report'
    title: string
    description?: string
    filters: string[]
    presetChips: string[]
    chartTitle: string
    chart: { line: boolean; bars: PreviewBar[] }
    /** The first chart's totals table is drawn (its `table`, default on). */
    chartTable: boolean
    /** A report's second to fourth charts, drawn under the first; `table` as for the first (default off). */
    moreCharts: { title: string; line: boolean; bars: PreviewBar[]; table: boolean }[]
    groupLabel: string
    valueLabel: string
    totalLabel: string
    exportLabel: string | null
  }
  | {
    type: 'calendar'; title: string; description?: string
    /** The views offered, the opening one first; the grid always previews a month. */
    modes: string[]
    /** Five weeks of days (1–35 of a sample month), each with the headings of its sample rows. */
    days: { day: number; events: string[] }[]
    /** Whether a day can be clicked to add a row. */
    creates: boolean
  }
  | {
    type: 'board'; title: string; description?: string
    lanes: { label: string; count: number; limit: number | null; cards: { heading: string; details: string[] }[] }[]
  }
  | { type: 'content'; title: string; description?: string; blocks: ContentBlock[] }
  | { type: 'import'; title: string; description?: string; entity: string; fields: { label: string; required: boolean }[] }
  | { type: 'search'; title: string; description?: string; words: string; groups: { title: string; total: number; rows: string[] }[]; header: boolean }
  | { type: 'broken'; title: string; message: string }

export interface PreviewNavSection {
  /** The nav group; absent for a run of ungrouped pages. */
  group?: string
  items: PreviewNavItem[]
}

export interface LayoutPreview {
  rtl: boolean
  /** The nav in the order the generated shell lists it (sections flattened). */
  nav: PreviewNavItem[]
  sections: PreviewNavSection[]
  /** One per page, index-aligned with the layout. */
  screens: PreviewScreen[]
  strings: { viewAll: string; search: string; filters: string; total: string; startPage: string }
}

// ── Chrome strings (a subset of i18n-strings.ts.mustache) ──────────────────

const STRINGS = {
  en: {
    dashboard: 'Dashboard', xByY: '{x} by {y}', xByYAndZ: '{x} by {y} and {z}', recentX: 'Recent {x}', xOverTime: '{x} over time',
    xReport: '{x} report', total: 'Total', aggSum: 'Total {x}', aggAvg: 'Average {x}', aggMin: 'Lowest {x}',
    aggMax: 'Highest {x}', viewAll: 'View all', back: 'Back', exportCsv: 'Export CSV', newX: 'New {x}',
    xDetails: '{x} details', search: 'Search…', filters: 'Filters', trueLabel: 'True', falseLabel: 'False',
    count: 'Count', startPage: 'Start page', stepX: 'Step {x}', review: 'Review', next: 'Next', save: 'Save', refresh: 'Refresh', topXByY: 'Top {x} by {y}', vsPrevious: 'vs previous period',
    percentOfTarget: '{x}% of target', periodAll: 'All time', period7d: 'Last 7 days',
    period30d: 'Last 30 days', period90d: 'Last 90 days', periodYtd: 'This year', period12m: 'Last 12 months',
    perPage: '{n} per page', opensRecord: 'rows open their page', opensDrawer: 'rows open in a drawer', newestBy: 'Newest by {x}',
  },
  he: {
    dashboard: 'לוח בקרה', xByY: '{x} לפי {y}', xByYAndZ: '{x} לפי {y} ו{z}', recentX: '{x} – אחרונים', xOverTime: '{x} לאורך זמן',
    xReport: 'דוח {x}', total: 'סך הכול', aggSum: 'סך {x}', aggAvg: '{x} ממוצע', aggMin: '{x} מינימלי',
    aggMax: '{x} מקסימלי', viewAll: 'הצג הכל', back: 'חזרה', exportCsv: 'ייצוא ל-CSV', newX: '{x} חדש',
    xDetails: 'פרטי {x}', search: 'חיפוש…', filters: 'מסננים', trueLabel: 'כן', falseLabel: 'לא',
    count: 'כמות', startPage: 'דף פתיחה', stepX: 'שלב {x}', review: 'סקירה', next: 'הבא', save: 'שמירה', refresh: 'רענון', topXByY: '{x} מובילים לפי {y}', vsPrevious: 'לעומת התקופה הקודמת',
    percentOfTarget: '{x}% מהיעד', periodAll: 'כל הזמן', period7d: '7 הימים האחרונים',
    period30d: '30 הימים האחרונים', period90d: '90 הימים האחרונים', periodYtd: 'מתחילת השנה',
    period12m: '12 החודשים האחרונים',
    perPage: '{n} בעמוד', opensRecord: 'שורה נפתחת בעמוד שלה', opensDrawer: 'שורה נפתחת במגירה', newestBy: 'החדשים לפי {x}',
  },
} as const

type StringKey = keyof typeof STRINGS.en

function translator(locale: 'en' | 'he') {
  const table = STRINGS[locale]
  return (key: StringKey, vars: Record<string, string> = {}) =>
    table[key].replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`)
}
type T = ReturnType<typeof translator>

const PERIOD_KEYS = {
  all: 'periodAll', '7d': 'period7d', '30d': 'period30d', '90d': 'period90d', ytd: 'periodYtd', '12m': 'period12m',
} as const

/** The Material Symbol that stands in for a page's (lucide) nav icon. */
export function navSymbol(page: FullstackPageDef): string {
  const icon = page.icon && page.icon in NAV_ICONS ? page.icon : DEFAULT_NAV_ICON[page.type as FullstackPageType]
  return icon ? NAV_ICONS[icon].symbol : 'web_asset'
}

// ── Sample data ─────────────────────────────────────────────────────────────

/** A small deterministic generator (mulberry32 over a string hash). */
function seeded(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const between = (rand: () => number, lo: number, hi: number) => Math.round(lo + rand() * (hi - lo))

function formatNumber(n: number, locale: 'en' | 'he'): string {
  return new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-US', { maximumFractionDigits: 1 }).format(n)
}

/** The rough size of one value of an aggregated field — a count is small, a sum of money is not. */
function magnitude(agg: FullstackAgg | undefined, field: FullstackFieldDef | undefined): [number, number] {
  if (!agg || agg === 'count') return [4, 60]
  const lo = field?.min != null ? Number(field.min) : 10
  const hi = field?.max != null ? Number(field.max) : field?.type === 'BIG_DECIMAL' ? 900 : 120
  const [a, b] = [Number.isFinite(lo) ? lo : 10, Number.isFinite(hi) && hi > lo ? hi : lo + 100]
  return agg === 'sum' ? [a * 20 + 50, b * 20 + 100] : [a, b]
}

function sampleCell(f: FullstackFieldDef, row: number, t: T): string {
  if (f.primaryKey) return f.type === 'UUID' ? `3f2a…${row}` : String(row)
  switch (f.type) {
    case 'LONG': case 'INTEGER': return String(((row * 37) % 90) + 3)
    case 'BIG_DECIMAL': return `${((row * 173) % 900) + 12}.50`
    case 'BOOLEAN': return row % 2 ? t('trueLabel') : t('falseLabel')
    case 'LOCAL_DATE': return `2026-0${(row % 9) + 1}-1${row % 9}`
    case 'LOCAL_DATE_TIME': return `2026-0${(row % 9) + 1}-1${row % 9} 09:${10 + row}`
    case 'ENUM': {
      const values = f.enumValues ?? []
      return values.length ? enumLabel(f, values[(row - 1) % values.length]) : '—'
    }
    case 'UUID': return `3f2a…${row}`
    default: return `${fieldLabel(f)} ${row}`
  }
}

/** The field the generated app labels a row with: the first non-key string (EntityScaffoldContext). */
function labelFieldOf(e: FullstackEntityDef): FullstackFieldDef | undefined {
  return e.fields.find(f => !f.primaryKey && (f.type === 'STRING' || f.type === 'TEXT'))
}

function rowLabel(e: FullstackEntityDef, row: number, singular: string, t: T): string {
  const f = labelFieldOf(e)
  return f ? sampleCell(f, row, t) : `${singular} #${row}`
}

// ── Builder ──────────────────────────────────────────────────────────────────

const MAX_COLUMNS = 5
const SAMPLE_ROWS = 3

export function buildLayoutPreview(
  pages: FullstackPageDef[],
  entities: FullstackEntityDef[],
  ctx: LayoutPreviewContext,
): LayoutPreview {
  const t = translator(ctx.locale)
  const named = entities.filter(e => e.name.trim())
  const byLower = new Map(named.map(e => [e.name.trim().toLowerCase(), e]))
  const entityOf = (name: string | undefined) => (name ? byLower.get(name.trim().toLowerCase()) : undefined)
  const labels = (e: FullstackEntityDef) => {
    const ui = buildUiPreview(e, { projectOpts: ctx.projectOpts, entities: named })
    return { singular: ui.title, plural: ui.titlePlural, ui }
  }
  const fieldOf = (e: FullstackEntityDef, name: string | undefined) => (name ? e.fields.find(f => f.name === name) : undefined)
  const aggTitle = (agg: FullstackAgg, field: FullstackFieldDef | undefined) => {
    const x = field ? fieldLabel(field) : '?'
    return t(agg === 'sum' ? 'aggSum' : agg === 'avg' ? 'aggAvg' : agg === 'min' ? 'aggMin' : 'aggMax', { x })
  }

  /** How a list page opens (its presentation), when it sets any of it. */
  interface ListOpening { columns?: string[]; view?: FullstackListView; sort?: FullstackListSort; detail?: FullstackListDetail; pageSize?: number }

  function table(e: FullstackEntityDef, presetFilter?: Record<string, string>, hideRelation?: string, opening: ListOpening = {}): PreviewTable {
    const { plural, singular, ui } = labels(e)
    const cells: { key: string; label: string; value: (row: number) => string }[] = e.fields.map(f => ({
      key: f.name,
      label: fieldLabel(f),
      value: (row: number) => {
        const preset = presetFilter?.[f.name]
        if (preset != null) return f.type === 'ENUM' ? enumLabel(f, preset) : preset === 'true' ? t('trueLabel') : t('falseLabel')
        return sampleCell(f, row, t)
      },
    }))
    for (const r of e.relations ?? []) {
      if (!r.fieldName.trim() || r.fieldName === hideRelation) continue
      const target = entityOf(r.targetEntity)
      cells.push({
        key: r.fieldName,
        label: humanize(r.fieldName),
        value: row => (target ? rowLabel(target, row, labels(target).singular, t) : `#${row}`),
      })
    }
    if (auditOn(e, ctx.projectOpts)) {
      cells.push(
        { key: 'createdAt', label: 'Created', value: row => `2026-0${Math.min(9, row + 2)}-1${row}` },
        { key: 'updatedAt', label: 'Updated', value: row => `2026-0${Math.min(9, row + 3)}-0${row}` },
      )
    }
    // A page that names its columns shows exactly those, in that order; otherwise the first few.
    const shown = opening.columns
      ? opening.columns.flatMap(k => cells.filter(c => c.key === k)).slice(0, MAX_COLUMNS)
      : cells.slice(0, MAX_COLUMNS)
    const view = opening.view ?? enabledListViews(e)[0]
    const laneField = e.fields.find(f => f.type === 'ENUM') ?? e.fields.find(f => f.type === 'BOOLEAN')
    const lanes = view !== 'kanban' || !laneField ? []
      : laneField.type === 'ENUM' ? (laneField.enumValues ?? []).slice(0, 3).map(v => enumLabel(laneField, v))
        : [t('trueLabel'), t('falseLabel')]
    const laneCell = cells.find(c => c.key === laneField?.name)
    const rowLanes = lanes.length === 0 || !laneCell ? [] : Array.from({ length: SAMPLE_ROWS }, (_, i) => lanes.indexOf(laneCell.value(i + 1)))
    const sortCell = opening.sort ? cells.find(c => c.key === opening.sort!.field) : undefined
    return {
      title: plural,
      columns: shown.map(c => c.label),
      rows: Array.from({ length: SAMPLE_ROWS }, (_, i) => shown.map(c => c.value(i + 1))),
      view,
      lanes,
      rowLanes,
      sort: opening.sort ? `${sortCell?.label ?? opening.sort.field} ${opening.sort.dir === 'desc' ? '↓' : '↑'}` : null,
      showSearch: ui.showSearch,
      filters: ui.filters.filter(label => !hideRelation || label !== humanize(hideRelation)),
      presetChips: presetChips(e, presetFilter),
      sidePane: opening.detail === 'side' ? cells.slice(0, 5).map(c => ({ label: c.label, value: c.value(1) })) : null,
      newLabel: ui.canCreate ? t('newX', { x: singular }) : null,
      hasExport: ui.hasExport,
      footer: [
        t('perPage', { n: String(opening.pageSize ?? 20) }),
        // Absent: the record page when the entity has one, else the drawer (the side pane is drawn).
        opening.detail === 'side' ? null
          : opening.detail === 'record' || (opening.detail == null && hasRecordPage(e)) ? t('opensRecord') : t('opensDrawer'),
      ].filter(Boolean).join(' · '),
    }
  }

  function recordDetails(e: FullstackEntityDef): { label: string; value: string; section?: string }[] {
    const sections = e.formSections ?? []
    if (sections.length === 0) return e.fields.slice(0, 6).map(f => ({ label: fieldLabel(f), value: sampleCell(f, 1, t) }))
    const out: { label: string; value: string; section?: string }[] = []
    for (const s of sections) {
      s.fields.forEach((name, i) => {
        const f = fieldOf(e, name)
        const r = f ? undefined : (e.relations ?? []).find(x => x.fieldName === name)
        const target = r ? entityOf(r.targetEntity) : undefined
        if (!f && !r) return
        out.push({
          label: f ? fieldLabel(f) : humanize(name),
          value: f ? sampleCell(f, 1, t) : target ? rowLabel(target, 1, labels(target).singular, t) : '—',
          ...(i === 0 && s.title ? { section: s.title } : {}),
        })
      })
    }
    return out.slice(0, 8)
  }

  function hasRecordPage(e: FullstackEntityDef): boolean {
    return pages.some(p => p.type === 'record' && sameName(p.entity, e.name))
  }

  function presetChips(e: FullstackEntityDef, presetFilter?: Record<string, string>): string[] {
    return Object.entries(presetFilter ?? {}).map(([name, value]) => {
      const f = fieldOf(e, name)
      if (!f) return `${name}: ${value}`
      const shown = f.type === 'ENUM' ? enumLabel(f, value)
        : f.type === 'BOOLEAN' ? (value === 'true' ? t('trueLabel') : t('falseLabel'))
          : describePresetValue(f, value)
      return `${fieldLabel(f)}: ${shown}`
    })
  }

  /** Group values of `field` (enum constants, or the two booleans) with sample numbers. */
  function breakdown(field: FullstackFieldDef, agg: FullstackAgg | undefined,
                     valueField: FullstackFieldDef | undefined, seed: string): PreviewBar[] {
    const rand = seeded(seed)
    const [lo, hi] = magnitude(agg, valueField)
    const keys = field.type === 'BOOLEAN'
      ? [t('trueLabel'), t('falseLabel')]
      : (field.enumValues ?? []).slice(0, 6).map(v => enumLabel(field, v))
    // The generated chart sorts largest first.
    return keys.map(label => ({ label, value: between(rand, lo, hi) })).sort((a, b) => b.value - a.value)
  }

  function series(bucket: FullstackBucket | undefined, agg: FullstackAgg | undefined,
                  valueField: FullstackFieldDef | undefined, seed: string): PreviewBar[] {
    const rand = seeded(seed)
    const [lo, hi] = magnitude(agg, valueField)
    const b = bucket ?? 'month'
    const labelsFor = b === 'year'
      ? ['2021', '2022', '2023', '2024', '2025', '2026']
      : b === 'day'
        ? ['09-01', '09-02', '09-03', '09-04', '09-05', '09-06', '09-07']
        : ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06']
    let level = between(rand, lo, hi)
    return labelsFor.map(label => {
      level = Math.max(lo, Math.min(hi, level + between(rand, -(hi - lo) / 4, (hi - lo) / 3)))
      return { label, value: level }
    })
  }

  function kpiValue(agg: FullstackAgg | undefined, valueField: FullstackFieldDef | undefined, seed: string): string {
    const rand = seeded(seed)
    const [lo, hi] = magnitude(agg, valueField)
    const n = !agg || agg === 'count' ? between(rand, 40, 900) : agg === 'sum' ? between(rand, lo * 8, hi * 8) : between(rand, lo, hi)
    return formatNumber(n, ctx.locale)
  }

  const screens: PreviewScreen[] = pages.map((page, pageIndex) => {
    const description = page.description?.trim() || undefined
    const seedBase = `${page.id}:${pageIndex}`
    switch (page.type) {
      case 'dashboard': {
        const widgets: PreviewWidget[] = (page.widgets ?? []).map((w, wi): PreviewWidget => {
          if (w.kind === 'links') {
            return {
              index: wi,
              span: Math.min(Math.max(w.span ?? defaultSpan(w.kind), 1), 4),
              filters: [],
              kind: 'links',
              title: w.title ?? '',
              tiles: (w.pages ?? []).map(id => {
                const target = pages.find(p => p.id === id)
                return target ? { label: linkLabel(target), icon: navSymbol(target) } : { label: id, icon: 'link_off' }
              }),
            }
          }
          if (w.kind === 'text') {
            return {
              index: wi,
              span: Math.min(Math.max(w.span ?? defaultSpan(w.kind), 1), 4),
              filters: [],
              kind: 'text',
              title: w.title ?? '',
              paragraphs: (w.text ?? '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean),
            }
          }
          const e = entityOf(w.entity)
          const seed = `${seedBase}:${wi}:${w.kind}:${w.entity}:${w.groupBy ?? ''}:${w.agg ?? ''}:${w.field ?? ''}`
          const base = {
            index: wi,
            span: Math.min(Math.max(w.span ?? defaultSpan(w.kind), 1), 4),
            filters: e ? presetChips(e, w.presetFilter) : [],
          }
          if (!e) return { ...base, kind: 'broken', title: w.title || w.entity || '?', message: `No entity “${w.entity}”` }
          const { plural } = labels(e)
          if (w.kind === 'list') {
            const tbl = table(e, w.presetFilter, undefined, { columns: w.columns, sort: w.sort })
            return { ...base, filters: [], kind: 'list', title: w.title || plural, table: { ...tbl, rows: tbl.rows.slice(0, Math.min(w.limit ?? 10, 4)) } }
          }
          const reduces = !!w.agg && w.agg !== 'count'
          const valueField = reduces ? fieldOf(e, w.field) : undefined
          const measured = reduces ? aggTitle(w.agg!, valueField) : plural
          switch (w.kind) {
            case 'kpi': {
              const change = seeded(`${seed}:change`)() * 40 - 12
              return {
                ...base, kind: 'kpi', title: w.title || measured, value: kpiValue(w.agg, valueField, seed),
                delta: w.compare ? `${change >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(change))}%` : null,
              }
            }
            case 'progress': {
              const target = Number(w.target)
              const percent = Math.round(20 + seeded(seed)() * 75)
              return {
                ...base, kind: 'progress', title: w.title || measured,
                value: Number.isFinite(target) && target > 0 ? formatNumber(Math.round((target * percent) / 100), ctx.locale) : '—',
                target: Number.isFinite(target) && target > 0 ? formatNumber(target, ctx.locale) : '?',
                percent,
              }
            }
            case 'top': {
              const by = w.groupBy ?? defaultTopGroupBy(e)
              const relation = (e.relations ?? []).find(r => r.fieldName === by && r.type === 'MANY_TO_ONE')
              const limit = Math.min(Math.max(w.limit ?? 5, 1), 20)
              const rand = seeded(seed)
              const [lo, hi] = magnitude(w.agg, valueField)
              let rows: PreviewBar[]
              let groupLabel: string
              if (relation) {
                const target = entityOf(relation.targetEntity)
                groupLabel = humanize(relation.fieldName)
                rows = Array.from({ length: Math.min(limit, 5) }, (_, i) => ({
                  label: target ? rowLabel(target, i + 1, labels(target).singular, t) : `#${i + 1}`,
                  value: between(rand, lo, hi),
                }))
              } else {
                const group = fieldOf(e, by)
                if (!group) return { ...base, kind: 'broken', title: w.title || plural, message: `${e.name} has nothing to rank by` }
                groupLabel = fieldLabel(group)
                rows = breakdown(group, w.agg, valueField, seed).slice(0, limit)
              }
              return {
                ...base, kind: 'top',
                title: w.title || t('topXByY', { x: measured, y: groupLabel }),
                rows: rows.sort((a, b) => b.value - a.value),
              }
            }
            case 'bar':
            case 'donut': {
              const by = w.groupBy ?? defaultTopGroupBy(e)
              // Grouped by a relation: one bar per related record, named like a top list's rows.
              const relation = (e.relations ?? []).find(r => r.fieldName === by && r.type === 'MANY_TO_ONE')
              if (relation) {
                const target = entityOf(relation.targetEntity)
                const rand = seeded(seed)
                const [lo, hi] = magnitude(w.agg, valueField)
                return {
                  ...base, kind: w.kind,
                  title: w.title || t('xByY', { x: measured, y: humanize(relation.fieldName) }),
                  bars: Array.from({ length: 5 }, (_, i) => ({
                    label: target ? rowLabel(target, i + 1, labels(target).singular, t) : `#${i + 1}`,
                    value: between(rand, lo, hi),
                  })),
                }
              }
              const group = fieldOf(e, by)
              if (!group) return { ...base, kind: 'broken', title: w.title || plural, message: `${e.name} has nothing to group by` }
              return {
                ...base, kind: w.kind,
                title: w.title || t('xByY', { x: measured, y: fieldLabel(group) }),
                bars: breakdown(group, w.agg, valueField, seed),
              }
            }
            case 'stacked': {
              const by = w.groupBy ?? defaultBarGroupBy(e)
              const group = fieldOf(e, by)
              const split = fieldOf(e, w.series ?? defaultSeries(e, by))
              if (!group || !split || group === split) {
                return { ...base, kind: 'broken', title: w.title || plural, message: `${e.name} needs two enum or boolean fields` }
              }
              const seriesLabels = breakdown(split, undefined, undefined, `${seed}:series`).map(b => b.label)
              const rows = breakdown(group, w.agg, valueField, seed).map((b, ri) => {
                const rand = seeded(`${seed}:${ri}`)
                const weights = seriesLabels.map(() => 0.2 + rand())
                const sum = weights.reduce((a, x) => a + x, 0)
                return { label: b.label, parts: weights.map(x => (b.value * x) / sum) }
              })
              return {
                ...base, kind: 'stacked',
                title: w.title || t('xByYAndZ', { x: measured, y: fieldLabel(group), z: fieldLabel(split) }),
                rows,
                series: seriesLabels,
              }
            }
            case 'line': {
              const date = fieldOf(e, w.groupBy ?? defaultLineGroupBy(e))
              if (!date) return { ...base, kind: 'broken', title: w.title || plural, message: `${e.name} has no date field` }
              return {
                ...base, kind: 'line',
                title: w.title || t('xOverTime', { x: measured }),
                points: series(w.bucket, w.agg, valueField, seed),
              }
            }
            case 'recent': {
              const limit = Math.min(Math.max(w.limit ?? 5, 1), 20)
              const { singular } = labels(e)
              // Newest first: the generated list sorts by key, descending.
              return {
                ...base, kind: 'recent',
                title: w.title || t('recentX', { x: plural }),
                by: t('newestBy', { x: (() => { const f = fieldOf(e, w.sortBy); return f ? fieldLabel(f) : fieldLabel(e.fields.find(x => x.primaryKey) ?? e.fields[0]) })() }),
                rows: Array.from({ length: Math.min(limit, 5) }, (_, i) => rowLabel(e, limit - i + 20, singular, t)),
              }
            }
          }
        })
        const period = page.dateRange ? t(PERIOD_KEYS[page.dateRange]) : null
        const every = page.refreshSeconds == null ? null
          : page.refreshSeconds < 60 ? `${page.refreshSeconds}s` : `${Math.round(page.refreshSeconds / 60)}m`
        const refresh = (page.widgets ?? []).some(reloads) ? { label: t('refresh'), every } : null
        return { type: 'dashboard', title: page.title || t('dashboard'), description, widgets, period, refresh }
      }
      case 'entity-list': {
        const e = entityOf(page.entity)
        if (!e) return { type: 'broken', title: page.title || page.id, message: `No entity “${page.entity ?? ''}”` }
        const tbl = table(e, page.presetFilter, undefined, { columns: page.columns, view: page.view, sort: page.sort, detail: page.detail, pageSize: page.pageSize })
        return { type: 'entity-list', title: page.title || tbl.title, description, table: tbl }
      }
      case 'tabs': {
        const tabs = (page.tabs ?? []).map(tab => {
          const target = pages.findIndex(p => p.id === tab.page)
          const targetPage = target >= 0 ? pages[target] : undefined
          return { label: tab.title || (targetPage ? defaultTitle(targetPage) : tab.page || '?'), target: target >= 0 ? target : null }
        })
        return { type: 'tabs', title: page.title || page.id, description, tabs }
      }
      case 'master-detail': {
        const parent = entityOf(page.parent)
        const child = entityOf(page.child)
        if (!parent || !child) {
          return { type: 'broken', title: page.title || page.id, message: `Pick a parent and a child entity` }
        }
        const via = page.via ?? relationsTo(child, parent.name)[0]
        const { plural: parentPlural, singular: parentSingular } = labels(parent)
        return {
          type: 'master-detail',
          title: page.title || parentPlural,
          description,
          parentTitle: parentPlural,
          parentItems: Array.from({ length: 5 }, (_, i) => rowLabel(parent, i + 1, parentSingular, t)),
          child: table(child, undefined, via, { columns: page.columns, sort: page.sort }),
          childTitle: labels(child).plural,
          parentDetails: page.showParent
            ? parent.fields.filter(f => !f.primaryKey).slice(0, 4).map(f => ({ label: fieldLabel(f), value: sampleCell(f, 1, t) }))
            : null,
        }
      }
      case 'record': {
        const e = entityOf(page.entity)
        if (!e) return { type: 'broken', title: page.title || page.id, message: `No entity “${page.entity ?? ''}”` }
        const { singular } = labels(e)
        const related = page.childTabs?.map(childTabEntity) ?? named.filter(c => relationsTo(c, e.name).length > 0).map(c => c.name).slice(0, 5)
        const home = pages.find(p => !p.hidden && ((p.type === 'entity-list' && sameName(p.entity, e.name))
          || (p.type === 'master-detail' && (sameName(p.parent, e.name) || sameName(p.child, e.name)))))
        return {
          type: 'record',
          title: page.title || singular,
          description,
          heading: rowLabel(e, 1, singular, t),
          back: home ? t('back') : null,
          tabs: [t('xDetails', { x: singular }), ...related.map(name => {
            const c = entityOf(name)
            return c ? labels(c).plural : name
          })],
          details: recordDetails(e),
          tabTables: (page.childTabs ?? related).map(tab => {
            const name = typeof tab === 'string' ? tab : childTabEntity(tab)
            const c = entityOf(name)
            if (!c) return null
            const via = (typeof tab === 'string' ? undefined : childTabVia(tab)) ?? relationsTo(c, e.name)[0]
            return table(c, undefined, via, typeof tab === 'string' ? {} : { columns: tab.columns, sort: tab.sort })
          }),
          // The generator's default: a row count per related tab.
          stats: (page.headerStats ?? related.slice(0, 4).map(child => ({ child } as { child: string; agg?: FullstackAgg; field?: string; title?: string })))
            .map((s, si) => {
              const c = entityOf(s.child)
              const reduces = !!s.agg && s.agg !== 'count'
              const valueField = c && reduces ? fieldOf(c, s.field) : undefined
              return {
                title: s.title || (reduces ? aggTitle(s.agg!, valueField) : c ? labels(c).plural : s.child),
                value: kpiValue(s.agg, valueField, `${seedBase}:stat:${si}`),
              }
            }),
        }
      }
      case 'wizard': {
        const e = entityOf(page.entity)
        if (!e) return { type: 'broken', title: page.title || page.id, message: `No entity “${page.entity ?? ''}”` }
        const { singular } = labels(e)
        const steps = page.steps ?? defaultWizardSteps(e)
        const labelOf = (name: string) => {
          const f = fieldOf(e, name)
          return f ? fieldLabel(f) : humanize(name)
        }
        return {
          type: 'wizard',
          title: page.title || t('newX', { x: singular }),
          description,
          steps: [...steps.map((s, i) => s.title || t('stepX', { x: String(i + 1) })), t('review')],
          fields: (steps[0]?.fields ?? []).map(labelOf),
          stepFields: steps.map(st => st.fields.map(labelOf)),
          review: steps.flatMap(st => st.fields).map(name => {
            const f = fieldOf(e, name)
            const r = (e.relations ?? []).find(x => x.fieldName === name)
            const target = r ? entityOf(r.targetEntity) : undefined
            return {
              label: labelOf(name),
              value: f ? sampleCell(f, 1, t) : target ? rowLabel(target, 1, labels(target).singular, t) : '—',
            }
          }),
          save: t('save'),
          next: t('next'),
          back: t('back'),
        }
      }
      case 'report': {
        const e = entityOf(page.entity)
        if (!e) return { type: 'broken', title: page.title || page.id, message: `No entity “${page.entity ?? ''}”` }
        const { plural, ui } = labels(e)
        // Each chart: its bars (or points), title and headings, from the same seeded sample data.
        const drawn = reportCharts(page).map((chart, ci) => {
          const by = chart.groupBy ?? defaultReportGroupBy(e)
          // Grouped by a relation: one bar per related record, named like a top list's rows.
          const relation = (e.relations ?? []).find(r => r.fieldName === by && r.type === 'MANY_TO_ONE')
          const group = relation ? undefined : fieldOf(e, by)
          const reduces = !!chart.agg && chart.agg !== 'count'
          const valueField = reduces ? fieldOf(e, chart.field) : undefined
          const measured = reduces ? aggTitle(chart.agg!, valueField) : plural
          const line = !!group && dateFields(e).some(f => f.name === group.name)
          const seed = `${seedBase}:${ci}:${chart.groupBy ?? ''}:${chart.agg ?? ''}:${chart.field ?? ''}:${chart.bucket ?? ''}`
          let bars: PreviewBar[]
          if (relation) {
            const target = entityOf(relation.targetEntity)
            const rand = seeded(seed)
            const [lo, hi] = magnitude(chart.agg, valueField)
            bars = Array.from({ length: 5 }, (_, i) => ({
              label: target ? rowLabel(target, i + 1, labels(target).singular, t) : `#${i + 1}`,
              value: between(rand, lo, hi),
            }))
          } else {
            bars = !group ? [] : line ? series(chart.bucket, chart.agg, valueField, seed) : breakdown(group, chart.agg, valueField, seed)
          }
          const groupLabel = relation ? humanize(relation.fieldName) : group ? fieldLabel(group) : undefined
          const title = groupLabel ? (line ? t('xOverTime', { x: measured }) : t('xByY', { x: measured, y: groupLabel })) : measured
          // The totals table: the chart's own choice, else the first chart only.
          return { groupLabel, reduces, measured, line, bars, title, table: chart.table ?? ci === 0 }
        })
        const { groupLabel, reduces, measured, line, bars } = drawn[0]
        const csv = (e.opts?.csvExport ?? ctx.projectOpts.includes('csvExport'))
        return {
          type: 'report',
          title: page.title || t('xReport', { x: plural }),
          description,
          filters: ui.filters,
          presetChips: presetChips(e, page.presetFilter),
          chartTitle: drawn[0].title,
          chart: { line, bars },
          chartTable: drawn[0].table,
          moreCharts: drawn.slice(1).map(c => ({ title: c.title, line: c.line, bars: c.bars, table: c.table })),
          groupLabel: groupLabel ?? '—',
          valueLabel: reduces ? measured : t('count'),
          totalLabel: t('total'),
          exportLabel: csv ? t('exportCsv') : null,
        }
      }
    }
    switch (page.type) {
      case 'calendar': {
        const e = entityOf(page.entity)
        if (!e) return { type: 'broken', title: page.title || page.id, message: `No entity “${page.entity ?? ''}”` }
        const modes = (page.modes ?? ['month']).map(m => CALENDAR_MODES.find(c => c.value === m)?.label ?? m)
        const long = page.endField != null
        const days = Array.from({ length: 35 }, (_, i) => {
          const day = i + 1
          // A few sample rows, spread over the month; with an end date they run over two days.
          const starts = [3, 9, 9, 16, 22, 27].map((d, n) => ({ d, n: n + 1 }))
          const events = starts.filter(s => day === s.d || (long && day === s.d + 1)).map(s => rowLabel(e, s.n, labels(e).singular, t))
          return { day: ((day - 1) % 30) + 1, events }
        })
        return { type: 'calendar', title: page.title || labels(e).plural, description, modes, days, creates: !e.readOnly }
      }
      case 'board': {
        const e = entityOf(page.entity)
        if (!e) return { type: 'broken', title: page.title || page.id, message: `No entity “${page.entity ?? ''}”` }
        const lane = page.laneField ?? defaultLaneField(e)
        const laneField = e.fields.find(f => f.name === lane)
        const values = page.lanes ?? laneValues(e, lane)
        const cardNames = (page.cardFields ?? defaultCardFields(e, lane)).filter(n => cardFieldOptions(e).includes(n))
        const valueOf = (name: string, row: number) => {
          const f = e.fields.find(x => x.name === name)
          return f ? sampleCell(f, row, t) : `#${row}`
        }
        let row = 0
        const lanes = values.map((v, li) => {
          const count = [4, 2, 3, 1, 5][li % 5]
          const cards = Array.from({ length: Math.min(count, 2) }, () => {
            row += 1
            const [head, ...rest] = cardNames
            return { heading: head ? valueOf(head, row) : `#${row}`, details: rest.map(n => valueOf(n, row)) }
          })
          const label = laneField?.type === 'BOOLEAN' ? (v === 'true' ? t('trueLabel') : t('falseLabel')) : laneField ? enumLabel(laneField, v) : v
          return { label, count, limit: page.wipLimits?.[v] ?? null, cards }
        })
        return { type: 'board', title: page.title || labels(e).plural, description, lanes }
      }
      case 'content':
        return { type: 'content', title: page.title || page.id, description, blocks: parseContent(page.body ?? '') }
      case 'import': {
        const e = entityOf(page.entity)
        if (!e) return { type: 'broken', title: page.title || page.id, message: `No entity “${page.entity ?? ''}”` }
        const fields = [
          ...e.fields.filter(f => !(f.primaryKey && f.generated) && !f.readOnly).map(f => ({ label: fieldLabel(f), required: Boolean(f.required) || Boolean(f.primaryKey) })),
          ...(e.relations ?? []).filter(r => r.type === 'MANY_TO_ONE').map(r => ({ label: humanize(r.fieldName), required: Boolean(r.required) })),
        ]
        return { type: 'import', title: page.title || `Import ${labels(e).plural}`, description, entity: labels(e).plural, fields }
      }
      case 'search': {
        const names = page.entities ?? defaultSearchEntities(named)
        const groups = names.map(entityOf).filter((e): e is FullstackEntityDef => e != null).map((e, gi) => ({
          title: labels(e).plural,
          total: [12, 4, 7, 2][gi % 4],
          rows: Array.from({ length: Math.min(page.perEntity ?? 5, 3) }, (_, i) => rowLabel(e, i + 1, labels(e).singular, t)),
        }))
        return { type: 'search', title: page.title || t('search').replace('…', ''), description, words: 'acme', groups, header: Boolean(page.shellSearch) }
      }
    }
    return { type: 'broken', title: page.id, message: `Unknown page type “${String((page as FullstackPageDef).type)}”` }
  })

  function defaultTitle(p: FullstackPageDef): string {
    if (p.title) return p.title
    const e = entityOf(p.type === 'master-detail' ? p.parent : p.entity)
    switch (p.type) {
      case 'dashboard': return t('dashboard')
      case 'entity-list': return e ? labels(e).plural : p.entity ?? p.id
      case 'master-detail': return e ? labels(e).plural : p.parent ?? p.id
      case 'report': return e ? t('xReport', { x: labels(e).plural }) : p.id
      case 'wizard': return e ? t('newX', { x: labels(e).singular }) : p.id
      case 'record': return e ? labels(e).singular : p.id
      case 'calendar':
      case 'board': return e ? labels(e).plural : p.id
      case 'import': return e ? `Import ${labels(e).plural}` : p.id
      case 'search': return t('search').replace('…', '')
      default: return p.id
    }
  }

  const startIndex = pages.findIndex(p => !p.hidden && p.type !== 'record')
  const sections: PreviewNavSection[] = navSections(pages).map(section => ({
    group: section.group,
    items: section.items.map(index => ({
      index,
      label: screens[index]?.title ?? defaultTitle(pages[index]),
      icon: navSymbol(pages[index]),
      start: index === startIndex,
      warning: ctx.warnPages?.has(index) ?? false,
      roles: pages[index].roles ?? [],
    })),
  }))

  return {
    // The generated index.html turns right-to-left on the rtl opt, not on the chrome language.
    rtl: ctx.projectOpts.includes('rtl'),
    nav: sections.flatMap(section => section.items),
    sections,
    screens,
    strings: { viewAll: t('viewAll'), search: t('search'), filters: t('filters'), total: t('total'), startPage: t('startPage') },
  }
}

function sameName(a: string | undefined, b: string | undefined): boolean {
  return (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase() && Boolean(a?.trim())
}


// ── Editor ↔ preview linking ────────────────────────────────────────────────

/** A page, and optionally one control on it — the same keys validatePages reports errors under.
 *  A click in the preview asks the editor to open one; an editor part hovered lights one. */
export interface EditTarget { page: number; control?: string }

/**
 * The preview part an editor control belongs to, so the two sides agree through one rule: the
 * editor's `data-control` keys are finer than the preview's parts (a widget card holds
 * `widget.2.presetFilter.status`, a report chart card `chart2.bucket`, a record's tiles
 * `headerStat.1`). `undefined` is the page itself — its nav item.
 */
export function previewPartOf(control: string | undefined): string | undefined {
  if (!control) return undefined
  const [head, second] = control.split('.')
  if (head === 'widget' && second != null) return `widget.${second}`
  if (head === 'headerStat' || head === 'headerStats') return 'headerStats'
  if (head === 'step' || head === 'steps') return 'steps'
  if (head === 'childTabs') return 'childTabs'
  if (head === 'tab' && second != null) return `tab.${second}`
  if (/^chart\d*$/.test(head)) return head
  if (head === 'description') return 'title'
  if (head === 'via') return 'child'
  // A list page draws its column headings, sort and side pane as parts of their own.
  if (head === 'columns' || head === 'sort' || head === 'detail') return head
  if (head === 'presetFilter' || head === 'view' || head === 'pageSize') return 'entity'
  if (head === 'id' || head === 'group' || head === 'icon' || head === 'roles') return undefined
  return head
}

/** Whether a hovered editor part (`hover`) is the preview part drawn for `target`. */
export function highlights(hover: EditTarget | null | undefined, target: EditTarget): boolean {
  return hover != null && hover.page === target.page && previewPartOf(hover.control) === previewPartOf(target.control)
}
