import { useMemo } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { EditorView } from '@codemirror/view'
import { useLanguage } from './lang-from-path'
import { useIsDark } from '../hooks/useTheme'

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
  /** Long lines wrap instead of scrolling sideways. */
  wrap?: boolean
}

export function ReadOnlyCodeViewer({ code, targetPath, wrap = false }: Props) {
  // react-codemirror compares `extensions` by identity — a fresh array per render would
  // reconfigure the editor (and rebuild the parser) every time the parent re-renders.
  const language = useLanguage(targetPath)
  const extensions = useMemo(
    () => (wrap ? [language, transparentTheme, EditorView.lineWrapping] : [language, transparentTheme]),
    [language, wrap],
  )
  // CodeMirror takes its syntax colours from this prop, not from CSS: follow the app theme, or
  // light mode shows dark-theme token colours on a white panel.
  const dark = useIsDark()
  // Code reads left to right in either language.
  return (
    <div dir="ltr" className="h-full">
      <CodeMirror
        value={code}
        extensions={extensions}
        basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true }}
        theme={dark ? 'dark' : 'light'}
        editable={false}
        readOnly={true}
        height="100%"
        style={{ fontSize: '12px', height: '100%' }}
      />
    </div>
  )
}
