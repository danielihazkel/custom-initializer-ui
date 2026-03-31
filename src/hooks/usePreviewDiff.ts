import { useMemo } from 'react'
import type { PreviewResponse, DiffResult, FileStatus } from '../types'

export function usePreviewDiff(
  current:  PreviewResponse | null,
  previous: PreviewResponse | null
): DiffResult | null {
  return useMemo(() => {
    if (!current || !previous) return null

    const oldMap = new Map(previous.files.map(f => [f.path, f.content]))
    const newMap = new Map(current.files.map(f => [f.path, f.content]))

    const statuses = new Map<string, FileStatus>()
    let addedCount    = 0
    let removedCount  = 0
    let modifiedCount = 0

    for (const [path, content] of newMap) {
      if (!oldMap.has(path)) {
        statuses.set(path, 'added')
        addedCount++
      } else if (oldMap.get(path) !== content) {
        statuses.set(path, 'modified')
        modifiedCount++
      } else {
        statuses.set(path, 'unchanged')
      }
    }

    for (const path of oldMap.keys()) {
      if (!newMap.has(path)) {
        statuses.set(path, 'removed')
        removedCount++
      }
    }

    return {
      fileStatuses: statuses,
      addedCount,
      removedCount,
      modifiedCount,
      hasChanges: addedCount + removedCount + modifiedCount > 0,
    }
  }, [current, previous])
}
