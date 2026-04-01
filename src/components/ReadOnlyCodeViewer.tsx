import CodeMirror from '@uiw/react-codemirror'
import { EditorView } from '@codemirror/view'
import { langFromPath } from './lang-from-path'

const transparentTheme = EditorView.theme({
  '&': { background: 'transparent !important', height: '100%' },
  '.cm-scroller': { overflow: 'auto' },
  '.cm-gutters': { background: 'transparent', borderRight: '1px solid color-mix(in srgb, var(--color-outline-variant) 20%, transparent)' },
  '.cm-lineNumbers .cm-gutterElement': { color: 'color-mix(in srgb, var(--color-secondary) 40%, transparent)', minWidth: '3rem', paddingRight: '0.75rem' },
  '.cm-activeLine': { background: 'color-mix(in srgb, var(--color-surface-container) 40%, transparent)' },
  '.cm-activeLineGutter': { background: 'transparent' },
})

interface Props {
  code: string
  targetPath: string
}

export function ReadOnlyCodeViewer({ code, targetPath }: Props) {
  return (
    <CodeMirror
      value={code}
      extensions={[langFromPath(targetPath), transparentTheme]}
      basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true }}
      theme="dark"
      editable={false}
      readOnly={true}
      height="100%"
      style={{ fontSize: '12px', height: '100%' }}
    />
  )
}
