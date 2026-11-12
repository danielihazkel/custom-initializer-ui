import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextSteps } from './NextSteps'
import { BackendNextSteps, type BackendRun } from '../backend/BackendNextSteps'
import { useBusy } from '../../utils/busy'
import { registerCommands, runCommand } from '../../commands'

afterEach(() => vi.unstubAllGlobals())

describe('NextSteps', () => {
  it('lists the commands with a Copy each, the actions, and says when it is stale', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    const copied = vi.fn()
    const explore = vi.fn()
    const dismiss = vi.fn()
    const { rerender } = render(
      <NextSteps
        title="demo.zip is downloaded"
        commands={[{ label: 'Run', cmd: 'mvn spring-boot:run' }]}
        actions={[{ id: 'explore', label: 'Explore the files', icon: 'folder_open', onClick: explore }]}
        onDismiss={dismiss}
        onCopied={copied}
      />,
    )
    expect(screen.getByRole('region', { name: 'Next steps' })).toBeTruthy()
    expect(document.querySelector('[data-next-steps-stale]')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Copy Run command' }))
    await waitFor(() => expect(copied).toHaveBeenCalledWith(true, 'Run command'))
    expect(writeText).toHaveBeenCalledWith('mvn spring-boot:run')

    fireEvent.click(screen.getByRole('button', { name: /Explore the files/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss next steps' }))
    expect(explore).toHaveBeenCalledTimes(1)
    expect(dismiss).toHaveBeenCalledTimes(1)

    rerender(<NextSteps title="demo.zip is downloaded" stale commands={[]} actions={[]} onDismiss={dismiss} />)
    expect(document.querySelector('[data-next-steps-stale]')?.textContent).toMatch(/changed since/)
  })
})

describe('BackendNextSteps', () => {
  const run: BackendRun = { artifactId: 'orders', dependencyCount: 5, wizardCount: 1, moduleCount: 0, key: 'k' }
  const handlers = () => ({ onDismiss: vi.fn(), onSavePreset: vi.fn(), onCopyCurl: vi.fn(), onShareLink: vi.fn(), onExplore: vi.fn() })

  it('says what was made and how to run it', () => {
    render(<BackendNextSteps run={run} stale={false} {...handlers()} />)
    expect(screen.getByRole('heading', { name: 'orders.zip is downloaded — 5 dependencies, 1 wizard' })).toBeTruthy()
    expect(screen.getByText('unzip orders.zip -d orders && cd orders')).toBeTruthy()
    expect(screen.getByText('mvn spring-boot:run')).toBeTruthy()
  })

  it('counts modules for a multi-module project, and words one dependency', () => {
    render(<BackendNextSteps run={{ ...run, dependencyCount: 1, wizardCount: 0, moduleCount: 3 }} stale {...handlers()} />)
    expect(screen.getByRole('heading', { name: 'orders.zip is downloaded — 1 dependency, 3 modules' })).toBeTruthy()
    expect(document.querySelector('[data-next-steps-stale]')).toBeTruthy()
  })

  it('wires its four actions', () => {
    const h = handlers()
    render(<BackendNextSteps run={run} stale={false} {...h} />)
    fireEvent.click(screen.getByRole('button', { name: /Save as preset/ }))
    fireEvent.click(screen.getByRole('button', { name: /Copy as curl/ }))
    fireEvent.click(screen.getByRole('button', { name: /Copy share link/ }))
    fireEvent.click(screen.getByRole('button', { name: /Explore the files/ }))
    expect(h.onSavePreset).toHaveBeenCalledTimes(1)
    expect(h.onCopyCurl).toHaveBeenCalledTimes(1)
    expect(h.onShareLink).toHaveBeenCalledTimes(1)
    expect(h.onExplore).toHaveBeenCalledTimes(1)
  })
})

describe('useBusy', () => {
  function Busy({ a, b }: { a: boolean; b: boolean }) {
    useBusy(a)
    useBusy(b)
    return null
  }
  const busy = () => document.documentElement.hasAttribute('data-busy')

  it('marks the page while any request is out, and clears when the last one ends', () => {
    const { rerender, unmount } = render(<Busy a={false} b={false} />)
    expect(busy()).toBe(false)
    rerender(<Busy a b={false} />)
    expect(busy()).toBe(true)
    rerender(<Busy a b />)
    rerender(<Busy a={false} b />)
    expect(busy()).toBe(true)
    rerender(<Busy a={false} b={false} />)
    expect(busy()).toBe(false)
    rerender(<Busy a b={false} />)
    unmount()
    expect(busy()).toBe(false)
  })
})

describe('runCommand', () => {
  it('runs a registered action by id and says when there is none', () => {
    const save = vi.fn()
    const off = registerCommands([{ id: 'backend-save-preset', title: 'Save', icon: 'bookmark_add', group: 'Backend', run: save }], 'test')
    expect(runCommand('backend-save-preset')).toBe(true)
    expect(save).toHaveBeenCalledTimes(1)
    off()
    expect(runCommand('backend-save-preset')).toBe(false)
  })
})
