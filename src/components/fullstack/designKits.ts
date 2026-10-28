import { useEffect, useState } from 'react'
import { fetchCatalog, useCatalog } from '../../hooks/catalogCache'
import type { FeColorPalette } from '../../hooks/useFrontendMetadata'
import type { DesignKitPin, DesignKitSummary, DesignKitVersion, DesignToken } from '../../types'

/** The request's `designKit`: `key@version`. */
export function kitRef(pin: DesignKitPin): string {
  return `${pin.key}@${pin.version}`
}

/** `key` (the kit's latest version) or `key@N`, against the listed kits; null when it names none. */
export function parseKitRef(ref: string | undefined | null, kits: DesignKitSummary[]): DesignKitPin | null {
  const m = /^([a-z][a-z0-9-]{1,48})(?:@([1-9]\d{0,5}))?$/.exec(ref?.trim() ?? '')
  if (!m) return null
  const kit = kits.find(k => k.key === m[1])
  const version = m[2] ? Number(m[2]) : kit?.latestVersion
  return version ? { key: m[1], version } : null
}

/** A `key@N` pin read from data that has no kit list at hand (a request, an imported file). */
export function pinFromRef(ref: unknown): DesignKitPin | undefined {
  if (typeof ref !== 'string') return undefined
  const m = /^([a-z][a-z0-9-]{1,48})@([1-9]\d{0,5})$/.exec(ref.trim())
  return m ? { key: m[1], version: Number(m[2]) } : undefined
}

export type KitStatus =
  | { kind: 'current' }
  /** A newer version is published; the model keeps its own until the user switches. */
  | { kind: 'upgrade'; latest: number }
  /** The pinned kit is gone (deleted, disabled) — Generate would answer 400. */
  | { kind: 'missing' }

export function kitStatus(pin: DesignKitPin, kits: DesignKitSummary[]): KitStatus {
  const kit = kits.find(k => k.key === pin.key)
  if (!kit || kit.latestVersion == null || pin.version > kit.latestVersion) return { kind: 'missing' }
  return kit.latestVersion > pin.version ? { kind: 'upgrade', latest: kit.latestVersion } : { kind: 'current' }
}

/** What picking a kit switches on — its declared defaults (Menora Digital: Hebrew, right-to-left). */
export function kitDefaults(kit: DesignKitSummary | undefined): { locale?: 'en' | 'he'; rtl?: boolean } {
  return { ...(kit?.defaults?.locale ? { locale: kit.defaults.locale } : {}), ...(kit?.defaults?.rtl ? { rtl: true } : {}) }
}

/**
 * The two colours today's layout preview draws with, from a kit's tokens: `color-brand` and
 * `color-gold`, palette references resolved against the palette in force. Null when the kit
 * version is not loaded yet (the preview keeps the palette's own colours).
 */
export function kitPreviewPalette(version: DesignKitVersion | null, palette: FeColorPalette | undefined): FeColorPalette | undefined {
  if (!version) return palette
  const tokens = version.tokens.tokens
  const brand = resolveToken(tokens, 'color-brand', palette)
  const gold = resolveToken(tokens, 'color-gold', palette)
  if (!brand && !gold) return palette
  const base: FeColorPalette = palette ?? { id: version.key, name: version.key, primary: '#2B2F4C', secondary: '#FEDB41', isDefault: false, sortOrder: 0 }
  return { ...base, primary: brand ?? base.primary, secondary: gold ?? base.secondary }
}

/** A token's light value with `{palette.*}` references filled in (a missing accent/error takes its fallback). */
export function resolveToken(tokens: DesignToken[], name: string, palette: FeColorPalette | undefined): string | undefined {
  const value = tokens.find(t => t.name === name)?.value
  if (!value) return undefined
  return value.replace(/\{palette\.(primary|secondary|accent|error)(?:\|(#[0-9a-fA-F]{3,8}))?\}/g, (_m, key: string, fallback?: string) => {
    const v = palette ? (palette as unknown as Record<string, string | null | undefined>)[key] : undefined
    return v || fallback || (key === 'primary' ? '#2B2F4C' : key === 'secondary' ? '#FEDB41' : '#888888')
  })
}

/** The kits the generator can use (enabled, with a published version), cached per session. */
export function useDesignKits() {
  const { data, loading, error, reload } = useCatalog<DesignKitSummary[]>('/metadata/design/kits', [],
    raw => (Array.isArray(raw) ? raw as DesignKitSummary[] : []))
  return { kits: data, loading, error, reload }
}

/** One published kit version (immutable, so cached for the session); null until it arrives. */
export function useDesignKitVersion(pin: DesignKitPin | null): DesignKitVersion | null {
  const url = pin ? `/metadata/design/kits/${encodeURIComponent(pin.key)}/versions/${pin.version}` : null
  const [loaded, setLoaded] = useState<{ url: string; version: DesignKitVersion } | null>(null)
  useEffect(() => {
    if (!url) return
    let cancelled = false
    fetchCatalog<DesignKitVersion>(url)
      .then(version => { if (!cancelled) setLoaded({ url, version }) })
      .catch(() => { /* the preview keeps the palette's colours; Generate reports a real problem */ })
    return () => { cancelled = true }
  }, [url])
  return url && loaded?.url === url ? loaded.version : null
}
