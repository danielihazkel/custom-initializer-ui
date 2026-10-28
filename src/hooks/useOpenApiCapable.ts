import { useCatalog } from './catalogCache'

const NO_DEPS: string[] = []
const asDepIds = (data: unknown): string[] => (Array.isArray(data) ? (data as string[]) : [])

export function useOpenApiCapable() {
  // `error` is surfaced (not swallowed) so a failing endpoint is distinguishable from "no capable deps".
  const { data, loading, error } = useCatalog<string[]>('/metadata/openapi-capable-deps', NO_DEPS, asDepIds)
  return { depIds: data, loading, error }
}
