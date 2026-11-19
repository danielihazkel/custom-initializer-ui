import { describe, expect, it } from 'vitest'
import { setLang } from '../../i18n'
import { validateEntities, validateMeta } from './validation'
import { lintModel } from './lint'
import { exprProblem } from './expr'
import type { FullstackEntityDef } from '../../types'

const FSI = '⁨'
const PDI = '⁩'

/** The Fullstack editor's messages in Hebrew (the setup file puts the site back in English after each test). */
describe('Fullstack editor messages in Hebrew', () => {
  it('validation speaks Hebrew', async () => {
    await setLang('he')
    const entities: FullstackEntityDef[] = [{ name: 'Order', fields: [{ name: 'title', type: 'STRING' }] }]
    const errors = validateEntities(entities)
    expect(errors.entities[0].pk).toBe('סמנו לפחות שדה אחד כמפתח ראשי (PK)')
    expect(validateMeta({ groupId: '', artifactId: 'demo', packageName: 'com.x' }).groupId).toBe('חובה')
  })

  it('lint names the entity inside a Hebrew sentence, isolated', async () => {
    await setLang('he')
    const entities: FullstackEntityDef[] = [{
      uid: 'a', name: 'Tag', fields: [{ name: 'id', type: 'LONG', primaryKey: true, generated: true }],
    }]
    const issue = lintModel(entities, [], []).find(i => i.rule === 'only-keys')
    expect(issue?.message).toBe(`ל-${FSI}Tag${PDI} יש רק שדות מפתח — הטופס והטבלה שלה לא יכילו נתונים.`)
  })

  it('the expression checker answers in Hebrew', async () => {
    await setLang('he')
    const entity: FullstackEntityDef = { name: 'Task', fields: [{ name: 'id', type: 'LONG', primaryKey: true }] }
    expect(exprProblem('', entity)).toBe('הביטוי ריק')
  })
})
