/**
 * The frontend page layout (`pages`) model: validation, the summary lines the editor shows, and
 * the bulk operations (seed a layout from the entities, follow a rename, retarget a page).
 *
 * The code is in `./pageLayout/`, by area; this file is the list of what the model offers, so
 * every `from './pageLayout'` reads as it always did. Add a function to the module of its area
 * and to the list here.
 */

export {
  PAGE_ID, MAX_PAGES, MAX_TITLE, MAX_DESCRIPTION, MAX_WIDGETS, MIN_TABS, MAX_TABS, MAX_CHILD_TABS, MAX_RECENT_LIMIT,
  MAX_GROUP, MAX_SPAN, MAX_CHARTS, MAX_STEPS, DEFAULT_STEP_SIZE, MAX_HEADER_STATS, MAX_TEXT, MAX_LINKS,
  LIST_WIDGET_LIMITS, LIST_PAGE_SIZES, DEFAULT_PAGE_SIZE, LIST_VIEWS,
} from './pageLayout/limits'
export {
  valuesOf,
} from './pageLayout/entityHelpers'
export {
  pagesEmbedding, createsRows, canDuplicate, linkablePages, tabCandidates,
} from './pageLayout/pageKinds'
export {
  auditOn, listColumns, sortableKeys, enabledListViews, viewDisabledReason, LIST_ACTIONS,
} from './pageLayout/listPresentation'
export type {
  ListColumnOption,
} from './pageLayout/listPresentation'
export {
  wizardFields, stepFields, askableFields, defaultWizardSteps,
} from './pageLayout/wizardFields'
export {
  reportCharts, chartControl, rankableKeys, defaultTopGroupBy, DATE_RANGES, REFRESH_CHOICES, reloads, defaultSpan,
  defaultSeries, CHART_KINDS, chartKindsFor, defaultChartSeries, groupByFields, groupableFields, dateFields,
  filterableDateFields, MAX_DASHBOARD_FILTERS, readsEntity, MAX_ACTIVITY_ENTITIES, MIN_ACTIVITY_LIMIT,
  activityEntities, defaultPivotColumns, dashboardFilterEntities, dashboardFilterShape, resolveDashboardFilter,
  dashboardFilterCandidates, drillToPages, widgetDateField, trendDateField, numericFields, chartableFields,
  relationKeys, reportGroupKeys, defaultBarGroupBy, defaultLineGroupBy, funnelStageFields, widgetKindDisabledReason,
  newWidget, defaultReportGroupBy, defaultOptionLabel,
} from './pageLayout/dashboard'
export type {
  DashboardFilterResolution,
} from './pageLayout/dashboard'
export {
  NAV_ICONS, DEFAULT_NAV_ICON, inNav, navSections, renameGroupInPages, moveNavGroup, adoptedGroup,
} from './pageLayout/nav'
export {
  PRESET_PERIODS, presetKind, presettableFields, presettableRelations, relationPresetKey, relationOfPresetKey,
  relationPresetProblem, presetValues, parsePresetRange, presetValueProblem, defaultPresetValue, describePresetValue,
} from './pageLayout/presets'
export type {
  PresetKind,
} from './pageLayout/presets'
export {
  childTabEntity, childTabVia, childTab, withChildTab, childTabPresentation, retargetHeaderStat, relationsTo,
} from './pageLayout/childTabs'
export {
  PAGE_ROLES, validatePages, fixAllProblems, pageLayoutProblems, pageOfServerError,
} from './pageLayout/validate'
export type {
  PageFix, PageLayoutValidation, LayoutWarning, PageLayoutContext,
} from './pageLayout/validate'
export {
  ADVICE,
} from './pageLayout/advice'
export {
  describePage, pageLabel, slugify, uniquePageId, seedLayout, PAGE_TYPE_META, describePagesChange,
} from './pageLayout/labels'
export {
  renameEntityInPages, renameFieldInPages, renamePageIdInPages, dropTabsTo, removePageAt, renameRelationInPages,
  renameEnumValueInPages,
} from './pageLayout/references'
export {
  selfLinks, treeReason, duplicatePage, requestPages, splitDisabledReason, splitListByField, blankPage, pairKey,
  newPageChoices, newPageTypeReason, masterDetailPairs,
} from './pageLayout/newPages'
export type {
  NewPageChoice,
} from './pageLayout/newPages'
export {
  suggestPages, suggestWidgets, pageFromSuggestion,
} from './pageLayout/suggestions'
export type {
  PageSuggestion, WidgetSuggestion,
} from './pageLayout/suggestions'
export {
  retargetPage, keptPresetFilter, retargetWidget, retargetEntityList, retargetMasterDetail,
  retargetMasterDetailChild, retargetRecord, stripDateRange, retargetReport, retargetWizardSteps,
} from './pageLayout/retarget'
