// Metadata API shapes
export interface MetadataOption {
  id: string
  name: string
  description?: string
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
  metadata:           InitializrMetadata | null
  selected:           string[]
  onChange:           (selected: string[]) => void
  extensions:         DependencyExtensions
  selectedOptions:    Record<string, string[]>
  onOptionsChange:    (depId: string, optIds: string[]) => void
  compatibilityRules: CompatibilityRule[]
}
export interface GenerateButtonProps {
  form:     ProjectFormValues
  selected: string[]
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
  sortOrder: number
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

export type AdminTab = 'groups' | 'entries' | 'files' | 'builds' | 'suboptions' | 'compatibility'

export interface Toast {
  message: string
  type: 'success' | 'error'
}
