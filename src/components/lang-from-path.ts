import { java } from '@codemirror/lang-java'
import { yaml } from '@codemirror/lang-yaml'
import { xml } from '@codemirror/lang-xml'
import { json } from '@codemirror/lang-json'
import { sql } from '@codemirror/lang-sql'
import type { Extension } from '@codemirror/state'

export function langFromPath(targetPath: string): Extension[] {
  const parts = targetPath.split('/')
  const filename = parts[parts.length - 1] ?? ''
  if (filename.endsWith('.java'))                               return [java()]
  if (filename.endsWith('.yaml') || filename.endsWith('.yml')) return [yaml()]
  if (filename.endsWith('.xml'))                               return [xml()]
  if (filename.endsWith('.json'))                              return [json()]
  if (filename.endsWith('.sql'))                                return [sql()]
  return []
}
