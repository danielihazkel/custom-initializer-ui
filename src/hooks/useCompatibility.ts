import type { CompatibilityRule, ProjectKind } from '../types'
import { useCatalog } from './catalogCache'

const NO_RULES: CompatibilityRule[] = []

export function useCompatibility(projectKind?: ProjectKind): { rules: CompatibilityRule[] } {
  const url = projectKind
    ? `/metadata/compatibility?projectKind=${projectKind}`
    : '/metadata/compatibility'
  // A failure is non-fatal — the warnings just don't appear.
  const { data } = useCatalog<CompatibilityRule[]>(url, NO_RULES)
  return { rules: data }
}
