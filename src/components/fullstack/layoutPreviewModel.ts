import type { FullstackAgg, FullstackBucket, FullstackEntityDef, FullstackFieldDef, FullstackPageDef, FullstackPageType } from '../../types'
import { enumLabel } from './enumLabels'
import { humanize } from './naming'
import {
  defaultBarGroupBy,
  defaultLineGroupBy,
  defaultReportGroupBy,
  dateFields,
  relationsTo,
} from './pageLayout'
import { buildUiPreview, fieldLabel } from './uiPreview'

/**
 * View-model for the Fullstack tab's layout preview: a wireframe of the app the page layout
 * generates — the nav in order, and each screen as the templates draw it (ScreenDashboard,
 * ScreenEntityList, ScreenTabs, ScreenMasterDetail, ScreenRecord, ScreenReport). Titles follow
 * the backend defaults (EntityScaffoldContext.putPageContext) in the chosen chrome language;
 * the numbers and rows are sample data made up from the model, seeded by name so they stay put
 * between renders. Pure so it can be unit tested; LayoutPreview.tsx only draws it.
 */

export interface LayoutPreviewContext {
  locale: 'en' | 'he'
  /** Project-wide scaffold opts (csvExport, audit, bulk…) — the list pages' toolbars follow them. */
  projectOpts: string[]
}

export interface PreviewNavItem {
  /** Index into the layout's pages. */
  index: number
  label: string
  icon: string
  start: boolean
}

export interface PreviewBar { label: string; value: number }

export type PreviewWidget =
  | { kind: 'kpi'; index: number; title: string; value: string }
  | { kind: 'bar'; index: number; title: string; bars: PreviewBar[] }
  | { kind: 'line'; index: number; title: string; points: PreviewBar[] }
  | { kind: 'recent'; index: number; title: string; rows: string[] }
  | { kind: 'broken'; index: number; title: string; message: string }

export interface PreviewTable {
  /** The entity's plural label. */
  title: string
  columns: string[]
  rows: string[][]
  showSearch: boolean
  filters: string[]
  /** "Status: Open" chips for the filters the page opens with. */
  presetChips: string[]
  newLabel: string | null
  hasExport: boolean
}

export type PreviewScreen =
  | { type: 'dashboard'; title: string; description?: string; widgets: PreviewWidget[] }
  | { type: 'entity-list'; title: string; description?: string; table: PreviewTable }
  | { type: 'tabs'; title: string; description?: string; tabs: { label: string; target: number | null }[] }
  | { type: 'master-detail'; title: string; description?: string; parentTitle: string; parentItems: string[]; child: PreviewTable; childTitle: string }
  | { type: 'record'; title: string; description?: string; heading: string; back: string | null; tabs: string[]; details: { label: string; value: string }[] }
  | {
    type: 'report'
    title: string
    description?: string
    filters: string[]
    presetChips: string[]
    chartTitle: string
    chart: { line: boolean; bars: PreviewBar[] }
    groupLabel: string
    valueLabel: string
    totalLabel: string
    exportLabel: string | null
  }
  | { type: 'broken'; title: string; message: string }

export interface LayoutPreview {
  rtl: boolean
  nav: PreviewNavItem[]
  /** One per page, index-aligned with the layout. */
  screens: PreviewScreen[]
  strings: { viewAll: string; search: string; filters: string; total: string; startPage: string }
}

// ── Chrome strings (a subset of i18n-strings.ts.mustache) ──────────────────

const STRINGS = {
  en: {
    dashboard: 'Dashboard', xByY: '{x} by {y}', recentX: 'Recent {x}', xOverTime: '{x} over time',
    xReport: '{x} report', total: 'Total', aggSum: 'Total {x}', aggAvg: 'Average {x}', aggMin: 'Lowest {x}',
    aggMax: 'Highest {x}', viewAll: 'View all', back: 'Back', exportCsv: 'Export CSV', newX: 'New {x}',
    xDetails: '{x} details', search: 'Search…', filters: 'Filters', trueLabel: 'True', falseLabel: 'False',
    count: 'Count', startPage: 'Start page',
  },
  he: {
    dashboard: 'לוח בקרה', xByY: '{x} לפי {y}', recentX: '{x} – אחרונים', xOverTime: '{x} לאורך זמן',
    xReport: 'דוח {x}', total: 'סך הכול', aggSum: 'סך {x}', aggAvg: '{x} ממוצע', aggMin: '{x} מינימלי',
    aggMax: '{x} מקסימלי', viewAll: 'הצג הכל', back: 'חזרה', exportCsv: 'ייצוא ל-CSV', newX: '{x} חדש',
    xDetails: 'פרטי {x}', search: 'חיפוש…', filters: 'מסננים', trueLabel: 'כן', falseLabel: 'לא',
    count: 'כמות', startPage: 'דף פתיחה',
  },
} as const

type StringKey = keyof typeof STRINGS.en

function translator(locale: 'en' | 'he') {
  const table = STRINGS[locale]
  return (key: StringKey, vars: Record<string, string> = {}) =>
    table[key].replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`)
}
type T = ReturnType<typeof translator>

export const PAGE_NAV_ICON: Record<FullstackPageType, string> = {
  dashboard: 'dashboard',
  'entity-list': 'table_rows',
  tabs: 'tab',
  'master-detail': 'vertical_split',
  record: 'article',
  report: 'monitoring',
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

  function table(e: FullstackEntityDef, presetFilter?: Record<string, string>, hideRelation?: string): PreviewTable {
    const { plural, singular, ui } = labels(e)
    const cells: { label: string; value: (row: number) => string }[] = e.fields.map(f => ({
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
        label: humanize(r.fieldName),
        value: row => (target ? rowLabel(target, row, labels(target).singular, t) : `#${row}`),
      })
    }
    const shown = cells.slice(0, MAX_COLUMNS)
    return {
      title: plural,
      columns: shown.map(c => c.label),
      rows: Array.from({ length: SAMPLE_ROWS }, (_, i) => shown.map(c => c.value(i + 1))),
      showSearch: ui.showSearch,
      filters: ui.filters.filter(label => !hideRelation || label !== humanize(hideRelation)),
      presetChips: presetChips(e, presetFilter),
      newLabel: ui.canCreate ? t('newX', { x: singular }) : null,
      hasExport: ui.hasExport,
    }
  }

  function presetChips(e: FullstackEntityDef, presetFilter?: Record<string, string>): string[] {
    return Object.entries(presetFilter ?? {}).map(([name, value]) => {
      const f = fieldOf(e, name)
      if (!f) return `${name}: ${value}`
      const shown = f.type === 'ENUM' ? enumLabel(f, value) : value === 'true' ? t('trueLabel') : t('falseLabel')
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
          const e = entityOf(w.entity)
          const seed = `${seedBase}:${wi}:${w.kind}:${w.entity}:${w.groupBy ?? ''}:${w.agg ?? ''}:${w.field ?? ''}`
          if (!e) return { kind: 'broken', index: wi, title: w.title || w.entity || '?', message: `No entity “${w.entity}”` }
          const { plural } = labels(e)
          const reduces = !!w.agg && w.agg !== 'count'
          const valueField = reduces ? fieldOf(e, w.field) : undefined
          const measured = reduces ? aggTitle(w.agg!, valueField) : plural
          switch (w.kind) {
            case 'kpi':
              return { kind: 'kpi', index: wi, title: w.title || measured, value: kpiValue(w.agg, valueField, seed) }
            case 'bar': {
              const group = fieldOf(e, w.groupBy ?? defaultBarGroupBy(e))
              if (!group) return { kind: 'broken', index: wi, title: w.title || plural, message: `${e.name} has nothing to group by` }
              return {
                kind: 'bar', index: wi,
                title: w.title || t('xByY', { x: measured, y: fieldLabel(group) }),
                bars: breakdown(group, w.agg, valueField, seed),
              }
            }
            case 'line': {
              const date = fieldOf(e, w.groupBy ?? defaultLineGroupBy(e))
              if (!date) return { kind: 'broken', index: wi, title: w.title || plural, message: `${e.name} has no date field` }
              return {
                kind: 'line', index: wi,
                title: w.title || t('xOverTime', { x: measured }),
                points: series(w.bucket, w.agg, valueField, seed),
              }
            }
            case 'recent': {
              const limit = Math.min(Math.max(w.limit ?? 5, 1), 20)
              const { singular } = labels(e)
              // Newest first: the generated list sorts by key, descending.
              return {
                kind: 'recent', index: wi,
                title: w.title || t('recentX', { x: plural }),
                rows: Array.from({ length: Math.min(limit, 5) }, (_, i) => rowLabel(e, limit - i + 20, singular, t)),
              }
            }
          }
        })
        return { type: 'dashboard', title: page.title || t('dashboard'), description, widgets }
      }
      case 'entity-list': {
        const e = entityOf(page.entity)
        if (!e) return { type: 'broken', title: page.title || page.id, message: `No entity “${page.entity ?? ''}”` }
        const tbl = table(e, page.presetFilter)
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
          child: table(child, undefined, via),
          childTitle: labels(child).plural,
        }
      }
      case 'record': {
        const e = entityOf(page.entity)
        if (!e) return { type: 'broken', title: page.title || page.id, message: `No entity “${page.entity ?? ''}”` }
        const { singular } = labels(e)
        const related = page.childTabs ?? named.filter(c => relationsTo(c, e.name).length > 0).map(c => c.name).slice(0, 5)
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
          details: e.fields.slice(0, 6).map(f => ({ label: fieldLabel(f), value: sampleCell(f, 1, t) })),
        }
      }
      case 'report': {
        const e = entityOf(page.entity)
        if (!e) return { type: 'broken', title: page.title || page.id, message: `No entity “${page.entity ?? ''}”` }
        const { plural, ui } = labels(e)
        const chart = page.chart ?? {}
        const group = fieldOf(e, chart.groupBy ?? defaultReportGroupBy(e))
        const reduces = !!chart.agg && chart.agg !== 'count'
        const valueField = reduces ? fieldOf(e, chart.field) : undefined
        const measured = reduces ? aggTitle(chart.agg!, valueField) : plural
        const line = !!group && dateFields(e).some(f => f.name === group.name)
        const seed = `${seedBase}:${chart.groupBy ?? ''}:${chart.agg ?? ''}:${chart.field ?? ''}:${chart.bucket ?? ''}`
        const bars = !group ? [] : line ? series(chart.bucket, chart.agg, valueField, seed) : breakdown(group, chart.agg, valueField, seed)
        const csv = (e.opts?.csvExport ?? ctx.projectOpts.includes('csvExport'))
        return {
          type: 'report',
          title: page.title || t('xReport', { x: plural }),
          description,
          filters: ui.filters,
          presetChips: presetChips(e, page.presetFilter),
          chartTitle: group ? (line ? t('xOverTime', { x: measured }) : t('xByY', { x: measured, y: fieldLabel(group) })) : measured,
          chart: { line, bars },
          groupLabel: group ? fieldLabel(group) : '—',
          valueLabel: reduces ? measured : t('count'),
          totalLabel: t('total'),
          exportLabel: csv ? t('exportCsv') : null,
        }
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
      case 'record': return e ? labels(e).singular : p.id
      default: return p.id
    }
  }

  const visible = pages.map((p, index) => ({ p, index })).filter(({ p }) => !p.hidden && p.type !== 'record')
  const nav: PreviewNavItem[] = visible.map(({ p, index }, i) => ({
    index,
    label: screens[index]?.title ?? defaultTitle(p),
    icon: PAGE_NAV_ICON[p.type] ?? 'web_asset',
    start: i === 0,
  }))

  return {
    rtl: ctx.locale === 'he',
    nav,
    screens,
    strings: { viewAll: t('viewAll'), search: t('search'), filters: t('filters'), total: t('total'), startPage: t('startPage') },
  }
}

function sameName(a: string | undefined, b: string | undefined): boolean {
  return (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase() && Boolean(a?.trim())
}

