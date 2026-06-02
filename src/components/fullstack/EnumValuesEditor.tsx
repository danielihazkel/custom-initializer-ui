import { useState, type KeyboardEvent } from 'react'

interface Props {
  values: string[]
  onChange: (next: string[]) => void
  invalid?: boolean
}

/**
 * Controlled editor for an ENUM field's constants: removable chips plus a draft input
 * that commits on Enter, comma, or blur. A pasted "A,B,C" splits into three chips.
 * Dedupe is case-sensitive to match the backend, which uppercases constants on render.
 */
export function EnumValuesEditor({ values, onChange, invalid }: Props) {
  const [draft, setDraft] = useState('')

  function commit(raw: string) {
    const additions = raw.split(',').map(s => s.trim()).filter(Boolean)
    if (additions.length === 0) return
    const next = [...values]
    for (const v of additions) {
      if (!next.includes(v)) next.push(v)
    }
    onChange(next)
    setDraft('')
  }

  function removeAt(idx: number) {
    onChange(values.filter((_, i) => i !== idx))
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
        <span key={i} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-mono">
          {v}
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
        placeholder={values.length === 0 ? 'ACTIVE, DISABLED…' : ''}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => commit(draft)}
      />
    </div>
  )
}
