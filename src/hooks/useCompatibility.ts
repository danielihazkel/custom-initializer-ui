import { useState, useEffect } from 'react'
import type { CompatibilityRule, ProjectKind } from '../types'

export function useCompatibility(projectKind?: ProjectKind): { rules: CompatibilityRule[] } {
  const [rules, setRules] = useState<CompatibilityRule[]>([])

  useEffect(() => {
    const url = projectKind
      ? `/metadata/compatibility?projectKind=${projectKind}`
      : '/metadata/compatibility'
    fetch(url)
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json() })
      .then(data => setRules(data as CompatibilityRule[]))
      .catch(() => { /* non-fatal — warnings just won't appear */ })
  }, [projectKind])

  return { rules }
}
