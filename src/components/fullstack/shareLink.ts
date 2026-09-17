import { isSnapshot, type FullstackSnapshot } from './snapshot'

/** Query parameter the whole editor state rides in, so the header's Share button (which copies
 *  `location.href`) produces a link that actually reproduces the model on another machine. */
export const SHARE_PARAM = 'fs'

/** Links longer than this are refused by some proxies/browsers; beyond it we stop syncing. */
export const MAX_ENCODED_LENGTH = 60_000

/** Outcome of a URL sync — `too-large` means the link no longer carries the model and the UI
 *  should say so (a silently shortened link is worse than no link). */
export type ShareWriteStatus = 'written' | 'too-large' | 'unavailable'

function toBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): Uint8Array {
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  const bin = atob(padded)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

/** Compact, URL-safe encoding of a snapshot (UTF-8 JSON → base64url). */
export function encodeShare(snapshot: FullstackSnapshot): string {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(snapshot)))
}

/** Inverse of {@link encodeShare}; null for anything malformed rather than throwing. */
export function decodeShare(value: string): FullstackSnapshot | null {
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(fromBase64Url(value)))
    return isSnapshot(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function readShareFromLocation(): FullstackSnapshot | null {
  try {
    const value = new URLSearchParams(window.location.search).get(SHARE_PARAM)
    return value ? decodeShare(value) : null
  } catch {
    return null
  }
}

/** Writes the snapshot into the current URL (replaceState, other params untouched). A model too
 *  large for a sane link drops the param instead of producing a broken one, and reports it so
 *  the editor can tell the user the Share button won't carry the model. */
export function writeShareToLocation(snapshot: FullstackSnapshot): ShareWriteStatus {
  try {
    const url = new URL(window.location.href)
    const encoded = encodeShare(snapshot)
    const tooLarge = encoded.length > MAX_ENCODED_LENGTH
    if (tooLarge) url.searchParams.delete(SHARE_PARAM)
    else url.searchParams.set(SHARE_PARAM, encoded)
    const next = url.pathname + url.search + url.hash
    if (next !== window.location.pathname + window.location.search + window.location.hash) {
      window.history.replaceState(window.history.state, '', next)
    }
    return tooLarge ? 'too-large' : 'written'
  } catch {
    /* history API unavailable (tests, sandboxed frames) — the link just won't carry state */
    return 'unavailable'
  }
}

/** Removes the model from the URL — called when the user leaves the tab, so the Backend/Frontend
 *  Share links don't drag a multi-KB fullstack payload along. */
export function clearShareFromLocation(): void {
  try {
    const url = new URL(window.location.href)
    if (!url.searchParams.has(SHARE_PARAM)) return
    url.searchParams.delete(SHARE_PARAM)
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
  } catch {
    /* see above */
  }
}
