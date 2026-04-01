import { useState, useMemo } from 'react'
import type { PreviewResponse, TreeNode, FileStatus } from '../types'
import { usePreviewDiff } from '../hooks/usePreviewDiff'
import { DiffContentViewer } from './DiffContentViewer'
import { ReadOnlyCodeViewer } from './ReadOnlyCodeViewer'

interface Props {
  preview:          PreviewResponse
  previousPreview?: PreviewResponse | null
  artifactId:       string
  onClose:          () => void
  onDownload:       () => void
}

function fileIcon(name: string): string {
  if (name.endsWith('.java'))                                          return 'code'
  if (/\.(xml|yaml|yml|json|properties)$/.test(name))                 return 'data_object'
  if (name === 'Dockerfile' || name.endsWith('.sh'))                   return 'terminal'
  if (name.endsWith('.md'))                                            return 'article'
  if (name.startsWith('.') || name === 'VERSION' || name === 'NOTICE') return 'settings'
  return 'insert_drive_file'
}

const STATUS_COLORS: Record<FileStatus, string> = {
  added:     'text-green-500',
  removed:   'text-red-400',
  modified:  'text-amber-400',
  unchanged: '',
}

const STATUS_ICONS: Record<FileStatus, string> = {
  added:     'add_circle',
  removed:   'remove_circle',
  modified:  'edit',
  unchanged: '',
}

interface NodeRowProps {
  node:        TreeNode
  depth:       number
  selected:    string
  expanded:    Set<string>
  onSelect:    (path: string) => void
  onToggle:    (path: string) => void
  fileStatuses?: Map<string, FileStatus>
}

function NodeRow({ node, depth, selected, expanded, onSelect, onToggle, fileStatuses }: NodeRowProps) {
  const isExpanded = expanded.has(node.path)
  const isSelected = node.path === selected
  const indent     = 8 + depth * 14

  const status = fileStatuses?.get(node.path)
  const statusColor = status && status !== 'unchanged' ? STATUS_COLORS[status] : ''

  if (node.type === 'directory') {
    const dirHasChanges = fileStatuses
      ? [...fileStatuses.entries()].some(
          ([path, s]) => s !== 'unchanged' && path.startsWith(node.path + '/')
        )
      : false

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
          {dirHasChanges && (
            <span className="ml-1 w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
          )}
        </button>
        {isExpanded && node.children.map(child => (
          <NodeRow key={child.path} node={child} depth={depth + 1}
            selected={selected} expanded={expanded}
            onSelect={onSelect} onToggle={onToggle}
            fileStatuses={fileStatuses}
          />
        ))}
      </div>
    )
  }

  const isRemoved = status === 'removed'

  return (
    <button
      onClick={() => onSelect(node.path)}
      className={`w-full flex items-center gap-1.5 py-0.5 pr-2 text-xs text-left rounded transition-colors ${
        isSelected
          ? 'bg-primary/10 text-primary'
          : `hover:bg-surface-container-high ${statusColor || 'text-on-surface-variant hover:text-on-surface'}`
      }`}
      style={{ paddingLeft: `${indent}px` }}
    >
      <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '14px' }}>
        {fileIcon(node.name)}
      </span>
      <span className={`truncate ${isRemoved ? 'line-through opacity-60' : ''}`}>{node.name}</span>
      {status && status !== 'unchanged' && (
        <span className={`material-symbols-outlined ml-auto flex-shrink-0 ${STATUS_COLORS[status]}`} style={{ fontSize: '12px' }}>
          {STATUS_ICONS[status]}
        </span>
      )}
    </button>
  )
}

/** Insert removed-file paths as ghost nodes into the new tree */
function mergeRemovedIntoTree(tree: TreeNode[], removedPaths: string[]): TreeNode[] {
  if (removedPaths.length === 0) return tree

  // Deep clone to avoid mutating props
  const cloned = JSON.parse(JSON.stringify(tree)) as TreeNode[]

  for (const filePath of removedPaths) {
    const parts = filePath.split('/')
    let nodes = cloned

    for (let i = 0; i < parts.length - 1; i++) {
      const dirName = parts[i]
      const dirPath = parts.slice(0, i + 1).join('/')
      let dir = nodes.find(n => n.name === dirName && n.type === 'directory')
      if (!dir) {
        dir = { name: dirName, path: dirPath, type: 'directory', children: [] }
        nodes.push(dir)
      }
      nodes = dir.children
    }

    const fileName = parts[parts.length - 1]
    if (!nodes.find(n => n.path === filePath)) {
      nodes.push({ name: fileName, path: filePath, type: 'file', children: [] })
    }
  }

  return cloned
}

export function ProjectPreview({ preview, previousPreview, artifactId, onClose, onDownload }: Props) {
  const diffResult = usePreviewDiff(preview, previousPreview ?? null)
  const [diffMode, setDiffMode] = useState(true)

  const showDiff = diffMode && diffResult !== null

  const fileMap = useMemo(
    () => new Map(preview.files.map(f => [f.path, f.content])),
    [preview.files]
  )

  const oldFileMap = useMemo(
    () => previousPreview ? new Map(previousPreview.files.map(f => [f.path, f.content])) : new Map<string, string>(),
    [previousPreview]
  )

  const mergedTree = useMemo(() => {
    if (!showDiff || !diffResult) return preview.tree
    const removedPaths = [...diffResult.fileStatuses.entries()]
      .filter(([, s]) => s === 'removed')
      .map(([p]) => p)
    return mergeRemovedIntoTree(preview.tree, removedPaths)
  }, [showDiff, diffResult, preview.tree])

  const allDirPaths = useMemo(() => {
    const dirs = new Set<string>()
    function collect(nodes: TreeNode[]) {
      for (const n of nodes) {
        if (n.type === 'directory') { dirs.add(n.path); collect(n.children) }
      }
    }
    collect(mergedTree)
    return dirs
  }, [mergedTree])

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(allDirPaths))
  const [selected, setSelected] = useState<string>(preview.files[0]?.path ?? '')

  function toggleDir(path: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path); else next.add(path)
      return next
    })
  }

  const selectedStatus = diffResult?.fileStatuses.get(selected)
  const content    = fileMap.get(selected) ?? oldFileMap.get(selected) ?? ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-3">
      <div className="w-full h-full bg-surface-container border border-outline-variant rounded-2xl flex flex-col overflow-hidden shadow-2xl">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-outline-variant flex-shrink-0 bg-surface-container-high">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-secondary" style={{ fontSize: '18px' }}>folder_zip</span>
            <span className="text-sm font-bold text-on-surface">{artifactId}.zip</span>
            <span className="text-xs text-secondary">{preview.files.length} files</span>
            {diffResult?.hasChanges && (
              <span className="text-xs text-secondary">
                {[
                  diffResult.addedCount    > 0 && <span key="a" className="text-green-500">{diffResult.addedCount} added</span>,
                  diffResult.modifiedCount > 0 && <span key="m" className="text-amber-400">{diffResult.modifiedCount} modified</span>,
                  diffResult.removedCount  > 0 && <span key="r" className="text-red-400">{diffResult.removedCount} removed</span>,
                ].filter(Boolean).reduce<React.ReactNode[]>((acc, el, i) => {
                  if (i > 0) acc.push(<span key={`sep-${i}`} className="text-secondary"> · </span>)
                  acc.push(el)
                  return acc
                }, [])}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {diffResult !== null && (
              <div className="flex rounded overflow-hidden border border-outline-variant text-xs">
                <button
                  onClick={() => setDiffMode(false)}
                  className={`px-3 py-1 transition-colors ${!diffMode ? 'bg-primary text-on-primary font-bold' : 'text-secondary hover:bg-surface-container'}`}
                >
                  Normal
                </button>
                <button
                  onClick={() => setDiffMode(true)}
                  className={`px-3 py-1 transition-colors ${diffMode ? 'bg-primary text-on-primary font-bold' : 'text-secondary hover:bg-surface-container'}`}
                >
                  Diff{diffResult.hasChanges ? ` (${diffResult.addedCount + diffResult.modifiedCount + diffResult.removedCount})` : ''}
                </button>
              </div>
            )}
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
            {mergedTree.map(node => (
              <NodeRow key={node.path} node={node} depth={0}
                selected={selected} expanded={expanded}
                onSelect={setSelected} onToggle={toggleDir}
                fileStatuses={showDiff ? diffResult.fileStatuses : undefined}
              />
            ))}
          </div>

          {/* Content viewer */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {selected && (
              <div className="px-4 py-1.5 border-b border-outline-variant bg-surface-container flex-shrink-0 flex items-center gap-2">
                <span className="text-[11px] text-secondary font-mono">{selected}</span>
                {showDiff && selectedStatus && selectedStatus !== 'unchanged' && (
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded capitalize ${
                    selectedStatus === 'added'    ? 'bg-green-500/15 text-green-500' :
                    selectedStatus === 'removed'  ? 'bg-red-400/15 text-red-400'    :
                    selectedStatus === 'modified' ? 'bg-amber-400/15 text-amber-500' : ''
                  }`}>
                    {selectedStatus}
                  </span>
                )}
              </div>
            )}
            <div className="flex-1 overflow-auto bg-surface-container-lowest">
              {showDiff && selectedStatus && selectedStatus !== 'unchanged' ? (
                <DiffContentViewer
                  status={selectedStatus}
                  newContent={fileMap.get(selected) ?? ''}
                  oldContent={oldFileMap.get(selected) ?? ''}
                />
              ) : (
                <ReadOnlyCodeViewer code={content} targetPath={selected} />
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
