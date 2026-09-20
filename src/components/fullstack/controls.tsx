import type { ReactNode } from 'react'
import type { EntityTemplateSetSummary } from '../../types'

/**
 * The editor's shared form primitives. Three near-identical `inputClass` definitions and two
 * divergent `Labeled` helpers used to live in FullstackView, EntitiesEditor and
 * EntitySettingsPanel; a field rendered in one panel did not quite match the same field rendered
 * in another. One definition each, here.
 */

/** Section label with a leading icon. `primary` bumps the weight/size so the Entities
 *  workspace visibly outranks the surrounding config sections. */
export function SectionHeading({ icon, title, primary }: { icon: string; title: string; primary?: boolean }) {
  return (
    <h2 className={`flex items-center gap-2 font-bold uppercase tracking-widest ${
      primary ? 'text-sm text-on-surface' : 'text-xs text-secondary'}`}>
      <span className={`material-symbols-outlined ${primary ? 'text-primary' : 'text-secondary'}`}
            style={{ fontSize: primary ? '18px' : '15px' }}>{icon}</span>
      {title}
    </h2>
  )
}

/** The one text-input/select class string. Carries the error ring when `error` is set, so an
 *  invalid control looks the same wherever it is rendered. */
export function inputClass(error?: string): string {
  const base = 'w-full bg-background border rounded px-3 py-2 text-sm text-on-surface placeholder:text-secondary/60 outline-none transition-all disabled:opacity-40'
  return error
    ? `${base} border-error focus:ring-2 focus:ring-error/20 focus:border-error`
    : `${base} border-outline-variant focus:ring-2 focus:ring-primary/20 focus:border-primary`
}

/**
 * Labelled form row. `htmlFor` is not optional in spirit — pass it whenever the child is a single
 * control, so the label actually targets it; it stays optional only for the handful of rows whose
 * child is a group (a checkbox pair, a chip editor) with no single id to point at.
 */
export function Labeled({ label, htmlFor, error, hint, children }: {
  label: string
  htmlFor?: string
  error?: string
  /** Tooltip on the label, for a constraint too long to spell out inline. */
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-[11px] font-semibold uppercase tracking-wider text-secondary" title={hint}>{label}</label>
      {children}
      {error && <p className="text-[11px] text-error">{error}</p>}
    </div>
  )
}

/** What a template set does, in the set's own words — the picker only names it. */
export function SetDescription({ set }: { set?: EntityTemplateSetSummary }) {
  if (!set?.description?.trim()) return null
  return <p className="text-[11px] text-on-surface-variant" data-set-description>{set.description}</p>
}

/** Stand-in for a one-option `<select>`: a single template set is not a choice, so it renders as
 *  read-only text rather than a dropdown that cannot drop down. */
export function SetLabel({ name, setKey }: { name?: string; setKey: string }) {
  return (
    <div className="w-full bg-surface-container-low border border-outline-variant rounded px-3 py-2 text-sm text-on-surface">
      {name ?? setKey}
      <span className="ml-2 text-[11px] text-secondary font-mono">{setKey}</span>
    </div>
  )
}
