import { useEffect, useState } from 'react'

/** One entry of `GET /metadata/departments` — the admin-managed list shared by every screen. */
export interface Department {
  id: string
  name: string
  isDefault: boolean
  sortOrder: number
}

// One in-flight/resolved promise shared by the three generator screens, like useMetadata.
let cached: Promise<Department[]> | null = null

export function getDepartments(): Promise<Department[]> {
  if (!cached) {
    const p = fetch('/metadata/departments', { cache: 'no-store' }).then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json() as Promise<Department[]>
    })
    // A failed load must not be memoised — the next mount refetches.
    p.catch(() => { if (cached === p) cached = null })
    cached = p
  }
  return cached
}

/** Drop the memoised list (the admin Departments tab calls this after a write). */
export function invalidateDepartments(): void {
  cached = null
}

/** The department a blank selection resolves to — the flagged default, else the first entry. */
export function defaultDepartmentId(departments: Department[]): string {
  return departments.find(d => d.isDefault)?.id ?? departments[0]?.id ?? ''
}

export function useDepartments(): { departments: Department[]; loading: boolean; error: string | null } {
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getDepartments()
      .then(list => { if (!cancelled) { setDepartments(list); setLoading(false) } })
      .catch((err: Error) => { if (!cancelled) { setError(err.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [])

  return { departments, loading, error }
}
