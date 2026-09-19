import { useState, type KeyboardEvent } from 'react'
import { humanizeConstant, lookupLabel } from './enumLabels'

interface Props {
  values: string[]
  onChange: (next: string[]) => void
  /** Display labels per constant (see `FullstackFieldDef.enumLabels`). When given, every chip
   *  carries a label input; the placeholder shows the humanized default the generator would use. */
  labels?: Record<string, string>
  onLabelsChange?: (next: Record<string, string> | undefined) => void
  invalid?: boolean
}

/**
 * Controlled editor for an ENUM field's constants: removable chips plus a draft input
 * that commits on Enter, comma, or blur. A pasted "A,B,C" splits into three chips, and
 * "OPEN:Open" sets the label along with the value (the Paste-fields syntax). Dedupe is
 * case-sensitive to match the backend, which uppercases constants on render.
 */
export function EnumValuesEditor({ values, onChange, labels, onLabelsChange, invalid }: Props) {
  const [draft, setDraft] = useState('')
  const withLabels = onLabelsChange !== undefined

  function setLabel(value: string, label: string) {
    const next = { ...(labels ?? {}) }
    if (label.trim()) next[value] = label
    else delete next[value]
    onLabelsChange?.(Object.keys(next).length > 0 ? next : undefined)
  }

  function commit(raw: string) {
    const additions = raw.split(',').map(s => s.trim()).filter(Boolean)
    if (additions.length === 0) return
    const next = [...values]
    const nextLabels = { ...(labels ?? {}) }
    let labelsTouched = false
    for (const item of additions) {
      const sep = withLabels ? item.indexOf(':') : -1
      const v = sep > 0 ? item.slice(0, sep).trim() : item
      const label = sep > 0 ? item.slice(sep + 1).trim() : ''
      if (!v) continue
      if (!next.includes(v)) next.push(v)
      if (label) { nextLabels[v] = label; labelsTouched = true }
    }
    onChange(next)
    if (labelsTouched) onLabelsChange?.(nextLabels)
    setDraft('')
  }

  function removeAt(idx: number) {
    const removed = values[idx]
    onChange(values.filter((_, i) => i !== idx))
    if (withLabels && labels && lookupLabel(labels, removed) !== undefined) {
      const next = { ...labels }
      for (const k of Object.keys(next)) if (k.trim().toLowerCase() === removed.trim().toLowerCase()) delete next[k]
      onLabelsChange?.(Object.keys(next).length > 0 ? next : undefined)
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit(draft)
    } else if (e.key === 'Backspace' && draft === '' && values.length > 0) {
      removeAt(values.length - 1)
    }
  }

  return (
    <div
      className={`w-full bg-background border rounded px-2 py-1 flex flex-wrap items-center gap-1 focus-within:ring-1 ${invalid ? 'border-error focus-within:ring-error/20' : 'border-outline-variant focus-within:ring-primary/20 focus-within:border-primary'}`}
    >
      {values.map((v, i) => (
        // Values are deduped (see commit), so the value itself is a stable key.
        <span key={v} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[11px] font-mono">
          {v}
          {withLabels && (
            <input
              type="text"
              aria-label={`Label for ${v}`}
              title="Display label in the generated app (blank = derived from the constant)"
              className="ml-1 w-[9ch] min-w-[6ch] bg-background/70 border border-primary/20 rounded px-1 py-0 text-[11px] font-sans text-on-surface placeholder:text-secondary/60 outline-none focus:border-primary"
              placeholder={humanizeConstant(v)}
              value={lookupLabel(labels, v) ?? ''}
              onChange={e => setLabel(v, e.target.value)}
            />
          )}
          <button
            type="button"
            onClick={() => removeAt(i)}
            className="hover:text-error leading-none"
            aria-label={`Remove ${v}`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>close</span>
          </button>
        </span>
      ))}
      <input
        type="text"
        aria-label="Add enum value"
        className="flex-1 min-w-[6ch] bg-transparent text-xs outline-none"
        placeholder={values.length === 0 ? (withLabels ? 'ACTIVE, DISABLED… or OPEN:Open' : 'ACTIVE, DISABLED…') : ''}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => commit(draft)}
      />
    </div>
  )
}
