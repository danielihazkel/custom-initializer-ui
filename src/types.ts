// Metadata API shapes
export interface MetadataOption {
  id: string
  name: string
  description?: string
  versionRange?: string
}
export interface DependencyGroup {
  name: string
  values: MetadataOption[]
}
export interface MetadataField {
  values: MetadataOption[]
  default: string
}
export interface InitializrMetadata {
  bootVersion:  MetadataField
  javaVersion:  MetadataField
  language:     MetadataField
  packaging:    MetadataField
  type:         MetadataField
  dependencies: { values: DependencyGroup[] }
}

// Form state
export interface ProjectFormValues {
  groupId:     string
  artifactId:  string
  name:        string
  description: string
  packageName: string
  bootVersion: string
  language:    string
  type:        string
  packaging:   string
  javaVersion: string
  /** Department id ({{department}} in templates); '' = the server's default department. */
  department:  string
}

// Dependency sub-options
export interface SubOption {
  id: string
  label: string
  description: string
}
export type DependencyExtensions = Record<string, SubOption[]>

// Hook return
export interface UseMetadataResult {
  metadata: InitializrMetadata | null
  loading:  boolean
  error:    string | null
}

export interface UseExtensionsResult {
  extensions: DependencyExtensions
  loading:    boolean
  error:      string | null
}

// Component props
export interface ProjectFormProps {
  values:   ProjectFormValues
  onChange: (updates: Partial<ProjectFormValues>) => void
  errors?:  Partial<Record<keyof ProjectFormValues, string>>
}
export interface OptionsPanelProps {
  metadata: InitializrMetadata | null
  values:   ProjectFormValues
  onChange: (updates: Partial<ProjectFormValues>) => void
  section:  'upper' | 'lower'
}
export interface DependencySelectorProps {
  metadata:            InitializrMetadata | null
  selected:            string[]
  onChange:            (selected: string[]) => void
  extensions:          DependencyExtensions
  selectedOptions:     Record<string, string[]>
  onOptionsChange:     (depId: string, optIds: string[]) => void
  compatibilityRules:  CompatibilityRule[]
  sqlDialects:         SqlDialects
  sqlByDep:            SqlByDep
  onSqlByDepChange:    (depId: string, entry: SqlWizardEntry | null) => void
  openApiCapableDeps:  string[]
  openApiByDep:        OpenApiByDep
  onOpenApiByDepChange: (depId: string, entry: OpenApiWizardEntry | null) => void
  soapCapableDeps:     string[]
  soapByDep:           SoapByDep
  onSoapByDepChange:   (depId: string, entry: SoapWizardEntry | null) => void
  sqlParseError?:      PreviewError | null
}

// ── SQL Entity Wizard ─────────────────────────────────────────────────────────
export type SqlDialects = Record<string, string>  // depId → dialect enum name

export interface SqlTableConfig {
  name: string
  generateRepository: boolean
}

// How much of a REST stack the SQL wizard generates on top of the parsed entities.
export type SqlApiMode = 'NONE' | 'ENTITY_DIRECT' | 'INLINE_DTO' | 'MAPSTRUCT_DTO'

export interface SqlWizardEntry {
  sql: string
  subPackage: string
  tables: SqlTableConfig[]
  apiMode?: SqlApiMode  // defaults to 'NONE' (entities only) when absent
}

export type SqlByDep = Record<string, SqlWizardEntry>

// ── OpenAPI Wizard ────────────────────────────────────────────────────────────
export type OpenApiMode = 'CONTROLLERS' | 'CLIENT' | 'BOTH'

export interface OpenApiWizardEntry {
  spec: string
  apiSubPackage: string
  dtoSubPackage: string
  clientSubPackage: string
  mode: OpenApiMode
  baseUrlProperty: string
}

export type OpenApiByDep = Record<string, OpenApiWizardEntry>

// ── SOAP Wizard ───────────────────────────────────────────────────────────────
export type SoapMode = 'ENDPOINTS' | 'CLIENT' | 'BOTH'

export interface SoapWizardEntry {
  wsdl: string
  endpointSubPackage: string
  clientSubPackage: string
  payloadSubPackage: string
  mode: SoapMode
  baseUrlProperty: string
  contextPath: string
}

export type SoapByDep = Record<string, SoapWizardEntry>

export interface GenerateButtonProps {
  form:     ProjectFormValues
  selected: string[]
}

// ── Project presets ───────────────────────────────────────────────────────────
export interface ProjectSnapshot {
  form: ProjectFormValues
  selected: string[]
  selectedOptions: Record<string, string[]>
  sqlByDep: SqlByDep
  openApiByDep: OpenApiByDep
  soapByDep: SoapByDep
  multiModuleEnabled: boolean
  selectedModules: string[]
}

export interface ProjectPreset {
  id: string
  name: string
  createdAt: number
  snapshot: ProjectSnapshot
}

// ── Admin entity types ────────────────────────────────────────────────────────

/** Discriminates entries between the Spring Boot backend catalog and the React/Vite frontend catalog. */
export type ProjectKind = 'BACKEND' | 'FRONTEND'

export interface AdminDependencyGroup {
  id: number
  name: string
  sortOrder: number
  projectKind?: ProjectKind
}

export interface AdminDependencyEntry {
  id: number
  group: { id: number }
  depId: string
  name: string
  description: string
  mavenGroupId: string
  mavenArtifactId: string
  version: string
  scope: string
  repository: string
  compatibilityRange: string
  sortOrder: number
  starter: boolean
  projectKind?: ProjectKind
}

export type FileType = 'STATIC_COPY' | 'YAML_MERGE' | 'TEMPLATE' | 'DELETE'
export type SubstitutionType = 'MUSTACHE' | 'NONE'

export interface AdminFileContribution {
  id: number
  dependencyId: string
  fileType: FileType
  content: string
  targetPath: string
  substitutionType: SubstitutionType
  javaVersion: string
  subOptionId: string
  sortOrder: number
  projectKind?: ProjectKind
}

export type BuildCustomizationType =
  | 'ADD_DEPENDENCY'
  | 'EXCLUDE_DEPENDENCY'
  | 'ADD_REPOSITORY'
  | 'ADD_NPM_DEPENDENCY'
  | 'ADD_NPM_SCRIPT'
  | 'ADD_VITE_PLUGIN'

export interface AdminBuildCustomization {
  id: number
  dependencyId: string
  customizationType: BuildCustomizationType
  mavenGroupId: string
  mavenArtifactId: string
  version: string
  excludeFromGroupId: string
  excludeFromArtifactId: string
  repoId: string
  repoName: string
  repoUrl: string
  snapshotsEnabled: boolean
  scope?: string
  subOptionId?: string
  sortOrder: number
  projectKind?: ProjectKind
}

export interface AdminSubOption {
  id: number
  dependencyId: string
  optionId: string
  label: string
  description: string
  sortOrder: number
  projectKind?: ProjectKind
}

// Compatibility rules
export type RelationType = 'REQUIRES' | 'CONFLICTS' | 'RECOMMENDS'

export interface CompatibilityRule {
  sourceDepId: string
  targetDepId: string
  relationType: RelationType
  description: string
  projectKind: ProjectKind
}

export interface AdminDependencyCompatibility {
  id: number
  sourceDepId: string
  targetDepId: string
  relationType: RelationType
  description: string
  sortOrder: number
  projectKind?: ProjectKind
}

export type AdminTab = 'overview' | 'activity' | 'groups' | 'entries' | 'files' | 'builds' | 'suboptions' | 'compatibility' | 'templates' | 'modules' | 'palettes' | 'entity-templates' | 'versions' | 'departments' | 'fullstack-examples'

/** Discriminator for {@link AdminVersion} rows — backend Java/Boot plus frontend React/Node/package-manager lists. */
export type VersionKind = 'JAVA' | 'BOOT' | 'REACT' | 'NODE' | 'PACKAGE_MANAGER'

export interface AdminVersion {
  id: number
  kind: VersionKind
  versionId: string
  displayName: string
  isDefault: boolean
  sortOrder: number
  enabled: boolean
  /** npm semver range for {@code react}/{@code react-dom} — REACT rows only. */
  npmSemver?: string | null
  /** npm semver range for {@code @types/react}/{@code @types/react-dom} — REACT rows only. */
  typesSemver?: string | null
}

// ── Fullstack CRUD scaffolding ────────────────────────────────────────────────

export type EntityTemplateSetKind = 'BACKEND_JAVA' | 'FRONTEND_REACT'

export type DesignSystem = 'TAILWIND' | 'MUI' | 'CHAKRA' | 'MANTINE' | 'SHADCN' | 'MENORA_DIGITAL' | 'NONE'

export interface AdminEntityTemplateSet {
  id: number
  setKey: string
  name: string
  description: string | null
  kind: EntityTemplateSetKind
  enabled: boolean
  sortOrder: number
  designSystem: DesignSystem | null
  bootVersion: string | null
  javaVersion: string | null
  defaultPaletteId: string | null
}

export type EntityTemplateFileType = 'TEMPLATE' | 'STATIC_COPY'

export interface AdminEntityTemplateFile {
  id: number
  setId: number
  pathTemplate: string
  content: string
  substitutionType: SubstitutionType
  fileType: EntityTemplateFileType
  perEntity: boolean
  sortOrder: number
}

export type FullstackFieldType =
  | 'STRING' | 'TEXT' | 'LONG' | 'INTEGER' | 'BOOLEAN'
  | 'LOCAL_DATE' | 'LOCAL_DATE_TIME' | 'BIG_DECIMAL' | 'UUID' | 'ENUM'

export interface FullstackFieldDef {
  /** Client-only editor row identity (React key); stripped before the request is sent. */
  uid?: string
  name: string
  type: FullstackFieldType
  primaryKey?: boolean
  generated?: boolean
  required?: boolean
  unique?: boolean
  length?: number
  min?: number
  max?: number
  pattern?: string
  email?: boolean
  enumValues?: string[]
  /** Display labels per enum constant (`{ IN_PROGRESS: 'In progress' }` / Hebrew), shown by the
   *  generated dropdowns, filter chips, kanban lanes, table cells and detail rows. A constant
   *  without one is humanized (`IN_PROGRESS` → "In progress"). Optional and additive: older
   *  presets, team models and share links simply lack it. */
  enumLabels?: Record<string, string>
  // Per-field search/filter opt-out (default on). searchable applies to STRING/TEXT (text-search box);
  // filterable to enum/boolean/date/numeric (filter bar). Omitted = default true; written false to exclude.
  searchable?: boolean
  filterable?: boolean
  /** Human-facing display label for the generated UI (table header, form label, filter chip,
   *  detail row). Omitted/blank falls back to the PascalCase field name. Enables e.g. Hebrew labels. */
  label?: string
  /** Locked-after-create: the generated form disables the field on edit and the backend
   *  Service.update never overwrites it. Editable when creating a new row. */
  readOnly?: boolean
  /** Initial value, as text, type-checked server-side per field type (integral/decimal parse,
   *  true/false, ISO date/date-time, UUID, an enum constant). Rendered as the entity's field
   *  initializer, the generated form's starting value and the demo-data seed. Not allowed on a
   *  generated primary key. */
  defaultValue?: string
}

/** Per-entity override of a project-wide scaffold opt (true = force on, false = force off;
 *  absent = inherit). Keys: audit, softDelete, csvExport, bulkDelete, bulkUpdate, tests. */
export type FullstackEntityOpts = Partial<Record<FullstackEntityOptKey, boolean>>
export type FullstackEntityOptKey = 'audit' | 'softDelete' | 'csvExport' | 'bulkDelete' | 'bulkUpdate' | 'tests' | 'csvImport'
export const FULLSTACK_ENTITY_OPT_KEYS: FullstackEntityOptKey[] = ['audit', 'softDelete', 'csvExport', 'bulkDelete', 'bulkUpdate', 'tests', 'csvImport']

// v1 supports the FK-owning side only (MANY_TO_ONE); the inverse @OneToMany is auto-derived
// server-side via the inverseCollections opt.
export type FullstackRelationType = 'MANY_TO_ONE'

export interface FullstackRelationDef {
  /** Client-only editor row identity (React key); stripped before the request is sent. */
  uid?: string
  type: FullstackRelationType
  fieldName: string
  targetEntity: string
  required?: boolean
}

export interface FullstackEntityDef {
  /** Client-only editor row identity (React key); stripped before the request is sent. */
  uid?: string
  name: string
  tableName?: string
  schema?: string
  fields: FullstackFieldDef[]
  relations?: FullstackRelationDef[]
  /** Human-facing entity display label for the generated UI (nav, list heading, dashboard,
   *  dialogs). Omitted/blank falls back to the PascalCase name. Enables e.g. Hebrew names. */
  label?: string
  /** Plural form of {@link label} used on plural surfaces (nav, list H1, dashboard). Omitted/blank
   *  falls back to {@link label}, then the derived PascalCase plural — auto-pluralizing a localized
   *  label is unsafe, so supply it explicitly. */
  labelPlural?: string
  /** Read-only entity — generates GET-only scaffolding (no create/update/delete). */
  readOnly?: boolean
  /** The list-view modes the generated entity page generates (subset of table/cards/kanban/
   *  calendar, ordered; first = initial). A runtime toggle is emitted only when 2+ are enabled,
   *  and unsupported modes are dropped (kanban needs an ENUM/BOOLEAN field + a writable entity;
   *  calendar needs a LOCAL_DATE/LOCAL_DATE_TIME field). Empty/absent defaults to ['table']. */
  listViews?: FullstackListView[]
  /** @deprecated Legacy single initial view — still read for back-compat when {@link listViews}
   *  is absent. New code should write {@link listViews}. */
  listView?: FullstackListView
  /** Raw SELECT this entity maps to via Hibernate @Immutable/@Subselect. Implies readOnly. */
  viewQuery?: string
  /** Originating CREATE TABLE this entity was imported from. Informational only —
   *  shown read-only in the editor; not used during generation. */
  sourceSql?: string
  /** Per-entity overrides of the project-wide `opts.scaffold` flags (see {@link FullstackEntityOpts}). */
  opts?: FullstackEntityOpts
  /** The form in titled sections (the drawer form, the record's details, and a wizard without
   *  its own steps follow them); fields no section lists come after, untitled. */
  formSections?: FullstackFormSection[]
}

/** A titled group of an entity's form: field and MANY_TO_ONE relation names, in order. */
export interface FullstackFormSection {
  title: string
  fields: string[]
}

/** A fullstack model saved on the server for the whole team (`/metadata/fullstack/models`).
 *  The listing carries summaries only; the snapshot comes with `GET /{id}`. */
export interface TeamModelSummary {
  id: number
  name: string
  description: string | null
  entityCount: number
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface EntityTemplateSetSummary {
  setKey: string
  name: string
  description: string | null
  kind: EntityTemplateSetKind
  defaultDeps: string[]
  designSystem: DesignSystem | null
  bootVersion: string | null
  javaVersion: string | null
  defaultPaletteId: string | null
}

export interface FullstackStarterRequest {
  groupId?: string
  artifactId?: string
  name?: string
  description?: string
  packageName?: string
  domainPackage?: string
  bootVersion?: string
  packaging?: string
  javaVersion?: string
  version?: string
  dependencies?: string[]
  backendTemplateSet?: string
  frontendTemplateSet?: string
  /** Optional dashboard header overrides; blank falls back to the generated defaults. */
  dashboardTitle?: string
  dashboardOverview?: string
  /** Language of the generated frontend's own chrome strings; omitted = English. */
  locale?: 'en' | 'he'
  /** The shell's navigation for a page layout (needs `pages`). */
  nav?: FullstackNav
  /** Department id exposed to both halves' templates as {{department}}; omitted = the default. */
  department?: string
  /** Opt-in scaffolding extras, e.g. { scaffold: ["audit","softDelete","inverseCollections","tests"] }. */
  opts?: Record<string, string[]>
  /** Seeded colour-palette id for the generated frontend; omitted = the frontend set's default. */
  colorPalette?: string
  entities: FullstackEntityDef[]
  /** Frontend page layout; omitted = the classic shell (a dashboard + one list page per entity). */
  pages?: FullstackPageDef[]
}

export interface AdminDepartment {
  id: number
  departmentId: string
  name: string
  isDefault: boolean
  sortOrder: number
}

/** One row of `/admin/fullstack-examples` — a "Start from → Examples" model. */
export interface AdminFullstackExample {
  id: number
  exampleId: string
  name: string
  description: string | null
  icon: string | null
  entities: FullstackEntityDef[]
  pages: FullstackPageDef[] | null
  settings: ExampleSettings | null
  sortOrder: number
  enabled: boolean
}

/** A ready-made entity model the Fullstack tab can start from (`GET /metadata/fullstack/examples`). */
export interface ExampleModel {
  id: string
  name: string
  description: string | null
  /** Material Symbols icon name. */
  icon: string | null
  entities: FullstackEntityDef[]
  /** The frontend page layout the example showcases; null = the classic shell. */
  pages?: FullstackPageDef[] | null
  /** Editor settings the example applies on load (only the keys present). */
  settings?: ExampleSettings | null
}

/** The page types a fullstack frontend layout is built from (FullstackPageValidator). */
export type FullstackPageType = 'entity-list' | 'dashboard' | 'tabs' | 'master-detail' | 'record' | 'report' | 'wizard'
  | 'calendar' | 'board' | 'content' | 'import' | 'search'

/** The views a calendar page offers (FullstackPageValidator.calendar). */
export type FullstackCalendarMode = 'month' | 'week' | 'agenda' | 'timeline'

/** The lucide icons a page may show in the generated nav (FullstackPageValidator.NAV_ICONS). */
export type FullstackNavIcon =
  | 'BarChart3' | 'Building2' | 'Calendar' | 'Columns3' | 'FileText' | 'Inbox' | 'Layers' | 'LayoutDashboard'
  | 'ListChecks' | 'Package' | 'PanelLeft' | 'Search' | 'Settings' | 'ShoppingCart' | 'Star' | 'Table2' | 'Tag'
  | 'Ticket' | 'Truck' | 'Upload' | 'Users' | 'Wallet' | 'Wand2'

/** How a tile or chart reduces the rows it covers. Anything but `count` needs a numeric field. */
export type FullstackAgg = 'count' | 'sum' | 'avg' | 'min' | 'max'

/** The granularity a time series buckets its date field into. */
export type FullstackBucket = 'day' | 'month' | 'year'

/** The periods a dashboard's picker offers, each ending today. */
export type FullstackDateRange = 'all' | '7d' | '30d' | '90d' | 'ytd' | '12m'

/** The list views a generated entity page can offer (see {@link FullstackEntityDef.listViews}). */
export type FullstackListView = 'table' | 'cards' | 'kanban' | 'calendar'

/** How an entity-list page opens sorted: a sortable column, ascending unless `dir` is `desc`. */
export interface FullstackListSort {
  field: string
  dir?: 'asc' | 'desc'
}

/** A dashboard widget: one number, a breakdown by an enum/boolean field, a time series over a
 *  date field, the latest rows, the largest groups ranked, or one number against a target. */
export interface FullstackWidgetDef {
  kind: 'kpi' | 'bar' | 'donut' | 'stacked' | 'line' | 'recent' | 'top' | 'progress' | 'text' | 'links' | 'list'
  /** The entity the widget reads — empty for a text or links widget. */
  entity: string
  title?: string
  /** bar: the enum/boolean field; line: the date field. Defaults to the entity's first of that kind. */
  groupBy?: string
  /** line: the bucket granularity (default month). */
  bucket?: FullstackBucket
  /** kpi/bar/line: how the rows are reduced (default count). */
  agg?: FullstackAgg
  /** The numeric field `agg` reduces — required unless agg is count, and forbidden when it is. */
  field?: string
  /** recent/top: how many rows (1–20, default 5); list: its page size, 10 or 20 (default 10). */
  limit?: number
  /** Dashboard grid columns (1–4); default 1 for a tile, 2 for a chart or list. */
  span?: number
  /** Field → value the widget is limited to (as a page's presetFilter: a constant, a period or a range). */
  presetFilter?: Record<string, string>
  /** recent: the column it orders by, newest first (default: the primary key). */
  sortBy?: string
  /** The date the dashboard's period picker limits (default: the entity's first filterable date). */
  dateField?: string
  /** kpi: also show the change against the previous period of the dashboard's picker. */
  compare?: boolean
  /** progress: the value the bar fills up to (a positive number, as written). */
  target?: string
  /** stacked: the enum/boolean field each bar is split by (default: the entity's next one). */
  series?: string
  /** text: the note itself; a blank line starts a new paragraph. */
  text?: string
  /** links: the ids of the pages its tiles open (1–8; never a record page, nor a hidden page
   *  that is not a wizard). */
  pages?: string[]
  /** list: the columns it shows, in order (as on a list page; omitted: every column). */
  columns?: string[]
  /** list: the column it opens sorted by. */
  sort?: FullstackListSort
}

/** A report page's single chart: bars when `groupBy` is an enum/boolean, a line when it is a date. */
export interface FullstackChartDef {
  groupBy?: string
  bucket?: FullstackBucket
  agg?: FullstackAgg
  field?: string
  /** The grouped totals table under the chart. Absent: under a report's first chart only. */
  table?: boolean
}

/** The generated security's logical roles (its Constants). */
export type FullstackPageRole = 'ADMIN' | 'USER'

/** A record page's related-list tab: the entity, or `{ entity, via }` to pick which of its
 *  relations to the record entity links them (default: the first). */
export type FullstackChildTabDef = string | {
  entity: string
  via?: string
  /** How the related list opens: its columns, in order, and its sort (as a list page's). */
  columns?: string[]
  sort?: FullstackListSort
}

/** Where an entity-list page opens a row. */
export type FullstackListDetail = 'drawer' | 'side' | 'record'

/** One page of the generated frontend (the `pages` of a fullstack request). */
export interface FullstackPageDef {
  /** Lower-case slug: the nav id and the screen's file name (`tickets-open` → TicketsOpenScreen). */
  id: string
  /** Editor only: the id was typed by hand and no longer follows the title. Stripped from every
   *  request by `requestPages` (the server would ignore it, but a request carries only its API). */
  idLocked?: boolean
  type: FullstackPageType
  /** Nav label; required for tabs, else defaults to the entity's plural label / "Dashboard". */
  title?: string
  description?: string
  /** Out of the navigation — reachable only as a tab. */
  hidden?: boolean
  /** The roles (any of) that may open the page — needs ldap-auth-rest or ldap-auth. Absent: everyone. */
  roles?: FullstackPageRole[]
  /** Nav section (visible pages only): pages sharing a group are listed together under its name. */
  group?: string
  /** Nav icon (visible pages only); default: the page type's own. */
  icon?: FullstackNavIcon
  /** entity-list */
  entity?: string
  /** entity-list / report: field → value the page opens filtered on. An enum constant or
   *  `true`/`false`; on a date field a period (`last:7d`, `last:30d`, `last:90d`, `ytd`, `12m`) or
   *  a range `2026-01-01..2026-03-31`; on a number field a range `100..500` (either side optional). */
  presetFilter?: Record<string, string>
  /** entity-list: the columns the list shows, by key, in this order — field names, relation field
   *  names and, with the audit option, `createdAt`/`updatedAt`. Omitted: every column. */
  columns?: string[]
  /** entity-list: the column the list opens sorted by (default: the primary key). */
  sort?: FullstackListSort
  /** entity-list: the view the list opens in — one the entity actually offers (default: its first). */
  view?: FullstackListView
  /** entity-list: rows per page it opens with — 10, 20, 50 or 100 (default 20). */
  pageSize?: number
  /** entity-list: where a row opens — the quick-look drawer, a pane beside the rows (the open row
   *  in the route) or the entity's record page. Default: the record page when there is one, else the drawer. */
  detail?: FullstackListDetail
  /** dashboard */
  widgets?: FullstackWidgetDef[]
  /** dashboard: a period picker over the widgets' dates, opening on this period. */
  dateRange?: FullstackDateRange
  /** dashboard: reload the widgets every so many seconds while the page is open (30, 60, 300 or
   *  900). Absent: only the generated Refresh button reloads them. */
  refreshSeconds?: number
  /** tabs: 2–6 other pages (never a tabs or record page). */
  tabs?: { title?: string; page: string }[]
  /** master-detail: the entity listed on the left. Needs a single primary key. */
  parent?: string
  /** master-detail: the entity listed for the selected parent. */
  child?: string
  /** master-detail: the child's MANY_TO_ONE field pointing at the parent. Optional while the
   *  child has exactly one such relation; required when it has several. */
  via?: string
  /** master-detail: show the selected parent's own details (and Edit, for a writable parent)
   *  above its rows. New pages start with it on; absent generates without the card. */
  showParent?: boolean
  /** record: the related entities shown as tabs under the record. Omitted = every entity with a
   *  MANY_TO_ONE to it; an empty array = none. */
  childTabs?: FullstackChildTabDef[]
  /** report: its chart when it has one (its entity and opening filters are the shared `entity` /
   *  `presetFilter`). */
  chart?: FullstackChartDef
  /** report: its charts when it has several (2–4); the first gets the totals table. */
  charts?: FullstackChartDef[]
  /** wizard: the create form split into steps — field names, and relation field names for the
   *  pickers. Omitted: the form's fields four to a step, relations last. */
  steps?: { title?: string; fields: string[] }[]
  /** record: number tiles over its related lists (default: one row count per related tab;
   *  an empty array: none). */
  headerStats?: { child: string; agg?: FullstackAgg; field?: string; title?: string; via?: string }[]
  /** calendar: the date field rows are placed by (default: the entity's first filterable date). */
  dateField?: string
  /** calendar: the date a row ends on (needed by the timeline); absent: rows are one day long. */
  endField?: string
  /** calendar: the views it offers, the first one opening (default: month). */
  modes?: FullstackCalendarMode[]
  /** board: the enum/boolean field the lanes split by (default: the first). */
  laneField?: string
  /** board: the lanes, in order (default: every value of the lane field). */
  lanes?: string[]
  /** board: what a card shows — 1–4 field or relation names, the first as its heading. */
  cardFields?: string[]
  /** board: lane value → the most cards it should hold. */
  wipLimits?: Record<string, number>
  /** board: the cards a lane loads at a time — 10, 20 or 50 (default 20). */
  laneSize?: number
  /** content: the page's text, in a small Markdown subset (see contentMarkdown.ts). */
  body?: string
  /** search: the entities searched (default: every entity with text to search, up to 8). */
  entities?: string[]
  /** search: the matches shown per entity — 3 to 10 (default 5). */
  perEntity?: number
  /** search: put a search box in the app's header that opens this page. */
  shellSearch?: boolean
}

/** The editor state an example sets on load — FullstackExampleAdminController.validateSettings. */
export interface ExampleSettings {
  dashboardTitle?: string
  dashboardOverview?: string
  locale?: 'en' | 'he'
  backendTemplateSet?: string
  frontendTemplateSet?: string
  colorPalette?: string
  scaffold?: string[]
  nav?: FullstackNav
}

/** The generated shell's navigation, for a page layout: a sidebar (default) or a top bar, and
 *  whether nav sections fold. The Menora set is a top bar already and ignores it. */
export interface FullstackNav {
  style?: 'sidebar' | 'topbar'
  collapsibleGroups?: boolean
}

export interface AdminColorPalette {
  id: number
  paletteId: string
  name: string
  description: string
  primary: string
  secondary: string
  accent: string | null
  error: string | null
  isDefault: boolean
  sortOrder: number
}

// Activity / Audit
export type GenerationEventStatus = 'SUCCESS' | 'FAILURE'

export interface GenerationEvent {
  id: number
  eventTimestamp: string
  endpoint: string
  artifactId: string | null
  groupId: string | null
  bootVersion: string | null
  javaVersion: string | null
  packaging: string | null
  language: string | null
  dependencyIds: string | null
  durationMs: number
  status: GenerationEventStatus
  errorMessage: string | null
  remoteAddr: string | null
  username: string | null
}

export interface ActivitySummary {
  days: number
  totalCount: number
  successCount: number
  failureCount: number
  successRate: number
  p50Ms: number
  p95Ms: number
  p99Ms: number
  topDependencies: { depId: string; count: number }[]
  topBootVersions: { bootVersion: string; count: number }[]
}

export interface Toast {
  message: string
  type: 'success' | 'error'
  /** Optional one-click follow-up rendered as a button in the toast (e.g. "Undo" after a
   *  delete). A toast carrying an action stays up longer so the user can reach it. */
  action?: { label: string; onClick: () => void }
}

// Starter Templates
export interface StarterTemplateDep {
  depId: string
  subOptions: string[]
}
export interface StarterTemplate {
  id: string
  name: string
  description: string
  icon: string | null
  color: string | null
  bootVersion: string | null
  javaVersion: string | null
  packaging: string | null
  dependencies: StarterTemplateDep[]
}

export interface AdminStarterTemplate {
  id: number
  templateId: string
  name: string
  description: string
  icon: string
  color: string
  bootVersion: string
  javaVersion: string
  packaging: string
  sortOrder: number
  projectKind?: ProjectKind
}

export interface AdminStarterTemplateDep {
  id: number
  template: { id: number }
  depId: string
  subOptions: string
}

// Project Preview
export type FileStatus = 'added' | 'removed' | 'modified' | 'unchanged'

export interface DiffResult {
  fileStatuses: Map<string, FileStatus>
  addedCount: number
  removedCount: number
  modifiedCount: number
  hasChanges: boolean
}

export interface PreviewFile {
  path: string
  content: string
}

export interface TreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children: TreeNode[]
}

export interface PreviewResponse {
  files: PreviewFile[]
  tree: TreeNode[]
}

export interface PreviewError {
  message: string
  kind?: string       // e.g. "Invalid SQL", "Invalid OpenAPI spec", "Invalid WSDL"
  dep?: string        // dependency id whose script failed (when applicable)
  snippet?: string    // offending statement excerpt (SQL wizard only)
  statementIndex?: number
}

// Module Templates (multi-module project generation)
export interface AdminModuleTemplate {
  id: number
  moduleId: string
  label: string
  description: string
  suffix: string
  packaging: string
  hasMainClass: boolean
  sortOrder: number
}

export interface AdminModuleDependencyMapping {
  id: number
  dependencyId: string
  moduleId: string
  sortOrder: number
}

export interface ModuleTemplate {
  moduleId: string
  label: string
  description: string
  suffix: string
  packaging: string
  hasMainClass: boolean
  dependencyIds: string[]
}
