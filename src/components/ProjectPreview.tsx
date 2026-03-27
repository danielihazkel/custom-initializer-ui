import { useState, useMemo } from 'react'
import { Highlight, Prism } from 'prism-react-renderer'
import type { PreviewResponse, TreeNode } from '../types'
import { md3SyntaxTheme } from './syntax-theme'
import { detectLanguage } from './detect-language'

// Register languages not bundled by default
;(globalThis as typeof globalThis & { Prism: typeof Prism }).Prism = Prism
import('prismjs/components/prism-docker' as string)
import('prismjs/components/prism-properties' as string)

interface Props {
  preview:    PreviewResponse
  artifactId: string
  onClose:    () => void
  onDownload: () => void
}

function fileIcon(name: string): string {
  if (name.endsWith('.java'))                                          return 'code'
  if (/\.(xml|yaml|yml|json|properties)$/.test(name))                 return 'data_object'
  if (name === 'Dockerfile' || name.endsWith('.sh'))                   return 'terminal'
  if (name.endsWith('.md'))                                            return 'article'
  if (name.startsWith('.') || name === 'VERSION' || name === 'NOTICE') return 'settings'
  return 'insert_drive_file'
}

interface NodeRowProps {
  node:     TreeNode
  depth:    number
  selected: string
  expanded: Set<string>
  onSelect: (path: string) => void
  onToggle: (path: string) => void
}

function NodeRow({ node, depth, selected, expanded, onSelect, onToggle }: NodeRowProps) {
  const isExpanded = expanded.has(node.path)
  const isSelected = node.path === selected
  const indent     = 8 + depth * 14

  if (node.type === 'directory') {
    return (
      <div>
        <button
          onClick={() => onToggle(node.path)}
          className="w-full flex items-center gap-1.5 py-0.5 pr-2 text-xs text-left rounded hover:bg-surface-container-high text-on-surface-variant transition-colors"
          style={{ paddingLeft: `${indent}px` }}
        >
          <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '14px' }}>
            {isExpanded ? 'folder_open' : 'folder'}
          </span>
          <span className="font-medium truncate">{node.name}</span>
        </button>
        {isExpanded && node.children.map(child => (
          <NodeRow key={child.path} node={child} depth={depth + 1}
            selected={selected} expanded={expanded}
            onSelect={onSelect} onToggle={onToggle}
          />
        ))}
      </div>
    )
  }

  return (
    <button
      onClick={() => onSelect(node.path)}
      className={`w-full flex items-center gap-1.5 py-0.5 pr-2 text-xs text-left rounded transition-colors ${
        isSelected
          ? 'bg-primary/10 text-primary'
          : 'hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface'
      }`}
      style={{ paddingLeft: `${indent}px` }}
    >
      <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '14px' }}>
        {fileIcon(node.name)}
      </span>
      <span className="truncate">{node.name}</span>
    </button>
  )
}

export function ProjectPreview({ preview, artifactId, onClose, onDownload }: Props) {
  const fileMap = useMemo(
    () => new Map(preview.files.map(f => [f.path, f.content])),
    [preview.files]
  )

  const [selected, setSelected] = useState<string>(preview.files[0]?.path ?? '')

  const allDirPaths = useMemo(() => {
    const dirs = new Set<string>()
    function collect(nodes: TreeNode[]) {
      for (const n of nodes) {
        if (n.type === 'directory') { dirs.add(n.path); collect(n.children) }
      }
    }
    collect(preview.tree)
    return dirs
  }, [preview.tree])

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(allDirPaths))

  function toggleDir(path: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path); else next.add(path)
      return next
    })
  }

  const content  = fileMap.get(selected) ?? ''
  const language = detectLanguage(selected.split('/').pop() ?? '')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-3">
      <div className="w-full h-full bg-surface-container border border-outline-variant rounded-2xl flex flex-col overflow-hidden shadow-2xl">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-outline-variant flex-shrink-0 bg-surface-container-high">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-secondary" style={{ fontSize: '18px' }}>folder_zip</span>
            <span className="text-sm font-bold text-on-surface">{artifactId}.zip</span>
            <span className="text-xs text-secondary">{preview.files.length} files</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onDownload}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded text-sm font-bold bg-primary text-on-primary hover:brightness-110 transition-all active:scale-95"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>download</span>
              Download ZIP
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
              aria-label="Close preview"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
            </button>
          </div>
        </div>

        {/* ── Body ───────────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden">

          {/* File tree */}
          <div className="w-60 flex-shrink-0 border-r border-outline-variant overflow-y-auto p-1.5 bg-surface-container-low">
            {preview.tree.map(node => (
              <NodeRow key={node.path} node={node} depth={0}
                selected={selected} expanded={expanded}
                onSelect={setSelected} onToggle={toggleDir}
              />
            ))}
          </div>

          {/* Content viewer */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {selected && (
              <div className="px-4 py-1.5 border-b border-outline-variant bg-surface-container flex-shrink-0">
                <span className="text-[11px] text-secondary font-mono">{selected}</span>
              </div>
            )}
            <div className="flex-1 overflow-auto bg-surface-container-lowest">
              <Highlight theme={md3SyntaxTheme} code={content} language={language}>
                {({ tokens, getLineProps, getTokenProps }) => (
                  <pre className="text-xs font-mono leading-5 m-0 p-0" style={{ background: 'transparent' }}>
                    {tokens.map((line, i) => (
                      <div key={i} {...getLineProps({ line })} className="flex hover:bg-surface-container/40 min-w-0" style={{}}>
                        <span className="text-secondary/40 select-none text-right px-3 flex-shrink-0 w-12 border-r border-outline-variant/20">
                          {i + 1}
                        </span>
                        <span className="px-4 whitespace-pre">
                          {line.map((token, key) => (
                            <span key={key} {...getTokenProps({ token })} />
                          ))}
                        </span>
                      </div>
                    ))}
                  </pre>
                )}
              </Highlight>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
