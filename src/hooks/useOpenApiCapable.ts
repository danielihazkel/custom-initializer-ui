import { useState, useEffect } from 'react'

export function useOpenApiCapable() {
  const [depIds, setDepIds] = useState<string[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    fetch('/metadata/openapi-capable-deps')
      .then(res => (res.ok ? res.json() : []))
      .then(data => {
        setDepIds(Array.isArray(data) ? (data as string[]) : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return { depIds, loading }
}
