import { useEffect, useMemo, useRef } from 'react'
import type { PreviewResponse } from '../../types'
import type { ProjectRequest } from '../../utils/projectUtils'
import { useLiveProjectTree } from '../../hooks/useLiveProjectTree'
import { usePreviewDiff } from '../../hooks/usePreviewDiff'
import { FileTree, collectChangedDirs, mergeRemovedIntoTree } from '../explore/FileTree'
import { t, tn } from '../../i18n'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The preview request of the setup on screen; null while the form cannot generate. */
  request: ProjectRequest | null
  /** Why there is no request (the form's first error). */
  invalidReason?: string
  /** The selected dependency ids — to say which one a change came from. */
  selected: string[]
  depName: (id: string) => string
  onOpenFile: (path: string, preview: PreviewResponse) => void
}

interface Counts { added: number; modified: number; removed: number }

/**
 * What the last change did, in a sentence. When exactly one dependency was added (or removed)
 * between the two previews, the change is its doing and is worded so — "Kafka adds 4 files,
 * changes 2" — which is the point of the dock: seeing what each choice costs.
 */
export function describeChange(before: string[], after: string[], counts: Counts, depName: (id: string) => string): string {
  if (counts.added + counts.modified + counts.removed === 0) return t('Same files as before.')
  const gained = after.filter(id => !before.includes(id))
  const lost = before.filter(id => !after.includes(id))
  const parts = (removes: 'removes' | 'drops') => [
    counts.added ? t('adds {files}', { files: tn(counts.added, '{n} file', '{n} files') }) : '',
    counts.modified ? t('changes {n}', { n: counts.modified }) : '',
    counts.removed ? (removes === 'removes' ? t('removes {n}', { n: counts.removed }) : t('drops {n}', { n: counts.removed })) : '',
  ].filter(Boolean).join(', ')
  if (gained.length === 1 && lost.length === 0) return t('{dep} {changes}.', { dep: depName(gained[0]), changes: parts('removes') })
  if (lost.length === 1 && gained.length === 0) return t('Without {dep}: {changes}.', { dep: depName(lost[0]), changes: parts('drops') })
  return `${[
    counts.added ? tn(counts.added, '{n} file added', '{n} files added') : '',
    counts.modified ? t('{n} changed', { n: counts.modified }) : '',
    counts.removed ? t('{n} removed', { n: counts.removed }) : '',
  ].filter(Boolean).join(', ')}.`
}

/** How many request keys' selections are remembered — only the last two shown are ever asked for. */
const MAX_REMEMBERED = 16

/**
 * The Backend tab's file dock: the tree of files the setup on screen generates, kept current as
 * the setup changes, with what the last change did. Closed, it is a button and asks the backend
 * nothing; the rules for when it may ask are in `hooks/useLiveProjectTree.ts`.
 *
 * Lazy, and its tree is `FileTree` — no editor on the page. A click on a file opens Explore on
 * the preview the dock already has.
 */
export function FileDock({ open, onOpenChange, request, invalidReason, selected, depName, onOpenFile }: Props) {
  const live = useLiveProjectTree(request, open)

  // Which dependencies each request was made with, so a change can be put down to one of them.
  const selections = useRef(new Map<string, string[]>())
  if (request && !selections.current.has(request.key)) {
    selections.current.set(request.key, selected)
    if (selections.current.size > MAX_REMEMBERED) selections.current.delete(selections.current.keys().next().value as string)
  }

  const diff = usePreviewDiff(live.current?.preview ?? null, live.previous?.preview ?? null)
  const statuses = diff?.hasChanges ? diff.fileStatuses : undefined
  const changedDirs = useMemo(() => (statuses ? collectChangedDirs(statuses) : undefined), [statuses])
  const added = useMemo(
    () => (statuses ? new Set([...statuses].filter(([, s]) => s === 'added').map(([path]) => path)) : undefined),
    [statuses],
  )
  const tree = useMemo(() => {
    if (!live.current) return []
    if (!statuses) return live.current.preview.tree
    const removed = [...statuses].filter(([, s]) => s === 'removed').map(([path]) => path)
    return mergeRemovedIntoTree(live.current.preview.tree, removed)
    // `live.current` is the hook's answer for this render (it re-renders when it changes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.current, statuses])

  const summary = live.current && live.previous && diff
    ? describeChange(
      selections.current.get(live.previous.key) ?? [],
      selections.current.get(live.current.key) ?? [],
      { added: diff.addedCount, modified: diff.modifiedCount, removed: diff.removedCount },
      depName,
    )
    : null

  // Below 1440px the dock lies over the dependency panels (from there up the page makes room for
  // it — see App's <main>), so there it is a drawer: Escape closes it, as does the scrim below.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      if (!window.matchMedia?.('(max-width: 1439px)').matches) return
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return
      onOpenChange(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onOpenChange])

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        aria-expanded={false}
        title={t('See the files this setup generates, as you change it')}
        className="fixed bottom-6 end-6 z-40 inline-flex items-center gap-2 ps-3 pe-4 py-2.5 rounded-full border border-outline-variant bg-surface-container shadow-xl text-xs font-bold text-on-surface hover:border-primary/60 hover:text-primary transition-colors"
        data-file-dock-pill
        data-tour="file-dock"
      >
        <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">account_tree</span>
        {t('Project files')}
      </button>
    )
  }

  const behind = Boolean(request && live.current && live.current.key !== request.key)
  const fileCount = live.current?.preview.files.length

  return (
    <>
    {/* The drawer's scrim: only where the dock overlaps the page. A click on the page closes it. */}
    <div
      className="fixed inset-0 top-16 z-30 bg-background/50 animate-fade-in min-[1440px]:hidden"
      onClick={() => onOpenChange(false)}
      aria-hidden="true"
      data-file-dock-scrim
    />
    <aside
      aria-label={t('Project files')}
      className="fixed top-16 end-0 bottom-0 z-40 w-[300px] max-w-[85vw] flex flex-col border-s border-outline-variant bg-surface-container shadow-2xl dock-enter"
      data-file-dock
      data-tour="file-dock"
    >
      <div className="flex items-center gap-2 ps-4 pe-2 py-2.5 border-b border-outline-variant flex-shrink-0">
        <span className="material-symbols-outlined text-primary" style={{ fontSize: '18px' }} aria-hidden="true">account_tree</span>
        <h2 className="text-xs font-bold uppercase tracking-widest text-on-surface">{t('Project files')}</h2>
        {fileCount !== undefined && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary tabular-nums" data-file-count>{fileCount}</span>
        )}
        <span className="ms-auto flex items-center">
          {live.loading && (
            <span className="material-symbols-outlined animate-spin text-secondary me-1" style={{ fontSize: '16px' }} aria-label={t('Updating')}>progress_activity</span>
          )}
          <button type="button" onClick={live.refresh} aria-label={t('Refresh the file list')} title={t('Refresh')} className="p-1.5 rounded text-secondary hover:text-on-surface hover:bg-surface-container-high transition-colors">
            <span className="material-symbols-outlined block" style={{ fontSize: '16px' }} aria-hidden="true">refresh</span>
          </button>
          <button type="button" onClick={() => onOpenChange(false)} aria-label={t('Close project files')} title={t('Close')} className="p-1.5 rounded text-secondary hover:text-on-surface hover:bg-surface-container-high transition-colors">
            <span className="material-symbols-outlined block" style={{ fontSize: '18px' }} aria-hidden="true">close</span>
          </button>
        </span>
      </div>

      <p className="px-4 py-2 text-[11px] text-secondary border-b border-outline-variant/50 flex-shrink-0 min-h-[2.25rem]" aria-live="polite" data-dock-summary>
        {summary ?? t('Tick a dependency and see what it adds.')}
      </p>

      <div className={`flex-1 overflow-y-auto p-2 transition-opacity ${behind ? 'opacity-60' : ''}`}>
        {!request ? (
          <p className="px-2 py-3 text-[11px] text-secondary" data-dock-invalid>
            {invalidReason ? t('Fix the project metadata first: {error}', { error: invalidReason }) : t('Fix the project metadata to see its files.')}
          </p>
        ) : live.error ? (
          <div role="alert" className="px-2 py-3 text-[11px] text-error space-y-2">
            <p className="break-words">{live.error}</p>
            <button type="button" onClick={live.refresh} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-outline-variant text-secondary hover:text-on-surface">
              {t('Try again')}
            </button>
          </div>
        ) : !live.current ? (
          <div className="space-y-1.5 p-2 animate-pulse" aria-hidden="true">
            {[60, 45, 70, 55, 40, 65, 50].map((w, i) => (
              <div key={i} className="h-3 rounded bg-surface-container-high" style={{ width: `${w}%`, marginInlineStart: `${(i % 3) * 14}px` }} />
            ))}
          </div>
        ) : (
          <FileTree
            tree={tree}
            selected=""
            onSelect={path => onOpenFile(path, live.current!.preview)}
            fileStatuses={statuses}
            changedDirs={changedDirs}
            flash={added}
            label={t('Files of the project')}
          />
        )}
      </div>

      <p className="px-4 py-2 text-[10px] text-secondary border-t border-outline-variant/50 flex-shrink-0">
        {t('Click a file to open it in Explore.')}
      </p>
    </aside>
    </>
  )
}
