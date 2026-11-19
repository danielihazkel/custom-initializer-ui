import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import App from './App'
import { getLang, setLang } from './i18n'

vi.mock('framer-motion', () => ({
  motion: { span: ({ children }: { children: ReactNode }) => <span>{children}</span>, div: ({ children }: { children: ReactNode }) => <div>{children}</div> },
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  MotionConfig: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

const METADATA = {
  dependencies: { values: [{ name: 'Web', values: [{ id: 'web', name: 'Spring Web', description: 'Build web apps' }] }] },
  bootVersion: { values: [{ id: '3.2.1', name: '3.2.1' }], default: '3.2.1' },
  language: { values: [{ id: 'java', name: 'Java' }], default: 'java' },
  javaVersion: { values: [{ id: '21', name: '21' }], default: '21' },
  type: { values: [{ id: 'maven-project', name: 'Maven' }], default: 'maven-project' },
  packaging: { values: [{ id: 'jar', name: 'Jar' }], default: 'jar' },
  groupId: { default: 'com.menora' },
  artifactId: { default: 'demo' },
  name: { default: 'demo' },
  description: { default: 'Demo project' },
  packageName: { default: 'com.menora.demo' },
}

function response(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response
}

beforeEach(() => {
  localStorage.clear()
  // No tour on first visit: these tests look at the header, not at a coach mark over it.
  for (const tab of ['backend', 'frontend', 'fullstack']) localStorage.setItem(`tour:${tab}`, 'done')
  vi.stubGlobal('fetch', vi.fn(async (url: string) => (String(url).startsWith('/metadata/client') ? response(200, METADATA) : response(404, {}))))
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {} }))
})

afterEach(() => {
  vi.unstubAllGlobals()
  window.history.replaceState({}, '', '/')
  document.documentElement.lang = 'en'
  document.documentElement.dir = 'ltr'
})

describe('App — the site language', () => {
  it('draws the header in Hebrew, right to left, and switches back to English', async () => {
    await setLang('he')
    render(<App />)
    const nav = await screen.findByRole('navigation', { name: 'אזורים' })
    expect(nav.textContent).toContain('בקאנד')
    expect(nav.textContent).toContain('פולסטאק')
    expect(document.documentElement.dir).toBe('rtl')

    // The toggle names the other language in its own script.
    const toggle = document.querySelector('[data-language-toggle]') as HTMLButtonElement
    expect(toggle.textContent).toBe('EN')
    fireEvent.click(toggle)
    await waitFor(() => expect(getLang()).toBe('en'))
    expect(await screen.findByRole('navigation', { name: 'Sections' })).toBeTruthy()
    expect(document.documentElement.dir).toBe('ltr')
    expect((document.querySelector('[data-language-toggle]') as HTMLElement).textContent).toBe('עב')
  })

  it('keeps Config in English, left to right, while the site is in Hebrew', async () => {
    window.history.replaceState({}, '', '/?tab=admin')
    await setLang('he')
    render(<App />)
    await screen.findByRole('navigation', { name: 'אזורים' })
    const configRoot = document.querySelector('main [lang="en"][dir="ltr"]')
    expect(configRoot).not.toBeNull()
  })

  it('opens the Guide in the site language, and its own toggle switches the site', async () => {
    window.history.replaceState({}, '', '/')
    await setLang('he')
    render(<App />)
    const nav = await screen.findByRole('navigation', { name: 'אזורים' })
    fireEvent.click(Array.from(nav.querySelectorAll('button')).find(b => b.textContent?.includes('מדריך'))!)
    expect(await screen.findByText('מדריך מנהל')).toBeTruthy()
    // Guide's own toggle (EN) turns the whole site back to English.
    await act(async () => { fireEvent.click(screen.getByTitle('Switch to English')) })
    await waitFor(() => expect(getLang()).toBe('en'))
    expect(await screen.findByText('Admin Guide')).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'Sections' })).toBeTruthy()
  })
})
