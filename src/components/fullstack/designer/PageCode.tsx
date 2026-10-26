import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import type { FullstackPageDef, FullstackStarterRequest, PreviewFile } from '../../../types'
import { readErrorBody } from '../../../utils/previewErrors'
import { PAGE_CODE_ROLE, pageCodeFiles } from '../pageCode'
import { SMALL_BUTTON } from '../pages/constants'

const ReadOnlyCodeViewer = lazy(() => import('../../ReadOnlyCodeViewer').then(m => ({ default: m.ReadOnlyCodeViewer })))

/** How long the model must sit still before the preview is asked again. */
export const PAGE_CODE_DEBOUNCE_MS = 600

interface Fetched {
  key: string
  files?: PreviewFile[]
  error?: string
}

/**
 * The inspector's Code tab: the selected page's generated screen (and what it is wired to), read
 * from `POST /starter-fullstack.preview` for the model as it stands. Asked once on opening, then
 * again a moment after each edit; the last answer stays on screen, dimmed, while the next is on
 * its way. A layout with problems is not sent — the generator would only turn it down.
 */
export function PageCode({ page, pages, request, problems }: {
  page: FullstackPageDef
  pages: FullstackPageDef[]
  request: FullstackStarterRequest
  /** The layout's problems; while there are any, nothing is fetched. */
  problems: number
}) {
  const key = JSON.stringify(request)
  const [fetched, setFetched] = useState<Fetched | null>(null)
  const [loading, setLoading] = useState(false)
  const [retry, setRetry] = useState(0)
  // The file picked, per page: another page opens on its own screen.
  const [picked, setPicked] = useState<{ page: string; path: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const shown = useRef(false)
  shown.current = fetched != null

  useEffect(() => {
    if (problems > 0) return
    const ctrl = new AbortController()
    // The first answer is wanted at once; later ones wait for the typing to stop.
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch('/starter-fullstack.preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: key,
          signal: ctrl.signal,
        })
        if (!res.ok) {
          const err = await readErrorBody(res)
          if (!ctrl.signal.aborted) setFetched(prev => ({ key, files: prev?.files, error: err.message }))
          return
        }
        const data = await res.json() as { files?: PreviewFile[] }
        if (!ctrl.signal.aborted) setFetched({ key, files: data.files ?? [] })
      } catch (err) {
        if (ctrl.signal.aborted) return
        setFetched(prev => ({ key, files: prev?.files, error: err instanceof Error ? err.message : String(err) }))
      } finally {
        if (!ctrl.signal.aborted) setLoading(false)
      }
    }, shown.current ? PAGE_CODE_DEBOUNCE_MS : 0)
    return () => { clearTimeout(timer); ctrl.abort() }
  }, [key, problems, retry])

  const files = pageCodeFiles(page, pages, fetched?.files)
  const active = files.find(f => picked?.page === page.id && f.path === picked.path) ?? files[0]
  const stale = fetched != null && (fetched.key !== key || problems > 0)

  async function copy() {
    if (!active) return
    try {
      await navigator.clipboard.writeText(active.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // No clipboard (an insecure origin): the viewer's text can still be selected by hand.
    }
  }

  return (
    <div className="space-y-2" data-page-code>
      <p className="flex items-center gap-1.5 text-[11px] text-secondary" role="status" data-page-code-status>
        {problems > 0 ? (
          <>
            <span className="material-symbols-outlined text-error" style={{ fontSize: '14px' }} aria-hidden="true">error</span>
            Fix the {problems} problem{problems === 1 ? '' : 's'} first — the generator turns down a layout with problems.
          </>
        ) : loading ? (
          <>
            <span className="material-symbols-outlined animate-spin" style={{ fontSize: '14px' }} aria-hidden="true">progress_activity</span>
            {fetched ? 'Updating…' : 'Generating…'}
          </>
        ) : stale ? (
          <>
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">update</span>
            Updating after your edit…
          </>
        ) : (
          <>
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">code</span>
            What Generate writes for this page, read-only.
          </>
        )}
      </p>

      {fetched?.error && fetched.key === key && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-error/40 bg-error/5 px-3 py-2 text-[11px] text-error" role="alert" data-page-code-error>
          <span className="min-w-0 flex-1">The generator said: {fetched.error}</span>
          <button type="button" onClick={() => setRetry(n => n + 1)} className="font-semibold underline">Try again</button>
        </div>
      )}

      {fetched?.files && files.length === 0 && !stale && !fetched.error && (
        <p className="rounded-lg border border-outline-variant bg-background/50 px-3 py-3 text-[11px] text-secondary" data-page-code-empty>
          The preview has no screen for this page. A page needs an id to become a route.
        </p>
      )}

      {active && (
        <div className={`overflow-hidden rounded-lg border border-outline-variant bg-background/50 transition-opacity ${stale ? 'opacity-60' : ''}`}>
          <div className="flex flex-wrap gap-1 border-b border-outline-variant px-2 py-1.5" role="tablist" aria-label="Generated files">
            {files.map(file => (
              <button
                key={file.path}
                type="button"
                role="tab"
                aria-selected={file.path === active.path}
                onClick={() => setPicked({ page: page.id, path: file.path })}
                title={`${PAGE_CODE_ROLE[file.role]} — ${file.path}`}
                className={`rounded px-2 py-1 font-mono text-[11px] transition-colors ${
                  file.path === active.path ? 'bg-primary/10 font-semibold text-primary' : 'text-secondary hover:bg-primary/5 hover:text-on-surface'}`}
                data-page-code-file={file.role}
              >
                {file.name}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 border-b border-outline-variant px-3 py-1">
            <p className="min-w-0 flex-1 truncate text-[10px] text-secondary" title={active.path}>
              <span className="font-semibold">{PAGE_CODE_ROLE[active.role]}</span> · <span className="font-mono">{active.path.replace(/^frontend\//, '')}</span>
            </p>
            <button type="button" onClick={copy} className={SMALL_BUTTON} aria-label={`Copy ${active.name}`}>
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }} aria-hidden="true">{copied ? 'check' : 'content_copy'}</span>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="max-h-[60vh] overflow-auto custom-scrollbar" data-page-code-path={active.path}>
            <Suspense fallback={<div className="p-4 text-[11px] text-secondary">Loading viewer…</div>}>
              <ReadOnlyCodeViewer code={active.content} targetPath={active.path} />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  )
}
