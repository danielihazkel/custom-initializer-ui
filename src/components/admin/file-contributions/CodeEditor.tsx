import CodeMirror from '@uiw/react-codemirror'
import { java } from '@codemirror/lang-java'
import { yaml } from '@codemirror/lang-yaml'
import { xml } from '@codemirror/lang-xml'
import { json } from '@codemirror/lang-json'
import type { Extension } from '@codemirror/state'

function langFromPath(targetPath: string): Extension[] {
  const filename = targetPath.split('/').at(-1) ?? ''
  if (filename.endsWith('.java'))                              return [java()]
  if (filename.endsWith('.yaml') || filename.endsWith('.yml')) return [yaml()]
  if (filename.endsWith('.xml'))                               return [xml()]
  if (filename.endsWith('.json'))                              return [json()]
  return []
}

interface Props {
  value: string
  onChange: (value: string) => void
  targetPath: string
}

export function CodeEditor({ value, onChange, targetPath }: Props) {
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={langFromPath(targetPath)}
      basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true }}
      theme="dark"
      style={{ fontSize: '12px', borderRadius: '0.375rem', overflow: 'hidden' }}
      minHeight="14rem"
    />
  )
}
