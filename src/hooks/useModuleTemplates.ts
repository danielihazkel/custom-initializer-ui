import type { ModuleTemplate } from '../types'
import { useCatalog } from './catalogCache'

export interface UseModuleTemplatesResult {
  modules: ModuleTemplate[]
  loading: boolean
  error: string | null
}

const NO_MODULES: ModuleTemplate[] = []

export function useModuleTemplates(): UseModuleTemplatesResult {
  const { data, loading, error } = useCatalog<ModuleTemplate[]>('/metadata/module-templates', NO_MODULES)
  return { modules: data, loading, error }
}
