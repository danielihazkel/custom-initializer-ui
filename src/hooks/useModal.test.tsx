import { useRef, useState, StrictMode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useModal } from './useModal'
import { ConfirmDialog } from '../components/ConfirmDialog'

function Modal({ name, onClose, children }: { name: string; onClose?: () => void; children?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useModal(ref, { onClose })
  return (
    <div ref={ref} role="dialog" aria-label={name} tabIndex={-1}>
      <button>{name} first</button>
      <button>{name} last</button>
      {children}
    </div>
  )
}

function Page({ children }: { children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      {open && children(() => setOpen(false))}
    </>
  )
}

const tab = (shift = false) => fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Tab', shiftKey: shift })

describe('useModal', () => {
  it('moves focus in, keeps Tab inside, closes on Escape and gives focus back to the opener', () => {
    render(<Page>{close => <Modal name="Sheet" onClose={close} />}</Page>)
    const opener = screen.getByRole('button', { name: 'Open' })
    opener.focus()
    fireEvent.click(opener)

    const first = screen.getByRole('button', { name: 'Sheet first' })
    const last = screen.getByRole('button', { name: 'Sheet last' })
    expect(document.activeElement).toBe(first)

    // Tab off the end wraps to the start; Shift+Tab off the start wraps to the end.
    last.focus()
    tab()
    expect(document.activeElement).toBe(first)
    tab(true)
    expect(document.activeElement).toBe(last)

    // Focus that escaped to the page behind is pulled back in.
    opener.focus()
    tab()
    expect(document.activeElement).toBe(first)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(opener)
  })

  it('lets only the top modal answer Escape', () => {
    const closeUnder = vi.fn()
    const closeTop = vi.fn()
    const { rerender } = render(
      <>
        <Modal name="Under" onClose={closeUnder} />
        <Modal name="Top" onClose={closeTop} />
      </>,
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(closeTop).toHaveBeenCalledTimes(1)
    expect(closeUnder).not.toHaveBeenCalled()

    rerender(<Modal name="Under" onClose={closeUnder} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(closeUnder).toHaveBeenCalledTimes(1)
  })

  it('leaves Escape to an inner widget that already used it', () => {
    const close = vi.fn()
    render(
      <Modal name="Drawer" onClose={close}>
        <input aria-label="Picker" onKeyDown={e => { if (e.key === 'Escape') e.preventDefault() }} />
      </Modal>,
    )
    fireEvent.keyDown(screen.getByLabelText('Picker'), { key: 'Escape' })
    expect(close).not.toHaveBeenCalled()
  })

  it('stops the page scrolling while any modal is open, and restores it after the last one', () => {
    document.body.style.overflow = 'auto'
    const { rerender, unmount } = render(
      <>
        <Modal name="One" />
        <Modal name="Two" />
      </>,
    )
    expect(document.body.style.overflow).toBe('hidden')
    rerender(<Modal name="One" />)
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('auto')
    document.body.style.overflow = ''
  })

  it('keeps an autoFocus target, and returns focus to the opener even though it ran first', () => {
    // StrictMode, as in the app: the effect is mounted, cleaned up and mounted again.
    render(
      <StrictMode>
        <Page>
          {close => <ConfirmDialog title="Reset?" message="Sure?" confirmLabel="Reset" onConfirm={close} onCancel={close} />}
        </Page>
      </StrictMode>,
    )
    const opener = screen.getByRole('button', { name: 'Open' })
    opener.focus()
    fireEvent.click(opener)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Reset' }))

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(opener)
  })
})
