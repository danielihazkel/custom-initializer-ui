import CodeMirror from '@uiw/react-codemirror'
import { langFromPath } from '../../lang-from-path'

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
