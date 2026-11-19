/**
 * The site's language: English or Hebrew, for the whole UI (Admin excepted, which stays English).
 *
 * The English text is the key, written where it is shown — `t('Generate')`, `t('{name} adds {n}
 * files', { name, n })` — and the Hebrew is a dictionary in `./he`, a chunk loaded only when the
 * site is in Hebrew. Nothing here may grow the entry chunk much: keep it to the lookup and the store.
 *
 * Rules (checked by `scripts/i18n-extract.mjs` and `coverage.test.ts`):
 * - Pass literal text only, with `{name}` placeholders — never a `${}` template or a variable.
 * - `tn(n, one, other)` for a count; `tc(context, text)` when one English text needs two Hebrew ones.
 * - A component that renders translated text re-renders on a switch if its parent does. A `memo`
 *   component calls `useLang()`, and a `useMemo` whose result holds translated text lists `lang`.
 */
import { useSyncExternalStore } from 'react'

export type Lang = 'en' | 'he'
export type Dict = Record<string, string>
export type Vars = Record<string, string | number>

const STORAGE_KEY = 'lang'
/** Unicode isolates: a name inside a Hebrew sentence keeps its own direction. */
const FSI = '⁨'
const PDI = '⁩'
/** Joins a `tc` context to its text, as gettext does. */
export const CONTEXT_SEPARATOR = '\u0004'

let lang: Lang = 'en'
let hebrew: Dict | null = null
let pseudo = false
const listeners = new Set<() => void>()

function fill(text: string, vars: Vars | undefined, isolate: boolean): string {
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (match, name: string) => {
    if (!(name in vars)) return match
    const value = String(vars[name])
    return isolate ? FSI + value + PDI : value
  })
}

function lookup(key: string, english: string, vars: Vars | undefined): string {
  if (pseudo) return '⟦' + fill(english, vars, false) + '⟧'
  const translated = lang === 'he' ? hebrew?.[key] : undefined
  return translated === undefined ? fill(english, vars, false) : fill(translated, vars, true)
}

/** The text in the site's language. */
export function t(text: string, vars?: Vars): string {
  return lookup(text, text, vars)
}

/** `one` when `n` is 1, else `other`; `{n}` is filled in. */
export function tn(n: number, one: string, other: string, vars?: Vars): string {
  const text = n === 1 ? one : other
  return lookup(text, text, { n, ...vars })
}

/** The text in a context, for an English text that reads two ways in Hebrew. */
export function tc(context: string, text: string, vars?: Vars): string {
  return lookup(context + CONTEXT_SEPARATOR + text, text, vars)
}

export function getLang(): Lang {
  return lang
}

export function isRtl(): boolean {
  return lang === 'he'
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** The site's language, re-rendering the caller when it changes. */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, getLang)
}

/** `t`, re-rendering the caller when the language changes. */
export function useT(): typeof t {
  useLang()
  return t
}

function apply(next: Lang): void {
  lang = next
  const html = document.documentElement
  html.lang = next
  html.dir = next === 'he' ? 'rtl' : 'ltr'
  for (const listener of [...listeners]) listener()
}

async function loadHebrew(): Promise<void> {
  if (!hebrew) hebrew = (await import('./he')).default
}

/**
 * Switches the site's language: the Hebrew dictionary is loaded first, so no frame is half English.
 * `wrap` runs the switch itself (a view transition).
 */
export async function setLang(next: Lang, wrap?: (update: () => void) => void): Promise<void> {
  if (next === 'he') {
    try {
      await loadHebrew()
    } catch {
      return // the chunk did not load: stay as we are
    }
  }
  try { localStorage.setItem(STORAGE_KEY, next) } catch { /* this visit only */ }
  if (wrap) wrap(() => apply(next))
  else apply(next)
}

/** What the browser chose before; Guide's and Training's own choices count once, the first time. */
function storedLang(): Lang | 'pseudo' {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'he' || stored === 'en') return stored
    if (stored === 'pseudo') return 'pseudo'
    const old = localStorage.getItem('guide-lang') === 'he' || localStorage.getItem('tutorial-lang') === 'he'
    return old ? 'he' : 'en'
  } catch {
    return 'en'
  }
}

/** Before the first render: the stored language, with its dictionary loaded. */
export async function initLang(): Promise<void> {
  const stored = storedLang()
  if (stored === 'pseudo') {
    // A developer's check for text that never went through `t`: every translated text is ⟦marked⟧.
    pseudo = (import.meta as { env?: { DEV?: boolean } }).env?.DEV === true
    apply('en')
    return
  }
  if (stored === 'he') {
    try {
      await loadHebrew()
    } catch {
      apply('en')
      return
    }
  }
  apply(stored)
}

/** Tests: back to English, without touching storage. */
export function resetLang(): void {
  pseudo = false
  if (lang !== 'en') apply('en')
}
