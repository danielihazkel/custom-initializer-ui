import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { FRONTEND_SHORTCUTS, FULLSTACK_SHORTCUTS, ShortcutsOverlay } from './ShortcutsOverlay'
import { setLang } from '../../i18n'

describe('ShortcutsOverlay', () => {
  it('lists every shortcut with its key', () => {
    render(<ShortcutsOverlay onClose={() => {}} />)
    const dialog = screen.getByRole('dialog', { name: 'Keyboard shortcuts' })
    for (const s of FULLSTACK_SHORTCUTS) {
      expect(dialog.textContent).toContain(s.keys)
      expect(dialog.textContent).toContain(s.action)
    }
    expect(FULLSTACK_SHORTCUTS.map(s => s.keys)).toEqual(expect.arrayContaining(['Ctrl+Enter', 'Ctrl+Shift+E', 'Ctrl+S', '?']))
  })

  it('reads in Hebrew once the site is in Hebrew, keys unchanged', async () => {
    await setLang('he')
    render(<ShortcutsOverlay onClose={() => {}} shortcuts={FRONTEND_SHORTCUTS} />)
    const dialog = screen.getByRole('dialog', { name: 'קיצורי מקלדת' })
    expect(dialog.textContent).toContain('הצגת הרשימה הזו')
    expect(dialog.textContent).toContain('Ctrl+Enter')
    expect(screen.getByRole('button', { name: 'סגור' })).toBeTruthy()
  })

  it('closes on Escape, on the close button and on the backdrop', () => {
    const onClose = vi.fn()
    render(<ShortcutsOverlay onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
