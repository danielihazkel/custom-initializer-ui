import { describe, expect, it } from 'vitest'
import type { FullstackEntityDef, FullstackPageDef } from '../../types'
import { setLang } from '../../i18n'
import { LIST_VIEWS, PAGE_TYPE_META, describePage, validatePages } from './pageLayout'
import { WIDGET_KINDS } from './pages/constants'

// The isolates `t` puts around a value inside a Hebrew sentence.
const plain = (s: string) => s.replace(/[⁨⁩]/g, '')

const ticket: FullstackEntityDef = {
  name: 'Ticket',
  fields: [{ name: 'id', type: 'LONG', primaryKey: true, generated: true }, { name: 'title', type: 'STRING' }],
} as FullstackEntityDef

describe('the layout model in Hebrew', () => {
  it('names page types, list views and widget kinds in the site’s language when they are read', async () => {
    expect(PAGE_TYPE_META.report.label).toBe('Report')
    await setLang('he')
    expect(PAGE_TYPE_META.report.label).toBe('דוח')
    expect(LIST_VIEWS.find(v => v.value === 'kanban')?.label).toBe('לוח')
    expect(WIDGET_KINDS.find(k => k.kind === 'kpi')?.label).toBe('אריח מספר')
    await setLang('en')
    expect(PAGE_TYPE_META.report.label).toBe('Report')
  })

  it('words a layout problem, and the summary naming its page, in Hebrew', async () => {
    const pages: FullstackPageDef[] = [{ id: 'gone', type: 'entity-list', entity: 'Order' }]
    const english = validatePages(pages, [ticket])
    expect(english.byPage[0].entity).toBe('“Order” is no longer an entity')

    await setLang('he')
    const hebrew = validatePages(pages, [ticket])
    expect(plain(hebrew.byPage[0].entity)).toBe('„Order” כבר אינה ישות')
    expect(plain(hebrew.problems[0])).toBe('העמוד „gone” מציג את „Order”, שכבר אינה ישות')
    // A page summary reads in Hebrew too; the entity's name stays as it is.
    expect(plain(describePage({ id: 'tickets', type: 'entity-list', entity: 'Ticket', columns: ['id', 'title'] }, []))).toBe('רשימת Ticket · 2 עמודות')
    await setLang('en')
  })
})
