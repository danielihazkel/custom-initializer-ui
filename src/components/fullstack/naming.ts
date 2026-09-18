/**
 * Client mirror of the backend `gen/Naming.java` helpers that decide generated names, so the
 * editor can tell the user what an entity will become (`/api/order-items`, `order_items`) without
 * a round-trip. Keep in step with the Java — the summary line is only useful if it's truthful.
 */

/** `OrderItem` → `order_item`; `TD_APP_STP` → `td_app_stp`. A boundary is inserted only at a camel
 *  hump (an uppercase letter following a lowercase letter or digit); explicit separators collapse. */
export function toSnakeCase(s: string): string {
  if (!s) return ''
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '-' || c === ' ' || c === '_') {
      out += '_'
    } else if (c !== c.toLowerCase() && c === c.toUpperCase()) {
      const prev = i > 0 ? s[i - 1] : ''
      if (i > 0 && (/[a-z]/.test(prev) || /[0-9]/.test(prev))) out += '_'
      out += c.toLowerCase()
    } else {
      out += c
    }
  }
  return out
}

/** `order_item` / `orderItem` / `order-item` → `OrderItem`. Mirrors `Naming.toPascalCase`: a
 *  separator starts a new word; an uppercase letter following a lowercase letter or digit is kept
 *  (camel hump); every other letter is lower-cased. */
export function toPascalCase(s: string): string {
  if (!s) return ''
  let out = ''
  let upper = true
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '-' || c === '_' || c === ' ') {
      upper = true
    } else if (c !== c.toLowerCase() && c === c.toUpperCase() && i > 0 && /[a-z0-9]/.test(s[i - 1])) {
      out += c
      upper = false
    } else if (upper) {
      out += c.toUpperCase()
      upper = false
    } else {
      out += c.toLowerCase()
    }
  }
  return out
}

/** `OrderItem` / `order_item` → `orderItem`. */
export function toCamelCase(s: string): string {
  const pascal = toPascalCase(s)
  return pascal ? pascal[0].toLowerCase() + pascal.slice(1) : ''
}

/** `OrderItem` → `order-item`. */
export function toKebabCase(s: string): string {
  return toSnakeCase(s).replace(/_/g, '-')
}

/** A name that does not collide (case-insensitively — the validator's duplicate rule) with any
 *  in `taken`: `base` itself, else `base2`, `base3`, … Used by the Duplicate actions so cloning
 *  the same row twice never produces two identical `XCopy` names. */
export function uniqueName(base: string, taken: readonly string[]): string {
  const used = new Set(taken.map(t => t.trim().toLowerCase()))
  if (!used.has(base.trim().toLowerCase())) return base
  for (let n = 2; ; n++) {
    const candidate = `${base}${n}`
    if (!used.has(candidate.toLowerCase())) return candidate
  }
}

/** `firstName` / `first_name` / `FirstName` → `First name` — the label the generated UI derives
 *  when no explicit display label is set. */
export function humanize(s: string): string {
  const words = toSnakeCase(s.trim()).split('_').filter(Boolean)
  if (words.length === 0) return ''
  return words.map((w, i) => (i === 0 ? w[0].toUpperCase() + w.slice(1) : w)).join(' ')
}

/** Best-effort English plural, same heuristics as the backend: -y→-ies, -s/-x/-z/-ch/-sh→-es,
 *  else +s; something already ending in s (not ss/us) is left alone. */
export function pluralize(s: string): string {
  if (!s) return s
  const lower = s.toLowerCase()
  if (lower.endsWith('ies')) return s
  if (lower.endsWith('s') && !lower.endsWith('ss') && !lower.endsWith('us')) return s
  if (lower.endsWith('y') && s.length > 1 && !'aeiou'.includes(lower[lower.length - 2])) {
    return s.slice(0, -1) + 'ies'
  }
  if (/(s|x|z|ch|sh)$/.test(lower)) return s + 'es'
  return s + 's'
}
