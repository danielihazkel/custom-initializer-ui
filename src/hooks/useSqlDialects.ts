import { useState, useEffect } from 'react'
import type { SqlDialects } from '../types'

export function useSqlDialects() {
  const [dialects, setDialects] = useState<SqlDialects>({})
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    fetch('/metadata/sql-dialects')
      .then(res => (res.ok ? res.json() : {}))
      .then(data => {
        setDialects(data as SqlDialects)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return { dialects, loading }
}
