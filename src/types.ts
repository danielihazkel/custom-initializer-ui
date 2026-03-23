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
  metadata:        InitializrMetadata | null
  selected:        string[]
  onChange:        (selected: string[]) => void
  extensions:      DependencyExtensions
  selectedOptions: Record<string, string[]>
  onOptionsChange: (depId: string, optIds: string[]) => void
}
export interface GenerateButtonProps {
  form:     ProjectFormValues
  selected: string[]
}
