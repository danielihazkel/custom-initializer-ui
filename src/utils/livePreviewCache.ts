import type { PreviewResponse } from '../types'

/**
 * The previews the file dock has fetched, by request key (`ProjectRequest.key`), oldest first.
 *
 * Its own small module because two things read it: the dock's hook (a lazy chunk), and `App`,
 * which opens Explore on a preview the dock already has instead of asking the backend again.
 */
export const LIVE_CACHE_SIZE = 8

const cache = new Map<string, PreviewResponse>()

export function rememberLivePreview(key: string, preview: PreviewResponse): void {
  cache.delete(key)
  cache.set(key, preview)
  while (cache.size > LIVE_CACHE_SIZE) cache.delete(cache.keys().next().value as string)
}

/** The preview fetched for this exact request, if it is still kept. */
export function livePreviewFor(key: string): PreviewResponse | undefined {
  return cache.get(key)
}

export function forgetLivePreview(key: string): void {
  cache.delete(key)
}

/** Forgets every preview — between tests. */
export function clearLivePreviews(): void {
  cache.clear()
}
