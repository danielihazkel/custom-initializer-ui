import { useMemo } from 'react'
import type { AdminDependencyCompatibility, AdminDependencyEntry, AdminDependencyGroup, RelationType } from '../../../types'
import { useAdminResource } from '../../../hooks/useAdminResource'

export interface GraphNode {
  id: string
  name: string
  groupId: number
  groupName: string
}

export interface GraphEdge {
  id: number
  source: string
  target: string
  relationType: RelationType
  description: string
}

export interface CompatibilityGraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
  loading: boolean
}

export function useCompatibilityGraphData(rules: AdminDependencyCompatibility[]): CompatibilityGraphData {
  const { items: entries, loading: loadingEntries } = useAdminResource<AdminDependencyEntry>('/admin/dependency-entries')
  const { items: groups, loading: loadingGroups } = useAdminResource<AdminDependencyGroup>('/admin/dependency-groups')

  const data = useMemo(() => {
    const groupMap = new Map<number, string>(groups.map(g => [g.id, g.name]))
    const entryMap = new Map<string, AdminDependencyEntry>(entries.map(e => [e.depId, e]))

    const depIds = new Set<string>()
    for (const rule of rules) {
      depIds.add(rule.sourceDepId)
      depIds.add(rule.targetDepId)
    }

    const nodes: GraphNode[] = Array.from(depIds).map(id => {
      const entry = entryMap.get(id)
      const groupId = entry?.group?.id ?? -1
      return {
        id,
        name: entry?.name ?? id,
        groupId,
        groupName: groupId !== -1 ? (groupMap.get(groupId) ?? 'Unknown') : 'Unknown',
      }
    })

    const edges: GraphEdge[] = rules.map(r => ({
      id: r.id,
      source: r.sourceDepId,
      target: r.targetDepId,
      relationType: r.relationType,
      description: r.description,
    }))

    return { nodes, edges }
  }, [rules, entries, groups])

  return { ...data, loading: loadingEntries || loadingGroups }
}
