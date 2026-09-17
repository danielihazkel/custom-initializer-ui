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

/** `OrderItem` → `order-item`. */
export function toKebabCase(s: string): string {
  return toSnakeCase(s).replace(/_/g, '-')
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
