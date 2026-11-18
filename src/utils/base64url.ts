/** URL-safe base64 (no padding) of bytes — what the share links carry their state in. */
export function toBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Inverse of {@link toBase64Url}; throws on input that is not base64. */
export function fromBase64Url(value: string): Uint8Array {
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  const bin = atob(padded)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

/** JSON → UTF-8 → base64url. */
export function encodeJson(value: unknown): string {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(value)))
}

/** Inverse of {@link encodeJson}; undefined for anything malformed rather than throwing. */
export function decodeJson(value: string): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(fromBase64Url(value)))
  } catch {
    return undefined
  }
}
