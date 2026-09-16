import { java } from '@codemirror/lang-java'
import { yaml } from '@codemirror/lang-yaml'
import { xml } from '@codemirror/lang-xml'
import { json } from '@codemirror/lang-json'
import { sql } from '@codemirror/lang-sql'
import { javascript } from '@codemirror/lang-javascript'
import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { markdown } from '@codemirror/lang-markdown'
import { StreamLanguage } from '@codemirror/language'
import { dockerFile } from '@codemirror/legacy-modes/mode/dockerfile'
import { properties } from '@codemirror/legacy-modes/mode/properties'
import type { Extension } from '@codemirror/state'

// Each language is constructed lazily, once, and reused: LanguageSupport instances are
// expensive (they carry a Lezer parser) and CodeMirror reconfigures on identity change.
const LANG_FACTORIES: Record<string, () => Extension[]> = {
  dockerfile:   () => [StreamLanguage.define(dockerFile)],
  editorconfig: () => [StreamLanguage.define(properties)],
  tsx:          () => [javascript({ jsx: true, typescript: true })],
  ts:           () => [javascript({ typescript: true })],
  jsx:          () => [javascript({ jsx: true })],
  js:           () => [javascript()],
  java:         () => [java()],
  yaml:         () => [yaml()],
  xml:          () => [xml()],
  json:         () => [json()],
  sql:          () => [sql()],
  css:          () => [css()],
  html:         () => [html()],
  markdown:     () => [markdown()],
}

const NONE: Extension[] = []
const cache = new Map<string, Extension[]>()

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

/** Returns the same array instance for the same language, so callers can use it as a
 *  stable `extensions` entry / memo dependency. */
export function langFromPath(targetPath: string): Extension[] {
  const key = langKey(targetPath)
  if (key === null) return NONE
  let ext = cache.get(key)
  if (!ext) {
    ext = LANG_FACTORIES[key]()
    cache.set(key, ext)
  }
  return ext
}
