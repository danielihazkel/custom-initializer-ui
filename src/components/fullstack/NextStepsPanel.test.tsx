import { describe, it, expect, vi, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextStepsPanel, type GeneratedRun } from './NextStepsPanel'
import { DEFAULT_PROJECT_META } from './snapshot'

const run: GeneratedRun = {
  at: 1,
  artifactId: 'shop',
  entityCount: 2,
  endpoints: [
    { entity: 'Order', method: 'GET', path: '/api/orders' },
    { entity: 'Order', method: 'POST', path: '/api/orders' },
    { entity: 'Customer', method: 'GET', path: '/api/customers' },
  ],
  snapshot: { meta: DEFAULT_PROJECT_META, entities: [], selectedDeps: [], scaffoldOpts: [], backendSet: 'a', frontendSet: 'b' },
}

function renderPanel(over: Partial<Parameters<typeof NextStepsPanel>[0]> = {}) {
  const props = {
    run, stale: false, onDismiss: vi.fn(), onSavePreset: vi.fn(), onSaveTeam: vi.fn(), onCopyCurl: vi.fn(), onShareLink: vi.fn(), onCopied: vi.fn(),
    ...over,
  }
  render(<NextStepsPanel {...props} />)
  return props
}

afterEach(() => vi.unstubAllGlobals())

describe('NextStepsPanel', () => {
  it('shows the run commands, the endpoints grouped by entity and the counts', () => {
    renderPanel()
    expect(screen.getByRole('heading', { name: /shop\.zip is downloaded — 2 entities, 3 endpoints/ })).toBeTruthy()
    expect(screen.getByText('cd backend && mvn spring-boot:run')).toBeTruthy()
    expect(screen.getByText('cd frontend && npm install && npm run dev')).toBeTruthy()
    const endpoints = document.querySelector('[data-next-steps-endpoints]')!
    expect(endpoints.getAttribute('open')).not.toBeNull()
    expect(endpoints.textContent).toContain('Order')
    expect(endpoints.textContent).toContain('/api/customers')
    expect(screen.queryByText(/model has changed since/)).toBeNull()
  })

  it('flags a stale run and wires every action', () => {
    const props = renderPanel({ stale: true })
    expect(screen.getByText(/model has changed since/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Save as preset/ }))
    fireEvent.click(screen.getByRole('button', { name: /Save to Team/ }))
    fireEvent.click(screen.getByRole('button', { name: /Copy as curl/ }))
    fireEvent.click(screen.getByRole('button', { name: /Copy share link/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss next steps' }))
    expect(props.onSavePreset).toHaveBeenCalledTimes(1)
    expect(props.onSaveTeam).toHaveBeenCalledTimes(1)
    expect(props.onCopyCurl).toHaveBeenCalledTimes(1)
    expect(props.onShareLink).toHaveBeenCalledTimes(1)
    expect(props.onDismiss).toHaveBeenCalledTimes(1)
  })

  it('copies a command and reports the outcome', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    const props = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Copy Backend command' }))
    await waitFor(() => expect(props.onCopied).toHaveBeenCalledWith(true, 'Backend command'))
    expect(writeText).toHaveBeenCalledWith('cd backend && mvn spring-boot:run')
  })

  it('starts the endpoint list collapsed for larger models', () => {
    const big = { ...run, endpoints: ['A', 'B', 'C', 'D'].map(entity => ({ entity, method: 'GET', path: `/api/${entity.toLowerCase()}s` })) }
    renderPanel({ run: big })
    expect(document.querySelector('[data-next-steps-endpoints]')!.getAttribute('open')).toBeNull()
  })
})
