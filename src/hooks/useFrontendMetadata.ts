import { useEffect, useState } from 'react'

export interface FeVersion { id: string; name: string; default?: boolean }
export interface FeSubOption { id: string; label: string; description?: string }
export interface FeDependency {
  id: string
  name: string
  description?: string
  sortOrder: number
  subOptions?: FeSubOption[]
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
export interface FrontendMetadata {
  defaults: FeDefaults
  reactVersions: FeVersion[]
  nodeVersions: FeVersion[]
  packageManagers: FeVersion[]
  pinned: { typescript: string; vite: string }
  dependencies: FeGroup[]
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
  const [metadata, setMetadata] = useState<FrontendMetadata | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/frontend/metadata?r=${Math.random().toString(36).slice(2)}`, {
      headers: { Accept: 'application/json' },
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data: FrontendMetadata) => {
        setMetadata(data)
        setLoading(false)
      })
      .catch((err: Error) => {
        setError(err.message)
        setLoading(false)
      })
  }, [tick])

  return { metadata, loading, error, reload: () => setTick(t => t + 1) }
}
