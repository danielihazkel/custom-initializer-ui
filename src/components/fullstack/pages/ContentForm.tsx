import { useRef } from 'react'
import type { FullstackPageDef } from '../../../types'
import { inputClass } from '../controls'
import { MAX_BODY } from '../newPageTypes'
import { linkablePages, pageLabel } from '../pageLayout'
import type { FormProps } from './formTypes'
import { Field } from './fields'

export function ContentForm({ page, index, pages, errors, update }: Omit<FormProps, 'entities' | 'lossy'> & { pages: FullstackPageDef[] }) {
  const body = page.body ?? ''
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const targets = linkablePages(pages).filter(p => p.id !== page.id)
  // Inserts `[label](#/id)` where the cursor is (or at the end).
  const insertLink = (id: string) => {
    const target = pages.find(p => p.id === id)
    if (!target) return
    const link = `[${pageLabel(target)}](#/${id})`
    const area = areaRef.current
    const at = area ? area.selectionStart : body.length
    const next = body.slice(0, at) + link + body.slice(area ? area.selectionEnd : body.length)
    update(index, { body: next })
    requestAnimationFrame(() => {
      area?.focus()
      area?.setSelectionRange(at + link.length, at + link.length)
    })
  }
  return (
    <div className="space-y-2">
      <Field label="Text" error={errors.body} control="body" hint={`${body.length}/${MAX_BODY} · ## heading · - list · 1. list · > note · **bold** · *em* · \`code\` · [text](#/page-id or https://…) · --- rule`}>
        <textarea
          ref={areaRef}
          aria-label="Page text"
          aria-invalid={Boolean(errors.body)}
          value={body}
          rows={10}
          maxLength={MAX_BODY}
          onChange={e => update(index, { body: e.target.value })}
          className={`${inputClass(errors.body)} w-full font-mono text-xs`}
        />
      </Field>
      {targets.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="text-secondary" htmlFor={`content-link-${index}`}>Insert a link to</label>
          <select
            id={`content-link-${index}`}
            value=""
            onChange={e => { if (e.target.value) insertLink(e.target.value) }}
            className={`${inputClass()} max-w-[14rem] py-1 text-xs`}
          >
            <option value="">— a page —</option>
            {targets.map(p => <option key={p.id} value={p.id}>{pageLabel(p)}</option>)}
          </select>
        </div>
      )}
    </div>
  )
}
