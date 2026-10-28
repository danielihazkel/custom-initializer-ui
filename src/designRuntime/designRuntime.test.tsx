import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, act, cleanup } from '@testing-library/react'
import contract from '../components/fullstack/__fixtures__/design-contract.json'
import { PROTOCOL_VERSION, type AppPayload, type HostMessage } from './protocol'
import { pageIdOfHash, payloadFromPreview } from './payload'
import { PreviewFrame, READY_TIMEOUT_MS } from './PreviewFrame'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('design runtime protocol', () => {
  it('speaks the protocol the backend ships (contract fixture)', () => {
    expect(PROTOCOL_VERSION).toBe((contract as { runtimeProtocol: number }).runtimeProtocol)
  })
})

describe('payloadFromPreview', () => {
  const files = [
    { path: 'menora-model.json', content: '{"format":"menora-fullstack-request/1","request":{"entities":[]}}' },
    { path: 'README.md', content: '# demo' },
    { path: 'backend/pom.xml', content: '<project/>' },
    { path: 'frontend/index.html', content: '<html lang="he" dir="rtl"></html>' },
    { path: 'frontend/package.json', content: '{}' },
    { path: 'frontend/src/main.tsx', content: 'import App from "./app/App"' },
    { path: 'frontend/public/logo.png', content: '[binary file]', base64: btoa('\x89PNG') },
  ]

  it('takes the frontend’s sources, binaries and the model', () => {
    const app = payloadFromPreview(files)!
    expect(Object.keys(app.files).sort()).toEqual(['index.html', 'src/main.tsx'])
    expect(app.model).toEqual({ format: 'menora-fullstack-request/1', request: { entities: [] } })
    expect(app.assets).toHaveLength(1)
    expect(app.assets![0]).toMatchObject({ path: 'public/logo.png', type: 'image/png' })
    expect(new Uint8Array(app.assets![0].data)[1]).toBe('P'.charCodeAt(0))
  })

  it('gives the same files the same ref, and other files another', () => {
    expect(payloadFromPreview(files)!.ref).toBe(payloadFromPreview(files)!.ref)
    const edited = files.map(f => (f.path === 'frontend/src/main.tsx' ? { ...f, content: f.content + ';' } : f))
    expect(payloadFromPreview(edited)!.ref).not.toBe(payloadFromPreview(files)!.ref)
    // Under an artifact folder too.
    expect(payloadFromPreview(files.map(f => ({ ...f, path: `demo/${f.path}` })))!.files['src/main.tsx']).toBeTruthy()
  })

  it('is null without a frontend', () => {
    expect(payloadFromPreview([{ path: 'backend/pom.xml', content: '' }])).toBeNull()
  })

  it('reads the page id of a route', () => {
    expect(pageIdOfHash('#/orders/12?status=OPEN')).toBe('orders')
    expect(pageIdOfHash('#/desk')).toBe('desk')
    expect(pageIdOfHash('')).toBe('')
  })
})

describe('PreviewFrame', () => {
  const app: AppPayload = { ref: 'a1', files: { 'src/main.tsx': '' }, model: null }

  function mount(props: Partial<Parameters<typeof PreviewFrame>[0]> = {}) {
    const handlers = { onRoute: vi.fn(), onCompiled: vi.fn(), onUnavailable: vi.fn(), onRuntimeError: vi.fn() }
    const view = render(<PreviewFrame app={app} hash="#/desk" {...handlers} {...props} />)
    const iframe = view.container.querySelector('iframe')!
    const sent: HostMessage[] = []
    vi.spyOn(iframe.contentWindow!, 'postMessage').mockImplementation((m: unknown) => { sent.push(m as HostMessage) })
    const fromRuntime = (data: unknown, source: unknown = iframe.contentWindow) =>
      act(() => { window.dispatchEvent(new MessageEvent('message', { data, source: source as Window })) })
    return { ...view, iframe, sent, fromRuntime, handlers }
  }

  it('is a sandbox without same-origin rights', () => {
    const { iframe } = mount()
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts allow-forms')
    expect(iframe.getAttribute('src')).toBe('/design-runtime/index.html')
  })

  it('loads the app once the runtime is ready, then sends only what changed', () => {
    const { sent, fromRuntime, rerender, handlers } = mount()
    expect(sent).toEqual([])
    fromRuntime({ type: 'ready', protocol: PROTOCOL_VERSION, selfCheck: {} })
    expect(sent).toEqual([{ type: 'load', app, hash: '#/desk', dataState: 'data', dark: undefined, css: undefined }])

    fromRuntime({ type: 'route', hash: '#/desk' })
    expect(handlers.onRoute).toHaveBeenCalledWith('#/desk')
    // Another page: navigate. The page the app is already on: leave it alone.
    rerender(<PreviewFrame app={app} hash="#/orders" {...handlers} />)
    expect(sent[sent.length - 1]).toEqual({ type: 'navigate', hash: '#/orders' })
    fromRuntime({ type: 'route', hash: '#/orders/7' })
    const count = sent.length
    rerender(<PreviewFrame app={app} hash="#/orders" dataState="empty" {...handlers} />)
    expect(sent.slice(count)).toEqual([{ type: 'dataState', state: 'empty' }])

    // The same app again is not reloaded; a new one is, on the page the app is on.
    rerender(<PreviewFrame app={app} hash="#/orders" dataState="empty" {...handlers} />)
    expect(sent.filter(m => m.type === 'load')).toHaveLength(1)
    rerender(<PreviewFrame app={{ ...app, ref: 'a2' }} hash="#/orders" dataState="empty" {...handlers} />)
    expect(sent[sent.length - 1]).toMatchObject({ type: 'load', hash: '#/orders/7', dataState: 'empty' })

    fromRuntime({ type: 'compiled', ref: 'a2', ok: true, errors: [], ms: { modules: 1, tailwind: 1, total: 2 }, files: 1, cssBytes: 1 })
    expect(handlers.onCompiled).toHaveBeenCalledWith({ ok: true, errors: [], ms: { modules: 1, tailwind: 1, total: 2 }, files: 1 })
    fromRuntime({ type: 'runtimeError', message: 'boom', path: 'src/app/App.tsx' })
    expect(handlers.onRuntimeError).toHaveBeenCalledWith('boom', 'src/app/App.tsx')
  })

  it('sets up the editing layer with the first load, sends its changes, and hands its intents over', () => {
    const onDesign = vi.fn()
    const design = { pageType: 'dashboard', selected: 'widget.1', problems: {}, drag: null }
    const { sent, fromRuntime, rerender, handlers } = mount({ design, onDesign })
    fromRuntime({ type: 'ready', protocol: PROTOCOL_VERSION, selfCheck: {} })
    expect(sent.map(m => m.type)).toEqual(['design', 'load'])
    expect(sent[0]).toEqual({ type: 'design', design })
    // An equal state is not sent again; a new one is; null hands the clicks back to the app.
    rerender(<PreviewFrame app={app} hash="#/desk" design={{ ...design }} onDesign={onDesign} {...handlers} />)
    expect(sent).toHaveLength(2)
    rerender(<PreviewFrame app={app} hash="#/desk" design={{ ...design, selected: null }} onDesign={onDesign} {...handlers} />)
    expect(sent[sent.length - 1]).toEqual({ type: 'design', design: { ...design, selected: null } })
    rerender(<PreviewFrame app={app} hash="#/desk" onDesign={onDesign} {...handlers} />)
    expect(sent[sent.length - 1]).toEqual({ type: 'design', design: null })

    fromRuntime({ type: 'pick', control: 'widget.2' })
    fromRuntime({ type: 'reorder', from: 0, to: 2 })
    expect(onDesign.mock.calls.map(c => c[0])).toEqual([{ type: 'pick', control: 'widget.2' }, { type: 'reorder', from: 0, to: 2 }])
    expect(handlers.onRoute).not.toHaveBeenCalled()

    // A key pressed in the app comes back out of the frame element, for the host's shortcuts.
    const keys: string[] = []
    document.addEventListener('keydown', e => keys.push(`${e.ctrlKey ? 'Ctrl+' : ''}${e.key}`), { once: true })
    fromRuntime({ type: 'key', key: 'z', code: 'KeyZ', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false })
    expect(keys).toEqual(['Ctrl+z'])
  })

  it('ignores messages from anything but its own runtime', () => {
    const { sent, fromRuntime } = mount()
    fromRuntime({ type: 'ready', protocol: PROTOCOL_VERSION, selfCheck: {} }, window)
    expect(sent).toEqual([])
  })

  it('gives up on a runtime of another protocol, or one that never answers', () => {
    const other = mount()
    other.fromRuntime({ type: 'ready', protocol: PROTOCOL_VERSION + 1, selfCheck: {} })
    expect(other.handlers.onUnavailable).toHaveBeenCalledWith(expect.stringContaining(`protocol ${PROTOCOL_VERSION + 1}`))
    expect(other.sent).toEqual([])
    cleanup()

    vi.useFakeTimers()
    const silent = mount()
    act(() => { vi.advanceTimersByTime(READY_TIMEOUT_MS + 1) })
    expect(silent.handlers.onUnavailable).toHaveBeenCalledWith('The preview runtime did not start.')
  })
})
