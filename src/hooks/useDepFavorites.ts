import { useCallback, useState } from 'react'

const KEY = 'depFavorites'

function read(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/**
 * The dependencies this browser has starred in the picker (`localStorage` `depFavorites`), in
 * the order they were starred. `toggle` is stable, so it can go to the memoised cards.
 */
export function useDepFavorites(): { favorites: string[]; toggle: (depId: string) => void } {
  const [favorites, setFavorites] = useState<string[]>(read)

  const toggle = useCallback((depId: string) => {
    setFavorites(prev => {
      const next = prev.includes(depId) ? prev.filter(id => id !== depId) : [...prev, depId]
      try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* kept for this visit only */ }
      return next
    })
  }, [])

  return { favorites, toggle }
}
