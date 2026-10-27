import type { DependencyExtensions, UseExtensionsResult } from '../types'
import { useCatalog } from './catalogCache'

const NO_EXTENSIONS: DependencyExtensions = {}

export function useExtensions(): UseExtensionsResult {
  const { data, loading, error } = useCatalog<DependencyExtensions>('/metadata/extensions', NO_EXTENSIONS)
  return { extensions: data, loading, error }
}
