import type { FullstackAgg, FullstackEntityDef, FullstackPageDef, FullstackPageRole, FullstackWidgetDef } from '../../../types'
import { t, tn } from '../../../i18n'
import { isSortableType } from '../fieldTypes'
import { checkBoard, checkCalendar, checkContent, checkImport, checkInbox, checkSearch } from '../newPageTypes'
import { LIST_PAGE_SIZES, LIST_VIEWS, LIST_WIDGET_LIMITS, MAX_CHARTS, MAX_CHILD_TABS, MAX_DESCRIPTION, MAX_GROUP, MAX_HEADER_STATS, MAX_LINKS, MAX_PAGES, MAX_RECENT_LIMIT, MAX_SPAN, MAX_STEPS, MAX_TABS, MAX_TEXT, MAX_TITLE, MAX_WIDGETS, MIN_TABS, PAGE_ID } from './limits'
import { sameName, singlePk } from './entityHelpers'
import { createsRows } from './pageKinds'
import { auditOn, enabledListViews, LIST_ACTIONS, listColumns, sortableKeys, viewDisabledReason } from './listPresentation'
import { askableFields, wizardFields } from './wizardFields'
import { activityEntities, chartableFields, chartControl, chartKindsFor, dashboardFilterEntities, DATE_RANGES, dateFields, defaultBarGroupBy, defaultChartSeries, defaultPivotColumns, defaultReportGroupBy, defaultSeries, filterableDateFields, funnelStageFields, groupByFields, MAX_ACTIVITY_ENTITIES, MAX_DASHBOARD_FILTERS, MIN_ACTIVITY_LIMIT, numericFields, rankableKeys, readsEntity, REFRESH_CHOICES, relationKeys, reloads, reportCharts, reportGroupKeys, resolveDashboardFilter, trendDateField, widgetDateField } from './dashboard'
import { inNav, NAV_ICONS } from './nav'
import { presettableFields, presetValueProblem, relationOfPresetKey, relationPresetProblem } from './presets'
import { childTabEntity, childTabPresentation, childTabVia, relationsTo } from './childTabs'
import { collectWarnings } from './advice'
import { pageLabel, slugify, uniquePageId } from './labels'
import { removePageAt } from './references'
import { selfLinks } from './newPages'
import { retargetEntityList, retargetRecord, retargetReport, retargetWidget, retargetWizardSteps } from './retarget'

/**
 * The validator: every rule FullstackPageValidator applies, mirrored, so a broken layout shows
 * on the offending control instead of as a 400 on Generate. `validatePages` returns the messages
 * per control, the problem sentences, the advice (`./advice`) and — where one repair is obvious
 * — a fix.
 */

/** A one-click repair of an issue. It takes the whole layout, so it can remove a page or a widget
 *  as well as patch one page; the editor records an undo entry under `label` before applying it. */
export interface PageFix {
  label: string
  apply: (pages: FullstackPageDef[]) => FullstackPageDef[]
}

export interface PageLayoutValidation {
  /** Page index → control name → message, for the inline errors in the editor. */
  byPage: Record<number, Record<string, string>>
  /** Problems that belong to the layout as a whole. */
  general: string[]
  /** Everything, as sentences naming the page — what the caller counts as errors. */
  problems: string[]
  /** The same problems with where they live, so the list can jump to the offending control, and
   *  a fix when the problem has one obvious repair. */
  issues: { page?: number; field?: string; summary: string; fix?: PageFix; alsoFix?: PageFix }[]
  count: number
  /** Advice, not errors: the layout generates, but with a dead end the user probably did not mean
   *  (a hidden page nothing opens, a chart nothing drills from, a default that was capped). Never
   *  counted, never blocks Generate. Each has a stable `key` (kind + page id + detail) by which it
   *  can be dismissed; dismissed ones are in `dismissedWarnings` instead. */
  warnings: LayoutWarning[]
  /** The warnings the user dismissed (`PageLayoutContext.dismissed`) — kept so they can be restored. */
  dismissedWarnings: LayoutWarning[]
  /** Page index → how many of the (not dismissed) warnings are about it. */
  warningsByPage: Record<number, number>
}

export interface LayoutWarning {
  /** Stable across edits that leave the warning standing: `<kind>:<page id>[:<detail>]`. */
  key: string
  page?: number
  field?: string
  summary: string
  fix?: PageFix
}

export interface Issue {
  /** Warnings only: the dismissal key. */
  key?: string
  page?: number
  field?: string
  /** Shown on the control. */
  message: string
  /** Shown in the problem list, naming the page. */
  summary: string
  fix?: PageFix
  /** A second repair, offered beside `fix` (a stale entity: switch to the likely replacement, or remove). */
  alsoFix?: PageFix
}

/** What the page checks need beyond the layout: whether an LDAP auth dependency (ldap-auth-rest or ldap-auth) is selected
 *  (page roles need one). Omitted, that check is skipped. */
export interface PageLayoutContext {
  ldapAuth?: boolean
  /** The project-wide scaffold opts: a list page may show or sort by the audit columns only with
   *  `audit` among them (or overridden on the entity). Omitted: no audit columns. */
  scaffoldOpts?: string[]
  /** Keys of the warnings the user dismissed (they move to `dismissedWarnings`). */
  dismissed?: string[]
}

export const PAGE_ROLES: FullstackPageRole[] = ['ADMIN', 'USER']

export function validatePages(pages: FullstackPageDef[], entities: FullstackEntityDef[], context: PageLayoutContext = {}): PageLayoutValidation {
  const issues = collect(pages, entities, context.scaffoldOpts ?? [])
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
  const dismissed = new Set(context.dismissed ?? [])
  const all = collectWarnings(pages, entities).map(({ key, page, field, summary, fix }): LayoutWarning =>
    ({ key: key ?? summary, page, field, summary, ...(fix ? { fix } : {}) }))
  const warnings = all.filter(w => !dismissed.has(w.key))
  const warningsByPage: Record<number, number> = {}
  for (const w of warnings) if (w.page != null) warningsByPage[w.page] = (warningsByPage[w.page] ?? 0) + 1
  return {
    byPage,
    general,
    problems: issues.map(i => i.summary),
    issues: issues.map(({ page, field, summary, fix, alsoFix }) => ({ page, field, summary, ...(fix ? { fix } : {}), ...(alsoFix ? { alsoFix } : {}) })),
    count: issues.length,
    warnings,
    dismissedWarnings: all.filter(w => dismissed.has(w.key)),
    warningsByPage,
  }
}

/**
 * Applies every problem's own fix, one at a time: a fix is written against the layout it was found
 * in (it removes page 3, widget 2…), so the layout is validated again after each one instead of
 * applying them all to the first. A fix that leaves no fewer problems is skipped, so a fix that does
 * not hold cannot loop. Returns the layout and the labels of the fixes applied, in order.
 */
export function fixAllProblems(pages: FullstackPageDef[], entities: FullstackEntityDef[], context: PageLayoutContext = {}): { pages: FullstackPageDef[]; applied: string[] } {
  let current = pages
  const applied: string[] = []
  for (let round = 0; round < 100; round++) {
    const before = validatePages(current, entities, context)
    const fixes = before.issues.flatMap(i => (i.fix ? [i.fix] : []))
    let next: FullstackPageDef[] | null = null
    for (const fix of fixes) {
      const after = fix.apply(current)
      const check = validatePages(after, entities, context)
      if (check.count < before.count || check.issues.filter(i => i.fix).length < fixes.length) {
        next = after
        applied.push(fix.label)
        break
      }
    }
    if (!next) break
    current = next
  }
  return { pages: current, applied }
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
    if (roles.some(r => !PAGE_ROLES.includes(r))) add(t('unknown role'), t('{where} names an unknown role', { where }))
    else if (page === start) add(t('the start page is open to everyone'), t('{where} is the start page, so it cannot be restricted to roles', { where }))
    else if (tabbed.has(page.id)) add(t('restrict the tabs page instead'), t('{where} is a tab, so it cannot be restricted to roles', { where }))
    else if (context.ldapAuth === false) add(t('needs ldap-auth-rest or ldap-auth'), t('{where} is restricted to roles, which need an LDAP auth dependency (ldap-auth-rest or ldap-auth)', { where }))
  })
  return out
}

/** Flat problem sentences — the layout summary and the error count read these. */
export function pageLayoutProblems(pages: FullstackPageDef[], entities: FullstackEntityDef[]): string[] {
  return validatePages(pages, entities).problems
}

type AddIssue = (field: string, message: string, summary?: string, fix?: PageFix) => void

/** The opening filters of a list, report or widget: a value of a filterable enum/boolean column, a
 *  period or date range on a date column, a number range on a number column. */
function checkPresetFilter(filter: Record<string, string> | undefined, e: FullstackEntityDef,
                           entityOf: (name: string | undefined) => FullstackEntityDef | undefined, add: AddIssue, where: string,
                           control: (field: string) => string = field => `presetFilter.${field}`): void {
  const presettable = presettableFields(e)
  for (const [field, value] of Object.entries(filter ?? {})) {
    const f = e.fields.find(x => x.name === field)
    const relation = f ? undefined : relationOfPresetKey(e, field)
    if (relation) {
      const problem = relationPresetProblem(value, entityOf(relation.targetEntity))
      if (problem) add(control(field), problem, t('{where} filters {field} on “{value}”, which {problem}', { where, field: relation.fieldName, value, problem }))
    } else if (!f) {
      add(control(field), t('{entity} no longer has “{field}”', { entity: e.name, field }),
        t('{where} filters on “{field}”, which {entity} no longer has', { where, field, entity: e.name }))
    } else if (!presettable.includes(f)) {
      add(control(field), t('only a filterable enum, boolean, date or number field can be preset'),
        t('{where} filters on “{field}”, which is not a filterable enum, boolean, date or number field', { where, field }))
    } else {
      const problem = presetValueProblem(f, value)
      if (problem) add(control(field), problem, t('{where} filters {field} on “{value}”, which {problem}', { where, field, value, problem: problem.replace(/^needs/, 'is not valid: needs') }))
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
      ? [{ field: 'chart.field', message: t('a count takes no field'), summary: t('counts rows, so it takes no field') }]
      : []
  }
  if (!field) {
    return [{ field: 'chart.field', message: t('{agg} needs a numeric field of {entity}', { agg, entity: e.name }),
      summary: t('reduces {entity} with {agg} but names no numeric field', { entity: e.name, agg }) }]
  }
  if (!numericFields(e).some(f => f.name === field)) {
    return [{ field: 'chart.field', message: t('{entity} has no numeric field “{field}”', { entity: e.name, field }),
      summary: t('reduces “{field}”, which is not a numeric field of {entity}', { field, entity: e.name }) }]
  }
  return []
}

/** How a list page opens: known columns (none twice), a sortable sort, an offered view, a pager size. */
function checkListPresentation(page: FullstackPageDef, e: FullstackEntityDef, add: AddIssue, where: string, scaffoldOpts: string[]): void {
  const isAudit = (key: string) => key === 'createdAt' || key === 'updatedAt' || key === 'createdBy' || key === 'updatedBy'
  if (page.columns) {
    if (page.columns.length === 0) add('columns', t('needs at least one column'), t('{where} shows no columns', { where }))
    const keys = listColumns(e, scaffoldOpts).map(c => c.key)
    const seen = new Set<string>()
    for (const key of page.columns) {
      if (!keys.includes(key)) {
        add('columns', isAudit(key) ? t('“{key}” needs the audit option on {entity}', { key, entity: e.name }) : t('{entity} has no “{key}” column', { entity: e.name, key }),
          isAudit(key) ? t('{where} shows “{key}”, which needs the audit scaffold option on {entity}', { where, key, entity: e.name })
            : t('{where} shows “{key}”, which is not a column of {entity}', { where, key, entity: e.name }))
      } else if (seen.has(key)) add('columns', t('“{key}” is listed twice', { key }), t('{where} lists the “{key}” column twice', { where, key }))
      seen.add(key)
    }
  }
  if (page.detail != null) {
    if (!['drawer', 'side', 'record'].includes(page.detail)) add('detail', t('must be drawer, side or record'), t('{where} opens rows in “{detail}”, which is not drawer, side or record', { where, detail: page.detail }))
    else if (page.detail === 'side' && !singlePk(e)) add('detail', t('a side pane needs a single-key entity'), t('{where} opens rows in a side pane, but {entity} has a composite key', { where, entity: e.name }))
  }
  if (page.sort) {
    const key = page.sort.field
    if (!key?.trim()) add('sort', t('needs a column'), t('{where} sorts by no column', { where }))
    else if (!sortableKeys(e, scaffoldOpts).includes(key)) {
      add('sort', isAudit(key) ? t('“{key}” needs the audit option on {entity}', { key, entity: e.name }) : t('{entity} cannot sort by “{key}”', { entity: e.name, key }),
        isAudit(key) ? t('{where} sorts by “{key}”, which needs the audit scaffold option on {entity}', { where, key, entity: e.name })
          : t('{where} sorts by “{key}”, which {entity} cannot sort by', { where, key, entity: e.name }))
    }
    if (page.sort.dir && page.sort.dir !== 'asc' && page.sort.dir !== 'desc') {
      add('sort', t('direction must be asc or desc'), t('{where} has a sort direction that is neither asc nor desc', { where }))
    }
  }
  if (page.view) {
    if (!LIST_VIEWS.some(v => v.value === page.view)) add('view', t('“{view}” is not a list view', { view: page.view }), t('{where} opens as “{view}”, which is not a list view', { where, view: page.view }))
    else if (!enabledListViews(e).includes(page.view)) {
      const reason = viewDisabledReason(e, page.view)
      add('view', reason ?? t('{entity} does not offer it', { entity: e.name }),
        reason
          ? t('{where} opens as {view}, which {entity} does not offer ({reason})', { where, view: page.view, entity: e.name, reason: `${reason.charAt(0).toLowerCase()}${reason.slice(1)}` })
          : t('{where} opens as {view}, which {entity} does not offer', { where, view: page.view, entity: e.name }))
    }
  }
  if (page.pageSize != null && !LIST_PAGE_SIZES.includes(page.pageSize)) {
    add('pageSize', t('must be {sizes}', { sizes: LIST_PAGE_SIZES.join(', ') }), t('{where} opens with {n} rows per page, which the pager does not offer', { where, n: page.pageSize }))
  }
}

/** A dashboard's filters (FullstackPageValidator.dashboardFilters): at most four, each an
 *  enum/boolean/relation name one of its widgets' entities filters by, the same kind of filter on
 *  every entity that has it, none blank or twice. */
function checkDashboardFilters(page: FullstackPageDef, entities: FullstackEntityDef[], add: AddIssue, where: string,
                               dropFilter: (index: number, name: string) => PageFix): void {
  const filters = page.filters ?? []
  if (filters.length === 0) return
  if (filters.length > MAX_DASHBOARD_FILTERS) add('filters', t('has more than {max} filters', { max: MAX_DASHBOARD_FILTERS }))
  const reach = dashboardFilterEntities(page, entities)
  const seen: string[] = []
  filters.forEach((raw, fi) => {
    const name = (raw ?? '').trim()
    if (!name) {
      add('filters', t('a filter name is blank'), t('{where}: a filter name is blank', { where }), dropFilter(fi, ''))
      return
    }
    const r = resolveDashboardFilter(name, reach, entities)
    if (!r) {
      add('filters', t('none of the widgets’ entities filters by “{name}”', { name }),
        t('{where}: filter “{name}” is not an enum, boolean or relation filter of any of its widgets’ entities ({entities})', { where, name, entities: reach.map(e => e.name).join(', ') }),
        dropFilter(fi, name))
    } else if ('conflict' in r) {
      const c = r.conflict
      add('filters', t('“{name}” is {shape} on {owner} but {otherShape} on {other}', { name, shape: c.shape, owner: c.owner, otherShape: c.otherShape, other: c.other }),
        t('{where}: filter “{name}” is {shape} on {owner} but {otherShape} on {other} — one control cannot set both', { where, name, shape: c.shape, owner: c.owner, otherShape: c.otherShape, other: c.other }),
        dropFilter(fi, name))
    } else if (seen.includes(r.name.toLowerCase())) {
      add('filters', t('“{name}” is listed twice', { name: r.name }), t('{where}: filter “{name}” is listed twice', { where, name: r.name }), dropFilter(fi, r.name))
    } else seen.push(r.name.toLowerCase())
  })
}

function collect(pages: FullstackPageDef[], entities: FullstackEntityDef[], scaffoldOpts: string[] = []): Issue[] {
  if (pages.length === 0) return []
  const issues: Issue[] = []
  const byLower = new Map(entities.map(e => [e.name.trim().toLowerCase(), e]))
  const entityOf = (name: string | undefined) => (name ? byLower.get(name.trim().toLowerCase()) : undefined)
  const typeById = new Map(pages.map(p => [p.id, p.type]))
  const seenIds = new Set<string>()
  const recordEntities = new Map<string, string>()
  // The page that creates each entity's rows: a wizard or a form, one per entity.
  const createPages = new Map<string, FullstackPageDef>()
  const checkOneCreatePage = (e: FullstackEntityDef, page: FullstackPageDef, where: string,
                              add: (field: string, message: string, summary?: string) => void) => {
    const already = createPages.get(e.name)
    if (already) {
      add('entity', t('{entity} already has the {type} “{id}”', { entity: e.name, type: already.type, id: already.id }), already.type === page.type
        ? t('{where} is a second {type} for {entity}', { where, type: page.type, entity: e.name })
        : t('{where} is a {type} for {entity}, which already has a {other} — an entity has one or the other', { where, type: page.type, entity: e.name, other: already.type }))
    } else createPages.set(e.name, page)
  }

  if (pages.length > MAX_PAGES) {
    issues.push({ message: '', summary: t('A layout can have at most {max} pages', { max: MAX_PAGES }) })
  }

  // The fixes: a stale reference is removed (the page, or just the widget / tab / tile that holds
  // it), an ambiguous link takes the first relation, a wizard asks for what it forgot.
  const removePage = (index: number): PageFix => ({
    label: t('Remove the “{page}” page', { page: pageLabel(pages[index]) }),
    apply: all => removePageAt(all, index),
  })
  const patchPage = (index: number, label: string, patch: (page: FullstackPageDef) => FullstackPageDef): PageFix => ({
    label,
    apply: all => all.map((p, i) => (i === index ? patch(p) : p)),
  })
  // A page (or widget) naming an entity that is gone can switch to the likely replacement: the
  // one entity the layout does not mention yet — the usual shape of a rename by delete-and-add or
  // a re-import under a new name.
  const mentioned = new Set<string>()
  const mention = (name: string | undefined) => { if (name?.trim()) mentioned.add(name.trim().toLowerCase()) }
  for (const p of pages) {
    mention(p.entity); mention(p.parent); mention(p.child)
    p.widgets?.forEach(w => mention(w.entity))
    p.childTabs?.forEach(t => mention(childTabEntity(t)))
    p.headerStats?.forEach(st => mention(st.child))
  }
  const unmentioned = entities.filter(e => e.name.trim() && !mentioned.has(e.name.trim().toLowerCase()))
  const replacement = unmentioned.length === 1 ? unmentioned[0] : undefined
  const switchPage = (index: number): PageFix | undefined => {
    const page = pages[index]
    const r = replacement
    if (!r) return undefined
    const label = t('Switch to {entity}', { entity: r.name })
    switch (page.type) {
      case 'entity-list':
        return patchPage(index, label, p => ({ ...p, ...retargetEntityList(p, r, scaffoldOpts).patch }))
      case 'report':
        return reportGroupKeys(r).length ? patchPage(index, label, p => ({ ...p, ...retargetReport(p, r).patch })) : undefined
      case 'record':
        return singlePk(r) ? patchPage(index, label, p => ({ ...p, ...retargetRecord(p, r.name).patch })) : undefined
      case 'wizard':
        return !r.readOnly && askableFields(r).length ? patchPage(index, label, p => ({ ...p, entity: r.name, steps: retargetWizardSteps(p.steps, r).steps })) : undefined
      case 'form':
        return !r.readOnly ? patchPage(index, label, p => ({ ...p, entity: r.name })) : undefined
      default:
        return undefined
    }
  }
  const switchWidget = (index: number, wi: number): PageFix | undefined => (replacement ? patchPage(index, t('Switch widget {n} to {entity}', { n: wi + 1, entity: replacement.name }),
    p => ({ ...p, widgets: (p.widgets ?? []).map((w, j) => (j === wi ? retargetWidget(w, { entity: replacement.name }, replacement, scaffoldOpts).widget : w)) }))
    : undefined)

  pages.forEach((page, index) => {
    const where = t('Page “{page}”', { page: page.title || page.id || index + 1 })
    // The summary names the page: "Page “X” needs an id" — in Hebrew, with a colon between.
    const add = (field: string, message: string, summary = t('{where} {message}', { where, message }), fix?: PageFix, alsoFix?: PageFix) =>
      issues.push({ page: index, field, message, summary, ...(fix ? { fix } : {}), ...(alsoFix ? { alsoFix } : {}) })

    if (!page.id.trim()) add('id', t('needs an id'))
    else if (!PAGE_ID.test(page.id) || page.id.length > 40) {
      add('id', t('must be lower-case words joined by “-”'), t('{where} has an invalid id “{id}”', { where, id: page.id }))
    } else if (seenIds.has(page.id)) add('id', t('is already used'), t('Two pages share the id “{id}”', { id: page.id }))
    seenIds.add(page.id)
    const tooLong = (title: string | undefined) => (title ?? '').trim().length > MAX_TITLE
    if (tooLong(page.title)) add('title', t('is longer than {max} characters', { max: MAX_TITLE }))
    if ((page.description ?? '').trim().length > MAX_DESCRIPTION) add('description', t('is longer than {max} characters', { max: MAX_DESCRIPTION }))
    // The titles inside a page have the same cap on the server.
    ;(page.widgets ?? []).forEach((w, wi) => {
      if (tooLong(w.title)) add(`widget.${wi}.title`, t('has a title longer than {max} characters', { max: MAX_TITLE }), t('{where} has a widget title over {max} characters', { where, max: MAX_TITLE }))
    })
    ;(page.tabs ?? []).forEach((tab, ti) => {
      if (tooLong(tab.title)) add(`tab.${ti}`, t('has a title longer than {max} characters', { max: MAX_TITLE }), t('{where} has a tab title over {max} characters', { where, max: MAX_TITLE }))
    })
    ;(page.steps ?? []).forEach((step, si) => {
      if (tooLong(step.title)) add(`step.${si}`, t('has a title longer than {max} characters', { max: MAX_TITLE }), t('{where} has a step title over {max} characters', { where, max: MAX_TITLE }))
    })
    ;(page.headerStats ?? []).forEach((s, si) => {
      if (tooLong(s.title)) add(`headerStat.${si}`, t('has a title longer than {max} characters', { max: MAX_TITLE }), t('{where} has a header number title over {max} characters', { where, max: MAX_TITLE }))
    })
    if (page.group?.trim() || page.icon) {
      if (!inNav(page)) {
        add(page.group?.trim() ? 'group' : 'icon', t('only applies to a page in the navigation'),
          page.group?.trim()
            ? t('{where} is not in the navigation, so it takes no nav group', { where })
            : t('{where} is not in the navigation, so it takes no nav icon', { where }))
      }
      if ((page.group ?? '').trim().length > MAX_GROUP) add('group', t('is longer than {max} characters', { max: MAX_GROUP }))
      if (page.icon && !(page.icon in NAV_ICONS)) add('icon', t('“{icon}” is not a nav icon', { icon: page.icon }))
    }
    if (page.type !== 'dashboard' && (page.filters?.length ?? 0) > 0) {
      add('filters', t('only a dashboard takes filters — a list or report page has its own filter bar'),
        t('{where} ({type}) does not take filters (only a dashboard does — a list or report page has its own filter bar)', { where, type: page.type }),
        patchPage(index, t('Drop the dashboard filters of “{page}”', { page: pageLabel(page) }), p => {
          const { filters: _filters, ...rest } = p
          return rest
        }))
    }

    switch (page.type) {
      case 'entity-list': {
        const e = entityOf(page.entity)
        if (!e) {
          add('entity', page.entity ? t('“{entity}” is no longer an entity', { entity: page.entity }) : t('needs an entity'),
            page.entity ? t('{where} lists “{entity}”, which is no longer an entity', { where, entity: page.entity }) : t('{where} lists no entity', { where }),
            page.entity ? switchPage(index) ?? removePage(index) : undefined,
            page.entity && switchPage(index) ? removePage(index) : undefined)
          break
        }
        checkPresetFilter(page.presetFilter, e, entityOf, add, where)
        checkListPresentation(page, e, add, where, scaffoldOpts)
        if (page.hideActions?.length) {
          const unknown = page.hideActions.find(a => !LIST_ACTIONS.some(x => x.value === a))
          // Either export is an action a list has: the CSV, or the Excel workbook.
          const exports = (e.opts?.csvExport ?? scaffoldOpts.includes('csvExport'))
            || (e.opts?.xlsxExport ?? scaffoldOpts.includes('xlsxExport'))
          if (unknown) add('hideActions', t('“{unknown}” is not a list action', { unknown }), t('{where} hides the unknown action “{unknown}”', { where, unknown }))
          else if (new Set(page.hideActions).size < page.hideActions.length) add('hideActions', t('lists an action twice'), t('{where} hides an action twice', { where }))
          else if ((e.readOnly || e.viewQuery != null) && !exports) {
            add('hideActions', t('{entity} is read-only and exports nothing — there is nothing to hide', { entity: e.name }),
              t('{where} hides actions, but {entity} is read-only and exports nothing', { where, entity: e.name }),
              patchPage(index, t('Show every action'), p => { const { hideActions: _h, ...rest } = p; return rest }))
          }
        }
        if (page.detail === 'record' && !pages.some(p => p.type === 'record' && p.entity?.trim().toLowerCase() === e.name.trim().toLowerCase())) {
          add('detail', t('needs a record page for {entity}', { entity: e.name }), t('{where} opens rows on a record page, but {entity} has none', { where, entity: e.name }),
            singlePk(e) && pages.length < MAX_PAGES ? {
              label: t('Add a {entity} record page', { entity: e.name }),
              apply: all => [...all, { id: uniquePageId(slugify(e.name), all.map(p => p.id)), type: 'record', entity: e.name, hidden: true }],
            } : undefined)
        }
        break
      }
      case 'dashboard': {
        const widgets = page.widgets ?? []
        if (widgets.length === 0) add('widgets', t('needs at least one widget'))
        if (widgets.length > MAX_WIDGETS) add('widgets', t('has more than {max} widgets', { max: MAX_WIDGETS }))
        const dropDrill = (wi: number, label: string) => patchPage(index, label,
          p => ({ ...p, widgets: (p.widgets ?? []).map((x, j) => {
            if (j !== wi) return x
            const { drillTo: _drillTo, ...kept } = x
            return kept
          }) }))
        // Where a widget's clicks go (FullstackPageValidator.drillTo): a visible list or report
        // page of the widget's own entity.
        const checkDrill = (w: FullstackWidgetDef, wi: number, e: FullstackEntityDef) => {
          const id = w.drillTo?.trim()
          if (!id) return
          const control = `widget.${wi}.drillTo`
          const fix = dropDrill(wi, t('Open {entity}’s own list from widget {n}', { entity: e.name, n: wi + 1 }))
          const target = pages.find(p => p.id === id)
          if (!target) {
            add(control, t('no page “{id}”', { id }), t('{where} has a widget whose clicks open the missing page “{id}”', { where, id }), fix)
          } else if (target.type !== 'entity-list' && target.type !== 'report') {
            add(control, t('“{page}” must be an entity-list or report page', { page: pageLabel(target) }),
              t('{where} has a widget whose clicks open “{page}”, which must be an entity-list or report page', { where, page: pageLabel(target) }), fix)
          } else if (target.hidden) {
            add(control, t('“{page}” is hidden, so it cannot be opened from a widget', { page: pageLabel(target) }),
              t('{where} has a widget whose clicks open “{page}”, which is hidden, so it cannot be opened from a widget', { where, page: pageLabel(target) }), fix)
          } else if (!sameName(target.entity, e.name)) {
            const shows = entityOf(target.entity)?.name ?? target.entity ?? '?'
            add(control, t('“{page}” shows {shows}, not {entity}', { page: pageLabel(target), shows, entity: e.name }),
              t('{where} has a widget whose clicks open “{page}”, which shows {shows}, not {entity}', { where, page: pageLabel(target), shows, entity: e.name }), fix)
          }
        }
        widgets.forEach((w, wi) => {
          if (!readsEntity(w) && w.drillTo?.trim()) {
            add(`widget.${wi}.drillTo`, t('a {kind} widget opens no page on click', { kind: w.kind }),
              w.kind === 'text'
                ? t('{where} gives a {kind} widget a click target, but a {kind} widget takes only text, a title and a width', { where, kind: w.kind })
                : t('{where} gives a {kind} widget a click target, but a {kind} widget takes only pages, a title and a width', { where, kind: w.kind }),
              dropDrill(wi, t('Drop the click target of widget {n}', { n: wi + 1 })))
          }
          if (w.kind === 'text') {
            if (!w.text?.trim()) add(`widget.${wi}.text`, t('needs some text'), t('{where} has an empty text widget', { where }))
            else if (w.text.length > MAX_TEXT) add(`widget.${wi}.text`, t('is longer than {max} characters', { max: MAX_TEXT }), t('{where} has a text widget over {max} characters', { where, max: MAX_TEXT }))
            return
          }
          if (w.kind === 'activity') {
            const named = w.entities ?? []
            if (named.length === 0 && activityEntities(w, entities, scaffoldOpts).length === 0) {
              add(`widget.${wi}.entities`, t('needs the audit option — no entity records when it changed'),
                t('{where} has an activity feed, but the audit option is off for every entity', { where }))
            }
            if (named.length > MAX_ACTIVITY_ENTITIES) {
              add(`widget.${wi}.entities`, t('reads at most {max} entities', { max: MAX_ACTIVITY_ENTITIES }), t('{where} has an activity feed over more than {max} entities', { where, max: MAX_ACTIVITY_ENTITIES }))
            }
            named.forEach((name, ni) => {
              const e = entityOf(name)
              if (!e) add(`widget.${wi}.entities`, t('“{name}” is no longer an entity', { name }), t('{where} has an activity feed over “{name}”, which is no longer an entity', { where, name }))
              else if (!auditOn(e, scaffoldOpts)) {
                add(`widget.${wi}.entities`, t('{entity} does not record when it changed (audit is off)', { entity: e.name }),
                  t('{where} has an activity feed over {entity}, which does not record when it changed', { where, entity: e.name }))
              } else if (named.findIndex(n => sameName(n, name)) !== ni) add(`widget.${wi}.entities`, t('lists {entity} twice', { entity: e.name }), t('{where} lists {entity} twice in its activity feed', { where, entity: e.name }))
            })
            if (w.limit != null && (w.limit < MIN_ACTIVITY_LIMIT || w.limit > MAX_RECENT_LIMIT)) {
              add(`widget.${wi}.limit`, t('between {min} and {max} changes', { min: MIN_ACTIVITY_LIMIT, max: MAX_RECENT_LIMIT }),
                t('{where} shows an activity feed of {limit} changes ({min}–{max})', { where, limit: w.limit, min: MIN_ACTIVITY_LIMIT, max: MAX_RECENT_LIMIT }))
            }
            if (w.span != null && (!Number.isInteger(w.span) || w.span < 1 || w.span > MAX_SPAN)) {
              add(`widget.${wi}.span`, t('spans 1 to {max} columns', { max: MAX_SPAN }), t('{where} has a widget {span} columns wide (1–{max})', { where, span: w.span, max: MAX_SPAN }))
            }
            return
          }
          if (w.kind === 'links') {
            const ids = w.pages ?? []
            const dropLink = (id: string) => patchPage(index, t('Drop the link to “{id}”', { id }),
              p => ({ ...p, widgets: (p.widgets ?? []).map((x, j) => (j === wi ? { ...x, pages: (x.pages ?? []).filter(k => k !== id) } : x)) }))
            if (ids.length === 0) add(`widget.${wi}.pages`, t('needs at least one page to open'), t('{where} has a links widget that opens no page', { where }))
            else if (ids.length > MAX_LINKS) add(`widget.${wi}.pages`, t('opens more than {max} pages', { max: MAX_LINKS }), t('{where} has a links widget over {max} pages', { where, max: MAX_LINKS }))
            ids.forEach((id, li) => {
              const target = pages.find(p => p.id === id)
              if (!target) add(`widget.${wi}.pages`, t('no page “{id}”', { id }), t('{where} links to the missing page “{id}”', { where, id }), dropLink(id))
              else if (target.type === 'record') {
                add(`widget.${wi}.pages`, t('“{page}” opens from a row, not a link', { page: pageLabel(target) }), t('{where} links to the record page “{page}”, which opens from a row', { where, page: pageLabel(target) }), dropLink(id))
              } else if (target.hidden && !createsRows(target) && target.type !== 'search') {
                add(`widget.${wi}.pages`, t('“{page}” is hidden, so a link cannot open it', { page: pageLabel(target) }), t('{where} links to “{page}”, which is hidden from the navigation', { where, page: pageLabel(target) }), dropLink(id))
              } else if (ids.indexOf(id) !== li) add(`widget.${wi}.pages`, t('links to “{page}” twice', { page: pageLabel(target) }), t('{where} links to “{page}” twice', { where, page: pageLabel(target) }))
            })
            return
          }
          const e = entityOf(w.entity)
          if (!e) {
            add(`widget.${wi}.entity`, w.entity ? t('“{entity}” is no longer an entity', { entity: w.entity }) : t('needs an entity'),
              t('{where} has a widget for “{entity}”, which is no longer an entity', { where, entity: w.entity }),
              !w.entity ? undefined
                : switchWidget(index, wi) ?? (widgets.length === 1 ? removePage(index)
                  : patchPage(index, t('Remove widget {n}', { n: wi + 1 }), p => ({ ...p, widgets: (p.widgets ?? []).filter((_, j) => j !== wi) }))),
              !w.entity || !switchWidget(index, wi) ? undefined
                : widgets.length === 1 ? removePage(index)
                  : patchPage(index, t('Remove widget {n}', { n: wi + 1 }), p => ({ ...p, widgets: (p.widgets ?? []).filter((_, j) => j !== wi) })))
            return
          }
          if (w.kind === 'list') {
            // The same presentation rules as a list page, reported on the widget.
            checkListPresentation({ id: page.id, type: 'entity-list', entity: e.name, columns: w.columns, sort: w.sort }, e,
              (field, message, summary, fix) => add(`widget.${wi}.${field}`, message, summary, fix), where, scaffoldOpts)
            if (w.limit != null && !LIST_WIDGET_LIMITS.includes(w.limit)) {
              const sizes = LIST_WIDGET_LIMITS.join(t(' or '))
              add(`widget.${wi}.limit`, t('shows {sizes} rows', { sizes }), t('{where} embeds a list of {limit} rows ({sizes})', { where, limit: w.limit, sizes }))
            }
            checkPresetFilter(w.presetFilter, e, entityOf, add, where, field => `widget.${wi}.presetFilter.${field}`)
            checkDrill(w, wi, e)
            return
          }
          if (w.kind === 'timeInState') {
            // It reads the workflow's move log — every row ever moved — so it takes an entity, a
            // title and a width, and nothing that filters or measures.
            if (!e.workflow?.trackMoves) {
              add(`widget.${wi}.entity`, e.workflow ? t('{entity}’s workflow keeps no log of its moves', { entity: e.name }) : t('{entity} has no workflow', { entity: e.name }),
                e.workflow
                  ? t('{where} shows time in state for {entity}, whose workflow keeps no log of its moves', { where, entity: e.name })
                  : t('{where} shows time in state for {entity}, which has no workflow', { where, entity: e.name }))
            }
            if (w.agg || w.field || w.groupBy || w.series || w.target || w.dateField || w.sortBy || w.drillTo
              || Object.keys(w.presetFilter ?? {}).length > 0) {
              add(`widget.${wi}.entity`, t('takes only an entity, a title and a width'),
                t('{where} has a time-in-state widget with settings it does not take', { where }),
                patchPage(index, t('Drop the extra settings'), p => ({
                  ...p, widgets: (p.widgets ?? []).map((x, j) => (j === wi ? { kind: x.kind, entity: x.entity, ...(x.title ? { title: x.title } : {}), ...(x.span ? { span: x.span } : {}) } : x)),
                })))
            }
            if (w.span != null && (!Number.isInteger(w.span) || w.span < 1 || w.span > MAX_SPAN)) {
              add(`widget.${wi}.span`, t('spans 1 to {max} columns', { max: MAX_SPAN }), t('{where} has a widget {span} columns wide (1–{max})', { where, span: w.span, max: MAX_SPAN }))
            }
            return
          }
          checkDrill(w, wi, e)
          if (w.kind === 'funnel') {
            const stages = funnelStageFields(e)
            if (w.groupBy && !stages.some(f => f.name.toLowerCase() === w.groupBy!.toLowerCase())) {
              add(`widget.${wi}.groupBy`, t('{entity} has no enum field “{groupBy}”', { entity: e.name, groupBy: w.groupBy }),
                t('{where} draws a funnel over “{groupBy}”, which is not an enum field of {entity}', { where, groupBy: w.groupBy, entity: e.name }))
            } else if (!w.groupBy && stages.length === 0) {
              add(`widget.${wi}.groupBy`, t('{entity} has no enum field for the stages', { entity: e.name }),
                t('{where} draws a funnel of {entity}, which has no enum field for its stages', { where, entity: e.name }))
            }
            if (w.agg && w.agg !== 'count' && w.agg !== 'sum') {
              add(`widget.${wi}.agg`, t('a funnel counts rows or sums a field'), t('{where} has a funnel that takes the {agg} — only a count or a sum adds up across stages', { where, agg: w.agg }))
            }
          }
          if (w.series && w.kind !== 'stacked' && w.kind !== 'pivot') {
            add(`widget.${wi}.series`, t('only a stacked chart or a pivot takes a series'), t('{where} splits a {kind} widget by a series', { where, kind: w.kind }))
          }
          if (w.kind === 'pivot') {
            const keys = rankableKeys(e)
            const rows = w.groupBy ?? keys[0]
            const columns = w.series ?? defaultPivotColumns(e, rows)
            if (w.groupBy && !keys.some(k => k.toLowerCase() === w.groupBy!.toLowerCase())) {
              add(`widget.${wi}.groupBy`, t('{entity} has no enum, boolean or relation “{groupBy}”', { entity: e.name, groupBy: w.groupBy }),
                t('{where} lays {entity} out by “{groupBy}”, which it no longer has', { where, entity: e.name, groupBy: w.groupBy }))
            } else if (w.series && !keys.some(k => k.toLowerCase() === w.series!.toLowerCase())) {
              add(`widget.${wi}.series`, t('{entity} has no enum, boolean or relation “{series}”', { entity: e.name, series: w.series }),
                t('{where} lays {entity} out in columns by “{series}”, which it no longer has', { where, entity: e.name, series: w.series }))
            } else if (!columns || columns === rows) {
              add(`widget.${wi}.series`, t('needs a second enum, boolean or relation for the columns'),
                t('{where} has a pivot of {entity}, which has no second enum, boolean or relation for its columns', { where, entity: e.name }))
            }
          }
          if (w.kind === 'stacked') {
            const by = w.groupBy ?? defaultBarGroupBy(e)
            const series = w.series ?? defaultSeries(e, by)
            if (w.series && !groupByFields(e).some(f => f.name === w.series)) {
              add(`widget.${wi}.series`, t('{entity} has no enum or boolean field “{series}”', { entity: e.name, series: w.series }),
                t('{where} splits {entity} by “{series}”, which it no longer has', { where, entity: e.name, series: w.series }))
            } else if (!series || series === by) {
              add(`widget.${wi}.series`, t('needs a second enum or boolean field to split by'),
                t('{where} has a stacked chart of {entity}, which has no second enum or boolean field to split by', { where, entity: e.name }))
            }
          }
          if (w.kind === 'bar' || w.kind === 'donut') {
            const keys = rankableKeys(e)
            if (w.groupBy && !keys.some(k => k.toLowerCase() === w.groupBy!.toLowerCase())) {
              add(`widget.${wi}.groupBy`, t('{entity} has no enum, boolean or relation “{groupBy}”', { entity: e.name, groupBy: w.groupBy }),
                t('{where} groups {entity} by “{groupBy}”, which it no longer has', { where, entity: e.name, groupBy: w.groupBy }))
            } else if (!w.groupBy && keys.length === 0) {
              add(`widget.${wi}.groupBy`, t('{entity} has no enum, boolean or relation to group by', { entity: e.name }),
                t('{where} charts {entity}, which has no enum, boolean or relation to group by', { where, entity: e.name }))
            }
          }
          if (w.kind === 'stacked') {
            const groupable = groupByFields(e)
            if (w.groupBy && !groupable.some(f => f.name === w.groupBy)) {
              add(`widget.${wi}.groupBy`, t('{entity} has no enum or boolean field “{groupBy}”', { entity: e.name, groupBy: w.groupBy }),
                t('{where} groups {entity} by “{groupBy}”, which it no longer has', { where, entity: e.name, groupBy: w.groupBy }))
            } else if (!w.groupBy && groupable.length === 0) {
              add(`widget.${wi}.groupBy`, t('{entity} has no enum or boolean field to group by', { entity: e.name }),
                t('{where} charts {entity}, which has no enum or boolean field to group by', { where, entity: e.name }))
            }
          }
          if (w.kind === 'line') {
            const dates = dateFields(e)
            if (w.groupBy && !dates.some(f => f.name === w.groupBy)) {
              add(`widget.${wi}.groupBy`, t('{entity} has no date field “{groupBy}”', { entity: e.name, groupBy: w.groupBy }),
                t('{where} plots {entity} over “{groupBy}”, which is not one of its date fields', { where, entity: e.name, groupBy: w.groupBy }))
            } else if (!w.groupBy && dates.length === 0) {
              add(`widget.${wi}.groupBy`, t('{entity} has no date field to plot over time', { entity: e.name }),
                t('{where} plots {entity} over time, but it has no date field', { where, entity: e.name }))
            }
          }
          if (w.kind === 'top') {
            const ranks = rankableKeys(e)
            if (w.groupBy && !ranks.some(k => k.toLowerCase() === w.groupBy!.toLowerCase())) {
              add(`widget.${wi}.groupBy`, t('{entity} has no enum, boolean or relation “{groupBy}”', { entity: e.name, groupBy: w.groupBy }),
                t('{where} ranks {entity} by “{groupBy}”, which it no longer has', { where, entity: e.name, groupBy: w.groupBy }))
            } else if (!w.groupBy && ranks.length === 0) {
              add(`widget.${wi}.groupBy`, t('{entity} has no enum, boolean or relation to rank by', { entity: e.name }),
                t('{where} ranks {entity}, which has nothing to rank by', { where, entity: e.name }))
            }
          }
          if (w.kind === 'progress' || w.kind === 'gauge') {
            const target = Number(w.target)
            if (!w.target?.trim()) {
              add(`widget.${wi}.target`, t('needs a target'), w.kind === 'gauge'
                ? t('{where} has a gauge without a target', { where })
                : t('{where} has a progress tile without a target', { where }))
            } else if (!Number.isFinite(target) || target <= 0) {
              add(`widget.${wi}.target`, t('the target must be a number above 0'), t('{where} has a progress target of “{target}”', { where, target: w.target }))
            }
          }
          if (w.compare) {
            if (w.kind !== 'kpi') {
              add(`widget.${wi}.compare`, t('only a number tile compares periods'), t('{where} compares periods on a {kind} widget', { where, kind: w.kind }))
            } else if (!page.dateRange || !widgetDateField(w, e)) {
              add(`widget.${wi}.compare`, t('comparing needs the period picker and a filterable date'),
                !page.dateRange
                  ? t('{where} compares periods, but has no period picker', { where })
                  : t('{where} compares periods, but {entity} has no filterable date', { where, entity: e.name }))
            }
          }
          if (w.trend) {
            if (w.kind !== 'kpi') {
              add(`widget.${wi}.trend`, t('only a number tile draws a trend'), t('{where} draws a trend on a {kind} widget', { where, kind: w.kind }))
            } else if (!['day', 'month', 'year'].includes(w.trend)) {
              add(`widget.${wi}.trend`, t('“{trend}” is not day, month or year', { trend: w.trend }), t('{where} draws a trend per “{trend}”', { where, trend: w.trend }))
            } else if (!trendDateField(w, e, Boolean(page.dateRange)) && !w.dateField) {
              add(`widget.${wi}.trend`, t('{entity} has no date field to plot over time', { entity: e.name }),
                t('{where} draws a trend of {entity}, which has no date field', { where, entity: e.name }))
            }
          }
          if (w.bucket && w.kind !== 'line') {
            add(`widget.${wi}.bucket`, t('only a trend takes a bucket'), t('{where} buckets a {kind} widget', { where, kind: w.kind }))
          }
          for (const issue of aggIssues(w.kind === 'recent' ? undefined : w.agg, w.field, e, w.kind === 'recent')) {
            add(`widget.${wi}.field`, issue.message, t('{where} {message}', { where, message: issue.summary }))
          }
          if (w.kind === 'recent' && (w.agg || w.field)) {
            add(`widget.${wi}.agg`, t('a recent list shows rows, not an aggregate'),
              t('{where} asks a recent list for an aggregate', { where }))
          }
          if ((w.kind === 'recent' || w.kind === 'top') && w.limit != null && (w.limit < 1 || w.limit > MAX_RECENT_LIMIT)) {
            add(`widget.${wi}.limit`, t('between 1 and {max} rows', { max: MAX_RECENT_LIMIT }),
              t('{where} shows a {kind} list of {limit} rows (1–{max})', { where, kind: w.kind, limit: w.limit, max: MAX_RECENT_LIMIT }))
          }
          if (w.span != null && (!Number.isInteger(w.span) || w.span < 1 || w.span > MAX_SPAN)) {
            add(`widget.${wi}.span`, t('spans 1 to {max} columns', { max: MAX_SPAN }), t('{where} has a widget {span} columns wide (1–{max})', { where, span: w.span, max: MAX_SPAN }))
          }
          if (w.sortBy) {
            if (w.kind !== 'recent') {
              add(`widget.${wi}.sortBy`, t('only a recent list takes a sort'), t('{where} sorts a {kind} widget', { where, kind: w.kind }))
            } else if (!e.fields.some(f => f.name === w.sortBy)
              && !(auditOn(e, scaffoldOpts) && (w.sortBy === 'createdAt' || w.sortBy === 'updatedAt'))) {
              add(`widget.${wi}.sortBy`, t('{entity} has no field “{sortBy}”', { entity: e.name, sortBy: w.sortBy }),
                t('{where} sorts {entity} by “{sortBy}”, which it no longer has', { where, entity: e.name, sortBy: w.sortBy }))
            } else if (e.fields.some(f => f.name === w.sortBy && !isSortableType(f.type))) {
              add(`widget.${wi}.sortBy`, t('“{sortBy}” is long text or a file, which a list cannot be sorted by', { sortBy: w.sortBy }),
                t('{where} sorts {entity} by “{sortBy}”, which is long text or a file', { where, entity: e.name, sortBy: w.sortBy }))
            }
          }
          checkPresetFilter(w.presetFilter, e, entityOf, add, t('{where} has a widget that', { where }), field => `widget.${wi}.presetFilter.${field}`)
          if (w.dateField) {
            if (!page.dateRange && w.kind === 'kpi' && w.trend) {
              // No picker: the date only names what the trend plots over.
              if (!dateFields(e).some(f => f.name === w.dateField)) {
                add(`widget.${wi}.dateField`, t('{entity} has no date field “{dateField}”', { entity: e.name, dateField: w.dateField }),
                  t('{where} plots a trend over “{dateField}”, which is not one of {entity}’s date fields', { where, dateField: w.dateField, entity: e.name }))
              }
            } else if (!page.dateRange) {
              add(`widget.${wi}.dateField`, t('a date field needs the dashboard’s period picker'),
                t('{where} limits a widget by “{dateField}”, but has no period picker', { where, dateField: w.dateField }))
            } else if (!filterableDateFields(e).some(f => f.name === w.dateField)) {
              add(`widget.${wi}.dateField`, t('{entity} has no filterable date field “{dateField}”', { entity: e.name, dateField: w.dateField }),
                t('{where} limits {entity} by “{dateField}”, which is not one of its filterable date fields', { where, entity: e.name, dateField: w.dateField }))
            }
          }
        })
        if (page.refreshSeconds != null) {
          if (!REFRESH_CHOICES.some(r => r.value === page.refreshSeconds)) {
            add('refreshSeconds', t('{refreshSeconds} seconds is not one of the refresh choices', { refreshSeconds: page.refreshSeconds }))
          } else if (widgets.length > 0 && !widgets.some(reloads)) {
            add('refreshSeconds', t('no widget shows data to reload'),
              t('{where} refreshes on a timer, but none of its widgets shows data to reload', { where }))
          }
        }
        if (page.dateRange) {
          if (!DATE_RANGES.some(r => r.value === page.dateRange)) {
            add('dateRange', t('“{dateRange}” is not a period', { dateRange: page.dateRange }))
          } else if (widgets.length > 0 && !widgets.some(w => widgetDateField(w, entityOf(w.entity)))) {
            add('dateRange', t('no widget counts an entity with a filterable date'),
              t('{where} has a period picker, but none of its widgets has a date for it to limit', { where }))
          }
        }
        checkDashboardFilters(page, entities, add, where, (fi, name) => patchPage(index, t('Drop the “{name}” filter', { name }), p => {
          const rest = (p.filters ?? []).filter((_, j) => j !== fi)
          const { filters: _filters, ...kept } = p
          return rest.length ? { ...kept, filters: rest } : kept
        }))
        break
      }
      case 'tabs': {
        if (!page.title?.trim()) add('title', t('needs a title (there is no entity to name it after)'))
        const tabs = page.tabs ?? []
        if (tabs.length < MIN_TABS || tabs.length > MAX_TABS) {
          add('tabs', t('needs between {min} and {max} tabs', { min: MIN_TABS, max: MAX_TABS }))
        }
        const seenTabs = new Set<string>()
        tabs.forEach((tab, ti) => {
          const targetType = typeById.get(tab.page)
          if (!targetType) {
            add(`tab.${ti}`, tab.page ? t('no page with id “{page}”', { page: tab.page }) : t('needs a page'),
              t('{where} has a tab for the missing page “{page}”', { where, page: tab.page }))
          } else if (targetType === 'tabs' || targetType === 'record') {
            add(`tab.${ti}`, t('a tab cannot embed a {targetType} page', { targetType }),
              t('{where} has a tab embedding the {targetType} page “{page}”', { where, targetType, page: tab.page }))
          } else if (seenTabs.has(tab.page)) {
            add(`tab.${ti}`, t('is already a tab of this page'), t('{where} has “{page}” as a tab twice', { where, page: tab.page }))
          }
          seenTabs.add(tab.page)
        })
        break
      }
      case 'master-detail': {
        const parent = entityOf(page.parent)
        const child = entityOf(page.child)
        if (!parent) {
          add('parent', page.parent ? t('“{parent}” is no longer an entity', { parent: page.parent }) : t('needs a parent entity'),
            t('{where} lists “{entity}”, which is no longer an entity', { where, entity: page.parent ?? '' }),
            page.parent ? removePage(index) : undefined)
        } else if (!singlePk(parent)) {
          add('parent', t('{entity} has a composite key', { entity: parent.name }),
            t('{where} lists {entity}, which has a composite key', { where, entity: parent.name }))
        }
        if (!child) {
          add('child', page.child ? t('“{child}” is no longer an entity', { child: page.child }) : t('needs a child entity'),
            t('{where} shows “{entity}”, which is no longer an entity', { where, entity: page.child ?? '' }),
            page.child ? removePage(index) : undefined)
        } else if (parent) {
          const candidates = relationsTo(child, parent.name)
          if (candidates.length === 0) {
            add('child', t('{entity} has no relation to {entity2}', { entity: child.name, entity2: parent.name }),
              t('{where} shows {entity}, which has no relation to {entity2}', { where, entity: child.name, entity2: parent.name }))
          } else if (page.via && !candidates.some(c => c.toLowerCase() === page.via!.toLowerCase())) {
            add('via', t('“{via}” is not a relation to {entity}', { via: page.via, entity: parent.name }),
              t('{where} links through “{via}”, which is not a relation of {entity} to {entity2}', { where, via: page.via, entity: child.name, entity2: parent.name }))
          } else if (!page.via && candidates.length > 1) {
            add('via', t('pick the relation to link through'),
              t('{where} must say which of the relations of {entity} to {entity2} it links through', { where, entity: child.name, entity2: parent.name }),
              patchPage(index, t('Link through “{candidates}”', { candidates: candidates[0] }), p => ({ ...p, via: candidates[0] })))
          }
        }
        // The child list may open with its own columns and sort.
        if (child && (page.columns || page.sort)) checkListPresentation(page, child, add, t('{where}’s {entity} list', { where, entity: child.name }), scaffoldOpts)
        break
      }
      case 'report': {
        const e = entityOf(page.entity)
        if (!e) {
          add('entity', page.entity ? t('“{entity}” is no longer an entity', { entity: page.entity }) : t('needs an entity'),
            page.entity ? t('{where} reports on “{entity}”, which is no longer an entity', { where, entity: page.entity })
              : t('{where} reports on no entity', { where }),
            page.entity ? switchPage(index) ?? removePage(index) : undefined,
            page.entity && switchPage(index) ? removePage(index) : undefined)
          break
        }
        const charts = reportCharts(page)
        if (page.chart && page.charts?.length) {
          add('chart.groupBy', t('has both a chart and a list of charts'), t('{where} sets both “chart” and “charts”', { where }))
        }
        if (charts.length > MAX_CHARTS) add('chart.groupBy', t('has more than {max} charts', { max: MAX_CHARTS }))
        const chartable = chartableFields(e)
        charts.forEach((chart, ci) => {
          const which = charts.length > 1 ? t('{where} (chart {n})', { where, n: ci + 1 }) : where
          // The grouping the chart resolves to: the named field, else the generator's default.
          const groupName = chart.groupBy ?? defaultReportGroupBy(e)
          const grouped = groupName ? e.fields.find(f => f.name === groupName) : undefined
          if (chart.groupBy && !chartable.some(f => f.name === chart.groupBy) && !relationKeys(e).includes(chart.groupBy)) {
            add(chartControl(ci, 'groupBy'), t('{entity} has no enum, boolean or date field, or relation, “{groupBy}”', { entity: e.name, groupBy: chart.groupBy }),
              t('{which} groups by “{groupBy}”, which is not an enum, boolean or date field, or a relation, of {entity}', { which, groupBy: chart.groupBy, entity: e.name }))
          } else if (!chart.groupBy && chartable.length === 0) {
            add(chartControl(ci, 'groupBy'), t('{entity} has no enum, boolean or date field to group by', { entity: e.name }),
              t('{which} reports on {entity}, which has no enum, boolean or date field to group by', { which, entity: e.name }))
          }
          const overTime = grouped ? dateFields(e).some(f => f.name === grouped.name) : false
          if (chart.bucket && !overTime) {
            add(chartControl(ci, 'bucket'), t('a bucket applies to a date grouping'),
              t('{which} buckets by {bucket}, but it does not group over a date', { which, bucket: chart.bucket }))
          }
          for (const issue of aggIssues(chart.agg, chart.field, e, false)) {
            add(chartControl(ci, 'field'), issue.message, t('{where} {message}', { where: which, message: issue.summary }))
          }
          const byRelation = !!groupName && relationKeys(e).includes(groupName)
          if (chart.kind && !chartKindsFor(overTime, byRelation).some(k => k.value === chart.kind)) {
            add(chartControl(ci, 'kind'), overTime ? t('a {kind} chart cannot draw a date over time', { kind: chart.kind })
              : byRelation && chart.kind === 'stacked' ? t('a stacked chart splits an enum or boolean grouping, not a relation')
                : t('a {kind} chart draws a date over time', { kind: chart.kind }),
            t('{which} is drawn as {kind}, which does not fit its grouping', { which, kind: chart.kind }))
          }
          if (chart.series && chart.kind !== 'stacked') {
            add(chartControl(ci, 'series'), t('only a stacked chart splits by a series'), t('{which} splits by “{series}” but is not stacked', { which, series: chart.series }))
          } else if (chart.kind === 'stacked' && !byRelation && !overTime) {
            const series = chart.series ?? defaultChartSeries(e, groupName)
            if (!series) {
              add(chartControl(ci, 'series'), t('{entity} needs a second enum or boolean field to split the bars by', { entity: e.name }),
                t('{which} is stacked, but {entity} has no second enum or boolean field', { which, entity: e.name }))
            } else if (series === groupName || !groupByFields(e).some(f => f.name === series)) {
              add(chartControl(ci, 'series'), t('“{series}” must be an enum or boolean field other than the grouping', { series }),
                t('{which} splits by “{series}”, which is not another enum or boolean field', { which, series }))
            }
          }
          if (chart.kind === 'table' && chart.table === false) {
            add(chartControl(ci, 'kind'), t('a table chart is its totals table'), t('{which} is a table chart without its table', { which }))
          }
        })
        checkPresetFilter(page.presetFilter, e, entityOf, add, where)
        break
      }
      case 'record': {
        const e = entityOf(page.entity)
        if (!e) {
          add('entity', page.entity ? t('“{entity}” is no longer an entity', { entity: page.entity }) : t('needs an entity'),
            t('{where} opens “{entity}”, which is no longer an entity', { where, entity: page.entity ?? '' }),
            page.entity ? switchPage(index) ?? removePage(index) : undefined,
            page.entity && switchPage(index) ? removePage(index) : undefined)
          break
        }
        if (!singlePk(e)) {
          add('entity', t('{entity} has a composite key', { entity: e.name }),
            t('{where} opens {entity}, which has a composite key and cannot be addressed by one id', { where, entity: e.name }))
        }
        const already = recordEntities.get(e.name)
        if (already) {
          add('entity', t('{entity} already has the record page “{already}”', { entity: e.name, already }),
            t('{where} is a second record page for {entity}', { where, entity: e.name }))
        }
        recordEntities.set(e.name, page.id)
        const seenChildren = new Set<string>()
        const childTabs = page.childTabs ?? []
        childTabs.forEach((tab, ci) => {
          const name = childTabEntity(tab)
          const via = childTabVia(tab)
          const child = entityOf(name)
          if (!child) {
            add(`childTab.${ci}`, t('“{name}” is no longer an entity', { name }),
              t('{where} has a tab for “{name}”, which is no longer an entity', { where, name }),
              patchPage(index, t('Remove the {name} tab', { name }), p => ({ ...p, childTabs: (p.childTabs ?? []).filter((_, j) => j !== ci) })))
          } else if (relationsTo(child, e.name).length === 0) {
            add(`childTab.${ci}`, t('{entity} has no relation to {entity2}', { entity: child.name, entity2: e.name }),
              t('{where} has a tab for {entity}, which has no relation to {entity2}', { where, entity: child.name, entity2: e.name }))
          } else if (seenChildren.has(child.name)) {
            add(`childTab.${ci}`, t('is already a tab'), t('{where} has {entity} as a tab twice', { where, entity: child.name }))
          } else if (via && !relationsTo(child, e.name).includes(via)) {
            add(`childTab.${ci}`, t('{entity} has no relation “{via}” to {entity2}', { entity: child.name, via, entity2: e.name }),
              t('{where} links {entity} through “{via}”, which is not one of its relations to {entity2}', { where, entity: child.name, via, entity2: e.name }))
          }
          const shown = childTabPresentation(tab)
          if (child && (shown.columns || shown.sort)) {
            checkListPresentation({ id: page.id, type: 'entity-list', ...shown }, child,
              (_field, message, summary, fix) => add(`childTab.${ci}`, message, summary, fix), t('{where}’s {entity} tab', { where, entity: child.name }), scaffoldOpts)
          }
          if (child) seenChildren.add(child.name)
        })
        if (childTabs.length > MAX_CHILD_TABS) add('childTabs', t('has more than {max} related lists', { max: MAX_CHILD_TABS }))
        const stats = page.headerStats ?? []
        if (stats.length > MAX_HEADER_STATS) add('headerStats', t('has more than {max} header numbers', { max: MAX_HEADER_STATS }))
        stats.forEach((s, si) => {
          const child = entityOf(s.child)
          if (!child) {
            add(`headerStat.${si}`, t('“{child}” is no longer an entity', { child: s.child }),
              t('{where} has a header number for “{child}”, which is no longer an entity', { where, child: s.child }),
              patchPage(index, t('Remove the {child} tile', { child: s.title || s.child }), p => ({ ...p, headerStats: (p.headerStats ?? []).filter((_, j) => j !== si) })))
          } else if (relationsTo(child, e.name).length === 0) {
            add(`headerStat.${si}`, t('{entity} has no relation to {entity2}', { entity: child.name, entity2: e.name }),
              t('{where} has a header number for {entity}, which has no relation to {entity2}', { where, entity: child.name, entity2: e.name }))
          } else if (s.via && !relationsTo(child, e.name).includes(s.via)) {
            add(`headerStat.${si}`, t('{entity} has no relation “{via}” to {entity2}', { entity: child.name, via: s.via, entity2: e.name }),
              t('{where} has a header number linked through “{via}”, which is not a relation of {entity} to {entity2}', { where, via: s.via, entity: child.name, entity2: e.name }))
          } else {
            for (const issue of aggIssues(s.agg, s.field, child, false)) {
              add(`headerStat.${si}`, issue.message, t('{where} has a header number that {summary}', { where, summary: issue.summary }))
            }
          }
        })
        break
      }
      case 'wizard': {
        const e = entityOf(page.entity)
        if (!e) {
          add('entity', page.entity ? t('“{entity}” is no longer an entity', { entity: page.entity }) : t('needs an entity'),
            t('{where} creates “{entity}”, which is no longer an entity', { where, entity: page.entity ?? '' }),
            page.entity ? switchPage(index) ?? removePage(index) : undefined,
            page.entity && switchPage(index) ? removePage(index) : undefined)
          break
        }
        if (e.readOnly) add('entity', t('{entity} is read-only', { entity: e.name }), t('{where} creates {entity}, which is read-only', { where, entity: e.name }))
        checkOneCreatePage(e, page, where, add)
        const askable = wizardFields(e)
        const steps = page.steps ?? []
        if (steps.length > MAX_STEPS) add('steps', t('has more than {max} steps', { max: MAX_STEPS }))
        const asked = new Set<string>()
        steps.forEach((step, si) => {
          if (step.fields.length === 0) add(`step.${si}`, t('asks for nothing'), t('{where} has an empty step {n}', { where, n: si + 1 }))
          for (const name of step.fields) {
            if (name === e.workflow?.statusField) {
              add(`step.${si}`, t('“{name}” is set by the workflow', { name }), t('{where} asks for “{name}”, which its workflow sets', { where, name }))
            } else if (name === e.workflow?.assigneeField) {
              add(`step.${si}`, t('“{name}” is set by claiming and reassigning', { name }), t('{where} asks for “{name}”, which is set by claiming and reassigning', { where, name }))
            } else if (!askable.some(a => a.name === name)) {
              add(`step.${si}`, t('{entity} has no field “{name}”', { entity: e.name, name }), t('{where} asks for “{name}”, which {entity} no longer has', { where, name, entity: e.name }))
            } else if (asked.has(name)) {
              add(`step.${si}`, t('“{name}” is already asked for', { name }), t('{where} asks for “{name}” twice', { where, name }))
            }
            asked.add(name)
          }
        })
        if (steps.length > 0) {
          const missing = askable.filter(a => a.required && !asked.has(a.name)).map(a => a.name)
          if (missing.length > 0) {
            add('steps', tn(missing.length, 'never asks for {fields}, which is required', 'never asks for {fields}, which are required',
              { fields: missing.map(m => `“${m}”`).join(', ') }),
              undefined,
              patchPage(index, t('Add {fields} to the last step', { fields: missing.join(', ') }), p => {
                const next = [...(p.steps ?? [])]
                if (next.length === 0) return p
                const last = next[next.length - 1]
                const asked = new Set(next.flatMap(s => s.fields))
                next[next.length - 1] = { ...last, fields: [...last.fields, ...missing.filter(m => !asked.has(m))] }
                return { ...p, steps: next }
              }))
          }
        }
        if (askable.length === 0) add('entity', t('{entity} has no field to ask for', { entity: e.name }))
        break
      }
      case 'form': {
        const e = entityOf(page.entity)
        if (!e) {
          add('entity', page.entity ? t('“{entity}” is no longer an entity', { entity: page.entity }) : t('needs an entity'),
            page.entity ? t('{where} creates “{entity}”, which is no longer an entity', { where, entity: page.entity }) : t('{where} names no entity', { where }),
            page.entity ? switchPage(index) ?? removePage(index) : undefined,
            page.entity && switchPage(index) ? removePage(index) : undefined)
          break
        }
        if (e.readOnly) add('entity', t('{entity} is read-only', { entity: e.name }), t('{where} creates {entity}, which is read-only', { where, entity: e.name }))
        checkOneCreatePage(e, page, where, add)
        break
      }
      case 'tree': {
        const e = entityOf(page.entity)
        if (!e) {
          add('entity', page.entity ? t('“{entity}” is no longer an entity', { entity: page.entity }) : t('needs an entity'),
            page.entity ? t('{where} shows “{entity}”, which is no longer an entity', { where, entity: page.entity }) : t('{where} names no entity', { where }),
            page.entity ? removePage(index) : undefined)
          break
        }
        const links = selfLinks(e)
        if (e.fields.filter(f => f.primaryKey).length !== 1) {
          add('entity', t('{entity} has a composite key', { entity: e.name }), t('{where} draws a tree of {entity}, which has a composite key', { where, entity: e.name }))
        } else if (links.length === 0) {
          add('entity', t('{entity} has no relation to itself', { entity: e.name }), t('{where} draws a tree of {entity}, which has no relation to itself (a parent)', { where, entity: e.name }))
        } else if (page.via && !links.some(r => r.fieldName.toLowerCase() === page.via!.toLowerCase())) {
          add('via', t('“{via}” is not a relation of {entity} to itself', { via: page.via, entity: e.name }),
            t('{where} draws its tree by “{via}”, which is not a relation of {entity} to itself', { where, via: page.via, entity: e.name }),
            patchPage(index, t('Use {link}', { link: links[0].fieldName }), p => ({ ...p, via: links.length === 1 ? undefined : links[0].fieldName })))
        } else if (!page.via && links.length > 1) {
          add('via', t('say which link makes the tree'),
            t('{where} draws a tree of {entity}, which points at itself through {links}', { where, entity: e.name, links: links.map(r => r.fieldName).join(t(' and ')) }),
            patchPage(index, t('Use {link}', { link: links[0].fieldName }), p => ({ ...p, via: links[0].fieldName })))
        }
        break
      }
      case 'calendar':
      case 'board':
      case 'inbox':
      case 'import': {
        const e = entityOf(page.entity)
        if (!e) {
          add('entity', page.entity ? t('“{entity}” is no longer an entity', { entity: page.entity }) : t('needs an entity'),
            page.entity ? t('{where} shows “{entity}”, which is no longer an entity', { where, entity: page.entity }) : t('{where} names no entity', { where }),
            page.entity ? removePage(index) : undefined)
          break
        }
        if (page.type === 'calendar') {
          checkPresetFilter(page.presetFilter, e, entityOf, add, where)
          checkCalendar(page, e, add, where)
        } else if (page.type === 'board') {
          checkPresetFilter(page.presetFilter, e, entityOf, add, where)
          checkBoard(page, e, add, where)
          if (page.sort) checkListPresentation({ id: page.id, type: 'entity-list', entity: e.name, sort: page.sort }, e, add, where, scaffoldOpts)
        } else if (page.type === 'inbox') {
          checkPresetFilter(page.presetFilter, e, entityOf, add, where)
          checkInbox(page, e, add, where)
          if (page.sort) checkListPresentation({ id: page.id, type: 'entity-list', entity: e.name, sort: page.sort }, e, add, where, scaffoldOpts)
        } else {
          checkImport(page, e, pages, add, where)
        }
        break
      }
      case 'content':
        checkContent(page, pages, add, where)
        break
      case 'search':
        checkSearch(page, entities, pages, add, where)
        break
    }
  })

  if (!pages.some(p => !p.hidden && p.type !== 'record')) {
    issues.push({ message: '', summary: t('Every page is hidden — at least one must be in the navigation') })
  }
  return issues
}

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
