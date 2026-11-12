import { useCatalog } from './catalogCache'

const NONE: string[] = []

function asDepIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return NONE
  return raw
    .map(row => (row && typeof row === 'object' ? (row as { depId?: unknown }).depId : undefined))
    .filter((id): id is string => typeof id === 'string')
}

/**
 * The dependencies projects were most often generated with lately, most used first
 * (`GET /metadata/popular-deps`, the public slice of the generation audit). Fetched once per
 * session through the catalog cache; an empty list until it arrives, and when it fails — the
 * picker's "Popular" row is a convenience, never worth an error on screen.
 */
export function usePopularDeps(kind: 'BACKEND' | 'FRONTEND' = 'BACKEND'): string[] {
  return useCatalog<string[]>(`/metadata/popular-deps?kind=${kind}`, NONE, asDepIds).data
}
