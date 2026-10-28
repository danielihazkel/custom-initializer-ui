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
  /** The pinned version is deprecated: it still generates, but its kit asks to move on. */
  | { kind: 'deprecated'; latest: number; note: string | null }
  /** The pinned kit is gone (deleted, disabled) — Generate would answer 400. */
  | { kind: 'missing' }

export function kitStatus(pin: DesignKitPin, kits: DesignKitSummary[]): KitStatus {
  const kit = kits.find(k => k.key === pin.key)
  if (!kit || kit.latestVersion == null || pin.version > kit.latestVersion) return { kind: 'missing' }
  const deprecated = kit.deprecated?.find(d => d.version === pin.version)
  if (deprecated) return { kind: 'deprecated', latest: kit.latestVersion, note: deprecated.note }
  return kit.latestVersion > pin.version ? { kind: 'upgrade', latest: kit.latestVersion } : { kind: 'current' }
}

/**
 * The kit a model generates with: the one it pins; else the kit its frontend set stands for (the
 * Menora Digital set); else the house kit on its set. `via` says which — only a pin keeps a
 * version, the others follow their kit's latest. Null without kits (offline, older backend).
 */
export function effectiveKit(pin: DesignKitPin | null | undefined, frontendSet: string, kits: DesignKitSummary[]):
  { kit: DesignKitSummary; version: number; via: 'pinned' | 'set' | 'house' } | null {
  if (pin) {
    const kit = kits.find(k => k.key === pin.key)
    return kit ? { kit, version: pin.version, via: 'pinned' } : null
  }
  const alias = kits.find(k => k.aliases?.includes(frontendSet))
  if (alias?.latestVersion) return { kit: alias, version: alias.latestVersion, via: 'set' }
  const house = kits.find(k => k.defaultKit && k.baseSetKey === frontendSet)
  return house?.latestVersion ? { kit: house, version: house.latestVersion, via: 'house' } : null
}

/** The sketch the layout designer draws a kit with until the real app compiles. */
export function kitSketch(kit: DesignKitSummary | undefined): 'tailwind' | 'menora' {
  return kit?.traits?.sketch === 'menora' ? 'menora' : 'tailwind'
}

/** Whether the kit's shell honours the layout's nav options (sidebar/top bar, folding groups). */
export function kitHasNavOptions(kit: DesignKitSummary | undefined): boolean {
  return kit?.traits?.navOptions !== false
}

/** A swatch colour of a kit, `{palette.*}` filled in from the palette in force. */
export function swatchColor(kit: DesignKitSummary, name: string, palette: FeColorPalette | undefined): string | undefined {
  const value = kit.swatch?.[name]
  return value ? resolveToken([{ name, value }], name, palette) : undefined
}

/** What picking a kit switches on — its declared defaults (Menora Digital: Hebrew, right-to-left). */
export function kitDefaults(kit: DesignKitSummary | undefined): { locale?: 'en' | 'he'; rtl?: boolean } {
  return { ...(kit?.defaults?.locale ? { locale: kit.defaults.locale } : {}), ...(kit?.defaults?.rtl ? { rtl: true } : {}) }
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
