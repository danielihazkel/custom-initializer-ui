import { useState, useEffect } from 'react'
import type { CompatibilityRule } from '../types'

export function useCompatibility(): { rules: CompatibilityRule[] } {
  const [rules, setRules] = useState<CompatibilityRule[]>([])

  useEffect(() => {
    fetch('/metadata/compatibility')
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json() })
      .then(data => setRules(data as CompatibilityRule[]))
      .catch(() => { /* non-fatal — warnings just won't appear */ })
  }, [])

  return { rules }
}
