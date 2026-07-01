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

export type AdminTab = 'overview' | 'activity' | 'groups' | 'entries' | 'files' | 'builds' | 'suboptions' | 'compatibility' | 'templates' | 'modules' | 'palettes' | 'entity-templates' | 'versions'

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

export type DesignSystem = 'TAILWIND' | 'MUI' | 'CHAKRA' | 'MANTINE' | 'SHADCN' | 'NONE'

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
}

// v1 supports the FK-owning side only (MANY_TO_ONE); the inverse @OneToMany is auto-derived
// server-side via the inverseCollections opt.
export type FullstackRelationType = 'MANY_TO_ONE'

export interface FullstackRelationDef {
  type: FullstackRelationType
  fieldName: string
  targetEntity: string
  required?: boolean
}

export interface FullstackEntityDef {
  name: string
  tableName?: string
  schema?: string
  fields: FullstackFieldDef[]
  relations?: FullstackRelationDef[]
  /** Read-only entity — generates GET-only scaffolding (no create/update/delete). */
  readOnly?: boolean
  /** The list-view modes the generated entity page generates (subset of table/cards/kanban/
   *  calendar, ordered; first = initial). A runtime toggle is emitted only when 2+ are enabled,
   *  and unsupported modes are dropped (kanban needs an ENUM/BOOLEAN field + a writable entity;
   *  calendar needs a LOCAL_DATE/LOCAL_DATE_TIME field). Empty/absent defaults to ['table']. */
  listViews?: Array<'table' | 'cards' | 'kanban' | 'calendar'>
  /** @deprecated Legacy single initial view — still read for back-compat when {@link listViews}
   *  is absent. New code should write {@link listViews}. */
  listView?: 'table' | 'cards' | 'kanban' | 'calendar'
  /** Raw SELECT this entity maps to via Hibernate @Immutable/@Subselect. Implies readOnly. */
  viewQuery?: string
  /** Originating CREATE TABLE this entity was imported from. Informational only —
   *  shown read-only in the editor; not used during generation. */
  sourceSql?: string
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
  dependencies?: string[]
  backendTemplateSet?: string
  frontendTemplateSet?: string
  /** Opt-in scaffolding extras, e.g. { scaffold: ["audit","softDelete","inverseCollections","tests"] }. */
  opts?: Record<string, string[]>
  entities: FullstackEntityDef[]
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
