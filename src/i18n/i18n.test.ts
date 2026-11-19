import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { getLang, initLang, resetLang, setLang, t, tc, tn, useT } from './index'

const FSI = '⁨'
const PDI = '⁩'

beforeEach(() => localStorage.clear())
afterEach(() => {
  localStorage.clear()
  document.documentElement.lang = 'en'
  document.documentElement.dir = 'ltr'
})

describe('t in English', () => {
  it('returns the text, with its placeholders filled in and nothing around them', () => {
    expect(t('Generate')).toBe('Generate')
    expect(t('Go to {tab}', { tab: 'Backend' })).toBe('Go to Backend')
    expect(t('Fix project metadata: {error}', {})).toBe('Fix project metadata: {error}')
  })

  it('picks the plural form by the count and fills in n', () => {
    expect(tn(1, '{n} file', '{n} files')).toBe('1 file')
    expect(tn(3, '{n} file', '{n} files')).toBe('3 files')
  })

  it('returns the text of a context unchanged', () => {
    expect(tc('menu', 'Open')).toBe('Open')
  })
})

describe('t in Hebrew', () => {
  it('loads the dictionary, then answers in Hebrew with values isolated', async () => {
    await setLang('he')
    expect(getLang()).toBe('he')
    expect(t('Generate')).toBe('צור')
    expect(t('Go to {tab}', { tab: 'Backend' })).toBe(`מעבר אל ${FSI}Backend${PDI}`)
    // A text with no Hebrew yet stays English, with no isolates.
    expect(t('Not in any dictionary {x}', { x: 1 })).toBe('Not in any dictionary 1')
  })

  it('sets the page language and direction, and remembers the choice', async () => {
    await setLang('he')
    expect(document.documentElement.lang).toBe('he')
    expect(document.documentElement.dir).toBe('rtl')
    expect(localStorage.getItem('lang')).toBe('he')
    await setLang('en')
    expect(document.documentElement.dir).toBe('ltr')
    expect(t('Generate')).toBe('Generate')
  })

  it('re-renders a component that reads it', async () => {
    function Label() {
      const tr = useT()
      return createElement('span', null, tr('Generate'))
    }
    render(createElement(Label))
    expect(screen.getByText('Generate')).toBeTruthy()
    await act(() => setLang('he'))
    expect(screen.getByText('צור')).toBeTruthy()
  })
})

describe('initLang', () => {
  it('starts in the stored language', async () => {
    localStorage.setItem('lang', 'he')
    await initLang()
    expect(getLang()).toBe('he')
    expect(document.documentElement.dir).toBe('rtl')
    resetLang()
    expect(getLang()).toBe('en')
  })

  it("takes Guide's or Training's old Hebrew choice when the site has none", async () => {
    localStorage.setItem('tutorial-lang', 'he')
    await initLang()
    expect(getLang()).toBe('he')
  })

  it('prefers the site choice over the old ones', async () => {
    localStorage.setItem('guide-lang', 'he')
    localStorage.setItem('lang', 'en')
    await initLang()
    expect(getLang()).toBe('en')
  })
})
