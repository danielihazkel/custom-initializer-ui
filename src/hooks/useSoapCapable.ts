import { useState, useEffect } from 'react'

export function useSoapCapable() {
  const [depIds, setDepIds] = useState<string[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    fetch('/metadata/soap-capable-deps')
      .then(res => (res.ok ? res.json() : []))
      .then(data => {
        setDepIds(Array.isArray(data) ? (data as string[]) : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return { depIds, loading }
}
