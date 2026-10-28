import { useEffect, useRef, type CSSProperties } from 'react'
import { PROTOCOL_VERSION, type AppPayload, type CompileError, type DataState, type DesignState, type HostMessage, type RuntimeMessage } from './protocol'
import { RUNTIME_URL, pageIdOfHash } from './payload'

/** How long the runtime may take to say it is ready before the host gives up on it. */
export const READY_TIMEOUT_MS = 5000

export interface Compiled {
  ok: boolean
  errors: CompileError[]
  ms: { modules: number; tailwind: number; total: number }
  files: number
}

/** What the runtime's editing layer reports: the gestures of design mode. */
export type DesignIntent = Extract<RuntimeMessage, { type: 'pick' | 'pickPage' | 'rename' | 'reorder' | 'resize' | 'drop' | 'tool' }>
const DESIGN_INTENTS = new Set<string>(['pick', 'pickPage', 'rename', 'reorder', 'resize', 'drop', 'tool'])

export interface PreviewFrameProps {
  app: AppPayload | null
  /** The route to show. A new one is opened only when it names another page than the app is on,
   *  so the app's own moves inside a page (a record id, a tab, filters) are left alone. */
  hash?: string
  dataState?: DataState
  dark?: boolean
  /** CSS laid over the app's stylesheet (live token edits). */
  css?: string
  onRoute?: (hash: string) => void
  onCompiled?: (compiled: Compiled) => void
  onRuntimeError?: (message: string, path?: string) => void
  /** The runtime did not come up (no answer in time, or another protocol version). */
  onUnavailable?: (reason: string) => void
  /** Design mode's editing layer over the app (null or absent: the app takes its own clicks). */
  design?: DesignState | null
  onDesign?: (intent: DesignIntent) => void
  title?: string
  className?: string
  style?: CSSProperties
}

/**
 * The generated app, running in the design preview runtime: an `<iframe sandbox="allow-scripts
 * allow-forms">` (an opaque origin — it cannot read this page, its storage or cookies, and the
 * backend's CSP gives it no network) that compiles and runs the app's own files. Talks to it
 * only through the postMessage protocol in ./protocol.ts.
 */
export function PreviewFrame({ app, hash, dataState = 'data', dark, css, onRoute, onCompiled, onRuntimeError, onUnavailable, design = null, onDesign, title = 'App preview', className, style }: PreviewFrameProps) {
  const frame = useRef<HTMLIFrameElement>(null)
  const ready = useRef(false)
  const loaded = useRef<string | null>(null)
  const route = useRef('')
  const sent = useRef<{ hash?: string; dataState: DataState; dark?: boolean; css?: string; design: string }>({ dataState, design: 'null' })
  const latest = useRef({ app, hash, dataState, dark, css, design, onRoute, onCompiled, onRuntimeError, onUnavailable, onDesign })
  latest.current = { app, hash, dataState, dark, css, design, onRoute, onCompiled, onRuntimeError, onUnavailable, onDesign }

  const post = (message: HostMessage) => frame.current?.contentWindow?.postMessage(message, '*')

  function load() {
    const { app: next, hash: h, dataState: state, dark: d, css: c } = latest.current
    if (!ready.current || !next || loaded.current === next.ref) return
    loaded.current = next.ref
    // Keep the page the app is on across a reload of the same layout.
    const open = route.current && (!h || pageIdOfHash(h) === pageIdOfHash(route.current)) ? route.current : h ?? ''
    const designState = JSON.stringify(latest.current.design)
    // The editing layer outlives loads; the first one sets it up.
    if (sent.current.design !== designState) post({ type: 'design', design: latest.current.design })
    sent.current = { hash: h, dataState: state, dark: d, css: c, design: designState }
    post({ type: 'load', app: next, hash: open, dataState: state, dark: d, css: c })
  }

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!frame.current || event.source !== frame.current.contentWindow) return
      const message = event.data as RuntimeMessage
      const cb = latest.current
      if (message?.type === 'key') {
        // The host's shortcuts listen on its own document: replay the key from the frame element.
        const { key, code, ctrlKey, metaKey, shiftKey, altKey } = message
        frame.current.dispatchEvent(new KeyboardEvent('keydown', { key, code, ctrlKey, metaKey, shiftKey, altKey, bubbles: true, cancelable: true }))
        return
      }
      if (message && DESIGN_INTENTS.has(message.type)) {
        cb.onDesign?.(message as DesignIntent)
        return
      }
      switch (message?.type) {
        case 'ready':
          if (message.protocol !== PROTOCOL_VERSION) {
            cb.onUnavailable?.(`The preview runtime speaks protocol ${message.protocol}; this page expects ${PROTOCOL_VERSION}.`)
            return
          }
          ready.current = true
          load()
          break
        case 'compiled':
          cb.onCompiled?.({ ok: message.ok, errors: message.errors, ms: message.ms, files: message.files })
          break
        case 'route':
          route.current = message.hash
          cb.onRoute?.(message.hash)
          break
        case 'runtimeError':
          cb.onRuntimeError?.(message.message, message.path)
          break
      }
    }
    window.addEventListener('message', onMessage)
    const timer = setTimeout(() => {
      if (!ready.current) latest.current.onUnavailable?.('The preview runtime did not start.')
    }, READY_TIMEOUT_MS)
    return () => {
      window.removeEventListener('message', onMessage)
      clearTimeout(timer)
    }
  }, [])

  useEffect(load, [app])

  useEffect(() => {
    if (!ready.current || loaded.current == null) return
    const last = sent.current
    if (hash != null && hash !== last.hash) {
      last.hash = hash
      if (pageIdOfHash(hash) !== pageIdOfHash(route.current)) post({ type: 'navigate', hash })
    }
    if (dataState !== last.dataState) {
      last.dataState = dataState
      post({ type: 'dataState', state: dataState })
    }
    if (dark != null && dark !== last.dark) {
      last.dark = dark
      post({ type: 'theme', dark })
    }
    if (css != null && css !== last.css) {
      last.css = css
      post({ type: 'css', css })
    }
    const designState = JSON.stringify(design)
    if (designState !== last.design) {
      last.design = designState
      post({ type: 'design', design })
    }
  }, [hash, dataState, dark, css, design])

  return (
    <iframe
      ref={frame}
      src={RUNTIME_URL}
      sandbox="allow-scripts allow-forms"
      title={title}
      className={className}
      style={{ border: 0, display: 'block', ...style }}
      data-preview-frame
    />
  )
}

/** Restarts the app with fresh sample data and settings. */
export function resetPreview(iframe: HTMLIFrameElement | null) {
  iframe?.contentWindow?.postMessage({ type: 'reset' } satisfies HostMessage, '*')
}
