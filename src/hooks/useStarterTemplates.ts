import type { StarterTemplate } from '../types'
import { useCatalog } from './catalogCache'

export interface UseStarterTemplatesResult {
  templates: StarterTemplate[]
  loading: boolean
  error: string | null
}

export type ProjectKind = 'BACKEND' | 'FRONTEND'

const NO_TEMPLATES: StarterTemplate[] = []

export function useStarterTemplates(projectKind?: ProjectKind): UseStarterTemplatesResult {
  const url = projectKind
    ? `/metadata/starter-templates?projectKind=${projectKind}`
    : '/metadata/starter-templates'
  const { data, loading, error } = useCatalog<StarterTemplate[]>(url, NO_TEMPLATES)
  return { templates: data, loading, error }
}
