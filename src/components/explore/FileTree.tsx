import { useEffect, useMemo, useRef, useState } from 'react'
import type { FileStatus, TreeNode } from '../../types'
import { fuzzyMatch } from '../../utils/fuzzy'
import { Highlight } from '../shared/Highlight'

/**
 * The file tree of a generated project: used by the Explore modal and by the Backend tab's file
 * dock. Deliberately free of any editor import — the dock shows it on the page itself, where a
 * CodeMirror dependency would cost the first paint.
 */

export function fileIcon(name: string): string {
  if (name.endsWith('.java'))                                          return 'code'
  if (/\.(tsx?|jsx?|css|html)$/.test(name))                            return 'code'
  if (/\.(xml|yaml|yml|json|properties)$/.test(name))                  return 'data_object'
  if (name === 'Dockerfile' || name.endsWith('.sh'))                   return 'terminal'
  if (name.endsWith('.md'))                                            return 'article'
  if (name.endsWith('.sql'))                                           return 'database'
  if (name.startsWith('.') || name === 'VERSION' || name === 'NOTICE') return 'settings'
  return 'insert_drive_file'
}

export const STATUS_COLORS: Record<FileStatus, string> = {
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

/** Every ancestor directory of each changed file, so directory rows can show their
 *  "has changes" dot with a Set lookup instead of scanning the whole status map. */
export function collectChangedDirs(fileStatuses: Map<string, FileStatus>): Set<string> {
  const dirs = new Set<string>()
  for (const [path, s] of fileStatuses) {
    if (s === 'unchanged') continue
    let idx = path.lastIndexOf('/')
    while (idx > 0) {
      dirs.add(path.slice(0, idx))
      idx = path.lastIndexOf('/', idx - 1)
    }
  }
  return dirs
}

/** Inserts removed-file paths as ghost nodes into (a copy of) the new tree. */
export function mergeRemovedIntoTree(tree: TreeNode[], removedPaths: string[]): TreeNode[] {
  if (removedPaths.length === 0) return tree
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

/** One visible row of the tree. */
export interface TreeRow {
  node: TreeNode
  depth: number
  /** Path of the directory it is in ('' at the top). */
  parent: string
  /** Where the filter matched the name. */
  ranges?: [number, number][]
}

/**
 * The rows to draw, top to bottom. Without a filter: everything not inside a collapsed directory.
 * With one: the files whose name matches (or whose path holds the words typed), each under its
 * directories, all open — a filter that hid matches inside closed folders would be useless.
 */
export function visibleRows(tree: TreeNode[], collapsed: Set<string>, filter: string): TreeRow[] {
  const q = filter.trim()
  const rows: TreeRow[] = []
  const lowered = q.toLowerCase()

  const walk = (nodes: TreeNode[], depth: number, parent: string): boolean => {
    let any = false
    for (const node of nodes) {
      if (node.type === 'directory') {
        const at = rows.length
        rows.push({ node, depth, parent })
        if (q) {
          // Keep the directory only if something under it matched.
          if (walk(node.children, depth + 1, node.path)) any = true
          else rows.length = at
        } else {
          any = true
          if (!collapsed.has(node.path)) walk(node.children, depth + 1, node.path)
        }
      } else if (!q) {
        rows.push({ node, depth, parent })
        any = true
      } else {
        const byName = fuzzyMatch(q, node.name)
        if (byName || node.path.toLowerCase().includes(lowered)) {
          rows.push({ node, depth, parent, ranges: byName?.ranges })
          any = true
        }
      }
    }
    return any
  }
  walk(tree, 0, '')
  return rows
}

interface Props {
  tree: TreeNode[]
  selected: string
  onSelect: (path: string) => void
  fileStatuses?: Map<string, FileStatus>
  /** Directory paths containing at least one changed file (precomputed once per diff). */
  changedDirs?: Set<string>
  /** Narrows the tree to matching files. */
  filter?: string
  /** Paths to flash once (the dock: files that just appeared). */
  flash?: Set<string>
  label?: string
}

export function FileTree({ tree, selected, onSelect, fileStatuses, changedDirs, filter = '', flash, label = 'Project files' }: Props) {
  // Tracked as "collapsed" rather than "expanded": the tree is fully open by default, and
  // directories that appear later (ghost dirs of removed files, new dependencies) inherit that.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const rows = useMemo(() => visibleRows(tree, collapsed, filter), [tree, collapsed, filter])

  // Roving tabindex: one row is the tree's Tab stop — the row the arrows last landed on, else
  // the selected file, else the first row.
  const [cursor, setCursor] = useState<string | null>(null)
  const active = rows.some(r => r.node.path === cursor) ? cursor
    : rows.some(r => r.node.path === selected) ? selected
      : rows[0]?.node.path ?? null
  const rootRef = useRef<HTMLDivElement>(null)
  const focusPending = useRef(false)

  useEffect(() => {
    if (!focusPending.current) return
    focusPending.current = false
    rootRef.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus()
  }, [active])

  function toggle(path: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path); else next.add(path)
      return next
    })
  }

  function moveTo(path: string | undefined) {
    if (!path) return
    focusPending.current = true
    setCursor(path)
    if (path === active) rootRef.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus()
  }

  function activate(row: TreeRow) {
    if (row.node.type === 'directory') toggle(row.node.path)
    else onSelect(row.node.path)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const at = rows.findIndex(r => r.node.path === active)
    if (at < 0) return
    const row = rows[at]
    const isDir = row.node.type === 'directory'
    const open = isDir && (filter.trim() !== '' || !collapsed.has(row.node.path))
    switch (e.key) {
      case 'ArrowDown': moveTo(rows[Math.min(at + 1, rows.length - 1)].node.path); break
      case 'ArrowUp': moveTo(rows[Math.max(at - 1, 0)].node.path); break
      case 'Home': moveTo(rows[0].node.path); break
      case 'End': moveTo(rows[rows.length - 1].node.path); break
      case 'ArrowRight':
        if (isDir && !open) toggle(row.node.path)
        else if (isDir) moveTo(rows[at + 1]?.node.path)
        break
      case 'ArrowLeft':
        if (isDir && open && !filter.trim()) toggle(row.node.path)
        else if (row.parent) moveTo(row.parent)
        break
      case 'Enter':
      case ' ':
        activate(row)
        break
      default:
        return
    }
    e.preventDefault()
  }

  if (rows.length === 0) {
    return <p className="px-2 py-3 text-[11px] text-secondary" data-tree-empty>No file matches “{filter.trim()}”.</p>
  }

  return (
    <div ref={rootRef} role="tree" aria-label={label} onKeyDown={onKeyDown}>
      {rows.map(row => {
        const { node, depth } = row
        const isDir = node.type === 'directory'
        const isOpen = isDir && (filter.trim() !== '' || !collapsed.has(node.path))
        const isSelected = !isDir && node.path === selected
        const status = isDir ? undefined : fileStatuses?.get(node.path)
        const changed = status && status !== 'unchanged' ? status : undefined
        return (
          <div
            key={node.path}
            role="treeitem"
            aria-level={depth + 1}
            aria-expanded={isDir ? isOpen : undefined}
            aria-selected={isDir ? undefined : isSelected}
            tabIndex={node.path === active ? 0 : -1}
            data-tree-path={node.path}
            onClick={() => { setCursor(node.path); activate(row) }}
            className={`flex items-center gap-1.5 py-0.5 pr-2 text-xs rounded cursor-pointer select-none outline-none transition-colors focus-visible:ring-1 focus-visible:ring-primary ${
              isSelected
                ? 'bg-primary/10 text-primary'
                : `hover:bg-surface-container-high ${changed ? STATUS_COLORS[changed] : 'text-on-surface-variant hover:text-on-surface'}`
            } ${flash?.has(node.path) ? 'tree-flash' : ''}`}
            style={{ paddingLeft: `${8 + depth * 14}px` }}
          >
            <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '14px' }} aria-hidden="true">
              {isDir ? (isOpen ? 'folder_open' : 'folder') : fileIcon(node.name)}
            </span>
            <span className={`truncate ${isDir ? 'font-medium' : ''} ${changed === 'removed' ? 'line-through opacity-60' : ''}`}>
              <Highlight text={node.name} ranges={row.ranges} />
            </span>
            {isDir && changedDirs?.has(node.path) && (
              <span className="ml-1 w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" aria-label="Has changes" />
            )}
            {changed && (
              <span
                className={`material-symbols-outlined ml-auto flex-shrink-0 ${STATUS_COLORS[changed]}`}
                style={{ fontSize: '12px' }}
                aria-label={changed}
              >
                {STATUS_ICONS[changed]}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
