import { useMemo } from 'react'
import type { CompatibilityRule } from '../types'
import type { Suggestion } from '../components/SuggestionStrip'

export interface CompatibilityWarning {
  source: string
  target: string
  desc: string
}

export interface DependencyLike {
  id: string
  name: string
}

export interface DependencyCompatibilityResult {
  conflicts: CompatibilityWarning[]
  requires: CompatibilityWarning[]
  suggestions: Suggestion[]
}

/**
 * Cross-cuts CONFLICTS/REQUIRES warnings and RECOMMENDS suggestions from a set
 * of compatibility rules. Shared by the backend (DependencySelector) and the
 * frontend (SelectedDependenciesFE) flows so the rule semantics stay identical.
 *
 * RECOMMENDS are deduplicated by target — multiple sources recommending the same
 * dep collapse into a single suggestion whose score tracks how many sources agree.
 */
export function useDependencyCompatibility(
  rules: CompatibilityRule[],
  selected: string[],
  allDeps: DependencyLike[],
): DependencyCompatibilityResult {
  return useMemo(() => {
    // O(1) lookups — the rule loops below run per rule, and the catalog has hundreds of deps.
    const nameById = new Map(allDeps.map(d => [d.id, d.name]))
    const selectedSet = new Set(selected)
    const depName = (id: string) => nameById.get(id) ?? id

    const conflicts: CompatibilityWarning[] = []
    const requires: CompatibilityWarning[] = []
    for (const rule of rules) {
      if (!selectedSet.has(rule.sourceDepId)) continue
      if (rule.relationType === 'CONFLICTS' && selectedSet.has(rule.targetDepId)) {
        conflicts.push({
          source: rule.sourceDepId,
          target: rule.targetDepId,
          desc: rule.description ?? `${depName(rule.sourceDepId)} conflicts with ${depName(rule.targetDepId)}`,
        })
      }
      if (rule.relationType === 'REQUIRES' && !selectedSet.has(rule.targetDepId)) {
        requires.push({
          source: rule.sourceDepId,
          target: rule.targetDepId,
          desc: rule.description ?? `${depName(rule.sourceDepId)} requires ${depName(rule.targetDepId)}`,
        })
      }
    }

    const byTarget = new Map<string, Suggestion>()
    for (const rule of rules) {
      if (rule.relationType !== 'RECOMMENDS') continue
      if (!selectedSet.has(rule.sourceDepId)) continue
      if (selectedSet.has(rule.targetDepId)) continue
      if (!nameById.has(rule.targetDepId)) continue
      const sourceName = depName(rule.sourceDepId)
      const reason = rule.description ?? `${sourceName} recommends ${depName(rule.targetDepId)}`
      const existing = byTarget.get(rule.targetDepId)
      if (existing) {
        if (!existing.sourceNames.includes(sourceName)) {
          existing.sourceNames.push(sourceName)
          existing.score += 1
        }
        if (!existing.reasons.includes(reason)) existing.reasons.push(reason)
      } else {
        byTarget.set(rule.targetDepId, {
          targetDepId: rule.targetDepId,
          targetName: depName(rule.targetDepId),
          score: 1,
          sourceNames: [sourceName],
          reasons: [reason],
        })
      }
    }
    const suggestions = Array.from(byTarget.values())
      .sort((a, b) => b.score - a.score || a.targetName.localeCompare(b.targetName))

    return { conflicts, requires, suggestions }
  }, [rules, selected, allDeps])
}
