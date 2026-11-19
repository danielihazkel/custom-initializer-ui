import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { FileStatus } from '../types'
import { diffRows, foldUnchanged, hunkStarts, isFold, pairRows, type Block, type DiffRow } from '../utils/diffRows'
import { tokenizeLines, type Token } from '../utils/highlightCode'
import { useLanguage } from './lang-from-path'
import { t, tn } from '../i18n'

interface Props {
  status:     FileStatus
  newContent: string
  oldContent: string
  /** The file's path — picks the grammar that colours it. */
  path?:      string
  /** Long lines wrap instead of scrolling sideways. */
  wrap?:      boolean
}

type Mode = 'unified' | 'split'
const MODE_KEY = 'explore:diffMode'

function readMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === 'split' ? 'split' : 'unified'
  } catch {
    return 'unified'
  }
}

const ROW_BG: Record<DiffRow['type'], string> = {
  added: 'bg-green-500/10',
  removed: 'bg-red-500/10',
  unchanged: '',
}

function Code({ tokens, wrap }: { tokens: Token[] | undefined; wrap: boolean }) {
  return (
    <span className={`px-3 min-w-0 flex-1 ${wrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'}`}>
      {tokens?.map((tok, i) => (tok.cls ? <span key={i} className={tok.cls}>{tok.text}</span> : <Fragment key={i}>{tok.text}</Fragment>))}
    </span>
  )
}

const NUM = 'text-secondary/40 select-none text-right px-2 flex-shrink-0 w-10 border-r border-outline-variant/20'

/**
 * What changed in one file between the previous preview and this one: unified or side by side,
 * coloured by the file's grammar, with long unchanged stretches folded and Previous / Next change.
 */
export function DiffContentViewer({ status, newContent, oldContent, path = '', wrap = false }: Props) {
  const [mode, setMode] = useState<Mode>(readMode)
  const [openFolds, setOpenFolds] = useState<ReadonlySet<number>>(() => new Set())
  const [at, setAt] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Another file: its folds and its place among the changes start over.
  useEffect(() => {
    setOpenFolds(new Set())
    setAt(0)
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [path, oldContent, newContent])

  function chooseMode(next: Mode) {
    setMode(next)
    try { localStorage.setItem(MODE_KEY, next) } catch { /* this visit only */ }
  }

  const language = useLanguage(path)
  const oldTokens = useMemo(() => tokenizeLines(oldContent, language), [oldContent, language])
  const newTokens = useMemo(() => tokenizeLines(newContent, language), [newContent, language])

  const rows = useMemo(() => diffRows(status, oldContent, newContent), [status, oldContent, newContent])
  const hunks = useMemo(() => hunkStarts(rows), [rows])
  const hunkOf = useMemo(() => new Map(hunks.map((rowIndex, n) => [rows[rowIndex], n])), [hunks, rows])
  const blocks = useMemo(() => foldUnchanged(rows, openFolds), [rows, openFolds])

  const tokensOf = (row: DiffRow) => (row.newLine !== null ? newTokens[row.newLine - 1] : oldTokens[(row.oldLine ?? 1) - 1])

  function goTo(n: number) {
    const next = (n + hunks.length) % hunks.length
    setAt(next)
    const box = scrollRef.current
    const el = box?.querySelector<HTMLElement>(`[data-hunk="${next}"]`)
    // The box is scrolled by hand: scrollIntoView would also move every scrollable ancestor.
    if (box && el) box.scrollTop = Math.max(0, el.offsetTop - box.clientHeight / 3)
  }

  const foldRow = (b: Extract<Block, { fold: true }>) => (
    <button
      key={`fold-${b.id}`}
      type="button"
      onClick={() => setOpenFolds(prev => new Set(prev).add(b.id))}
      className="w-full flex items-center gap-2 px-3 py-1 text-[11px] font-sans text-secondary bg-surface-container/60 hover:bg-surface-container-high hover:text-on-surface transition-colors border-y border-outline-variant/20"
      data-fold
    >
      <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">unfold_more</span>
      {tn(b.rows.length, '{n} unchanged line', '{n} unchanged lines')}
    </button>
  )

  const whole = status === 'added' ? t('New file') : status === 'removed' ? t('Removed file') : null
  const split = mode === 'split' && status === 'modified'

  // Runs of rows between folds, so the side-by-side view can pair lines within each run.
  const segments = useMemo(() => {
    const out: (DiffRow[] | Extract<Block, { fold: true }>)[] = []
    for (const b of blocks) {
      if (isFold(b)) out.push(b)
      else if (Array.isArray(out[out.length - 1])) (out[out.length - 1] as DiffRow[]).push(b)
      else out.push([b])
    }
    return out
  }, [blocks])

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-3 px-3 py-1 border-b border-outline-variant/40 bg-surface-container flex-shrink-0 text-[11px] text-secondary">
        {whole ? (
          <span>{whole}</span>
        ) : (
          <>
            <span data-diff-count>{tn(hunks.length, '{n} change', '{n} changes')}</span>
            {hunks.length > 1 && (
              <span className="flex items-center gap-0.5">
                <button type="button" onClick={() => goTo(at - 1)} aria-label={t('Previous change')} title={t('Previous change')} className="p-0.5 rounded hover:bg-surface-container-high hover:text-on-surface">
                  <span className="material-symbols-outlined block" style={{ fontSize: '16px' }} aria-hidden="true">keyboard_arrow_up</span>
                </button>
                <span className="tabular-nums">{at + 1} / {hunks.length}</span>
                <button type="button" onClick={() => goTo(at + 1)} aria-label={t('Next change')} title={t('Next change')} className="p-0.5 rounded hover:bg-surface-container-high hover:text-on-surface">
                  <span className="material-symbols-outlined block" style={{ fontSize: '16px' }} aria-hidden="true">keyboard_arrow_down</span>
                </button>
              </span>
            )}
            <span className="ms-auto flex rounded overflow-hidden border border-outline-variant" role="group" aria-label={t('Diff layout')}>
              {(['unified', 'split'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => chooseMode(m)}
                  aria-pressed={mode === m}
                  className={`px-2 py-0.5 transition-colors ${mode === m ? 'bg-primary/15 text-primary font-semibold' : 'hover:bg-surface-container-high'}`}
                >
                  {m === 'unified' ? t('Unified') : t('Side by side')}
                </button>
              ))}
            </span>
          </>
        )}
      </div>

      <div ref={scrollRef} dir="ltr" className="flex-1 overflow-auto relative code-tokens text-xs font-mono leading-5" data-diff-mode={split ? 'split' : 'unified'}>
        {segments.map((segment, s) => {
          if (!Array.isArray(segment)) return foldRow(segment)
          if (!split) {
            return segment.map((row, i) => (
              <div key={`${s}-${i}`} className={`flex min-w-0 ${ROW_BG[row.type]}`} data-hunk={hunkOf.get(row)}>
                <span className={NUM}>{row.oldLine ?? ''}</span>
                <span className={NUM}>{row.newLine ?? ''}</span>
                <span className={`select-none px-1.5 flex-shrink-0 border-r border-outline-variant/20 ${row.type === 'added' ? 'text-green-500' : row.type === 'removed' ? 'text-red-400' : 'text-secondary/40'}`}>
                  {row.type === 'added' ? '+' : row.type === 'removed' ? '-' : ' '}
                </span>
                <Code tokens={tokensOf(row)} wrap={wrap} />
              </div>
            ))
          }
          return pairRows(segment).map((pair, i) => (
            <div key={`${s}-${i}`} className="grid grid-cols-2 min-w-0" data-hunk={hunkOf.get((pair.left ?? pair.right)!) ?? (pair.right ? hunkOf.get(pair.right) : undefined)}>
              <div className={`flex min-w-0 border-r border-outline-variant/30 ${pair.left && pair.left.type !== 'unchanged' ? ROW_BG.removed : pair.left ? '' : 'bg-surface-container/40'}`}>
                <span className={NUM}>{pair.left?.oldLine ?? ''}</span>
                <Code tokens={pair.left ? oldTokens[(pair.left.oldLine ?? 1) - 1] : undefined} wrap={wrap} />
              </div>
              <div className={`flex min-w-0 ${pair.right && pair.right.type !== 'unchanged' ? ROW_BG.added : pair.right ? '' : 'bg-surface-container/40'}`}>
                <span className={NUM}>{pair.right?.newLine ?? ''}</span>
                <Code tokens={pair.right ? newTokens[(pair.right.newLine ?? 1) - 1] : undefined} wrap={wrap} />
              </div>
            </div>
          ))
        })}
      </div>
    </div>
  )
}
