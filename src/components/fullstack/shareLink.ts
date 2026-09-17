import { isSnapshot, type FullstackSnapshot } from './snapshot'

/** Query parameter the whole editor state rides in, so the header's Share button (which copies
 *  `location.href`) produces a link that actually reproduces the model on another machine. */
export const SHARE_PARAM = 'fs'

/** Links longer than this are refused by some proxies/browsers; beyond it we stop syncing. */
const MAX_ENCODED_LENGTH = 60_000

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
 *  large for a sane link drops the param instead of producing a broken one. */
export function writeShareToLocation(snapshot: FullstackSnapshot): void {
  try {
    const url = new URL(window.location.href)
    const encoded = encodeShare(snapshot)
    if (encoded.length > MAX_ENCODED_LENGTH) url.searchParams.delete(SHARE_PARAM)
    else url.searchParams.set(SHARE_PARAM, encoded)
    const next = url.pathname + url.search + url.hash
    if (next !== window.location.pathname + window.location.search + window.location.hash) {
      window.history.replaceState(window.history.state, '', next)
    }
  } catch {
    /* history API unavailable (tests, sandboxed frames) — the link just won't carry state */
  }
}
