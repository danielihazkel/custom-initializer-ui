import type { PreviewFile } from '../types'
import type { AppAsset, AppPayload } from './protocol'

/** Where the backend serves the preview runtime (see the backend's DesignRuntimeFilter). */
export const RUNTIME_URL = '/design-runtime/index.html'

const TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  woff2: 'font/woff2',
  woff: 'font/woff',
}

function bytesOf(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

/** A cheap, stable id for a payload: the same generated files give the same ref, so the runtime
 *  restarts instead of recompiling. */
function refOf(text: string): string {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return `app-${(h >>> 0).toString(36)}-${text.length.toString(36)}`
}

/**
 * The runtime's payload from a `POST /starter-fullstack.preview?assets=true` answer: the
 * frontend's text files with their `[<artifact>/]frontend/` prefix dropped, its binaries
 * (`public/**`, `src/assets/**`, sent as base64) as bytes, and the `menora-model.json` the zip
 * carries — which seeds the runtime's sample data. Null when the answer has no frontend.
 */
export function payloadFromPreview(previewFiles: PreviewFile[]): AppPayload | null {
  const files: Record<string, string> = {}
  const assets: AppAsset[] = []
  let model: unknown = null
  let signature = ''
  for (const file of previewFiles) {
    const inFrontend = file.path.match(/^(?:[^/]+\/)?frontend\/(.+)$/)
    if (inFrontend) {
      const path = inFrontend[1]
      if (file.base64) {
        const ext = path.split('.').pop()?.toLowerCase() ?? ''
        assets.push({ path, type: TYPES[ext] ?? 'application/octet-stream', data: bytesOf(file.base64) })
        signature += `${path}:${file.base64.length};`
      } else if (path === 'index.html' || path.startsWith('src/')) {
        files[path] = file.content
        signature += `${path}\n${file.content}\n`
      }
    } else if (/(^|\/)menora-model\.json$/.test(file.path)) {
      try {
        model = JSON.parse(file.content)
      } catch {
        model = null
      }
    }
  }
  if (!files['src/main.tsx']) return null
  return { ref: refOf(signature), files, model, assets }
}

/** The page id a route names: `#/orders/12?status=OPEN` → `orders`; '' for the app's start. */
export function pageIdOfHash(hash: string): string {
  return hash.replace(/^#\/?/, '').split(/[/?]/)[0] ?? ''
}
