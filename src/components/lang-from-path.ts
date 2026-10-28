import { useEffect, useReducer } from 'react'
import { StreamLanguage } from '@codemirror/language'
import type { Extension } from '@codemirror/state'

// Each grammar is its own chunk, fetched the first time a file of that language is shown: all
// of them together are ~250 KB gzipped, and a viewer usually needs one or two. A language is
// constructed once and reused — LanguageSupport instances are expensive (they carry a Lezer
// parser) and CodeMirror reconfigures on identity change.
const LANG_LOADERS: Record<string, () => Promise<Extension[]>> = {
  dockerfile:   () => import('@codemirror/legacy-modes/mode/dockerfile').then(m => [StreamLanguage.define(m.dockerFile)]),
  editorconfig: () => import('@codemirror/legacy-modes/mode/properties').then(m => [StreamLanguage.define(m.properties)]),
  tsx:          () => import('@codemirror/lang-javascript').then(m => [m.javascript({ jsx: true, typescript: true })]),
  ts:           () => import('@codemirror/lang-javascript').then(m => [m.javascript({ typescript: true })]),
  jsx:          () => import('@codemirror/lang-javascript').then(m => [m.javascript({ jsx: true })]),
  js:           () => import('@codemirror/lang-javascript').then(m => [m.javascript()]),
  java:         () => import('@codemirror/lang-java').then(m => [m.java()]),
  yaml:         () => import('@codemirror/lang-yaml').then(m => [m.yaml()]),
  xml:          () => import('@codemirror/lang-xml').then(m => [m.xml()]),
  json:         () => import('@codemirror/lang-json').then(m => [m.json()]),
  sql:          () => import('@codemirror/lang-sql').then(m => [m.sql()]),
  css:          () => import('@codemirror/lang-css').then(m => [m.css()]),
  html:         () => import('@codemirror/lang-html').then(m => [m.html()]),
  markdown:     () => import('@codemirror/lang-markdown').then(m => [m.markdown()]),
}

const NONE: Extension[] = []
const cache = new Map<string, Extension[]>()
const pending = new Map<string, Promise<void>>()

function langKey(targetPath: string): string | null {
  const parts = targetPath.split('/')
  const filename = parts[parts.length - 1] ?? ''
  const lower = filename.toLowerCase()

  if (lower === 'dockerfile')    return 'dockerfile'
  if (lower === '.editorconfig') return 'editorconfig'
  if (lower === '.gitignore')    return null

  if (lower.endsWith('.tsx')) return 'tsx'
  if (lower.endsWith('.ts'))  return 'ts'
  if (lower.endsWith('.jsx')) return 'jsx'
  if (lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.cjs')) return 'js'

  if (lower.endsWith('.java'))                              return 'java'
  if (lower.endsWith('.yaml') || lower.endsWith('.yml'))    return 'yaml'
  if (lower.endsWith('.xml'))                               return 'xml'
  if (lower.endsWith('.json'))                              return 'json'
  if (lower.endsWith('.sql'))                               return 'sql'
  if (lower.endsWith('.css'))                               return 'css'
  if (lower.endsWith('.html') || lower.endsWith('.htm'))    return 'html'
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'markdown'

  return null
}

function load(key: string): Promise<void> {
  let promise = pending.get(key)
  if (!promise) {
    promise = LANG_LOADERS[key]()
      .then(ext => { cache.set(key, ext) })
      // A grammar that fails to load leaves the file as plain text; the next file retries.
      .catch(() => { pending.delete(key) })
    pending.set(key, promise)
  }
  return promise
}

/** The language extension for `targetPath`: plain text until its grammar has loaded, then the
 *  same array instance every time, so callers can use it as a stable `extensions` entry. */
export function useLanguage(targetPath: string): Extension[] {
  const key = langKey(targetPath)
  const [, loaded] = useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    if (key === null || cache.has(key)) return
    let live = true
    load(key).then(() => { if (live) loaded() })
    return () => { live = false }
  }, [key])
  return (key === null ? NONE : cache.get(key)) ?? NONE
}
