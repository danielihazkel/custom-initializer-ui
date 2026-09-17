import { useMemo, useState } from 'react'
import type { FullstackFieldDef } from '../../types'
import { parseQuickAdd } from './quickAdd'

interface Props {
  onAdd: (fields: FullstackFieldDef[]) => void
  onClose: () => void
}

const PLACEHOLDER = [
  'sku string req uniq len=64',
  'price decimal min=0',
  'status values=ACTIVE|RETIRED req',
  'launchedOn date',
  'notes text nosearch',
].join('\n')

/** Inline "paste a column list" panel under an entity's field table. Parses live so the user
 *  sees the count (and any bad lines) before committing. */
export function QuickAddFields({ onAdd, onClose }: Props) {
  const [text, setText] = useState('')
  const result = useMemo(() => parseQuickAdd(text), [text])
  const n = result.fields.length

  function commit() {
    if (n === 0) return
    onAdd(result.fields)
    setText('')
    onClose()
  }

  return (
    <div className="mt-2 rounded-lg border border-outline-variant/60 bg-surface-container-low p-3 space-y-2" data-quick-add>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] text-secondary leading-relaxed">
          One field per line: <code className="font-mono text-on-surface">name type flags…</code> — types
          <code className="font-mono"> string text long int bool date datetime decimal uuid</code>, flags
          <code className="font-mono"> pk gen req uniq lock email nosearch nofilter</code>, options
          <code className="font-mono"> len=N min=N max=N pattern=… values=A|B label="…"</code>.
        </p>
        <button type="button" onClick={onClose} aria-label="Close quick add" className="p-0.5 rounded text-secondary hover:text-on-surface shrink-0">
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
        </button>
      </div>
      <textarea
        autoFocus
        aria-label="Fields to add, one per line"
        className="w-full font-mono text-xs bg-background border border-outline-variant rounded p-2 min-h-[120px] focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
        placeholder={PLACEHOLDER}
        value={text}
        spellCheck={false}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); commit() }
          if (e.key === 'Escape') { e.preventDefault(); onClose() }
        }}
      />
      {result.errors.length > 0 && (
        <ul className="text-[11px] text-error space-y-0.5" role="alert">
          {result.errors.map(err => <li key={err.line}>Line {err.line} — {err.message}</li>)}
        </ul>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={commit}
          disabled={n === 0}
          className="px-3 py-1.5 rounded-md text-xs font-bold bg-primary text-on-primary disabled:opacity-40 active:scale-95 transition-transform"
        >
          Add {n} field{n === 1 ? '' : 's'}
        </button>
        <span className="text-[11px] text-secondary">Ctrl+Enter to add · Esc to close</span>
      </div>
    </div>
  )
}
