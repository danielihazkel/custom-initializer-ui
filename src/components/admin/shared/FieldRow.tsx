import type { ReactNode } from 'react'

export const inputClass =
  'w-full bg-background border border-outline-variant rounded px-3 py-2 text-sm text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all'

export const selectClass =
  'w-full bg-background border border-outline-variant rounded px-3 py-2 text-sm text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all'

interface FieldRowProps {
  label: string
  required?: boolean
  error?: string
  children: ReactNode
  hint?: string
}

export function FieldRow({ label, required, error, children, hint }: FieldRowProps) {
  return (
    <div className="space-y-1">
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-secondary">
        {label}{required && <span className="text-error ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-[10px] text-secondary">{hint}</p>}
      {error && <p className="text-[10px] text-error">{error}</p>}
    </div>
  )
}
