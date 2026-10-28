import { useCatalog } from './catalogCache'

export interface FeVersion { id: string; name: string; default?: boolean }
export interface FeSubOption { id: string; label: string; description?: string }
export interface FeDependency {
  id: string
  name: string
  description?: string
  sortOrder: number
  subOptions?: FeSubOption[]
  /** Spring Initializr range syntax (e.g. "[18.0.0,19.0.0)"). Only emitted when set on the catalog. */
  versionRange?: string
}
export interface FeGroup {
  name: string
  sortOrder: number
  entries: FeDependency[]
}
export interface FeDefaults {
  projectName: string
  description: string
  appTitle: string
  scope: string
  reactVersion: string
  nodeVersion: string
  packageManager: string
}
export interface FeColorPalette {
  id: string
  name: string
  description?: string | null
  primary: string
  secondary: string
  accent?: string | null
  error?: string | null
  isDefault: boolean
  sortOrder: number
}
export interface FrontendMetadata {
  defaults: FeDefaults
  reactVersions: FeVersion[]
  nodeVersions: FeVersion[]
  packageManagers: FeVersion[]
  pinned: { typescript: string; vite: string }
  dependencies: FeGroup[]
  colorPalettes: FeColorPalette[]
}

export interface UseFrontendMetadataResult {
  metadata: FrontendMetadata | null
  loading: boolean
  error: string | null
  reload: () => void
}

export const DESIGN_GROUP_NAME = 'Design System'

export function getDesignSystemEntries(metadata: FrontendMetadata): FeDependency[] {
  const g = metadata.dependencies.find(g => g.name === DESIGN_GROUP_NAME)
  return g?.entries ?? []
}

export function useFrontendMetadata(): UseFrontendMetadataResult {
  const { data, loading, error, reload } = useCatalog<FrontendMetadata | null>('/frontend/metadata', null)
  return { metadata: data, loading, error, reload }
}
