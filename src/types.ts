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
}

// ── SQL Entity Wizard ─────────────────────────────────────────────────────────
export type SqlDialects = Record<string, string>  // depId → dialect enum name

export interface SqlTableConfig {
  name: string
  generateRepository: boolean
}

export interface SqlWizardEntry {
  sql: string
  subPackage: string
  tables: SqlTableConfig[]
}

export type SqlByDep = Record<string, SqlWizardEntry>

// ── OpenAPI Wizard ────────────────────────────────────────────────────────────
export interface OpenApiWizardEntry {
  spec: string
  apiSubPackage: string
  dtoSubPackage: string
}

export type OpenApiByDep = Record<string, OpenApiWizardEntry>

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

export interface AdminDependencyGroup {
  id: number
  name: string
  sortOrder: number
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
}

export type FileType = 'STATIC_COPY' | 'YAML_MERGE' | 'TEMPLATE' | 'DELETE'
export type SubstitutionType = 'PROJECT' | 'PACKAGE' | 'NONE'

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
}

export type BuildCustomizationType = 'ADD_DEPENDENCY' | 'EXCLUDE_DEPENDENCY' | 'ADD_REPOSITORY'

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
  sortOrder: number
}

export interface AdminSubOption {
  id: number
  dependencyId: string
  optionId: string
  label: string
  description: string
  sortOrder: number
}

// Compatibility rules
export type RelationType = 'REQUIRES' | 'CONFLICTS' | 'RECOMMENDS'

export interface CompatibilityRule {
  sourceDepId: string
  targetDepId: string
  relationType: RelationType
  description: string
}

export interface AdminDependencyCompatibility {
  id: number
  sourceDepId: string
  targetDepId: string
  relationType: RelationType
  description: string
  sortOrder: number
}

export type AdminTab = 'overview' | 'activity' | 'groups' | 'entries' | 'files' | 'builds' | 'suboptions' | 'compatibility' | 'templates' | 'modules'

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
