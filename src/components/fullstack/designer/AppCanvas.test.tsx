import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, act, cleanup, waitFor } from '@testing-library/react'
import type { FullstackStarterRequest } from '../../../types'
import { PROTOCOL_VERSION, type HostMessage } from '../../../designRuntime/protocol'
import { clearAppPreviewCache } from '../../../designRuntime/useAppPreview'
import { AppCanvas } from './AppCanvas'

const request = { artifactId: 'demo', entities: [] } as unknown as FullstackStarterRequest
const answer = {
  files: [
    { path: 'menora-model.json', content: '{"entities":[]}' },
    { path: 'frontend/src/main.tsx', content: 'export {}' },
  ],
}

beforeEach(() => {
  clearAppPreviewCache()
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(answer), { status: 200, headers: { 'content-type': 'application/json' } })))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function mount(req: FullstackStarterRequest | null) {
  const view = render(<AppCanvas request={req} device="desktop" hash="#/desk" fallback={<div data-sketch>sketch</div>} emptyReason="no model" />)
  const iframe = view.container.querySelector('iframe')
  const sent: HostMessage[] = []
  if (iframe) vi.spyOn(iframe.contentWindow!, 'postMessage').mockImplementation((m: unknown) => { sent.push(m as HostMessage) })
  const fromRuntime = (data: unknown) => act(() => { window.dispatchEvent(new MessageEvent('message', { data, source: iframe!.contentWindow })) })
  return { ...view, iframe, sent, fromRuntime }
}

describe('AppCanvas', () => {
  it('draws the sketch while the generated app starts, then the app once it has compiled', async () => {
    const { container, sent, fromRuntime } = mount(request)
    expect(container.querySelector('[data-sketch]')).toBeTruthy()
    expect(container.querySelector('[data-app-canvas]')?.getAttribute('data-app-canvas')).toBe('sketch')
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/starter-fullstack.preview?assets=true', expect.objectContaining({ method: 'POST', body: JSON.stringify(request) })))
    fromRuntime({ type: 'ready', protocol: PROTOCOL_VERSION, selfCheck: {} })
    await waitFor(() => expect(sent.some(m => m.type === 'load')).toBe(true))
    fromRuntime({ type: 'compiled', ref: 'x', ok: true, errors: [], ms: { modules: 1, tailwind: 1, total: 2 }, files: 2, cssBytes: 10 })
    expect(container.querySelector('[data-sketch]')).toBeNull()
    expect(container.querySelector('[data-app-canvas]')?.getAttribute('data-app-canvas')).toBe('app')
    // A file that did not compile is named.
    fromRuntime({ type: 'compiled', ref: 'x', ok: false, errors: [{ path: 'src/app/App.tsx', message: 'Unexpected token' }], ms: { modules: 1, tailwind: 1, total: 2 }, files: 2, cssBytes: 10 })
    expect(container.querySelector('[data-app-canvas-status]')?.textContent).toContain('src/app/App.tsx: Unexpected token')
  })

  it('keeps the sketch, with the reason, when the runtime is unavailable or the generator refuses', async () => {
    const other = mount(request)
    other.fromRuntime({ type: 'ready', protocol: PROTOCOL_VERSION + 1, selfCheck: {} })
    expect(other.container.querySelector('[data-sketch]')).toBeTruthy()
    expect(other.container.querySelector('[data-app-canvas-status]')?.textContent).toContain('Showing the sketch')
    cleanup()

    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Bad request', detail: "Page 'x': unknown entity" }), { status: 400 })))
    clearAppPreviewCache()
    const refused = mount(request)
    await waitFor(() => expect(refused.container.querySelector('[data-app-canvas-status]')?.textContent).toContain("Page 'x': unknown entity"))
    expect(refused.container.querySelector('[data-sketch]')).toBeTruthy()
  })

  it('asks nothing without a request', () => {
    const { container } = mount(null)
    expect(container.querySelector('[data-sketch]')).toBeTruthy()
    expect(container.querySelector('iframe')).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })
})
