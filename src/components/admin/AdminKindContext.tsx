import { createContext, useContext, useState, type ReactNode } from 'react'

export type ProjectKind = 'BACKEND' | 'FRONTEND'

interface Ctx {
  kind: ProjectKind
  setKind: (k: ProjectKind) => void
}

const AdminKindContext = createContext<Ctx>({ kind: 'BACKEND', setKind: () => {} })

export function AdminKindProvider({ children }: { children: ReactNode }) {
  const [kind, setKind] = useState<ProjectKind>(() => {
    const stored = localStorage.getItem('adminProjectKind') as ProjectKind | null
    return stored === 'FRONTEND' ? 'FRONTEND' : 'BACKEND'
  })
  return (
    <AdminKindContext.Provider
      value={{
        kind,
        setKind: k => {
          setKind(k)
          localStorage.setItem('adminProjectKind', k)
        },
      }}
    >
      {children}
    </AdminKindContext.Provider>
  )
}

export function useAdminKind(): Ctx {
  return useContext(AdminKindContext)
}

/**
 * Filter helper for admin tab lists. Treats rows without a `projectKind`
 * as BACKEND (matches the DB default), so legacy data still appears under
 * the Backend pill without any backfill.
 */
export function filterByKind<T extends { projectKind?: string }>(rows: T[], kind: ProjectKind): T[] {
  return rows.filter(r => {
    const rk = r.projectKind ?? 'BACKEND'
    return rk === kind
  })
}
