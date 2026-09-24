import type {
  FullstackAgg,
  FullstackChartDef,
  FullstackChildTabDef,
  FullstackDateRange,
  FullstackEntityDef,
  FullstackFieldDef,
  FullstackNavIcon,
  FullstackPageDef,
  FullstackPageRole,
  FullstackPageType,
  FullstackWidgetDef,
} from '../../types'

/**
 * The frontend page layout (`pages`) model: validation, the summary lines the editor shows, and
 * the two bulk operations (seed a layout from the entities, follow an entity rename).
 *
 * The checks mirror FullstackPageValidator so a broken layout shows up here, on the offending
 * control, instead of as a 400 on Generate.
 */

export const PAGE_ID = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/
export const MAX_PAGES = 30
export const MAX_WIDGETS = 24
export const MIN_TABS = 2
export const MAX_TABS = 6
export const MAX_CHILD_TABS = MAX_TABS - 1
export const MAX_RECENT_LIMIT = 20
export const MAX_GROUP = 40
export const MAX_SPAN = 4
export const MAX_CHARTS = 4
export const MAX_STEPS = 8
export const DEFAULT_STEP_SIZE = 4
export const MAX_HEADER_STATS = 4
export const MAX_TEXT = 2000

/** What a wizard step can ask for: every field but a generated key, then the MANY_TO_ONE
 *  relations (by field name) — what the entity's form shows. */
export function askableFields(entity: FullstackEntityDef | undefined): { name: string; required: boolean; relation: boolean }[] {
  if (!entity) return []
  return [
    ...entity.fields.filter(f => f.name.trim() && !(f.primaryKey && f.generated))
      .map(f => ({ name: f.name, required: Boolean(f.required || f.primaryKey), relation: false })),
    ...(entity.relations ?? []).filter(r => r.type === 'MANY_TO_ONE' && r.fieldName.trim())
      .map(r => ({ name: r.fieldName, required: Boolean(r.required), relation: true })),
  ]
}

/** The steps a wizard gets when it names none (FullstackPageValidator): four fields to a step. */
export function defaultWizardSteps(entity: FullstackEntityDef | undefined): { title?: string; fields: string[] }[] {
  const names = askableFields(entity).map(f => f.name)
  const steps: { fields: string[] }[] = []
  for (let i = 0; i < names.length; i += DEFAULT_STEP_SIZE) steps.push({ fields: names.slice(i, i + DEFAULT_STEP_SIZE) })
  return steps
}

/** A report's charts, whichever way the page spells them (`chart` or `charts`). */
export function reportCharts(page: FullstackPageDef): FullstackChartDef[] {
  if (page.charts && page.charts.length > 0) return page.charts
  return [page.chart ?? {}]
}

/** The control key of one chart's setting: `chart.groupBy` for the first, `chart2.groupBy`… after. */
export function chartControl(index: number, key: 'groupBy' | 'bucket' | 'field'): string {
  return `${index === 0 ? 'chart' : `chart${index + 1}`}.${key}`
}

/** What a top list can rank by: a groupable field, or a MANY_TO_ONE relation (its field name). */
export function rankableKeys(entity: FullstackEntityDef | undefined): string[] {
  return [
    ...groupableFields(entity).map(f => f.name),
    ...(entity?.relations ?? []).filter(r => r.type === 'MANY_TO_ONE').map(r => r.fieldName),
  ]
}

/** What a top list ranks by when it names nothing: the first enum, else boolean, else relation. */
export function defaultTopGroupBy(entity: FullstackEntityDef | undefined): string | undefined {
  return defaultBarGroupBy(entity) ?? (entity?.relations ?? []).find(r => r.type === 'MANY_TO_ONE')?.fieldName
}

/** The dashboard period picker's options, in the order the generated picker shows them. */
export const DATE_RANGES: { value: FullstackDateRange; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'ytd', label: 'This year' },
  { value: '12m', label: 'Last 12 months' },
]

/** Grid columns a widget takes when it names none: a tile one, a chart or list two. */
export function defaultSpan(kind: FullstackWidgetDef['kind']): number {
  return kind === 'kpi' || kind === 'progress' ? 1 : 2
}

/** What a stacked chart splits by when no series is named: the next enum/boolean after `groupBy`. */
export function defaultSeries(entity: FullstackEntityDef | undefined, groupBy: string | undefined): string | undefined {
  return groupableFields(entity).find(f => f.name !== groupBy)?.name
}

/** The nav icons a page may pick (the generated app draws the lucide icon; the editor shows the
 *  Material Symbol that looks like it). */
export const NAV_ICONS: Record<FullstackNavIcon, { symbol: string; label: string }> = {
  LayoutDashboard: { symbol: 'dashboard', label: 'Dashboard' },
  Table2: { symbol: 'table', label: 'Table' },
  Layers: { symbol: 'layers', label: 'Layers' },
  PanelLeft: { symbol: 'vertical_split', label: 'Split panel' },
  BarChart3: { symbol: 'bar_chart', label: 'Chart' },
  ListChecks: { symbol: 'checklist', label: 'Checklist' },
  Users: { symbol: 'group', label: 'People' },
  ShoppingCart: { symbol: 'shopping_cart', label: 'Cart' },
  Package: { symbol: 'package_2', label: 'Package' },
  Ticket: { symbol: 'confirmation_number', label: 'Ticket' },
  Inbox: { symbol: 'inbox', label: 'Inbox' },
  Calendar: { symbol: 'calendar_month', label: 'Calendar' },
  FileText: { symbol: 'description', label: 'Document' },
  Settings: { symbol: 'settings', label: 'Settings' },
  Truck: { symbol: 'local_shipping', label: 'Truck' },
  Wallet: { symbol: 'account_balance_wallet', label: 'Wallet' },
  Building2: { symbol: 'apartment', label: 'Building' },
  Tag: { symbol: 'sell', label: 'Tag' },
  Star: { symbol: 'star', label: 'Star' },
  Wand2: { symbol: 'auto_fix_high', label: 'Wand' },
}

/** The icon a page shows in the nav when it names none (EntityScaffoldContext.putPageContext). */
export const DEFAULT_NAV_ICON: Record<FullstackPageType, FullstackNavIcon> = {
  dashboard: 'LayoutDashboard',
  'entity-list': 'Table2',
  tabs: 'Layers',
  'master-detail': 'PanelLeft',
  record: 'Table2',
  report: 'BarChart3',
  wizard: 'Wand2',
}

/** Whether a page is listed in the generated nav (a record page never is). */
export function inNav(page: FullstackPageDef): boolean {
  return !page.hidden && page.type !== 'record'
}

/**
 * The nav as the generated shell groups it: pages sharing a group gathered where the group first
 * appears, ungrouped runs as label-less sections between them. Indices point into `pages`.
 */
export function navSections(pages: FullstackPageDef[]): { group?: string; items: number[] }[] {
  const sections: { group?: string; items: number[] }[] = []
  const byGroup = new Map<string, { group?: string; items: number[] }>()
  let loose: { items: number[] } | null = null
  pages.forEach((page, index) => {
    if (!inNav(page)) return
    const group = page.group?.trim()
    if (!group) {
      if (!loose) {
        loose = { items: [] }
        sections.push(loose)
      }
      loose.items.push(index)
      return
    }
    loose = null
    let section = byGroup.get(group)
    if (!section) {
      section = { group, items: [] }
      byGroup.set(group, section)
      sections.push(section)
    }
    section.items.push(index)
  })
  return sections
}

/** What the generated app can group or preset-filter by: a filterable, non-key enum/boolean field. */
export function groupableFields(entity: FullstackEntityDef | undefined): FullstackFieldDef[] {
  return (entity?.fields ?? []).filter(f => !f.primaryKey && f.filterable !== false && (f.type === 'ENUM' || f.type === 'BOOLEAN'))
}

/** What a time series can be bucketed over: a non-key date column. */
export function dateFields(entity: FullstackEntityDef | undefined): FullstackFieldDef[] {
  return (entity?.fields ?? []).filter(f => !f.primaryKey && (f.type === 'LOCAL_DATE' || f.type === 'LOCAL_DATE_TIME'))
}

/** What the dashboard period can limit: a filterable, non-key date (the list's own date filter). */
export function filterableDateFields(entity: FullstackEntityDef | undefined): FullstackFieldDef[] {
  return dateFields(entity).filter(f => f.filterable !== false)
}

/** The date a widget's period applies to: its own, else the entity's first filterable one. */
export function widgetDateField(w: FullstackWidgetDef, entity: FullstackEntityDef | undefined): string | undefined {
  return w.dateField || filterableDateFields(entity)[0]?.name
}

/** What sum/avg/min/max can reduce: a non-key numeric column. */
export function numericFields(entity: FullstackEntityDef | undefined): FullstackFieldDef[] {
  return (entity?.fields ?? [])
    .filter(f => !f.primaryKey && (f.type === 'LONG' || f.type === 'INTEGER' || f.type === 'BIG_DECIMAL'))
}

/** What a report can group by: an enum/boolean draws bars, a date draws a line. */
export function chartableFields(entity: FullstackEntityDef | undefined): FullstackFieldDef[] {
  return [...groupableFields(entity), ...dateFields(entity)]
}

/** The entity a record page's tab lists. */
export function childTabEntity(tab: FullstackChildTabDef): string {
  return typeof tab === 'string' ? tab : tab.entity
}

/** The relation a record page's tab links through, when one is named. */
export function childTabVia(tab: FullstackChildTabDef): string | undefined {
  return typeof tab === 'string' ? undefined : tab.via
}

/** A tab entry in its shortest spelling: the bare entity unless a relation is named. */
export function childTab(entity: string, via?: string): FullstackChildTabDef {
  return via ? { entity, via } : entity
}

/** The child's MANY_TO_ONE fields pointing at `parent`, in declaration order. */
export function relationsTo(child: FullstackEntityDef | undefined, parent: string | undefined): string[] {
  if (!child || !parent) return []
  return (child.relations ?? [])
    .filter(r => r.type === 'MANY_TO_ONE' && r.targetEntity.trim().toLowerCase() === parent.trim().toLowerCase())
    .map(r => r.fieldName)
}

export interface PageLayoutValidation {
  /** Page index → control name → message, for the inline errors in the editor. */
  byPage: Record<number, Record<string, string>>
  /** Problems that belong to the layout as a whole. */
  general: string[]
  /** Everything, as sentences naming the page — what the caller counts as errors. */
  problems: string[]
  /** The same problems with where they live, so the list can jump to the offending control. */
  issues: { page?: number; field?: string; summary: string }[]
  count: number
}

interface Issue {
  page?: number
  field?: string
  /** Shown on the control. */
  message: string
  /** Shown in the problem list, naming the page. */
  summary: string
}

const singlePk = (e: FullstackEntityDef) => e.fields.filter(f => f.primaryKey).length === 1

/** What the page checks need beyond the layout: whether an LDAP auth dependency (ldap-auth-rest or ldap-auth) is selected
 *  (page roles need one). Omitted, that check is skipped. */
export interface PageLayoutContext {
  ldapAuth?: boolean
}

export const PAGE_ROLES: FullstackPageRole[] = ['ADMIN', 'USER']

export function validatePages(pages: FullstackPageDef[], entities: FullstackEntityDef[], context: PageLayoutContext = {}): PageLayoutValidation {
  const issues = collect(pages, entities)
  issues.push(...roleIssues(pages, context))
  const byPage: Record<number, Record<string, string>> = {}
  const general: string[] = []
  for (const issue of issues) {
    if (issue.page == null) general.push(issue.summary)
    else {
      const fields = (byPage[issue.page] ??= {})
      // First message per control wins: it is the one that explains the rest.
      fields[issue.field ?? 'page'] ??= issue.message
    }
  }
  return {
    byPage,
    general,
    problems: issues.map(i => i.summary),
    issues: issues.map(({ page, field, summary }) => ({ page, field, summary })),
    count: issues.length,
  }
}

/** Page roles: known values, not on the start page or on a tab, and only with ldap-auth. */
function roleIssues(pages: FullstackPageDef[], context: PageLayoutContext): Issue[] {
  const out: Issue[] = []
  const start = pages.find(p => !p.hidden && p.type !== 'record')
  const tabbed = new Set(pages.flatMap(p => (p.type === 'tabs' ? (p.tabs ?? []).map(t => t.page) : [])))
  pages.forEach((page, index) => {
    const roles = page.roles ?? []
    if (roles.length === 0) return
    const where = `“${pageLabel(page)}”`
    const add = (message: string, summary: string) => out.push({ page: index, field: 'roles', message, summary })
    if (roles.some(r => !PAGE_ROLES.includes(r))) add('unknown role', `${where} names an unknown role`)
    else if (page === start) add('the start page is open to everyone', `${where} is the start page, so it cannot be restricted to roles`)
    else if (tabbed.has(page.id)) add('restrict the tabs page instead', `${where} is a tab, so it cannot be restricted to roles`)
    else if (context.ldapAuth === false) add('needs ldap-auth-rest or ldap-auth', `${where} is restricted to roles, which need an LDAP auth dependency (ldap-auth-rest or ldap-auth)`)
  })
  return out
}

/** Flat problem sentences — the layout summary and the error count read these. */
export function pageLayoutProblems(pages: FullstackPageDef[], entities: FullstackEntityDef[]): string[] {
  return validatePages(pages, entities).problems
}

type AddIssue = (field: string, message: string, summary?: string) => void

/** The opening filters of a list or report page: equality on a filterable enum/boolean column. */
function checkPresetFilter(filter: Record<string, string> | undefined, e: FullstackEntityDef, add: AddIssue, where: string,
                           control: (field: string) => string = field => `presetFilter.${field}`): void {
  const groupable = groupableFields(e)
  for (const [field, value] of Object.entries(filter ?? {})) {
    const f = e.fields.find(x => x.name === field)
    if (!f) {
      add(control(field), `${e.name} no longer has “${field}”`,
        `${where} filters on “${field}”, which ${e.name} no longer has`)
    } else if (!groupable.includes(f)) {
      add(control(field), 'only a filterable enum or boolean field can be preset',
        `${where} filters on “${field}”, which is not a filterable enum or boolean field`)
    } else if (f.type === 'ENUM' && !(f.enumValues ?? []).includes(value)) {
      add(control(field), `“${value}” is not one of the values of ${f.name}`,
        `${where} filters ${field} on “${value}”, which is not one of its values`)
    }
  }
}

/** `count` takes no field; every other aggregate needs a non-key numeric one. Shared by the
 *  dashboard widgets and a report's chart, which the backend validates with the same rule. */
function aggIssues(agg: FullstackAgg | undefined, field: string | undefined, e: FullstackEntityDef,
                   skip: boolean): { field: string; message: string; summary: string }[] {
  if (skip) return []
  if (!agg || agg === 'count') {
    return field
      ? [{ field: 'chart.field', message: 'a count takes no field', summary: `counts rows, so it takes no field` }]
      : []
  }
  if (!field) {
    return [{ field: 'chart.field', message: `${agg} needs a numeric field of ${e.name}`,
      summary: `reduces ${e.name} with ${agg} but names no numeric field` }]
  }
  if (!numericFields(e).some(f => f.name === field)) {
    return [{ field: 'chart.field', message: `${e.name} has no numeric field “${field}”`,
      summary: `reduces “${field}”, which is not a numeric field of ${e.name}` }]
  }
  return []
}

function collect(pages: FullstackPageDef[], entities: FullstackEntityDef[]): Issue[] {
  if (pages.length === 0) return []
  const issues: Issue[] = []
  const byLower = new Map(entities.map(e => [e.name.trim().toLowerCase(), e]))
  const entityOf = (name: string | undefined) => (name ? byLower.get(name.trim().toLowerCase()) : undefined)
  const typeById = new Map(pages.map(p => [p.id, p.type]))
  const seenIds = new Set<string>()
  const recordEntities = new Map<string, string>()
  const wizardEntities = new Map<string, string>()

  if (pages.length > MAX_PAGES) {
    issues.push({ message: '', summary: `A layout can have at most ${MAX_PAGES} pages` })
  }

  pages.forEach((page, index) => {
    const where = `Page “${page.title || page.id || index + 1}”`
    const add = (field: string, message: string, summary = `${where} ${message}`) =>
      issues.push({ page: index, field, message, summary })

    if (!page.id.trim()) add('id', 'needs an id')
    else if (!PAGE_ID.test(page.id) || page.id.length > 40) {
      add('id', 'must be lower-case words joined by “-”', `${where} has an invalid id “${page.id}”`)
    } else if (seenIds.has(page.id)) add('id', 'is already used', `Two pages share the id “${page.id}”`)
    seenIds.add(page.id)
    if ((page.title ?? '').length > 80) add('title', 'is longer than 80 characters')
    if ((page.description ?? '').length > 300) add('description', 'is longer than 300 characters')
    if (page.group?.trim() || page.icon) {
      if (!inNav(page)) {
        add(page.group?.trim() ? 'group' : 'icon', 'only applies to a page in the navigation',
          `${where} is not in the navigation, so it takes no nav ${page.group?.trim() ? 'group' : 'icon'}`)
      }
      if ((page.group ?? '').trim().length > MAX_GROUP) add('group', `is longer than ${MAX_GROUP} characters`)
      if (page.icon && !(page.icon in NAV_ICONS)) add('icon', `“${page.icon}” is not a nav icon`)
    }

    switch (page.type) {
      case 'entity-list': {
        const e = entityOf(page.entity)
        if (!e) {
          add('entity', page.entity ? `“${page.entity}” is no longer an entity` : 'needs an entity',
            page.entity ? `${where} lists “${page.entity}”, which is no longer an entity` : `${where} lists no entity`)
          break
        }
        checkPresetFilter(page.presetFilter, e, add, where)
        break
      }
      case 'dashboard': {
        const widgets = page.widgets ?? []
        if (widgets.length === 0) add('widgets', 'needs at least one widget')
        if (widgets.length > MAX_WIDGETS) add('widgets', `has more than ${MAX_WIDGETS} widgets`)
        widgets.forEach((w, wi) => {
          if (w.kind === 'text') {
            if (!w.text?.trim()) add(`widget.${wi}`, 'needs some text', `${where} has an empty text widget`)
            else if (w.text.length > MAX_TEXT) add(`widget.${wi}`, `is longer than ${MAX_TEXT} characters`, `${where} has a text widget over ${MAX_TEXT} characters`)
            return
          }
          const e = entityOf(w.entity)
          if (!e) {
            add(`widget.${wi}`, w.entity ? `“${w.entity}” is no longer an entity` : 'needs an entity',
              `${where} has a widget for “${w.entity}”, which is no longer an entity`)
            return
          }
          if (w.series && w.kind !== 'stacked') {
            add(`widget.${wi}`, 'only a stacked chart takes a series', `${where} splits a ${w.kind} widget by a series`)
          }
          if (w.kind === 'stacked') {
            const by = w.groupBy ?? defaultBarGroupBy(e)
            const series = w.series ?? defaultSeries(e, by)
            if (w.series && !groupableFields(e).some(f => f.name === w.series)) {
              add(`widget.${wi}`, `${e.name} has no enum or boolean field “${w.series}”`,
                `${where} splits ${e.name} by “${w.series}”, which it no longer has`)
            } else if (!series || series === by) {
              add(`widget.${wi}`, 'needs a second enum or boolean field to split by',
                `${where} has a stacked chart of ${e.name}, which has no second enum or boolean field to split by`)
            }
          }
          if (w.kind === 'bar' || w.kind === 'donut' || w.kind === 'stacked') {
            const groupable = groupableFields(e)
            if (w.groupBy && !groupable.some(f => f.name === w.groupBy)) {
              add(`widget.${wi}`, `${e.name} has no enum or boolean field “${w.groupBy}”`,
                `${where} groups ${e.name} by “${w.groupBy}”, which it no longer has`)
            } else if (!w.groupBy && groupable.length === 0) {
              add(`widget.${wi}`, `${e.name} has no enum or boolean field to group by`,
                `${where} charts ${e.name}, which has no enum or boolean field to group by`)
            }
          }
          if (w.kind === 'line') {
            const dates = dateFields(e)
            if (w.groupBy && !dates.some(f => f.name === w.groupBy)) {
              add(`widget.${wi}`, `${e.name} has no date field “${w.groupBy}”`,
                `${where} plots ${e.name} over “${w.groupBy}”, which is not one of its date fields`)
            } else if (!w.groupBy && dates.length === 0) {
              add(`widget.${wi}`, `${e.name} has no date field to plot over time`,
                `${where} plots ${e.name} over time, but it has no date field`)
            }
          }
          if (w.kind === 'top') {
            const ranks = rankableKeys(e)
            if (w.groupBy && !ranks.some(k => k.toLowerCase() === w.groupBy!.toLowerCase())) {
              add(`widget.${wi}`, `${e.name} has no enum, boolean or relation “${w.groupBy}”`,
                `${where} ranks ${e.name} by “${w.groupBy}”, which it no longer has`)
            } else if (!w.groupBy && ranks.length === 0) {
              add(`widget.${wi}`, `${e.name} has no enum, boolean or relation to rank by`,
                `${where} ranks ${e.name}, which has nothing to rank by`)
            }
          }
          if (w.kind === 'progress') {
            const target = Number(w.target)
            if (!w.target?.trim()) {
              add(`widget.${wi}`, 'needs a target', `${where} has a progress tile without a target`)
            } else if (!Number.isFinite(target) || target <= 0) {
              add(`widget.${wi}`, 'the target must be a number above 0', `${where} has a progress target of “${w.target}”`)
            }
          }
          if (w.compare) {
            if (w.kind !== 'kpi') {
              add(`widget.${wi}`, 'only a number tile compares periods', `${where} compares periods on a ${w.kind} widget`)
            } else if (!page.dateRange || !widgetDateField(w, e)) {
              add(`widget.${wi}`, 'comparing needs the period picker and a filterable date',
                `${where} compares periods, but ${!page.dateRange ? 'has no period picker' : `${e.name} has no filterable date`}`)
            }
          }
          if (w.bucket && w.kind !== 'line') {
            add(`widget.${wi}`, 'only a trend takes a bucket', `${where} buckets a ${w.kind} widget`)
          }
          for (const issue of aggIssues(w.kind === 'recent' ? undefined : w.agg, w.field, e, w.kind === 'recent')) {
            add(`widget.${wi}`, issue.message, `${where} ${issue.summary}`)
          }
          if (w.kind === 'recent' && (w.agg || w.field)) {
            add(`widget.${wi}`, 'a recent list shows rows, not an aggregate',
              `${where} asks a recent list for an aggregate`)
          }
          if ((w.kind === 'recent' || w.kind === 'top') && w.limit != null && (w.limit < 1 || w.limit > MAX_RECENT_LIMIT)) {
            add(`widget.${wi}`, `between 1 and ${MAX_RECENT_LIMIT} rows`,
              `${where} shows a ${w.kind} list of ${w.limit} rows (1–${MAX_RECENT_LIMIT})`)
          }
          if (w.span != null && (!Number.isInteger(w.span) || w.span < 1 || w.span > MAX_SPAN)) {
            add(`widget.${wi}`, `spans 1 to ${MAX_SPAN} columns`, `${where} has a widget ${w.span} columns wide (1–${MAX_SPAN})`)
          }
          if (w.sortBy) {
            if (w.kind !== 'recent') {
              add(`widget.${wi}`, 'only a recent list takes a sort', `${where} sorts a ${w.kind} widget`)
            } else if (!e.fields.some(f => f.name === w.sortBy)) {
              add(`widget.${wi}`, `${e.name} has no field “${w.sortBy}”`,
                `${where} sorts ${e.name} by “${w.sortBy}”, which it no longer has`)
            }
          }
          checkPresetFilter(w.presetFilter, e, add, `${where} has a widget that`, field => `widget.${wi}.presetFilter.${field}`)
          if (w.dateField) {
            if (!page.dateRange) {
              add(`widget.${wi}`, 'a date field needs the dashboard’s period picker',
                `${where} limits a widget by “${w.dateField}”, but has no period picker`)
            } else if (!filterableDateFields(e).some(f => f.name === w.dateField)) {
              add(`widget.${wi}`, `${e.name} has no filterable date field “${w.dateField}”`,
                `${where} limits ${e.name} by “${w.dateField}”, which is not one of its filterable date fields`)
            }
          }
        })
        if (page.dateRange) {
          if (!DATE_RANGES.some(r => r.value === page.dateRange)) {
            add('dateRange', `“${page.dateRange}” is not a period`)
          } else if (widgets.length > 0 && !widgets.some(w => widgetDateField(w, entityOf(w.entity)))) {
            add('dateRange', 'no widget counts an entity with a filterable date',
              `${where} has a period picker, but none of its widgets has a date for it to limit`)
          }
        }
        break
      }
      case 'tabs': {
        if (!page.title?.trim()) add('title', 'needs a title (there is no entity to name it after)')
        const tabs = page.tabs ?? []
        if (tabs.length < MIN_TABS || tabs.length > MAX_TABS) {
          add('tabs', `needs between ${MIN_TABS} and ${MAX_TABS} tabs`)
        }
        const seenTabs = new Set<string>()
        tabs.forEach((tab, ti) => {
          const targetType = typeById.get(tab.page)
          if (!targetType) {
            add(`tab.${ti}`, tab.page ? `no page with id “${tab.page}”` : 'needs a page',
              `${where} has a tab for the missing page “${tab.page}”`)
          } else if (targetType === 'tabs' || targetType === 'record') {
            add(`tab.${ti}`, `a tab cannot embed a ${targetType} page`,
              `${where} has a tab embedding the ${targetType} page “${tab.page}”`)
          } else if (seenTabs.has(tab.page)) {
            add(`tab.${ti}`, 'is already a tab of this page', `${where} has “${tab.page}” as a tab twice`)
          }
          seenTabs.add(tab.page)
        })
        break
      }
      case 'master-detail': {
        const parent = entityOf(page.parent)
        const child = entityOf(page.child)
        if (!parent) {
          add('parent', page.parent ? `“${page.parent}” is no longer an entity` : 'needs a parent entity',
            `${where} lists “${page.parent ?? ''}”, which is no longer an entity`)
        } else if (!singlePk(parent)) {
          add('parent', `${parent.name} has a composite key`,
            `${where} lists ${parent.name}, which has a composite key`)
        }
        if (!child) {
          add('child', page.child ? `“${page.child}” is no longer an entity` : 'needs a child entity',
            `${where} shows “${page.child ?? ''}”, which is no longer an entity`)
        } else if (parent) {
          const candidates = relationsTo(child, parent.name)
          if (candidates.length === 0) {
            add('child', `${child.name} has no relation to ${parent.name}`,
              `${where} shows ${child.name}, which has no relation to ${parent.name}`)
          } else if (page.via && !candidates.some(c => c.toLowerCase() === page.via!.toLowerCase())) {
            add('via', `“${page.via}” is not a relation to ${parent.name}`,
              `${where} links through “${page.via}”, which is not a relation of ${child.name} to ${parent.name}`)
          } else if (!page.via && candidates.length > 1) {
            add('via', 'pick the relation to link through',
              `${where} must say which of the relations of ${child.name} to ${parent.name} it links through`)
          }
        }
        break
      }
      case 'report': {
        const e = entityOf(page.entity)
        if (!e) {
          add('entity', page.entity ? `“${page.entity}” is no longer an entity` : 'needs an entity',
            page.entity ? `${where} reports on “${page.entity}”, which is no longer an entity`
              : `${where} reports on no entity`)
          break
        }
        const charts = reportCharts(page)
        if (page.chart && page.charts?.length) {
          add('chart.groupBy', 'has both a chart and a list of charts', `${where} sets both “chart” and “charts”`)
        }
        if (charts.length > MAX_CHARTS) add('chart.groupBy', `has more than ${MAX_CHARTS} charts`)
        const chartable = chartableFields(e)
        charts.forEach((chart, ci) => {
          const which = charts.length > 1 ? `${where} (chart ${ci + 1})` : where
          const grouped = chart.groupBy ? e.fields.find(f => f.name === chart.groupBy) : undefined
          if (chart.groupBy && !chartable.some(f => f.name === chart.groupBy)) {
            add(chartControl(ci, 'groupBy'), `${e.name} has no enum, boolean or date field “${chart.groupBy}”`,
              `${which} groups by “${chart.groupBy}”, which is not an enum, boolean or date field of ${e.name}`)
          } else if (!chart.groupBy && chartable.length === 0) {
            add(chartControl(ci, 'groupBy'), `${e.name} has no enum, boolean or date field to group by`,
              `${which} reports on ${e.name}, which has no enum, boolean or date field to group by`)
          }
          const overTime = grouped ? dateFields(e).some(f => f.name === grouped.name) : false
          if (chart.bucket && !overTime) {
            add(chartControl(ci, 'bucket'), 'a bucket applies to a date grouping',
              `${which} buckets by ${chart.bucket}, but it does not group over a date`)
          }
          for (const issue of aggIssues(chart.agg, chart.field, e, false)) {
            add(chartControl(ci, 'field'), issue.message, `${which} ${issue.summary}`)
          }
        })
        checkPresetFilter(page.presetFilter, e, add, where)
        break
      }
      case 'record': {
        const e = entityOf(page.entity)
        if (!e) {
          add('entity', page.entity ? `“${page.entity}” is no longer an entity` : 'needs an entity',
            `${where} opens “${page.entity ?? ''}”, which is no longer an entity`)
          break
        }
        if (!singlePk(e)) {
          add('entity', `${e.name} has a composite key`,
            `${where} opens ${e.name}, which has a composite key and cannot be addressed by one id`)
        }
        const already = recordEntities.get(e.name)
        if (already) {
          add('entity', `${e.name} already has the record page “${already}”`,
            `${where} is a second record page for ${e.name}`)
        }
        recordEntities.set(e.name, page.id)
        const seenChildren = new Set<string>()
        const childTabs = page.childTabs ?? []
        childTabs.forEach((tab, ci) => {
          const name = childTabEntity(tab)
          const via = childTabVia(tab)
          const child = entityOf(name)
          if (!child) {
            add(`childTab.${ci}`, `“${name}” is no longer an entity`,
              `${where} has a tab for “${name}”, which is no longer an entity`)
          } else if (relationsTo(child, e.name).length === 0) {
            add(`childTab.${ci}`, `${child.name} has no relation to ${e.name}`,
              `${where} has a tab for ${child.name}, which has no relation to ${e.name}`)
          } else if (seenChildren.has(child.name)) {
            add(`childTab.${ci}`, 'is already a tab', `${where} has ${child.name} as a tab twice`)
          } else if (via && !relationsTo(child, e.name).includes(via)) {
            add(`childTab.${ci}`, `${child.name} has no relation “${via}” to ${e.name}`,
              `${where} links ${child.name} through “${via}”, which is not one of its relations to ${e.name}`)
          }
          if (child) seenChildren.add(child.name)
        })
        if (childTabs.length > MAX_CHILD_TABS) add('childTabs', `has more than ${MAX_CHILD_TABS} related lists`)
        const stats = page.headerStats ?? []
        if (stats.length > MAX_HEADER_STATS) add('headerStats', `has more than ${MAX_HEADER_STATS} header tiles`)
        stats.forEach((s, si) => {
          const child = entityOf(s.child)
          if (!child) {
            add(`headerStat.${si}`, `“${s.child}” is no longer an entity`,
              `${where} has a header tile for “${s.child}”, which is no longer an entity`)
          } else if (relationsTo(child, e.name).length === 0) {
            add(`headerStat.${si}`, `${child.name} has no relation to ${e.name}`,
              `${where} has a header tile for ${child.name}, which has no relation to ${e.name}`)
          } else if (s.via && !relationsTo(child, e.name).includes(s.via)) {
            add(`headerStat.${si}`, `${child.name} has no relation “${s.via}” to ${e.name}`,
              `${where} has a header tile linked through “${s.via}”, which is not a relation of ${child.name} to ${e.name}`)
          } else {
            for (const issue of aggIssues(s.agg, s.field, child, false)) {
              add(`headerStat.${si}`, issue.message, `${where} has a header tile that ${issue.summary}`)
            }
          }
        })
        break
      }
      case 'wizard': {
        const e = entityOf(page.entity)
        if (!e) {
          add('entity', page.entity ? `“${page.entity}” is no longer an entity` : 'needs an entity',
            `${where} creates “${page.entity ?? ''}”, which is no longer an entity`)
          break
        }
        if (e.readOnly) add('entity', `${e.name} is read-only`, `${where} creates ${e.name}, which is read-only`)
        const already = wizardEntities.get(e.name)
        if (already) add('entity', `${e.name} already has the wizard “${already}”`, `${where} is a second wizard for ${e.name}`)
        wizardEntities.set(e.name, page.id)
        const askable = askableFields(e)
        const steps = page.steps ?? []
        if (steps.length > MAX_STEPS) add('steps', `has more than ${MAX_STEPS} steps`)
        const asked = new Set<string>()
        steps.forEach((step, si) => {
          if (step.fields.length === 0) add(`step.${si}`, 'asks for nothing', `${where} has an empty step ${si + 1}`)
          for (const name of step.fields) {
            if (!askable.some(a => a.name === name)) {
              add(`step.${si}`, `${e.name} has no field “${name}”`, `${where} asks for “${name}”, which ${e.name} no longer has`)
            } else if (asked.has(name)) {
              add(`step.${si}`, `“${name}” is already asked for`, `${where} asks for “${name}” twice`)
            }
            asked.add(name)
          }
        })
        if (steps.length > 0) {
          const missing = askable.filter(a => a.required && !asked.has(a.name)).map(a => a.name)
          if (missing.length > 0) {
            add('steps', `never asks for ${missing.map(m => `“${m}”`).join(', ')}, which ${missing.length === 1 ? 'is' : 'are'} required`)
          }
        }
        if (askable.length === 0) add('entity', `${e.name} has no field to ask for`)
        break
      }
    }
  })

  if (!pages.some(p => !p.hidden && p.type !== 'record')) {
    issues.push({ message: '', summary: 'Every page is hidden — at least one must be in the navigation' })
  }
  return issues
}

/** One line describing what a page shows. */
export function describePage(page: FullstackPageDef, pages: FullstackPageDef[]): string {
  switch (page.type) {
    case 'entity-list': {
      const filter = Object.entries(page.presetFilter ?? {}).map(([k, v]) => `${k} = ${v}`).join(', ')
      return filter ? `${page.entity} list · filtered on ${filter}` : `${page.entity} list`
    }
    case 'dashboard': {
      const counts = { kpi: 0, bar: 0, donut: 0, stacked: 0, line: 0, recent: 0, top: 0, progress: 0, text: 0 }
      for (const w of page.widgets ?? []) if (w.kind in counts) counts[w.kind]++
      const parts = [
        counts.kpi && `${counts.kpi} tile${counts.kpi === 1 ? '' : 's'}`,
        counts.progress && `${counts.progress} target${counts.progress === 1 ? '' : 's'}`,
        counts.bar && `${counts.bar} breakdown chart${counts.bar === 1 ? '' : 's'}`,
        counts.donut && `${counts.donut} donut${counts.donut === 1 ? '' : 's'}`,
        counts.stacked && `${counts.stacked} stacked chart${counts.stacked === 1 ? '' : 's'}`,
        counts.line && `${counts.line} trend${counts.line === 1 ? '' : 's'}`,
        counts.top && `${counts.top} top list${counts.top === 1 ? '' : 's'}`,
        counts.recent && `${counts.recent} recent list${counts.recent === 1 ? '' : 's'}`,
        counts.text && `${counts.text} note${counts.text === 1 ? '' : 's'}`,
      ].filter(Boolean)
      return parts.join(' · ') || 'No widgets'
    }
    case 'tabs':
      return (page.tabs ?? [])
        .map(tab => tab.title || pages.find(p => p.id === tab.page)?.title || tab.page)
        .join(' | ')
    case 'master-detail':
      return `${page.parent ?? '?'} → ${page.child ?? '?'}${page.via ? ` via ${page.via}` : ''}`
    case 'report': {
      const charts = reportCharts(page)
      const chart = charts[0]
      const by = chart.groupBy ?? 'its first enum, boolean or date field'
      const how = !chart.agg || chart.agg === 'count' ? 'row count' : `${chart.agg} of ${chart.field}`
      const more = charts.length > 1 ? ` · +${charts.length - 1} chart${charts.length === 2 ? '' : 's'}` : ''
      return `${page.entity ?? '?'} · ${how} by ${by}${chart.bucket ? ` per ${chart.bucket}` : ''}${more}`
    }
    case 'wizard': {
      const steps = page.steps?.length
      return `${page.entity ?? '?'} · ${steps ? `${steps} step${steps === 1 ? '' : 's'}` : 'default steps'} and a review`
    }
    case 'record': {
      const tabs = page.childTabs
      const related = tabs == null ? 'its related lists' : tabs.length === 0 ? 'no related lists'
        : tabs.map(tab => (childTabVia(tab) ? `${childTabEntity(tab)} (${childTabVia(tab)})` : childTabEntity(tab))).join(', ')
      return `One ${page.entity ?? '?'} · ${related}`
    }
  }
}

/** Nav label as the generated app shows it (mirrors the backend defaults). */
export function pageLabel(page: FullstackPageDef): string {
  if (page.title) return page.title
  if (page.type === 'dashboard') return 'Dashboard'
  if (page.type === 'master-detail') return page.parent ?? page.id
  return page.entity ?? page.id
}

/** A page slug from free text: "Order lines" → "order-lines". */
export function slugify(text: string): string {
  const slug = text.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
  return /^[a-z]/.test(slug) ? slug.replace(/-+$/, '') : ''
}

/** `base`, `base-2`, `base-3`… — the first id not already in `taken`. */
export function uniquePageId(base: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  const seed = base || 'page'
  if (!used.has(seed)) return seed
  for (let n = 2; ; n++) {
    const candidate = `${seed}-${n}`
    if (!used.has(candidate)) return candidate
  }
}

/**
 * The layout that matches the classic shell: a dashboard (one count tile per entity, a chart per
 * entity that can be grouped, the latest rows of the first one) plus a list page per entity — the
 * starting point users then rearrange.
 */
export function seedLayout(entities: FullstackEntityDef[]): FullstackPageDef[] {
  const named = entities.filter(e => e.name.trim())
  if (named.length === 0) return []
  const ids = new Set<string>()
  const take = (base: string) => {
    const id = uniquePageId(slugify(base), ids)
    ids.add(id)
    return id
  }
  const dashboard: FullstackPageDef = {
    id: take('dashboard'),
    type: 'dashboard',
    widgets: [
      ...named.map(e => ({ kind: 'kpi' as const, entity: e.name })),
      ...named.filter(e => groupableFields(e).length > 0).map(e => ({ kind: 'bar' as const, entity: e.name })),
      { kind: 'recent' as const, entity: named[0].name },
    ],
  }
  return [dashboard, ...named.map(e => ({ id: take(e.name), type: 'entity-list' as const, entity: e.name }))]
}

/** Follows an entity rename through every reference a layout can hold. */
export function renameEntityInPages(pages: FullstackPageDef[], from: string, to: string): FullstackPageDef[] {
  if (!from || !to || from === to) return pages
  const same = (name: string | undefined) => name != null && name.trim().toLowerCase() === from.trim().toLowerCase()
  return pages.map(page => {
    const next: FullstackPageDef = { ...page }
    if (same(next.entity)) next.entity = to
    if (same(next.parent)) next.parent = to
    if (same(next.child)) next.child = to
    if (next.widgets) next.widgets = next.widgets.map(w => (same(w.entity) ? { ...w, entity: to } : w))
    if (next.childTabs) next.childTabs = next.childTabs.map(tab => (same(childTabEntity(tab)) ? childTab(to, childTabVia(tab)) : tab))
    if (next.headerStats) next.headerStats = next.headerStats.map(s => (same(s.child) ? { ...s, child: to } : s))
    return next
  })
}

/** Follows a field rename on one entity (preset filters and chart groupings point at fields). */
export function renameFieldInPages(pages: FullstackPageDef[], entity: string, from: string, to: string): FullstackPageDef[] {
  if (!entity || !from || !to || from === to) return pages
  const isEntity = (name: string | undefined) => name != null && name.trim().toLowerCase() === entity.trim().toLowerCase()
  return pages.map(page => {
    const next: FullstackPageDef = { ...page }
    if (isEntity(next.entity) && next.presetFilter && from in next.presetFilter) {
      const filter: Record<string, string> = {}
      for (const [k, v] of Object.entries(next.presetFilter)) filter[k === from ? to : k] = v
      next.presetFilter = filter
    }
    if (next.widgets) {
      next.widgets = next.widgets.map(w => {
        if (!isEntity(w.entity)) return w
        const patched: FullstackWidgetDef = { ...w }
        if (patched.groupBy === from) patched.groupBy = to
        if (patched.field === from) patched.field = to
        if (patched.sortBy === from) patched.sortBy = to
        if (patched.dateField === from) patched.dateField = to
        if (patched.series === from) patched.series = to
        if (patched.presetFilter && from in patched.presetFilter) {
          const filter: Record<string, string> = {}
          for (const [k, v] of Object.entries(patched.presetFilter)) filter[k === from ? to : k] = v
          patched.presetFilter = filter
        }
        return patched
      })
    }
    const renameChart = (c: FullstackChartDef): FullstackChartDef => ({
      ...c,
      ...(c.groupBy === from ? { groupBy: to } : {}),
      ...(c.field === from ? { field: to } : {}),
    })
    if (isEntity(next.entity) && next.steps) {
      next.steps = next.steps.map(step => ({ ...step, fields: step.fields.map(name => (name === from ? to : name)) }))
    }
    if (next.headerStats) {
      next.headerStats = next.headerStats.map(s => (isEntity(s.child) && s.field === from ? { ...s, field: to } : s))
    }
    if (isEntity(next.entity) && next.chart) next.chart = renameChart(next.chart)
    if (isEntity(next.entity) && next.charts) next.charts = next.charts.map(renameChart)
    return next
  })
}

/** What each page type is, for the "Add page" gallery. */
export const PAGE_TYPE_META: Record<FullstackPageType, { icon: string; label: string; blurb: string }> = {
  dashboard: { icon: 'dashboard', label: 'Dashboard', blurb: 'Count tiles, breakdown charts and recent rows.' },
  'entity-list': { icon: 'table_rows', label: 'List', blurb: 'One entity’s table, optionally filtered to start with.' },
  tabs: { icon: 'tab', label: 'Tabs', blurb: 'Two to six other pages side by side as tabs.' },
  'master-detail': { icon: 'vertical_split', label: 'Master–detail', blurb: 'A parent list beside the selected parent’s rows.' },
  record: { icon: 'article', label: 'Record', blurb: 'One row opened from a list, with its related lists as tabs.' },
  report: { icon: 'monitoring', label: 'Report', blurb: 'Filters, charts and grouped totals, with a CSV export.' },
  wizard: { icon: 'auto_fix_high', label: 'Wizard', blurb: 'A create form split into steps, with a review before saving.' },
}

// ── Defaults the generator resolves ─────────────────────────────────────────

const nonKey = (e: FullstackEntityDef | undefined) => (e?.fields ?? []).filter(f => !f.primaryKey)
const isDate = (f: FullstackFieldDef) => f.type === 'LOCAL_DATE' || f.type === 'LOCAL_DATE_TIME'

/** The field a breakdown chart groups by when none is picked: the first enum, else the first
 *  boolean (FullstackPageValidator.groupBy). */
export function defaultBarGroupBy(entity: FullstackEntityDef | undefined): string | undefined {
  const fields = nonKey(entity)
  return (fields.find(f => f.type === 'ENUM') ?? fields.find(f => f.type === 'BOOLEAN'))?.name
}

/** The date field a trend plots over when none is picked: the first one. */
export function defaultLineGroupBy(entity: FullstackEntityDef | undefined): string | undefined {
  return dateFields(entity)[0]?.name
}

/** A report's grouping when none is picked: the first enum/boolean, else the first date field
 *  (FullstackPageValidator.chart). */
export function defaultReportGroupBy(entity: FullstackEntityDef | undefined): string | undefined {
  const fields = nonKey(entity)
  return (fields.find(f => f.type === 'ENUM' || f.type === 'BOOLEAN') ?? fields.find(isDate))?.name
}

/** The label of a "use the default" option: `Default (status)`, or what it would look for. */
export function defaultOptionLabel(resolved: string | undefined, looksFor: string): string {
  return resolved ? `Default (${resolved})` : `Default (first ${looksFor})`
}

// ── Page references (tabs point at pages by id) ─────────────────────────────

/** Follows a page id change into every tab that embeds the page. */
export function renamePageIdInPages(pages: FullstackPageDef[], from: string, to: string): FullstackPageDef[] {
  if (!from || from === to) return pages
  let changed = false
  const next = pages.map(page => {
    if (!page.tabs?.some(t => t.page === from)) return page
    changed = true
    return { ...page, tabs: page.tabs.map(t => (t.page === from ? { ...t, page: to } : t)) }
  })
  return changed ? next : pages
}

/** The tabs pages that embed the page with `id`. */
export function pagesEmbedding(pages: FullstackPageDef[], id: string): FullstackPageDef[] {
  return pages.filter(p => p.type === 'tabs' && (p.tabs ?? []).some(t => t.page === id))
}

/** Drops the tabs pointing at `id` (the page is being removed). */
export function dropTabsTo(pages: FullstackPageDef[], id: string): FullstackPageDef[] {
  return pages.map(page => (page.tabs?.some(t => t.page === id)
    ? { ...page, tabs: page.tabs.filter(t => t.page !== id) }
    : page))
}

/** Follows a relation rename on `child` into the master-detail pages that link through it. */
export function renameRelationInPages(pages: FullstackPageDef[], child: string, from: string, to: string): FullstackPageDef[] {
  if (!child || !from || !to || from === to) return pages
  // `child` is the entity that owns the relation.
  const isChild = (name: string | undefined) => name != null && name.trim().toLowerCase() === child.trim().toLowerCase()
  let changed = false
  const next = pages.map(page => {
    if (page.type === 'wizard' && isChild(page.entity) && page.steps?.some(step => step.fields.includes(from))) {
      changed = true
      return { ...page, steps: page.steps.map(step => ({ ...step, fields: step.fields.map(name => (name === from ? to : name)) })) }
    }
    if (page.type === 'dashboard' && page.widgets?.some(w => w.kind === 'top' && isChild(w.entity) && w.groupBy === from)) {
      changed = true
      return { ...page, widgets: page.widgets.map(w => (w.kind === 'top' && isChild(w.entity) && w.groupBy === from ? { ...w, groupBy: to } : w)) }
    }
    if (page.type === 'record' && (page.childTabs?.some(t => isChild(childTabEntity(t)) && childTabVia(t) === from)
      || page.headerStats?.some(s => isChild(s.child) && s.via === from))) {
      changed = true
      return {
        ...page,
        childTabs: page.childTabs?.map(t => (isChild(childTabEntity(t)) && childTabVia(t) === from ? childTab(childTabEntity(t), to) : t)),
        headerStats: page.headerStats?.map(s => (isChild(s.child) && s.via === from ? { ...s, via: to } : s)),
      }
    }
    if (page.type !== 'master-detail' || !isChild(page.child) || page.via !== from) return page
    changed = true
    return { ...page, via: to }
  })
  return changed ? next : pages
}

/** A copy of `page` under a fresh id and a "(copy)" title; the caller places it. */
export function duplicatePage(page: FullstackPageDef, taken: Iterable<string>): FullstackPageDef {
  const copy = JSON.parse(JSON.stringify(page)) as FullstackPageDef
  copy.id = uniquePageId(`${page.id || 'page'}-copy`.slice(0, 40).replace(/-+$/, ''), taken)
  copy.title = `${pageLabel(page)} (copy)`
  return copy
}

// ── Suggestions for the "Add page" gallery ──────────────────────────────────

export interface PageSuggestion {
  key: string
  icon: string
  label: string
  blurb: string
  /** The page to add; `idBase` becomes its id once made unique. */
  page: Omit<FullstackPageDef, 'id'> & { idBase: string }
}

const sameName = (a: string | undefined, b: string) => (a ?? '').trim().toLowerCase() === b.trim().toLowerCase()

/**
 * Pages the model is shaped for and the layout lacks: a master-detail and a record page where
 * one entity points at another, a report for an entity with something to group by, a trend
 * dashboard for an entity with a date. At most `limit`, most specific first.
 */
export function suggestPages(entities: FullstackEntityDef[], pages: FullstackPageDef[], limit = 4): PageSuggestion[] {
  const named = entities.filter(e => e.name.trim())
  const out: PageSuggestion[] = []

  for (const child of named) {
    for (const r of child.relations ?? []) {
      if (r.type !== 'MANY_TO_ONE') continue
      const parent = named.find(e => sameName(e.name, r.targetEntity))
      if (!parent || parent === child || !singlePk(parent)) continue
      const key = `md:${parent.name}:${child.name}`
      if (out.some(s => s.key === key)) continue
      if (pages.some(p => p.type === 'master-detail' && sameName(p.parent, parent.name) && sameName(p.child, child.name))) continue
      const via = relationsTo(child, parent.name).length > 1 ? r.fieldName : undefined
      out.push({
        key,
        icon: PAGE_TYPE_META['master-detail'].icon,
        label: `${parent.name} → ${child.name}`,
        blurb: `Pick a ${parent.name} on the left, see its ${child.name} rows on the right.`,
        page: { idBase: parent.name, type: 'master-detail', parent: parent.name, child: child.name, ...(via ? { via } : {}) },
      })
    }
  }
  for (const parent of named) {
    if (!singlePk(parent) || !named.some(c => c !== parent && relationsTo(c, parent.name).length > 0)) continue
    if (pages.some(p => p.type === 'record' && sameName(p.entity, parent.name))) continue
    out.push({
      key: `record:${parent.name}`,
      icon: PAGE_TYPE_META.record.icon,
      label: `${parent.name} record`,
      blurb: `Open one ${parent.name} with its related lists as tabs.`,
      page: { idBase: parent.name, type: 'record', entity: parent.name, hidden: true },
    })
  }
  for (const e of named) {
    const groupBy = defaultBarGroupBy(e)
    if (!groupBy || !groupableFields(e).some(f => f.name === groupBy)) continue
    if (pages.some(p => p.type === 'report' && sameName(p.entity, e.name))) continue
    const number = numericFields(e)[0]
    out.push({
      key: `report:${e.name}`,
      icon: PAGE_TYPE_META.report.icon,
      label: number ? `${e.name}: ${number.name} by ${groupBy}` : `${e.name} by ${groupBy}`,
      blurb: 'Filters, a chart and grouped totals.',
      page: {
        idBase: `${e.name}-report`,
        type: 'report',
        entity: e.name,
        chart: number ? { groupBy, agg: 'sum', field: number.name } : { groupBy },
      },
    })
  }
  for (const e of named) {
    const date = defaultLineGroupBy(e)
    if (!date) continue
    if (pages.some(p => (p.widgets ?? []).some(w => w.kind === 'line' && sameName(w.entity, e.name)))) continue
    const bar = defaultBarGroupBy(e)
    out.push({
      key: `trend:${e.name}`,
      icon: 'show_chart',
      label: `${e.name} trends`,
      blurb: `A dashboard with ${e.name} counted per month.`,
      page: {
        idBase: `${e.name}-trends`,
        type: 'dashboard',
        title: `${e.name} trends`,
        widgets: [
          { kind: 'kpi', entity: e.name },
          { kind: 'line', entity: e.name, groupBy: date },
          ...(bar && groupableFields(e).some(f => f.name === bar) ? [{ kind: 'bar' as const, entity: e.name, groupBy: bar }] : []),
        ],
      },
    })
  }
  for (const e of named) {
    if (e.readOnly || askableFields(e).length < 6) continue
    if (pages.some(p => p.type === 'wizard' && sameName(p.entity, e.name))) continue
    out.push({
      key: `wizard:${e.name}`,
      icon: PAGE_TYPE_META.wizard.icon,
      label: `New ${e.name} wizard`,
      blurb: `${askableFields(e).length} fields is a long form — ask for them step by step.`,
      page: { idBase: `new-${e.name}`, type: 'wizard', entity: e.name, title: `New ${e.name}`, steps: defaultWizardSteps(e) },
    })
  }
  return out.slice(0, limit)
}

/** Materializes a suggestion under a free id. */
export function pageFromSuggestion(s: PageSuggestion, taken: Iterable<string>): FullstackPageDef {
  const { idBase, ...rest } = JSON.parse(JSON.stringify(s.page)) as PageSuggestion['page']
  return { id: uniquePageId(slugify(idBase) || 'page', taken), ...rest }
}

// ── Undo labels ──────────────────────────────────────────────────────────────

/** A short name for what changed between two layouts — the undo history's entry label. */
export function describePagesChange(prev: FullstackPageDef[], next: FullstackPageDef[]): string {
  if (prev.length === 0 && next.length > 0) return 'Started a page layout'
  if (next.length === 0 && prev.length > 0) return 'Switched to the classic page layout'
  if (next.length > prev.length) {
    const added = next.find(n => !prev.some(p => p.id === n.id)) ?? next[next.length - 1]
    return `Added the “${pageLabel(added)}” page`
  }
  if (next.length < prev.length) {
    const gone = prev.find(p => !next.some(n => n.id === p.id))
    return gone ? `Removed the “${pageLabel(gone)}” page` : 'Removed a page'
  }
  const key = (p: FullstackPageDef) => JSON.stringify(p)
  if (prev.map(key).sort().join('\n') === next.map(key).sort().join('\n')) return 'Reordered pages'
  for (let i = 0; i < next.length; i++) {
    const a = prev[i]; const b = next[i]
    if (key(a) === key(b)) continue
    const name = pageLabel(b)
    if (a.title !== b.title || a.id !== b.id) return `Renamed the “${name}” page`
    const wa = a.widgets ?? []; const wb = b.widgets ?? []
    if (wb.length > wa.length) return `Added a widget to “${name}”`
    if (wb.length < wa.length) return `Removed a widget from “${name}”`
    const ta = a.tabs ?? []; const tb = b.tabs ?? []
    if (tb.length > ta.length) return `Added a tab to “${name}”`
    if (tb.length < ta.length) return `Removed a tab from “${name}”`
    if (Boolean(a.hidden) !== Boolean(b.hidden)) {
      return b.hidden ? `Hid “${name}” from the navigation` : `Showed “${name}” in the navigation`
    }
    return `Edited the “${name}” page`
  }
  return 'Changed page layout'
}

// ── Keeping settings across a kind / entity switch ──────────────────────────

/** Preset-filter entries that still apply to `entity` (a filterable enum/boolean with that value). */
export function keptPresetFilter(filter: Record<string, string> | undefined, entity: FullstackEntityDef | undefined): Record<string, string> | undefined {
  if (!filter) return undefined
  const groupable = groupableFields(entity)
  const kept: Record<string, string> = {}
  for (const [k, v] of Object.entries(filter)) {
    const f = groupable.find(x => x.name === k)
    if (f && (f.type === 'BOOLEAN' ? v === 'true' || v === 'false' : (f.enumValues ?? []).includes(v))) kept[k] = v
  }
  return Object.keys(kept).length ? kept : undefined
}

/**
 * A widget moved to another kind and/or entity, keeping every setting the new combination can
 * still use. `dropped` names what had to go, so the editor can say so instead of wiping silently.
 */
export function retargetWidget(widget: FullstackWidgetDef, patch: { kind?: FullstackWidgetDef['kind']; entity?: string },
                               entity: FullstackEntityDef | undefined): { widget: FullstackWidgetDef; dropped: string[] } {
  const kind = patch.kind ?? widget.kind
  const next: FullstackWidgetDef = { ...widget, ...patch, kind }
  const dropped: string[] = []
  const drop = (keys: (keyof FullstackWidgetDef)[], label: string) => {
    if (keys.some(k => next[k] != null)) dropped.push(label)
    for (const k of keys) delete next[k]
  }
  if (kind === 'text') {
    const kept: FullstackWidgetDef = { kind, entity: '', ...(next.title ? { title: next.title } : {}), ...(next.text ? { text: next.text } : {}) }
    if (next.span != null && next.span !== defaultSpan(kind)) kept.span = next.span
    const lost = (['groupBy', 'agg', 'limit', 'sortBy', 'compare', 'target', 'presetFilter', 'dateField', 'series'] as const)
      .filter(k => next[k] != null)
    return { widget: kept, dropped: lost.length ? ['data settings'] : [] }
  }
  if (next.text != null) drop(['text'], 'text')
  if (next.groupBy != null) {
    const fits = kind === 'bar' || kind === 'donut' || kind === 'stacked' ? groupableFields(entity).some(f => f.name === next.groupBy)
      : kind === 'line' ? dateFields(entity).some(f => f.name === next.groupBy)
        : kind === 'top' ? rankableKeys(entity).includes(next.groupBy)
          : false
    if (!fits) drop(['groupBy'], 'group by')
  }
  if (kind !== 'line') drop(['bucket'], 'bucket')
  if (next.series != null && (kind !== 'stacked' || !groupableFields(entity).some(f => f.name === next.series))) drop(['series'], 'split by')
  if (kind === 'recent') drop(['agg', 'field'], 'aggregate')
  else if (next.field != null && !numericFields(entity).some(f => f.name === next.field)) drop(['agg', 'field'], 'aggregate')
  if (kind !== 'recent' && kind !== 'top') drop(['limit'], 'row limit')
  if (next.sortBy != null && (kind !== 'recent' || !(entity?.fields ?? []).some(f => !f.primaryKey && f.name === next.sortBy))) {
    drop(['sortBy'], 'sort')
  }
  if (kind !== 'kpi') drop(['compare'], 'period comparison')
  if (kind !== 'progress') drop(['target'], 'target')
  if (next.dateField != null && !filterableDateFields(entity).some(f => f.name === next.dateField)) drop(['dateField'], 'period date')
  if (next.presetFilter) {
    const kept = keptPresetFilter(next.presetFilter, entity)
    if (Object.keys(kept ?? {}).length < Object.keys(next.presetFilter).length) dropped.push('filter')
    if (kept) next.presetFilter = kept
    else delete next.presetFilter
  }
  if (next.span != null && next.span === defaultSpan(kind)) delete next.span
  return { widget: next, dropped }
}

/** A report page moved to another entity: the charts and filter keep whatever the new entity has. */
export function retargetReport(page: FullstackPageDef, entity: FullstackEntityDef | undefined): { patch: Partial<FullstackPageDef>; dropped: string[] } {
  const dropped: string[] = []
  const chartable = chartableFields(entity)
  const numeric = numericFields(entity)
  const charts = reportCharts(page).map(c => {
    const n: FullstackChartDef = { ...c }
    if (n.groupBy != null && !chartable.some(f => f.name === n.groupBy)) {
      dropped.push('group by')
      delete n.groupBy
      delete n.bucket
    }
    if (n.bucket != null && n.groupBy != null && !dateFields(entity).some(f => f.name === n.groupBy)) delete n.bucket
    if (n.field != null && !numeric.some(f => f.name === n.field)) {
      dropped.push('aggregate')
      delete n.agg
      delete n.field
    }
    return n
  })
  const presetFilter = keptPresetFilter(page.presetFilter, entity)
  if (Object.keys(presetFilter ?? {}).length < Object.keys(page.presetFilter ?? {}).length) dropped.push('filter')
  return {
    patch: {
      entity: entity?.name ?? page.entity,
      presetFilter,
      ...(charts.length <= 1 ? { chart: charts[0] ?? {}, charts: undefined } : { charts, chart: undefined }),
    },
    dropped: [...new Set(dropped)],
  }
}

/** A wizard moved to another entity: steps keep the fields the new entity also has (by name), and
 *  whatever else it asks for is dealt into steps after them. Falls back to the default steps. */
export function retargetWizardSteps(steps: { title?: string; fields: string[] }[] | undefined, entity: FullstackEntityDef | undefined): { title?: string; fields: string[] }[] {
  const askable = askableFields(entity).map(a => a.name)
  const kept = (steps ?? []).map(s => ({ ...s, fields: s.fields.filter(f => askable.includes(f)) })).filter(s => s.fields.length > 0)
  // Keep the old shape only when it still covers most of the new form; otherwise start over.
  if (kept.flatMap(s => s.fields).length * 2 < askable.length) return defaultWizardSteps(entity)
  const placed = new Set(kept.flatMap(s => s.fields))
  const rest = askable.filter(a => !placed.has(a))
  for (let i = 0; i < rest.length; i += DEFAULT_STEP_SIZE) {
    if (kept.length >= MAX_STEPS) {
      kept[kept.length - 1].fields.push(...rest.slice(i))
      break
    }
    kept.push({ fields: rest.slice(i, i + DEFAULT_STEP_SIZE) })
  }
  return kept
}

// ── Server errors ────────────────────────────────────────────────────────────

/**
 * Finds the page a server-side 400 is about: FullstackPageValidator names a page as
 * `Page '<id>'…` or `pages[<i>]…`. Null when the message is not about a page of this layout.
 */
export function pageOfServerError(message: string, pages: FullstackPageDef[]): number | null {
  const byId = /Page '([^']+)'/.exec(message)
  if (byId) {
    const i = pages.findIndex(p => p.id === byId[1])
    if (i >= 0) return i
  }
  const byIndex = /pages\[(\d+)\]/.exec(message)
  if (byIndex) {
    const i = Number(byIndex[1])
    if (i < pages.length) return i
  }
  return null
}
