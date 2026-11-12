import { diffLines } from 'diff'
import type { FileStatus } from '../types'

/**
 * The model behind the Explore modal's diff view, kept apart from its drawing so the three things
 * it decides can be tested without a DOM: which lines changed, which unchanged stretches fold
 * away, and how lines pair up side by side.
 *
 * A row names lines by number, not by text: the viewer colours each version of the file once and
 * looks a row's tokens up by line.
 */
export type RowType = 'added' | 'removed' | 'unchanged'

export interface DiffRow {
  type: RowType
  /** 1-based line in the old file; null for an added line. */
  oldLine: number | null
  /** 1-based line in the new file; null for a removed line. */
  newLine: number | null
}

const lineCount = (text: string) => text.split('\n').length

export function diffRows(status: FileStatus, oldContent: string, newContent: string): DiffRow[] {
  if (status === 'added') {
    return Array.from({ length: lineCount(newContent) }, (_, i) => ({ type: 'added' as const, oldLine: null, newLine: i + 1 }))
  }
  if (status === 'removed') {
    return Array.from({ length: lineCount(oldContent) }, (_, i) => ({ type: 'removed' as const, oldLine: i + 1, newLine: null }))
  }
  const rows: DiffRow[] = []
  let oldLine = 1
  let newLine = 1
  for (const change of diffLines(oldContent, newContent)) {
    const lines = change.value.split('\n')
    // diffLines ends a chunk with "\n", which splits into a trailing empty string.
    if (lines[lines.length - 1] === '') lines.pop()
    for (let i = 0; i < lines.length; i++) {
      if (change.added) rows.push({ type: 'added', oldLine: null, newLine: newLine++ })
      else if (change.removed) rows.push({ type: 'removed', oldLine: oldLine++, newLine: null })
      else rows.push({ type: 'unchanged', oldLine: oldLine++, newLine: newLine++ })
    }
  }
  return rows
}

/** A stretch of unchanged lines drawn as one "N unchanged lines" row until it is opened. */
export interface Fold {
  fold: true
  id: number
  rows: DiffRow[]
}

export type Block = DiffRow | Fold

export const isFold = (b: Block): b is Fold => 'fold' in b

/**
 * Folds every run of unchanged lines that is longer than `minFold` once `context` lines are kept
 * on each side of it (none at the edge of the file, where there is no change to give context to).
 * Folds listed in `open` are left unfolded.
 */
export function foldUnchanged(rows: DiffRow[], open: ReadonlySet<number> = new Set(), context = 3, minFold = 8): Block[] {
  const out: Block[] = []
  let id = 0
  let i = 0
  while (i < rows.length) {
    if (rows[i].type !== 'unchanged') {
      out.push(rows[i++])
      continue
    }
    let j = i
    while (j < rows.length && rows[j].type === 'unchanged') j++
    const before = i === 0 ? 0 : context
    const after = j === rows.length ? 0 : context
    const hidden = rows.slice(i + before, j - after)
    const foldId = id++
    if (hidden.length >= minFold && !open.has(foldId)) {
      out.push(...rows.slice(i, i + before), { fold: true, id: foldId, rows: hidden }, ...rows.slice(j - after, j))
    } else {
      out.push(...rows.slice(i, j))
    }
    i = j
  }
  return out
}

/** Index (into `rows`) of the first line of every run of changed lines. */
export function hunkStarts(rows: DiffRow[]): number[] {
  const starts: number[] = []
  rows.forEach((row, i) => {
    if (row.type !== 'unchanged' && (i === 0 || rows[i - 1].type === 'unchanged')) starts.push(i)
  })
  return starts
}

/** A line of the side-by-side view: what the old file has on the left, the new one on the right. */
export interface SplitPair {
  left: DiffRow | null
  right: DiffRow | null
}

/**
 * Lays rows out side by side: an unchanged line on both sides; within a change, the removed
 * lines beside the added ones, top-aligned, with blanks where one side is longer.
 */
export function pairRows(rows: DiffRow[]): SplitPair[] {
  const pairs: SplitPair[] = []
  let i = 0
  while (i < rows.length) {
    if (rows[i].type === 'unchanged') {
      pairs.push({ left: rows[i], right: rows[i] })
      i++
      continue
    }
    const removed: DiffRow[] = []
    const added: DiffRow[] = []
    while (i < rows.length && rows[i].type !== 'unchanged') {
      if (rows[i].type === 'removed') removed.push(rows[i])
      else added.push(rows[i])
      i++
    }
    for (let k = 0; k < Math.max(removed.length, added.length); k++) {
      pairs.push({ left: removed[k] ?? null, right: added[k] ?? null })
    }
  }
  return pairs
}
