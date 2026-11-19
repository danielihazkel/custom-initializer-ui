// @vitest-environment node
// Every text the site passes to t / tn / tc has a Hebrew entry, every Hebrew entry is used, and
// each entry keeps its English key's placeholders. `npm run i18n:check` runs this file alone.
import { describe, expect, it } from 'vitest'
// @ts-expect-error — a plain ES module script, without types
import { extract, placeholders } from '../../scripts/i18n-extract.mjs'
import shell from './he/shell'
import backend from './he/backend'
import explore from './he/explore'
import frontend from './he/frontend'
import fullstack from './he/fullstack'
import designer from './he/designer'
import pages from './he/pages'
import hebrew from './he'

const AREAS: Record<string, Record<string, string>> = { shell, backend, explore, frontend, fullstack, designer, pages }

type Extracted = { keys: Map<string, string[]>; problems: { where: string; message: string }[] }
const { keys, problems } = extract() as Extracted

describe('Hebrew coverage', () => {
  it('passes only literal text to t, tn and tc', () => {
    expect(problems.map(p => `${p.where}: ${p.message}`)).toEqual([])
  })

  it('has a Hebrew entry for every translated text', () => {
    const missing = [...keys.keys()].filter(key => !(key in hebrew)).map(key => `${JSON.stringify(key)} (${keys.get(key)![0]})`)
    expect(missing).toEqual([])
  })

  it('uses every Hebrew entry', () => {
    const unused = Object.keys(hebrew).filter(key => !keys.has(key))
    expect(unused).toEqual([])
  })

  it('keeps the placeholders of each English text', () => {
    const wrong = Object.entries(hebrew)
      .filter(([en, he]) => placeholders(en).join() !== placeholders(he).join())
      .map(([en, he]) => `${en} → ${he}`)
    expect(wrong).toEqual([])
  })

  it('gives one text one Hebrew across the area files', () => {
    const seen = new Map<string, { area: string; he: string }>()
    const clashes: string[] = []
    for (const [area, dict] of Object.entries(AREAS)) {
      for (const [en, he] of Object.entries(dict)) {
        const before = seen.get(en)
        if (before && before.he !== he) clashes.push(`${JSON.stringify(en)}: ${before.area} "${before.he}" vs ${area} "${he}"`)
        else if (!before) seen.set(en, { area, he })
      }
    }
    expect(clashes).toEqual([])
  })

  it('has no empty entries', () => {
    expect(Object.entries(hebrew).filter(([, he]) => !he.trim()).map(([en]) => en)).toEqual([])
  })
})
