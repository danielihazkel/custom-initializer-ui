import { describe, it, expect, vi } from 'vitest'
import { useLayoutEffect, useRef, useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { handleRadioKeys, syncRadioTabStops } from './rovingRadios'

function Group({ onPick }: { onPick: (v: string) => void }) {
  const [value, setValue] = useState('b')
  const root = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => syncRadioTabStops(root.current))
  return (
    <div ref={root} onKeyDown={handleRadioKeys}>
      <div role="radiogroup" aria-label="Size">
        {['a', 'b', 'c'].map(v => (
          <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => { setValue(v); onPick(v) }}>{v}</button>
        ))}
      </div>
      <div role="radiogroup" aria-label="Nothing picked">
        <button type="button" role="radio" aria-checked={false} disabled>x</button>
        <button type="button" role="radio" aria-checked={false}>y</button>
      </div>
    </div>
  )
}

describe('roving radios', () => {
  it('makes each group one Tab stop and walks it with the arrow keys', () => {
    const onPick = vi.fn()
    render(<Group onPick={onPick} />)
    const [a, b, c] = ['a', 'b', 'c'].map(n => screen.getByRole('radio', { name: n }))
    expect([a.tabIndex, b.tabIndex, c.tabIndex]).toEqual([-1, 0, -1])
    // No option picked: the first enabled one holds the stop.
    expect(screen.getByRole('radio', { name: 'y' }).tabIndex).toBe(0)

    b.focus()
    fireEvent.keyDown(b, { key: 'ArrowRight' })
    expect(onPick).toHaveBeenLastCalledWith('c')
    expect(document.activeElement).toBe(c)
    expect([a.tabIndex, b.tabIndex, c.tabIndex]).toEqual([-1, -1, 0])
    // Wraps round, and Home/End jump to the ends.
    fireEvent.keyDown(c, { key: 'ArrowDown' })
    expect(onPick).toHaveBeenLastCalledWith('a')
    fireEvent.keyDown(a, { key: 'End' })
    expect(onPick).toHaveBeenLastCalledWith('c')
    fireEvent.keyDown(c, { key: 'Enter' })
    expect(onPick).toHaveBeenCalledTimes(3)
  })
})
