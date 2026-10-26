import { useState } from 'react'
import type { FullstackPageDef, FullstackPageRole } from '../../../types'
import { inputClass } from '../controls'
import { inNav, pageLabel } from '../pageLayout'
import { SMALL_BUTTON } from './constants'
import { duplicatePages, removePages, setPagesGroup, setPagesHidden, setPagesRoles } from './bulkPages'

/** The toolbar over the page list while pages are picked: one action for all of them, as one undo step. */
export function BulkPageBar({ pages, picked, onPick, pushUndo, onChange, ldapAuth, onRemoveRequest }: {
  pages: FullstackPageDef[]
  picked: string[]
  onPick: (ids: string[]) => void
  pushUndo: (label: string) => void
  onChange: (next: FullstackPageDef[]) => void
  /** Page roles need an LDAP auth dependency; without one the Roles action is not offered. */
  ldapAuth?: boolean
  /** Deleting asks first; the caller shows the confirmation and then calls `remove`. */
  onRemoveRequest: (count: number, remove: () => void) => void
}) {
  const [group, setGroup] = useState('')
  const chosen = pages.filter(p => picked.includes(p.id))
  const n = chosen.length
  const what = n === 1 ? `“${pageLabel(chosen[0])}”` : `${n} pages`
  const groups = [...new Set(pages.map(p => p.group?.trim()).filter((g): g is string => Boolean(g)))]
  const canHide = chosen.some(p => p.type !== 'record' && !p.hidden)
  const canShow = chosen.some(p => p.type !== 'record' && p.hidden)
  const inNavCount = chosen.filter(inNav).length

  const apply = (label: string, next: FullstackPageDef[]) => {
    pushUndo(label)
    onChange(next)
  }
  const roles = (value: string) => {
    const next: FullstackPageRole[] = value === 'ADMIN' ? ['ADMIN'] : value === 'USER' ? ['USER'] : []
    apply(next.length ? `Restricted ${what} to ${next.join(' / ')}` : `Opened ${what} to everyone`, setPagesRoles(pages, picked, next))
  }

  return (
    <div
      role="toolbar"
      aria-label="Picked pages"
      className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-2.5 py-1.5 text-xs"
      data-bulk-pages
    >
      <span className="font-semibold text-on-surface">{n} picked</span>
      {canHide && (
        <button type="button" className={SMALL_BUTTON} onClick={() => apply(`Hid ${what} from the navigation`, setPagesHidden(pages, picked, true))}>
          Hide from nav
        </button>
      )}
      {canShow && (
        <button type="button" className={SMALL_BUTTON} onClick={() => apply(`Showed ${what} in the navigation`, setPagesHidden(pages, picked, false))}>
          Show in nav
        </button>
      )}
      {inNavCount > 0 && (
        <form
          className="flex items-center gap-1"
          onSubmit={e => {
            e.preventDefault()
            apply(group.trim() ? `Moved ${what} into the “${group.trim()}” group` : `Took ${what} out of their groups`, setPagesGroup(pages, picked, group))
          }}
        >
          <input
            className={`${inputClass} !w-36 !py-0.5 text-xs`}
            list="bulk-page-groups"
            value={group}
            onChange={e => setGroup(e.target.value)}
            placeholder="Nav group (blank: none)"
            aria-label="Nav group for the picked pages"
            maxLength={40}
          />
          <datalist id="bulk-page-groups">
            {groups.map(g => <option key={g} value={g} />)}
          </datalist>
          <button type="submit" className={SMALL_BUTTON}>Set group</button>
        </form>
      )}
      {ldapAuth && inNavCount > 0 && (
        <select
          className={`${inputClass} !w-auto !py-0.5 text-xs`}
          aria-label="Roles for the picked pages"
          value=""
          onChange={e => { if (e.target.value) roles(e.target.value) }}
        >
          <option value="">Roles…</option>
          <option value="ADMIN">ADMIN role</option>
          <option value="USER">USER role</option>
          <option value="ANY">Everyone</option>
        </select>
      )}
      <button type="button" className={SMALL_BUTTON} onClick={() => apply(`Duplicated ${what}`, duplicatePages(pages, picked))}>
        Duplicate
      </button>
      <button
        type="button"
        className={`${SMALL_BUTTON} text-error`}
        onClick={() => onRemoveRequest(n, () => {
          apply(`Removed ${what}`, removePages(pages, picked))
          onPick([])
        })}
      >
        Delete
      </button>
      <button type="button" className="ms-auto text-secondary hover:text-on-surface" onClick={() => onPick([])}>
        Clear
      </button>
    </div>
  )
}
