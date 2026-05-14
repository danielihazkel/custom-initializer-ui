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

export function langFromPath(targetPath: string): Extension[] {
  const parts = targetPath.split('/')
  const filename = parts[parts.length - 1] ?? ''
  const lower = filename.toLowerCase()

  if (lower === 'dockerfile')    return [StreamLanguage.define(dockerFile)]
  if (lower === '.editorconfig') return [StreamLanguage.define(properties)]
  if (lower === '.gitignore')    return []

  if (lower.endsWith('.tsx')) return [javascript({ jsx: true, typescript: true })]
  if (lower.endsWith('.ts'))  return [javascript({ typescript: true })]
  if (lower.endsWith('.jsx')) return [javascript({ jsx: true })]
  if (lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.cjs')) return [javascript()]

  if (lower.endsWith('.java'))                              return [java()]
  if (lower.endsWith('.yaml') || lower.endsWith('.yml'))    return [yaml()]
  if (lower.endsWith('.xml'))                               return [xml()]
  if (lower.endsWith('.json'))                              return [json()]
  if (lower.endsWith('.sql'))                               return [sql()]
  if (lower.endsWith('.css'))                               return [css()]
  if (lower.endsWith('.html') || lower.endsWith('.htm'))    return [html()]
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return [markdown()]

  return []
}
