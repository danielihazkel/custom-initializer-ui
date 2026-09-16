import { useMemo } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { langFromPath } from '../../lang-from-path'

interface Props {
  value: string
  onChange: (value: string) => void
  targetPath: string
}

export function CodeEditor({ value, onChange, targetPath }: Props) {
  // CodeMirror compares `extensions` by identity; rebuilding the array (and a fresh
  // language parser) on every keystroke re-configured the editor per character typed.
  const extensions = useMemo(() => langFromPath(targetPath), [targetPath])
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true }}
      theme="dark"
      style={{ fontSize: '12px', borderRadius: '0.375rem', overflow: 'hidden' }}
      minHeight="14rem"
    />
  )
}
