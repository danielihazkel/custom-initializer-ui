import type { ProjectRequest } from './projectUtils'

/** Wraps text for a POSIX shell: single-quoted, with each `'` written as `'\''`. */
function shellQuote(text: string): string {
  return `'${text.replace(/'/g, `'\\''`)}'`
}

/**
 * The `curl` command that makes the same call as a {@link ProjectRequest} — for "Copy as curl",
 * so a project can be regenerated from a script or a CI job without the UI.
 */
export function curlFor(request: ProjectRequest, origin: string, filename: string): string {
  const url = shellQuote(origin + request.url)
  if (request.init.method === 'POST' && typeof request.init.body === 'string') {
    return `curl -o ${filename} -X POST -H 'Content-Type: application/json' -d ${shellQuote(request.init.body)} ${url}`
  }
  return `curl -o ${filename} ${url}`
}
