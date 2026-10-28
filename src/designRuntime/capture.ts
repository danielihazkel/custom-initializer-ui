import type { FullstackStarterRequest, PreviewFile } from '../types'
import { readErrorBody } from '../utils/previewErrors'
import { RUNTIME_URL, payloadFromPreview } from './payload'
import { PROTOCOL_VERSION, type AppPayload, type HostMessage, type RuntimeMessage } from './protocol'

/** A screen of the generated app as static markup (the runtime's `snapshot`). */
export interface ScreenCapture {
  html: string
  css: string
  lang: string
  dir: string
}

/** The generated frontend for `request`, as the runtime takes it — what `useAppPreview` fetches. */
export async function fetchAppPayload(request: FullstackStarterRequest): Promise<AppPayload> {
  const res = await fetch('/starter-fullstack.preview?assets=true', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  if (!res.ok) throw new Error((await readErrorBody(res)).message)
  const data = await res.json() as { files?: PreviewFile[] }
  const app = payloadFromPreview(data.files ?? [])
  if (!app) throw new Error('The generator returned no frontend for this model.')
  return app
}

/**
 * Runs `app` once in an offscreen runtime frame and captures each route in `hashes` (null for a
 * route that could not be captured): what the layout spec sheet shows of every page, drawn by
 * the app that ships. The frame is removed when done.
 */
export async function captureScreens(app: AppPayload, hashes: string[], { width = 1280, height = 900, timeoutMs = 20000 } = {}): Promise<(ScreenCapture | null)[]> {
  const frame = document.createElement('iframe')
  frame.src = RUNTIME_URL
  frame.setAttribute('sandbox', 'allow-scripts allow-forms')
  frame.setAttribute('aria-hidden', 'true')
  frame.tabIndex = -1
  Object.assign(frame.style, { position: 'fixed', left: '-10000px', top: '0', width: `${width}px`, height: `${height}px`, border: '0', visibility: 'hidden' })
  const waiting = new Map<string, (m: RuntimeMessage) => boolean>()
  const onMessage = (event: MessageEvent) => {
    if (event.source !== frame.contentWindow) return
    for (const [key, check] of waiting) if (check(event.data as RuntimeMessage)) waiting.delete(key)
  }
  const next = <T extends RuntimeMessage>(key: string, match: (m: RuntimeMessage) => m is T): Promise<T> =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => { waiting.delete(key); reject(new Error('The preview runtime did not answer.')) }, timeoutMs)
      waiting.set(key, m => {
        if (!match(m)) return false
        clearTimeout(timer)
        resolve(m)
        return true
      })
    })
  const post = (m: HostMessage) => frame.contentWindow?.postMessage(m, '*')
  window.addEventListener('message', onMessage)
  document.body.appendChild(frame)
  try {
    const ready = await next('ready', (m): m is Extract<RuntimeMessage, { type: 'ready' }> => m?.type === 'ready')
    if (ready.protocol !== PROTOCOL_VERSION) throw new Error(`The preview runtime speaks protocol ${ready.protocol}; this page expects ${PROTOCOL_VERSION}.`)
    const compiled = next('compiled', (m): m is Extract<RuntimeMessage, { type: 'compiled' }> => m?.type === 'compiled')
    post({ type: 'load', app, hash: hashes[0] ?? '' })
    await compiled
    const out: (ScreenCapture | null)[] = []
    for (const [i, hash] of hashes.entries()) {
      try {
        if (i > 0) post({ type: 'navigate', hash })
        const id = `shot-${i}`
        const shot = next(id, (m): m is Extract<RuntimeMessage, { type: 'snapshot' }> => m?.type === 'snapshot' && m.id === id)
        post({ type: 'snapshot', id })
        const { html, css, lang, dir } = await shot
        out.push({ html, css, lang, dir })
      } catch {
        out.push(null)
      }
    }
    return out
  } finally {
    window.removeEventListener('message', onMessage)
    frame.remove()
  }
}
