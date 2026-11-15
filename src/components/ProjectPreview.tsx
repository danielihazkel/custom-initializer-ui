import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import type { PreviewResponse } from '../types'
import { usePreviewDiff } from '../hooks/usePreviewDiff'
import { useModal } from '../hooks/useModal'
import { showToast } from '../toast'
import { CopyButton } from './shared/CopyButton'
import { downloadBlob } from '../utils/projectUtils'
import { searchFiles, MAX_SEARCH_HITS, type SearchHit } from '../utils/searchFiles'
import { DiffContentViewer } from './DiffContentViewer'
import { ReadOnlyCodeViewer } from './ReadOnlyCodeViewer'
import { FileTree, collectChangedDirs, fileIcon, mergeRemovedIntoTree } from './explore/FileTree'

interface Props {
  preview:          PreviewResponse
  previousPreview?: PreviewResponse | null
  artifactId:       string
  onClose:          () => void
  onDownload:       () => void
  /** The file to open on (the file dock's click); else the one looked at last, else the first. */
  initialPath?:     string
}

const WIDTH_KEY = 'explore:treeWidth'
const LAST_PATH_KEY = 'explore:lastPath'
const WRAP_KEY = 'explore:wrap'
const MIN_TREE = 180
const MAX_TREE = 560

function readNumber(key: string, fallback: number): number {
  try {
    const n = Number(localStorage.getItem(key))
    return Number.isFinite(n) && n > 0 ? n : fallback
  } catch {
    return fallback
  }
}

function store(storage: 'local' | 'session', key: string, value: string): void {
  try { (storage === 'local' ? localStorage : sessionStorage).setItem(key, value) } catch { /* this visit only */ }
}

/**
 * The Explore modal: the files a setup generates, before downloading them. A tree on the left
 * (resizable, filterable, keyboard-driven) or a search across every file; on the right the
 * selected file — or, against the previous preview, what changed in it.
 */
export function ProjectPreview({ preview, previousPreview, artifactId, onClose, onDownload, initialPath }: Props) {
  const diffResult = usePreviewDiff(preview, previousPreview ?? null)
  const [diffMode, setDiffMode] = useState(true)
  const showDiff = diffMode && diffResult !== null

  const fileMap = useMemo(() => new Map(preview.files.map(f => [f.path, f.content])), [preview.files])
  const oldFileMap = useMemo(
    () => previousPreview ? new Map(previousPreview.files.map(f => [f.path, f.content])) : new Map<string, string>(),
    [previousPreview],
  )

  const mergedTree = useMemo(() => {
    if (!showDiff || !diffResult) return preview.tree
    const removedPaths = [...diffResult.fileStatuses.entries()].filter(([, s]) => s === 'removed').map(([p]) => p)
    return mergeRemovedIntoTree(preview.tree, removedPaths)
  }, [showDiff, diffResult, preview.tree])

  const fileStatuses = showDiff ? diffResult.fileStatuses : undefined
  const changedDirs = useMemo(() => (fileStatuses ? collectChangedDirs(fileStatuses) : undefined), [fileStatuses])

  const [selected, setSelected] = useState<string>(() => {
    if (initialPath && fileMap.has(initialPath)) return initialPath
    let last: string | null = null
    try { last = sessionStorage.getItem(LAST_PATH_KEY) } catch { /* ignore */ }
    return last && fileMap.has(last) ? last : preview.files[0]?.path ?? ''
  })
  const select = useCallback((path: string) => {
    setSelected(path)
    store('session', LAST_PATH_KEY, path)
  }, [])

  // ── Left column: the tree with a name filter, or a search through the contents ───────────
  const [pane, setPane] = useState<'files' | 'search'>('files')
  const [filter, setFilter] = useState('')
  const [query, setQuery] = useState('')
  const filterRef = useRef<HTMLInputElement>(null)
  const queryRef = useRef<HTMLInputElement>(null)
  const search = useMemo(() => searchFiles(preview.files, query), [preview.files, query])
  const hitsByFile = useMemo(() => {
    const groups = new Map<string, SearchHit[]>()
    for (const hit of search.hits) {
      const list = groups.get(hit.path) ?? []
      list.push(hit)
      groups.set(hit.path, list)
    }
    return [...groups.entries()]
  }, [search.hits])

  function openPane(next: 'files' | 'search') {
    setPane(next)
    // After the pane has rendered its input.
    requestAnimationFrame(() => {
      const input = next === 'files' ? filterRef.current : queryRef.current
      input?.focus()
      input?.select()
    })
  }

  // ── Tree width, dragged ───────────────────────────────────────────────────────────────────
  const [treeWidth, setTreeWidth] = useState(() => Math.min(MAX_TREE, Math.max(MIN_TREE, readNumber(WIDTH_KEY, 260))))
  const dragging = useRef(false)
  function startResize(e: React.PointerEvent<HTMLDivElement>) {
    dragging.current = true
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  function resize(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return
    const left = e.currentTarget.parentElement?.getBoundingClientRect().left ?? 0
    setTreeWidth(Math.min(MAX_TREE, Math.max(MIN_TREE, e.clientX - left)))
  }
  function endResize() {
    if (!dragging.current) return
    dragging.current = false
    store('local', WIDTH_KEY, String(treeWidth))
  }
  function resizeByKey(e: React.KeyboardEvent) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const next = Math.min(MAX_TREE, Math.max(MIN_TREE, treeWidth + (e.key === 'ArrowRight' ? 16 : -16)))
    setTreeWidth(next)
    store('local', WIDTH_KEY, String(next))
  }

  const [wrap, setWrap] = useState(() => {
    try { return localStorage.getItem(WRAP_KEY) === 'on' } catch { return false }
  })
  function toggleWrap() {
    store('local', WRAP_KEY, wrap ? 'off' : 'on')
    setWrap(!wrap)
  }

  const dialogRef = useRef<HTMLDivElement>(null)
  useModal(dialogRef, { onClose, initialFocus: false })
  // Open on the tree, at the selected file: the arrows walk the files straight away.
  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>('[role="tree"] [tabindex="0"]')?.focus({ preventScroll: true })
  }, [])

  function onKeyDown(e: React.KeyboardEvent) {
    const typing = e.target instanceof HTMLInputElement
    const ctrl = e.ctrlKey || e.metaKey
    if (ctrl && e.shiftKey && e.key.toLowerCase() === 'f') {
      e.preventDefault()
      openPane('search')
    } else if ((ctrl && e.key.toLowerCase() === 'p') || (e.key === '/' && !typing)) {
      e.preventDefault()
      openPane('files')
    }
  }

  const selectedStatus = diffResult?.fileStatuses.get(selected)
  const content = fileMap.get(selected) ?? oldFileMap.get(selected) ?? ''
  const fileName = selected.split('/').pop() ?? selected
  const crumbs = selected.split('/')

  // The button itself shows the tick; a toast only when the browser refused.
  function copied(ok: boolean, what: string) {
    if (!ok) showToast({ message: `Couldn't copy the ${what}`, type: 'error' })
  }

  const tool = 'p-1.5 rounded text-secondary hover:text-on-surface hover:bg-surface-container-high transition-colors'
  const tab = (active: boolean) => `flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-semibold transition-colors ${
    active ? 'text-on-surface border-b-2 border-primary' : 'text-secondary hover:text-on-surface border-b-2 border-transparent'}`
  const field = 'w-full bg-surface-container-highest border border-outline-variant rounded px-2 py-1 text-xs text-on-surface outline-none focus:border-primary placeholder-secondary/70'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-3">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Files of ${artifactId}.zip`}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="w-full h-full bg-surface-container border border-outline-variant rounded-2xl flex flex-col overflow-hidden shadow-2xl outline-none panel-enter"
      >

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 flex-shrink-0 surface-toolbar">
          <div className="flex items-center gap-3 min-w-0">
            <span className="material-symbols-outlined text-secondary" style={{ fontSize: '18px' }} aria-hidden="true">folder_zip</span>
            <span className="text-sm font-bold text-on-surface truncate">{artifactId}.zip</span>
            <span className="text-xs text-secondary whitespace-nowrap">{preview.files.length} files</span>
            {diffResult?.hasChanges && (
              <span className="text-xs text-secondary whitespace-nowrap hidden sm:inline">
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
          <div className="flex items-center gap-2 flex-shrink-0">
            {diffResult !== null && (
              <div className="flex rounded overflow-hidden border border-outline-variant text-xs" role="group" aria-label="What to show">
                <button
                  onClick={() => setDiffMode(false)}
                  aria-pressed={!diffMode}
                  className={`px-3 py-1 transition-colors ${!diffMode ? 'bg-primary text-on-primary font-bold' : 'text-secondary hover:bg-surface-container'}`}
                >
                  Normal
                </button>
                <button
                  onClick={() => setDiffMode(true)}
                  aria-pressed={diffMode}
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
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }} aria-hidden="true">download</span>
              Download ZIP
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
              aria-label="Close preview"
              title="Close (Esc)"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }} aria-hidden="true">close</span>
            </button>
          </div>
        </div>

        {/* ── Body ───────────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden">

          {/* Tree / search */}
          <div className="flex-shrink-0 flex flex-col bg-surface-container-low min-w-0" style={{ width: treeWidth }} data-explore-side>
            <div className="flex border-b border-outline-variant flex-shrink-0" role="tablist" aria-label="Find a file">
              <button type="button" role="tab" aria-selected={pane === 'files'} onClick={() => openPane('files')} className={tab(pane === 'files')} title="Files (Ctrl+P or /)">
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">account_tree</span>Files
              </button>
              <button type="button" role="tab" aria-selected={pane === 'search'} onClick={() => openPane('search')} className={tab(pane === 'search')} title="Search in files (Ctrl+Shift+F)">
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">search</span>Search
              </button>
            </div>

            {pane === 'files' ? (
              <>
                <div className="p-1.5 flex-shrink-0">
                  <input
                    ref={filterRef}
                    type="search"
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Escape' && filter) { e.preventDefault(); setFilter('') }
                      if (e.key === 'ArrowDown') {
                        e.preventDefault()
                        dialogRef.current?.querySelector<HTMLElement>('[role="tree"] [tabindex="0"]')?.focus()
                      }
                    }}
                    placeholder="Filter files…"
                    aria-label="Filter files by name"
                    className={field}
                  />
                </div>
                <div className="flex-1 overflow-y-auto p-1.5 pt-0">
                  <FileTree
                    tree={mergedTree}
                    selected={selected}
                    onSelect={select}
                    fileStatuses={fileStatuses}
                    changedDirs={changedDirs}
                    filter={filter}
                    label={`Files of ${artifactId}.zip`}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="p-1.5 flex-shrink-0">
                  <input
                    ref={queryRef}
                    type="search"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Escape' && query) { e.preventDefault(); setQuery('') } }}
                    placeholder="Search in every file…"
                    aria-label="Search in every file"
                    className={field}
                  />
                </div>
                <div className="flex-1 overflow-y-auto p-1.5 pt-0 text-xs" data-search-results>
                  {query.trim().length < 2 ? (
                    <p className="px-2 py-3 text-[11px] text-secondary">Type two letters or more.</p>
                  ) : hitsByFile.length === 0 ? (
                    <p className="px-2 py-3 text-[11px] text-secondary">Nothing in these files says “{query.trim()}”.</p>
                  ) : (
                    <>
                      <p className="px-2 pb-1 text-[10px] text-secondary">
                        {search.hits.length}{search.more ? '+' : ''} {search.hits.length === 1 ? 'line' : 'lines'} in {hitsByFile.length} {hitsByFile.length === 1 ? 'file' : 'files'}
                      </p>
                      {hitsByFile.map(([path, hits]) => (
                        <div key={path} className="mb-1.5">
                          <button
                            type="button"
                            onClick={() => select(path)}
                            title={path}
                            className={`w-full flex items-center gap-1.5 px-2 py-0.5 rounded text-left font-medium transition-colors ${path === selected ? 'bg-primary/10 text-primary' : 'text-on-surface hover:bg-surface-container-high'}`}
                          >
                            <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '14px' }} aria-hidden="true">{fileIcon(path.split('/').pop() ?? path)}</span>
                            <span className="truncate">{path.split('/').pop()}</span>
                            <span className="ml-auto text-[10px] text-secondary flex-shrink-0">{hits.length}</span>
                          </button>
                          {hits.map(hit => (
                            <button
                              key={`${hit.path}:${hit.line}`}
                              type="button"
                              onClick={() => select(hit.path)}
                              className="w-full flex gap-2 pl-7 pr-2 py-px rounded text-left font-mono text-[11px] text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                            >
                              <span className="text-secondary/60 flex-shrink-0 tabular-nums">{hit.line}</span>
                              <span className="truncate">
                                {hit.text.slice(0, hit.from)}
                                <mark className="search-hit">{hit.text.slice(hit.from, hit.to)}</mark>
                                {hit.text.slice(hit.to)}
                              </span>
                            </button>
                          ))}
                        </div>
                      ))}
                      {search.more && <p className="px-2 py-1 text-[10px] text-secondary">Only the first {MAX_SEARCH_HITS} lines are listed — add a word.</p>}
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          {/* The edge between the two: drag it, or focus it and use ← → */}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize the file list"
            aria-valuenow={treeWidth}
            aria-valuemin={MIN_TREE}
            aria-valuemax={MAX_TREE}
            tabIndex={0}
            onPointerDown={startResize}
            onPointerMove={resize}
            onPointerUp={endResize}
            onPointerCancel={endResize}
            onKeyDown={resizeByKey}
            className="w-1 flex-shrink-0 cursor-col-resize bg-outline-variant hover:bg-primary/60 focus-visible:bg-primary transition-colors touch-none"
            data-explore-resize
          />

          {/* Content viewer */}
          <div className="flex-1 overflow-hidden flex flex-col min-w-0">
            {selected && (
              <div className="pl-4 pr-2 py-1 border-b border-outline-variant bg-surface-container flex-shrink-0 flex items-center gap-2 min-w-0">
                <nav className="flex items-center gap-0.5 text-[11px] font-mono text-secondary min-w-0 overflow-hidden" aria-label="Path">
                  {crumbs.map((part, i) => {
                    const last = i === crumbs.length - 1
                    const dir = crumbs.slice(0, i + 1).join('/')
                    return (
                      <span key={dir} className="flex items-center gap-0.5 min-w-0">
                        {i > 0 && <span className="text-secondary/40 flex-shrink-0">/</span>}
                        {last ? (
                          <span className="text-on-surface font-semibold truncate">{part}</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => { setPane('files'); setFilter(`${dir}/`) }}
                            title={`Show only ${dir}/`}
                            className="truncate hover:text-primary hover:underline"
                          >
                            {part}
                          </button>
                        )}
                      </span>
                    )
                  })}
                </nav>
                {showDiff && selectedStatus && selectedStatus !== 'unchanged' && (
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded capitalize flex-shrink-0 ${
                    selectedStatus === 'added'    ? 'bg-green-500/15 text-green-500' :
                    selectedStatus === 'removed'  ? 'bg-red-400/15 text-red-400'    :
                    selectedStatus === 'modified' ? 'bg-amber-400/15 text-amber-500' : ''
                  }`}>
                    {selectedStatus}
                  </span>
                )}
                <div className="ml-auto flex items-center flex-shrink-0">
                  <button type="button" onClick={toggleWrap} aria-pressed={wrap} aria-label="Wrap long lines" title="Wrap long lines" className={`${tool} ${wrap ? 'text-primary' : ''}`}>
                    <span className="material-symbols-outlined block" style={{ fontSize: '16px' }} aria-hidden="true">wrap_text</span>
                  </button>
                  <CopyButton text={selected} label="Copy path" icon="link" size={16} className="!p-1.5" onCopied={ok => copied(ok, 'path')} />
                  <CopyButton text={() => content} label="Copy file" size={16} className="!p-1.5" onCopied={ok => copied(ok, 'file')} />
                  <button
                    type="button"
                    onClick={() => downloadBlob(new Blob([content], { type: 'text/plain;charset=utf-8' }), fileName)}
                    aria-label="Download file"
                    title={`Download ${fileName}`}
                    className={tool}
                  >
                    <span className="material-symbols-outlined block" style={{ fontSize: '16px' }} aria-hidden="true">download</span>
                  </button>
                </div>
              </div>
            )}
            <div className="flex-1 overflow-auto bg-surface-container-lowest min-h-0">
              {showDiff && selectedStatus && selectedStatus !== 'unchanged' ? (
                <DiffContentViewer
                  status={selectedStatus}
                  newContent={fileMap.get(selected) ?? ''}
                  oldContent={oldFileMap.get(selected) ?? ''}
                  path={selected}
                  wrap={wrap}
                />
              ) : (
                <ReadOnlyCodeViewer code={content} targetPath={selected} wrap={wrap} />
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
